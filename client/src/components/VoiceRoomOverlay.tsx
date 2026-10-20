import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Channel, User, AudioSettings } from '../types';
import { handleAvatarError } from '../utils/avatar';
import { socket } from '../socket';
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Monitor,
  MonitorOff,
  Video,
  VideoOff,
  Volume2,
  Users,
  Maximize2,
  Minimize2,
  Radio,
  Sparkles,
  X,
  Play,
  Menu,
  Loader2,
} from 'lucide-react';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

interface VoiceRoomOverlayProps {
  channel: Channel;
  connectedUsers: User[];
  currentUser: User;
  audioSettings?: AudioSettings;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
  onStartStream: (title?: string) => void;
  onStopStream: () => void;
  onOpenMobileMenu?: () => void;
}

export const VoiceRoomOverlay: React.FC<VoiceRoomOverlayProps> = ({
  channel,
  connectedUsers,
  currentUser,
  audioSettings,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onSpeakingChange,
  onStartStream,
  onStopStream,
  onOpenMobileMenu,
}) => {
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [streamQuality, setStreamQuality] = useState<'720p' | '1080p'>('720p');
  const [streamFps, setStreamFps] = useState<30 | 60>(30);
  const [streamTitle, setStreamTitle] = useState(`${currentUser.username} está transmitindo`);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // WebRTC mesh state & refs
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // WebRTC peer connection tracking
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Active members in this voice channel
  const members = connectedUsers.filter((u) => u.voiceChannelId === channel.id);
  const displayMembers = members.some((m) => m.id === currentUser.id)
    ? members
    : [currentUser, ...members];

  // Check if anyone is streaming in this room
  const streamingUser = displayMembers.find((m) => m.isStreaming) || (isScreenSharing ? currentUser : null);
  const activeScreenStream = isScreenSharing ? screenStreamRef.current : remoteScreenStream;

  // 1. WebRTC Peer Connection Helper
  const getOrCreatePeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc) return pc;

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(remoteUserId, pc);

    // Attach local microphone audio if available
    if (microphoneStreamRef.current) {
      const audioTrack = microphoneStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !currentUser.isMuted;
        try {
          const sender = pc.addTrack(audioTrack, microphoneStreamRef.current);
          audioSendersRef.current.set(remoteUserId, sender);
        } catch (err) {
          console.warn('Erro ao anexar áudio ao peer:', err);
        }
      }
    }

    // Attach local screen video if currently screen sharing
    if (screenStreamRef.current) {
      const videoTrack = screenStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const sender = pc.addTrack(videoTrack, screenStreamRef.current);
          screenSendersRef.current.set(remoteUserId, sender);
        } catch (err) {
          console.warn('Erro ao anexar tela ao peer:', err);
        }
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:signal', {
          to: remoteUserId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Receive incoming tracks (audio & video/screen)
    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        let audioEl = remoteAudiosRef.current.get(remoteUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          remoteAudiosRef.current.set(remoteUserId, audioEl);
        }
        audioEl.srcObject = event.streams[0] || new MediaStream([event.track]);
        audioEl.muted = Boolean(currentUser.isDeafened);
        const vol = Math.max(0, Math.min(1, (audioSettings?.outputVolume ?? 100) / 100));
        audioEl.volume = vol;
        audioEl.play().catch((err) => console.warn('Autoplay áudio remoto:', err));
      } else if (event.track.kind === 'video') {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteScreenStream(stream);

        event.track.onended = () => {
          setRemoteScreenStream(null);
        };
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const audioEl = remoteAudiosRef.current.get(remoteUserId);
        if (audioEl) {
          audioEl.srcObject = null;
          remoteAudiosRef.current.delete(remoteUserId);
        }
      }
    };

    return pc;
  }, [currentUser.isMuted, currentUser.isDeafened, audioSettings?.outputVolume]);

  // 2. WebRTC Signaling Listener
  useEffect(() => {
    const handleSignal = async (data: { from: string; signal: any }) => {
      const { from, signal } = data;
      if (!from || !signal || from === currentUser.id) return;

      try {
        const pc = getOrCreatePeerConnection(from);

        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));

          // Flush queued candidates
          const queued = pendingCandidatesRef.current.get(from) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(from);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('webrtc:signal', {
            to: from,
            signal: answer,
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));

          // Flush queued candidates
          const queued = pendingCandidatesRef.current.get(from) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(from);
        } else if (signal.type === 'candidate' && signal.candidate) {
          if (!pc.remoteDescription) {
            const list = pendingCandidatesRef.current.get(from) || [];
            list.push(signal.candidate);
            pendingCandidatesRef.current.set(from, list);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Erro ao processar sinal WebRTC:', err);
      }
    };

    socket.on('webrtc:signal', handleSignal);

    return () => {
      socket.off('webrtc:signal', handleSignal);
    };
  }, [currentUser.id, getOrCreatePeerConnection]);

  // 3. Connect to all peers in this voice room
  useEffect(() => {
    const otherMembers = members.filter((m) => m.id !== currentUser.id && !m.id.startsWith('bot-'));

    otherMembers.forEach(async (member) => {
      // Deterministic tie-breaker: user with higher ID initiates the offer
      if (currentUser.id > member.id) {
        const pc = getOrCreatePeerConnection(member.id);
        if (pc.signalingState === 'stable') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:signal', {
              to: member.id,
              signal: offer,
            });
          } catch (err) {
            console.warn('Erro ao criar oferta WebRTC:', err);
          }
        }
      }
    });

    // Clean up peers who left
    const currentMemberIds = new Set(members.map((m) => m.id));
    peerConnectionsRef.current.forEach((pc, peerId) => {
      if (!currentMemberIds.has(peerId)) {
        pc.close();
        peerConnectionsRef.current.delete(peerId);
        audioSendersRef.current.delete(peerId);
        screenSendersRef.current.delete(peerId);
        const audioEl = remoteAudiosRef.current.get(peerId);
        if (audioEl) {
          audioEl.srcObject = null;
          remoteAudiosRef.current.delete(peerId);
        }
      }
    });
  }, [connectedUsers, channel.id, currentUser.id, getOrCreatePeerConnection]);

  // 4. Remote Speaking Detection Indicator
  useEffect(() => {
    const handleRemoteSpeaking = (data: { userId: string; channelId: string; isSpeaking: boolean }) => {
      if (data.channelId === channel.id) {
        setSpeakingUsers((prev) => {
          const next = new Set(prev);
          if (data.isSpeaking) next.add(data.userId);
          else next.delete(data.userId);
          return next;
        });
      }
    };

    socket.on('voice:user_speaking', handleRemoteSpeaking);
    return () => {
      socket.off('voice:user_speaking', handleRemoteSpeaking);
    };
  }, [channel.id]);

  // 5. Remote Stream Stopped Listener
  useEffect(() => {
    const handleStreamStopped = () => {
      setRemoteScreenStream(null);
    };
    socket.on('stream:stopped', handleStreamStopped);
    return () => {
      socket.off('stream:stopped', handleStreamStopped);
    };
  }, []);

  // 6. Microphone Setup & Volume Meter
  useEffect(() => {
    let isCancelled = false;

    async function setupMicrophone() {
      try {
        const audioConstraint =
          audioSettings?.inputDeviceId && audioSettings.inputDeviceId !== 'default'
            ? { deviceId: { exact: audioSettings.inputDeviceId } }
            : true;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        microphoneStreamRef.current = stream;

        // Apply mute state to track
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !currentUser.isMuted;
        });

        // Attach audio track to all active peer connections
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack && !audioSendersRef.current.has(peerId)) {
            try {
              const sender = pc.addTrack(audioTrack, stream);
              audioSendersRef.current.set(peerId, sender);
              if (pc.signalingState === 'stable' && currentUser.id > peerId) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('webrtc:signal', { to: peerId, signal: offer });
              }
            } catch (err) {
              console.warn('Erro ao adicionar track de áudio:', err);
            }
          }
        });

        // Setup local audio analyser for VU meter
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          if (isCancelled) return;
          if (currentUser.isMuted) {
            setIsSpeakingLocal(false);
            onSpeakingChange(false);
            animationFrameRef.current = requestAnimationFrame(checkVolume);
            return;
          }

          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          const speaking = average > 18;
          setIsSpeakingLocal(speaking);
          onSpeakingChange(speaking);

          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      } catch (err) {
        console.warn('Microfone não acessível:', err);
      }
    }

    setupMicrophone();

    return () => {
      isCancelled = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
        microphoneStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [audioSettings?.inputDeviceId]);

  // 7. Mute & Deafen Real-Time Handlers
  useEffect(() => {
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !currentUser.isMuted;
      });
    }
    if (currentUser.isMuted) {
      setIsSpeakingLocal(false);
      onSpeakingChange(false);
    }
  }, [currentUser.isMuted]);

  useEffect(() => {
    remoteAudiosRef.current.forEach((audio) => {
      audio.muted = Boolean(currentUser.isDeafened);
    });
  }, [currentUser.isDeafened]);

  useEffect(() => {
    const vol = Math.max(0, Math.min(1, (audioSettings?.outputVolume ?? 100) / 100));
    remoteAudiosRef.current.forEach((audio) => {
      audio.volume = vol;
    });
  }, [audioSettings?.outputVolume]);

  // 8. Bind Screen Video Stream to Player
  useEffect(() => {
    if (screenVideoRef.current && activeScreenStream) {
      if (screenVideoRef.current.srcObject !== activeScreenStream) {
        screenVideoRef.current.srcObject = activeScreenStream;
        screenVideoRef.current.play().catch((err) => {
          console.warn('Erro ao reproduzir stream da tela:', err);
        });
      }
    }
  }, [activeScreenStream]);

  // 9. Camera Video
  useEffect(() => {
    if (isVideoActive && cameraStreamRef.current && cameraVideoRef.current) {
      if (cameraVideoRef.current.srcObject !== cameraStreamRef.current) {
        cameraVideoRef.current.srcObject = cameraStreamRef.current;
        cameraVideoRef.current.play().catch((err) => {
          console.warn('Erro ao reproduzir câmera:', err);
        });
      }
    }
  }, [isVideoActive]);

  // 10. Start Screen Streaming (Go Live)
  const handleConfirmStartStream = async () => {
    setShowGoLiveModal(false);

    try {
      const constraints: DisplayMediaStreamOptions = {
        video: {
          width: streamQuality === '1080p' ? 1920 : 1280,
          height: streamQuality === '1080p' ? 1080 : 720,
          frameRate: streamFps,
        },
        audio: true,
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      screenStreamRef.current = stream;

      setIsScreenSharing(true);
      onStartStream(streamTitle);

      const videoTrack = stream.getVideoTracks()[0];

      // Send screen track to all connected WebRTC peers
      peerConnectionsRef.current.forEach(async (pc, peerId) => {
        try {
          const sender = pc.addTrack(videoTrack, stream);
          screenSendersRef.current.set(peerId, sender);

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:signal', { to: peerId, signal: offer });
        } catch (err) {
          console.warn('Erro ao transmitir tela para peer:', err);
        }
      });

      // Browser native banner stop button listener
      videoTrack.onended = () => {
        handleStopScreenShare();
      };
    } catch (err) {
      console.warn('Compartilhamento de tela cancelado ou falhou:', err);
    }
  };

  const handleStopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    // Remove video track from all peers and renegotiate
    peerConnectionsRef.current.forEach(async (pc, peerId) => {
      const sender = screenSendersRef.current.get(peerId);
      if (sender) {
        try {
          pc.removeTrack(sender);
          screenSendersRef.current.delete(peerId);

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:signal', { to: peerId, signal: offer });
        } catch (err) {
          console.warn('Erro ao remover track de tela do peer:', err);
        }
      }
    });

    setIsScreenSharing(false);
    onStopStream();
  };

  // Toggle Camera
  const handleToggleVideo = async () => {
    if (!isVideoActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStreamRef.current = stream;
        setIsVideoActive(true);
      } catch (err) {
        console.warn('Câmera não acessível:', err);
      }
    } else {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
      setIsVideoActive(false);
    }
  };

  // Fullscreen
  const handleToggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      remoteAudiosRef.current.forEach((audio) => {
        audio.srcObject = null;
      });
      remoteAudiosRef.current.clear();
      audioSendersRef.current.clear();
      screenSendersRef.current.clear();
    };
  }, []);

  return (
    <div
      ref={stageContainerRef}
      className="flex-1 h-full bg-[#111214] flex flex-col justify-between p-4 sm:p-6 select-none relative overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between z-10 flex-shrink-0 mb-3 gap-2">
        <div className="flex items-center gap-2 truncate min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-[var(--text-interactive)] hover:text-[var(--text-header)] hover:bg-[#2b2d31] rounded transition-colors cursor-pointer flex-shrink-0"
            title="Abrir Canais"
          >
            <Menu size={20} />
          </button>
          <Volume2 size={24} className="text-[#23a55a] flex-shrink-0" />
          <h2 className="text-base sm:text-xl font-bold text-[#f2f3f5] truncate">{channel.name}</h2>
          <span className="hidden sm:inline-block text-xs bg-[#23a55a]/20 text-[#23a55a] font-bold px-2 py-0.5 rounded whitespace-nowrap">
            Voz (WebRTC P2P)
          </span>
          {(isScreenSharing || streamingUser) && (
            <span className="bg-[#f23f43] text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1.5 animate-pulse whitespace-nowrap">
              <Radio size={12} /> AO VIVO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#949ba4] flex-shrink-0">
          <Users size={16} />
          <span>{displayMembers.length} <span className="hidden sm:inline">Conectados</span></span>
        </div>
      </div>

      {/* Main View: Screen Share Stage OR Grid of Users */}
      {isScreenSharing || streamingUser ? (
        /* SCREEN STREAMING ACTIVE STAGE */
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Top Participants Ribbon */}
          <div className="flex items-center gap-3 overflow-x-auto py-2 px-1 mb-2 scrollbar-none flex-shrink-0">
            {displayMembers.map((member) => {
              const isMe = member.id === currentUser.id;
              const speaking = isMe ? isSpeakingLocal : speakingUsers.has(member.id);

              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-2 bg-[#2b2d31]/80 backdrop-blur px-3 py-1.5 rounded-full border transition-all ${
                    speaking
                      ? 'border-[#23a55a] shadow-[0_0_12px_rgba(35,165,90,0.5)]'
                      : 'border-transparent'
                  }`}
                >
                  <img
                    src={member.avatar}
                    alt={member.username}
                    onError={(e) => handleAvatarError(e, member.id.startsWith('bot'))}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs font-medium text-[#f2f3f5] whitespace-nowrap">
                    {member.username} {isMe && '(Você)'}
                  </span>
                  {member.isStreaming && (
                    <span className="bg-[#f23f43] text-[9px] text-white font-extrabold px-1 rounded uppercase">
                      AO VIVO
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Large Screen Stream Player */}
          <div className="flex-1 bg-black rounded-2xl overflow-hidden relative group border border-[#2b2d31] flex items-center justify-center shadow-2xl">
            {activeScreenStream ? (
              <video
                ref={(el) => {
                  screenVideoRef.current = el;
                  if (el && activeScreenStream && el.srcObject !== activeScreenStream) {
                    el.srcObject = activeScreenStream;
                    el.play().catch((err) => console.warn('Erro ao reproduzir stream:', err));
                  }
                }}
                autoPlay
                playsInline
                muted={isScreenSharing || currentUser.isDeafened}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-[#949ba4] p-6 text-center">
                <Loader2 size={36} className="text-[#5865f2] animate-spin" />
                <p className="text-sm font-semibold text-[#f2f3f5]">
                  Conectando à transmissão ao vivo de {streamingUser?.username || 'outro usuário'}...
                </p>
                <span className="text-xs text-[#949ba4]">Aguardando sinal WebRTC P2P</span>
              </div>
            )}

            {/* Stream Top Overlay Banner */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 z-20">
              <img
                src={streamingUser?.avatar || currentUser.avatar}
                alt={streamingUser?.username || currentUser.username}
                onError={(e) => handleAvatarError(e, (streamingUser || currentUser).id.startsWith('bot'))}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="text-sm font-bold text-white">
                {streamingUser?.streamTitle || streamTitle}
              </span>
              <span className="bg-[#f23f43] text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                AO VIVO
              </span>
              <span className="bg-[#1e1f22] text-[#dbdee1] text-[11px] font-bold px-2 py-0.5 rounded">
                {streamQuality} {streamFps} FPS
              </span>
            </div>

            {/* Bottom Stream Controls Overlay on Hover */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 z-20">
              {isScreenSharing && (
                <button
                  onClick={handleStopScreenShare}
                  title="Parar de Transmitir"
                  className="bg-[#f23f43] hover:bg-[#da373c] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MonitorOff size={16} />
                  <span>Parar Transmissão</span>
                </button>
              )}
              <button
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* NORMAL USER CARDS GRID */
        <div className="flex-1 flex flex-col items-center justify-center my-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl w-full">
            {displayMembers.map((member) => {
              const isMe = member.id === currentUser.id;
              const speaking = isMe ? isSpeakingLocal : speakingUsers.has(member.id);

              return (
                <div
                  key={member.id}
                  className={`relative bg-[#2b2d31] rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-200 border-2 ${
                    speaking
                      ? 'border-[#23a55a] shadow-[0_0_20px_rgba(35,165,90,0.4)] scale-[1.02]'
                      : 'border-transparent shadow-lg'
                  }`}
                >
                  {/* User Camera Video if active */}
                  {isMe && isVideoActive ? (
                    <video
                      ref={(el) => {
                        cameraVideoRef.current = el;
                        if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                          el.srcObject = cameraStreamRef.current;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-32 h-32 rounded-full object-cover mb-4 ring-4 ring-[#23a55a]"
                    />
                  ) : (
                    <div className="relative mb-4">
                      <img
                        src={member.avatar}
                        alt={member.username}
                        onError={(e) => handleAvatarError(e, member.id.startsWith('bot'))}
                        className={`w-28 h-28 rounded-full object-cover transition-all duration-200 ${
                          speaking ? 'ring-4 ring-[#23a55a]' : 'ring-2 ring-transparent'
                        }`}
                      />
                      <div
                        className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-[#2b2d31] ${
                          member.status === 'online'
                            ? 'bg-[#23a55a]'
                            : member.status === 'idle'
                            ? 'bg-[#f0b232]'
                            : 'bg-[#f23f43]'
                        }`}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg text-[#f2f3f5]">
                      {member.username} {isMe && '(Você)'}
                    </span>
                    {member.isMuted && <MicOff size={16} className="text-[#f23f43]" />}
                  </div>

                  <span className="text-xs text-[#949ba4] mt-1">
                    {speaking ? 'Falando...' : member.customStatus || 'Conectado'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Voice Controls Bottom Toolbar */}
      <div className="flex items-center justify-center gap-3 bg-[#2b2d31]/90 backdrop-blur-md px-6 py-3 rounded-2xl mx-auto z-10 shadow-2xl border border-[#35373c] mt-3">
        {/* Toggle Mute */}
        <button
          onClick={onToggleMute}
          title={currentUser.isMuted ? 'Ativar Microfone' : 'Silenciar'}
          className={`p-3 rounded-full transition-all cursor-pointer ${
            currentUser.isMuted
              ? 'bg-[#f23f43] text-white hover:bg-[#da373c]'
              : 'bg-[#35373c] text-[#f2f3f5] hover:bg-[#404249]'
          }`}
        >
          {currentUser.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Toggle Deafen */}
        <button
          onClick={onToggleDeafen}
          title={currentUser.isDeafened ? 'Ativar Som' : 'Desativar Som'}
          className={`p-3 rounded-full transition-all cursor-pointer ${
            currentUser.isDeafened
              ? 'bg-[#f23f43] text-white hover:bg-[#da373c]'
              : 'bg-[#35373c] text-[#f2f3f5] hover:bg-[#404249]'
          }`}
        >
          <Headphones size={22} />
        </button>

        {/* Video Camera Toggle */}
        <button
          onClick={handleToggleVideo}
          title={isVideoActive ? 'Desativar Câmera' : 'Ligar Câmera'}
          className={`p-3 rounded-full transition-all cursor-pointer ${
            isVideoActive
              ? 'bg-[#23a55a] text-white hover:bg-[#1f9450]'
              : 'bg-[#35373c] text-[#f2f3f5] hover:bg-[#404249]'
          }`}
        >
          {isVideoActive ? <Video size={22} /> : <VideoOff size={22} />}
        </button>

        {/* Screen Share Button */}
        <button
          onClick={() => {
            if (isScreenSharing) {
              handleStopScreenShare();
            } else {
              setShowGoLiveModal(true);
            }
          }}
          title={isScreenSharing ? 'Parar Transmissão' : 'Transmitir sua Tela (Ao Vivo)'}
          className={`px-4 py-3 rounded-full font-bold flex items-center gap-2 transition-all cursor-pointer ${
            isScreenSharing
              ? 'bg-[#f23f43] text-white hover:bg-[#da373c]'
              : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
          }`}
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          <span className="text-sm">
            {isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
          </span>
        </button>

        {/* Disconnect Red Button */}
        <button
          onClick={onLeaveVoice}
          title="Desconectar do Canal"
          className="bg-[#35373c] hover:bg-[#f23f43] text-white p-3 rounded-full transition-all cursor-pointer"
        >
          <PhoneOff size={22} />
        </button>
      </div>

      {/* REUNI-AI "GO LIVE" MODAL */}
      {showGoLiveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn select-none">
          <div className="bg-[#313338] w-full max-w-lg rounded-xl shadow-2xl border border-[#1f2023] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 text-center relative border-b border-[#1f2023]/60 bg-[#2b2d31]">
              <button
                onClick={() => setShowGoLiveModal(false)}
                className="absolute right-4 top-4 text-[#949ba4] hover:text-[#f2f3f5] p-1.5 rounded-full hover:bg-[#35373c] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
              <div className="w-14 h-14 bg-[#5865f2] rounded-full flex items-center justify-center text-white mx-auto mb-3 shadow-lg">
                <Monitor size={30} />
              </div>
              <h2 className="text-xl font-bold text-[#f2f3f5] tracking-wide">
                TRANSMITIR AO VIVO
              </h2>
              <p className="text-xs text-[#949ba4] mt-1">
                Compartilhe sua tela, jogos ou janelas de aplicativos com todos no canal #{channel.name}.
              </p>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Stream Title */}
              <div>
                <label className="block text-xs font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                  Título da Transmissão
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="O que você está transmitindo?"
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded p-2.5 text-sm text-[#f2f3f5] outline-none focus:border-[#5865f2] transition-colors"
                />
              </div>

              {/* Quality Preset Buttons */}
              <div>
                <label className="block text-xs font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                  Qualidade da Transmissão
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStreamQuality('720p')}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      streamQuality === '720p'
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-white'
                        : 'bg-[#2b2d31] border-transparent text-[#949ba4] hover:bg-[#35373c]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#f2f3f5]">720p HD</span>
                      <span className="text-[10px] bg-[#404249] text-[#dbdee1] px-1.5 py-0.5 rounded font-bold">
                        Padrão
                      </span>
                    </div>
                    <span className="text-xs text-[#949ba4]">Ótimo equilíbrio e desempenho leve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStreamQuality('1080p')}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      streamQuality === '1080p'
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-white'
                        : 'bg-[#2b2d31] border-transparent text-[#949ba4] hover:bg-[#35373c]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#f2f3f5]">1080p Full HD</span>
                      <span className="text-[10px] bg-[#5865f2] text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                        <Sparkles size={10} /> Pro
                      </span>
                    </div>
                    <span className="text-xs text-[#949ba4]">Máxima nitidez para textos e games</span>
                  </button>
                </div>
              </div>

              {/* FPS Selector */}
              <div>
                <label className="block text-xs font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                  Taxa de Quadros (FPS)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStreamFps(30)}
                    className={`py-2 px-3 rounded-lg border font-semibold text-sm transition-all cursor-pointer ${
                      streamFps === 30
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-white'
                        : 'bg-[#2b2d31] border-transparent text-[#949ba4] hover:bg-[#35373c]'
                    }`}
                  >
                    30 FPS
                  </button>

                  <button
                    type="button"
                    onClick={() => setStreamFps(60)}
                    className={`py-2 px-3 rounded-lg border font-semibold text-sm transition-all cursor-pointer ${
                      streamFps === 60
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-white'
                        : 'bg-[#2b2d31] border-transparent text-[#949ba4] hover:bg-[#35373c]'
                    }`}
                  >
                    60 FPS
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-[#2b2d31] px-6 py-4 flex items-center justify-between border-t border-[#1f2023]">
              <button
                type="button"
                onClick={() => setShowGoLiveModal(false)}
                className="text-sm font-medium text-[#f2f3f5] hover:underline cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmStartStream}
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-bold text-sm px-6 py-2.5 rounded-md flex items-center gap-2 transition-colors cursor-pointer shadow-lg"
              >
                <Play size={16} fill="white" />
                <span>Transmitir ao Vivo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
