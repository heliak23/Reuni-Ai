import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Channel, User, AudioSettings, Message } from '../types';
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
  MessageSquare,
  Send,
  ExternalLink,
  Link as LinkIcon,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Public OpenRelay TURN server for bypassing Symmetric NAT and firewalls
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 10,
};

// Component to play remote audio in DOM without display:none to prevent browser audio throttling
const RemoteAudioPlayer: React.FC<{
  stream: MediaStream;
  isDeafened?: boolean;
  outputVolume?: number;
  outputDeviceId?: string;
}> = ({ stream, isDeafened, outputVolume = 100, outputDeviceId }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }

    const tryPlay = async () => {
      try {
        await el.play();
        console.log('[WebRTC] Áudio remoto conectado e reproduzindo com sucesso!');
      } catch (err) {
        console.warn('[WebRTC] Autoplay bloqueado pelo navegador, aguardando clique:', err);
      }
    };

    tryPlay();

    // Browser interaction unlock fallback
    const onUserInteraction = () => {
      el.play().catch(() => {});
    };
    window.addEventListener('click', onUserInteraction, { once: true });
    window.addEventListener('keydown', onUserInteraction, { once: true });
    return () => {
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
    };
  }, [stream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = Boolean(isDeafened);
    el.volume = Math.max(0, Math.min(1, outputVolume / 100));

    if ('setSinkId' in HTMLMediaElement.prototype && outputDeviceId && outputDeviceId !== 'default') {
      (el as any).setSinkId(outputDeviceId).catch(() => {});
    }
  }, [isDeafened, outputVolume, outputDeviceId]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

// Component to render video streams (camera / screen) with robust playback handling, unmute recovery and anti-freeze detection
const VideoStreamPlayer: React.FC<{
  stream: MediaStream;
  isMuted?: boolean;
  className?: string;
}> = ({ stream, isMuted = false, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTimeRef = useRef<number>(0);
  const frozenCountRef = useRef<number>(0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }

    const safePlay = () => {
      if (el) {
        el.play().catch(() => {});
      }
    };

    safePlay();

    // 1. Play when metadata is loaded
    const handleLoadedMetadata = () => {
      safePlay();
    };
    el.addEventListener('loadedmetadata', handleLoadedMetadata);

    // 2. Play and refresh pipeline when tracks unmute (crucial during renegotiation when both turn on camera)
    const videoTracks = stream.getVideoTracks();
    const handleUnmute = () => {
      console.log('[WebRTC Video] Faixa desmutada/reativada, garantindo reprodução contínua...');
      if (el) {
        el.srcObject = stream;
        safePlay();
      }
    };
    videoTracks.forEach((track) => {
      track.addEventListener('unmute', handleUnmute);
    });

    // 3. Auto-resume if the browser pauses the video while the stream is still active
    const handlePause = () => {
      const hasLiveTrack = stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
      if (hasLiveTrack && stream.active) {
        setTimeout(safePlay, 50);
      }
    };
    el.addEventListener('pause', handlePause);

    // 4. Heartbeat: monitors if video currentTime has stalled (frozen video frame) while track is live
    lastTimeRef.current = el.currentTime;
    frozenCountRef.current = 0;

    const intervalId = setInterval(() => {
      if (!el) return;
      const hasLiveTrack = stream.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted);
      if (!hasLiveTrack) return;

      if (el.paused) {
        safePlay();
        return;
      }

      // In WebRTC video playback, el.currentTime continuously increments.
      // If currentTime is frozen across consecutive checks while track is live, kick the video pipeline!
      if (el.currentTime > 0 && Math.abs(el.currentTime - lastTimeRef.current) < 0.001) {
        frozenCountRef.current += 1;
        if (frozenCountRef.current >= 2) {
          console.log('[WebRTC Video] Quadro congelado detectado (currentTime estático). Reiniciando pipeline...');
          el.srcObject = stream;
          safePlay();
          frozenCountRef.current = 0;
        }
      } else {
        frozenCountRef.current = 0;
        lastTimeRef.current = el.currentTime;
      }
    }, 1000);

    // 5. Browser interaction unlock fallback
    const onUserInteraction = () => {
      safePlay();
    };
    window.addEventListener('click', onUserInteraction, { once: true });
    window.addEventListener('keydown', onUserInteraction, { once: true });

    return () => {
      clearInterval(intervalId);
      el.removeEventListener('loadedmetadata', handleLoadedMetadata);
      el.removeEventListener('pause', handlePause);
      videoTracks.forEach((track) => {
        track.removeEventListener('unmute', handleUnmute);
      });
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isMuted}
      className={className}
    />
  );
};

interface VoiceRoomOverlayProps {
  channel: Channel;
  connectedUsers: User[];
  currentUser: User;
  audioSettings?: AudioSettings;
  messages?: Message[];
  onSendMessage?: (content: string) => void;
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
  messages = [],
  onSendMessage,
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

  // Voice Room Integrated Text & Link Chat
  const [chatText, setChatText] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChatOpen && messages && messages.length > 0) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSendVoiceText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (chatText.trim() && onSendMessage) {
      onSendMessage(chatText.trim());
      setChatText('');
    }
  };

  const renderMessageContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5865f2] hover:underline font-semibold inline-flex items-center gap-1 break-all cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
            <ExternalLink size={12} className="inline flex-shrink-0" />
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // WebRTC mesh state
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'idle'>('idle');

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // WebRTC references
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const cameraSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const trackMetadataRef = useRef<Map<string, 'camera' | 'screen'>>(new Map());
  const initiatedPeersRef = useRef<Set<string>>(new Set());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const peerRemovalTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Active members in this voice channel
  const members = connectedUsers.filter((u) => u.voiceChannelId === channel.id);
  const displayMembers = members.some((m) => m.id === currentUser.id)
    ? members
    : [{ ...currentUser, voiceChannelId: channel.id }, ...members];

  // Check if anyone is streaming in this room
  const streamingUser = displayMembers.find((m) => m.isStreaming) || (isScreenSharing ? currentUser : null);
  const activeScreenStream = isScreenSharing ? screenStreamRef.current : remoteScreenStream;

  // Helper to send offers with anti-glare flag tracking
  const sendOfferToPeer = useCallback(async (pc: RTCPeerConnection, peerId: string) => {
    try {
      makingOfferRef.current.set(peerId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:signal', {
        to: peerId,
        from: currentUser.id,
        signal: offer,
      });
      console.log(`[WebRTC] Oferta enviada para ${peerId}`);
    } catch (err) {
      console.warn(`[WebRTC] Erro ao criar/enviar oferta para ${peerId}:`, err);
    } finally {
      makingOfferRef.current.set(peerId, false);
    }
  }, [currentUser.id]);

  // 1. WebRTC Peer Connection Factory
  const getOrCreatePeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc) return pc;

    console.log(`[WebRTC] Criando conexão P2P com usuário: ${remoteUserId}`);
    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(remoteUserId, pc);
    setConnectionStatus('connecting');

    // 1. Attach local microphone audio track if available
    const activeMic = microphoneStreamRef.current || localMicStream;
    if (activeMic) {
      const audioTrack = activeMic.getAudioTracks()[0];
      if (audioTrack && !audioSendersRef.current.has(remoteUserId)) {
        audioTrack.enabled = !currentUser.isMuted;
        try {
          const sender = pc.addTrack(audioTrack, activeMic);
          audioSendersRef.current.set(remoteUserId, sender);
          console.log(`[WebRTC] Áudio local anexado ao peer: ${remoteUserId}`);
        } catch (err) {
          console.warn('[WebRTC] Erro ao anexar áudio:', err);
        }
      }
    }

    // 2. Attach local camera video if currently active
    if (cameraStreamRef.current) {
      const camTrack = cameraStreamRef.current.getVideoTracks()[0];
      if (camTrack && !cameraSendersRef.current.has(remoteUserId)) {
        try {
          const transceivers = pc.getTransceivers();
          const screenSender = screenSendersRef.current.get(remoteUserId);
          const cameraTransceiver = transceivers.find(
            (t) => (t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video') &&
                   (!screenSender || t.sender !== screenSender)
          );
          let sender: RTCRtpSender;
          if (cameraTransceiver) {
            cameraTransceiver.direction = 'sendrecv';
            cameraTransceiver.sender.replaceTrack(camTrack).catch(() => {});
            sender = cameraTransceiver.sender;
          } else {
            sender = pc.addTrack(camTrack, cameraStreamRef.current);
          }
          cameraSendersRef.current.set(remoteUserId, sender);
          console.log(`[WebRTC] Câmera local anexada ao peer: ${remoteUserId}`);
          socket.emit('webrtc:signal', {
            to: remoteUserId,
            from: currentUser.id,
            signal: {
              type: 'track_metadata',
              trackId: camTrack.id,
              streamId: cameraStreamRef.current.id,
              trackKind: 'camera',
            },
          });
        } catch (err) {
          console.warn('[WebRTC] Erro ao anexar câmera:', err);
        }
      }
    }

    // 3. Attach local screen video if currently screen sharing
    if (screenStreamRef.current) {
      const videoTrack = screenStreamRef.current.getVideoTracks()[0];
      if (videoTrack && !screenSendersRef.current.has(remoteUserId)) {
        try {
          const sender = pc.addTrack(videoTrack, screenStreamRef.current);
          screenSendersRef.current.set(remoteUserId, sender);
          console.log(`[WebRTC] Tela local anexada ao peer: ${remoteUserId}`);
          socket.emit('webrtc:signal', {
            to: remoteUserId,
            from: currentUser.id,
            signal: {
              type: 'track_metadata',
              trackId: videoTrack.id,
              streamId: screenStreamRef.current.id,
              trackKind: 'screen',
            },
          });
        } catch (err) {
          console.warn('[WebRTC] Erro ao anexar tela:', err);
        }
      }
    }

    // ICE candidates exchange
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:signal', {
          to: remoteUserId,
          from: currentUser.id,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Receive incoming tracks (audio & video/screen/camera)
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Faixa recebida de ${remoteUserId}: ${event.track.kind} (id: ${event.track.id})`);
      if (event.track.kind === 'audio') {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteAudioStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteUserId, stream);
          return next;
        });
        setConnectionStatus('connected');

        event.track.onended = () => {
          // Verify if there are other audio receivers still live before removing
          const hasOtherLiveAudio = pc.getReceivers().some(
            (r) => r.track && r.track.kind === 'audio' && r.track.id !== event.track.id && r.track.readyState === 'live'
          );
          if (!hasOtherLiveAudio) {
            setRemoteAudioStreams((prev) => {
              if (!prev.has(remoteUserId)) return prev;
              const next = new Map(prev);
              next.delete(remoteUserId);
              return next;
            });
          }
        };
      } else if (event.track.kind === 'video') {
        const stream = event.streams[0] || new MediaStream([event.track]);
        const trackKind = trackMetadataRef.current.get(event.track.id);

        const isScreen =
          trackKind === 'screen' ||
          (trackKind !== 'camera' && members.some((m) => m.id === remoteUserId && m.isStreaming));

        if (isScreen) {
          console.log(`[WebRTC] Stream de tela recebido de ${remoteUserId}`);
          setRemoteScreenStream(stream);

          event.track.onended = () => {
            setRemoteScreenStream(null);
          };
        } else {
          console.log(`[WebRTC] Stream de câmera recebido de ${remoteUserId}`);
          // Always create a new MediaStream reference with the track to guarantee re-render/re-binding
          const camStream = new MediaStream([event.track]);
          setRemoteCameraStreams((prev) => {
            const next = new Map(prev);
            next.set(remoteUserId, camStream);
            return next;
          });

          event.track.onunmute = () => {
            console.log(`[WebRTC] Faixa de câmera de ${remoteUserId} disparou onunmute, renovando stream`);
            setRemoteCameraStreams((prev) => {
              const next = new Map(prev);
              next.set(remoteUserId, new MediaStream([event.track]));
              return next;
            });
          };

          event.track.onended = () => {
            setRemoteCameraStreams((prev) => {
              if (!prev.has(remoteUserId)) return prev;
              const next = new Map(prev);
              next.delete(remoteUserId);
              return next;
            });
          };
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Estado da conexão com ${remoteUserId}: ${pc?.connectionState}`);
      if (pc?.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc?.connectionState === 'failed') {
        console.warn(`[WebRTC] Conexão com ${remoteUserId} falhou, tentando ICE restart...`);
        try {
          pc.restartIce();
          pc.createOffer({ iceRestart: true }).then((offer) => {
            pc.setLocalDescription(offer);
            socket.emit('webrtc:signal', {
              to: remoteUserId,
              from: currentUser.id,
              signal: offer,
            });
          }).catch((err) => {
            console.warn('[WebRTC] Erro no ICE restart:', err);
          });
        } catch (err) {
          console.warn('[WebRTC] Falha ao invocar ICE restart:', err);
        }
      } else if (pc?.connectionState === 'disconnected') {
        console.warn(`[WebRTC] Conexão com ${remoteUserId} temporariamente desconectada`);
      } else if (pc?.connectionState === 'closed') {
        setRemoteAudioStreams((prev) => {
          if (!prev.has(remoteUserId)) return prev;
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
        setRemoteCameraStreams((prev) => {
          if (!prev.has(remoteUserId)) return prev;
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
        if (peerConnectionsRef.current.size <= 1) {
          setConnectionStatus('idle');
        }
      }
    };

    return pc;
  }, [currentUser.id, currentUser.isMuted, localMicStream, members]);

  // 2. WebRTC Signaling Listener
  useEffect(() => {
    const handleSignal = async (data: { from: string; signal: any }) => {
      const { from, signal } = data;
      if (!from || !signal || from === currentUser.id) return;

      try {
        const pc = getOrCreatePeerConnection(from);

        if (signal.type === 'track_metadata') {
          console.log(`[WebRTC] Metadados de faixa recebidos de ${from}:`, signal);
          trackMetadataRef.current.set(signal.trackId, signal.trackKind);
        } else if (signal.type === 'offer') {
          console.log(`[WebRTC] Recebeu Offer de ${from}`);
          const isPolite = currentUser.id < from;
          const isOfferCollision = makingOfferRef.current.get(from) || pc.signalingState !== 'stable';
          if (isOfferCollision) {
            if (!isPolite) {
              console.log(`[WebRTC] Glare: ignorando oferta de ${from} (impolite peer)`);
              return;
            }
            console.log(`[WebRTC] Glare: revertendo oferta local para aceitar oferta de ${from} (polite peer)`);
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Flush queued ICE candidates
          const queued = pendingCandidatesRef.current.get(from) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(from);

          socket.emit('webrtc:signal', {
            to: from,
            from: currentUser.id,
            signal: answer,
          });
          console.log(`[WebRTC] Enviou Answer para ${from}`);

          // Always synchronize audio receiver to remoteAudioStreams to prevent audio drops on renegotiation
          const offerAudioReceiver = pc.getReceivers().find(
            (r) => r.track && r.track.kind === 'audio' && r.track.readyState === 'live'
          );
          if (offerAudioReceiver && offerAudioReceiver.track) {
            const track = offerAudioReceiver.track;
            setRemoteAudioStreams((prev) => {
              if (prev.has(from) && prev.get(from)!.getAudioTracks()[0]?.id === track.id) return prev;
              const next = new Map(prev);
              next.set(from, new MediaStream([track]));
              return next;
            });
            setConnectionStatus('connected');
          }

          // Sync active video receivers to remoteCameraStreams only if remote peer has video active
          const offerRemoteUser = members.find((m) => m.id === from);
          if (offerRemoteUser?.isVideoActive) {
            const offerVideoReceiver = pc.getReceivers().find(
              (r) => r.track && r.track.kind === 'video' && r.track.readyState === 'live'
            );
            if (offerVideoReceiver && offerVideoReceiver.track) {
              const track = offerVideoReceiver.track;
              setRemoteCameraStreams((prev) => {
                const next = new Map(prev);
                next.set(from, new MediaStream([track]));
                return next;
              });
            }
          } else {
            setRemoteCameraStreams((prev) => {
              if (!prev.has(from)) return prev;
              const next = new Map(prev);
              next.delete(from);
              return next;
            });
          }
        } else if (signal.type === 'answer') {
          console.log(`[WebRTC] Recebeu Answer de ${from}`);
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));

            // Flush queued ICE candidates
            const queued = pendingCandidatesRef.current.get(from) || [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingCandidatesRef.current.delete(from);

            // Always synchronize audio receiver to remoteAudioStreams to prevent audio drops on renegotiation
            const answerAudioReceiver = pc.getReceivers().find(
              (r) => r.track && r.track.kind === 'audio' && r.track.readyState === 'live'
            );
            if (answerAudioReceiver && answerAudioReceiver.track) {
              const track = answerAudioReceiver.track;
              setRemoteAudioStreams((prev) => {
                if (prev.has(from) && prev.get(from)!.getAudioTracks()[0]?.id === track.id) return prev;
                const next = new Map(prev);
                next.set(from, new MediaStream([track]));
                return next;
              });
              setConnectionStatus('connected');
            }

            // Sync active video receivers to remoteCameraStreams only if remote peer has video active
            const answerRemoteUser = members.find((m) => m.id === from);
            if (answerRemoteUser?.isVideoActive) {
              const answerVideoReceiver = pc.getReceivers().find(
                (r) => r.track && r.track.kind === 'video' && r.track.readyState === 'live'
              );
              if (answerVideoReceiver && answerVideoReceiver.track) {
                const track = answerVideoReceiver.track;
                setRemoteCameraStreams((prev) => {
                  const next = new Map(prev);
                  next.set(from, new MediaStream([track]));
                  return next;
                });
              }
            } else {
              setRemoteCameraStreams((prev) => {
                if (!prev.has(from)) return prev;
                const next = new Map(prev);
                next.delete(from);
                return next;
              });
            }
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          if (!pc.remoteDescription || pc.signalingState !== 'stable') {
            const list = pendingCandidatesRef.current.get(from) || [];
            list.push(signal.candidate);
            pendingCandidatesRef.current.set(from, list);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              const list = pendingCandidatesRef.current.get(from) || [];
              list.push(signal.candidate);
              pendingCandidatesRef.current.set(from, list);
            }
          }
        }
      } catch (err) {
        console.warn('[WebRTC] Erro ao processar sinal:', err);
      }
    };

    socket.on('webrtc:signal', handleSignal);

    return () => {
      socket.off('webrtc:signal', handleSignal);
    };
  }, [currentUser.id, getOrCreatePeerConnection, members]);

  // 3. Connect to all peers in this voice room once microphone is ready
  useEffect(() => {
    const otherMembers = members.filter((m) => m.id !== currentUser.id && !m.id.startsWith('bot-'));

    if (otherMembers.length > 0 && localMicStream) {
      otherMembers.forEach(async (member) => {
        // Deterministic tie-breaker: user with higher ID initiates the offer ONLY if not yet initiated
        if (currentUser.id > member.id && !initiatedPeersRef.current.has(member.id)) {
          initiatedPeersRef.current.add(member.id);
          const pc = getOrCreatePeerConnection(member.id);
          if (pc.signalingState === 'stable') {
            try {
              console.log(`[WebRTC] Iniciando chamada com ${member.id}`);
              await sendOfferToPeer(pc, member.id);
            } catch (err) {
              console.warn('[WebRTC] Erro ao criar oferta:', err);
            }
          }
        }
      });
    }

    // Clean up peers who left with 5-second grace period
    const currentMemberIds = new Set(members.map((m) => m.id));

    // Cancel pending removals for peers who are present
    currentMemberIds.forEach((id) => {
      if (peerRemovalTimersRef.current.has(id)) {
        clearTimeout(peerRemovalTimersRef.current.get(id)!);
        peerRemovalTimersRef.current.delete(id);
      }
    });

    peerConnectionsRef.current.forEach((pc, peerId) => {
      if (!currentMemberIds.has(peerId)) {
        if (!peerRemovalTimersRef.current.has(peerId)) {
          const timer = setTimeout(() => {
            peerRemovalTimersRef.current.delete(peerId);
            const stillAbsent = !connectedUsers.some((u) => u.id === peerId && u.voiceChannelId === channel.id);
            if (stillAbsent) {
              console.log(`[WebRTC] Fechando peer desconectado após grace period: ${peerId}`);
              pc.close();
              peerConnectionsRef.current.delete(peerId);
              initiatedPeersRef.current.delete(peerId);
              audioSendersRef.current.delete(peerId);
              cameraSendersRef.current.delete(peerId);
              screenSendersRef.current.delete(peerId);
              makingOfferRef.current.delete(peerId);
              setRemoteAudioStreams((prev) => {
                if (!prev.has(peerId)) return prev;
                const next = new Map(prev);
                next.delete(peerId);
                return next;
              });
              setRemoteCameraStreams((prev) => {
                if (!prev.has(peerId)) return prev;
                const next = new Map(prev);
                next.delete(peerId);
                return next;
              });
            }
          }, 5000);
          peerRemovalTimersRef.current.set(peerId, timer);
        }
      }
    });
  }, [connectedUsers, channel.id, currentUser.id, localMicStream, getOrCreatePeerConnection, sendOfferToPeer]);

  // 3.1. Synchronize remote camera streams when users toggle their camera off
  useEffect(() => {
    connectedUsers.forEach((u) => {
      if (u.id !== currentUser.id && !u.isVideoActive && remoteCameraStreams.has(u.id)) {
        setRemoteCameraStreams((prev) => {
          if (!prev.has(u.id)) return prev;
          const next = new Map(prev);
          next.delete(u.id);
          return next;
        });
      }
    });
  }, [connectedUsers, currentUser.id, remoteCameraStreams]);

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
        setLocalMicStream(stream);

        // Apply mute state to track
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !currentUser.isMuted;
        });

        // Attach audio track to all active peer connections and renegotiate
        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack && !audioSendersRef.current.has(peerId)) {
            try {
              const sender = pc.addTrack(audioTrack, stream);
              audioSendersRef.current.set(peerId, sender);
              if (pc.signalingState === 'stable') {
                await sendOfferToPeer(pc, peerId);
              }
            } catch (err) {
              console.warn('[WebRTC] Erro ao anexar áudio ao peer existente:', err);
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
  }, [audioSettings?.inputDeviceId, sendOfferToPeer]);

  // 7. Mute Real-Time Handler
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

  // 9. Start Screen Streaming (Go Live)
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
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        try {
          const sender = pc.addTrack(videoTrack, stream);
          screenSendersRef.current.set(peerId, sender);

          socket.emit('webrtc:signal', {
            to: peerId,
            from: currentUser.id,
            signal: {
              type: 'track_metadata',
              trackId: videoTrack.id,
              streamId: stream.id,
              trackKind: 'screen',
            },
          });

          if (pc.signalingState === 'stable') {
            await sendOfferToPeer(pc, peerId);
          }
        } catch (err) {
          console.warn('[WebRTC] Erro ao transmitir tela para peer:', err);
        }
      }

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
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      const sender = screenSendersRef.current.get(peerId);
      if (sender) {
        try {
          pc.removeTrack(sender);
          screenSendersRef.current.delete(peerId);

          if (pc.signalingState === 'stable') {
            sendOfferToPeer(pc, peerId);
          }
        } catch (err) {
          console.warn('[WebRTC] Erro ao remover track de tela do peer:', err);
        }
      }
    }

    setIsScreenSharing(false);
    onStopStream();
  };

  // Turn Off Camera Helper
  const handleTurnOffVideo = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsVideoActive(false);

    // Notify server that our camera is now off
    socket.emit('voice:toggle_video', false);

    // Remove or mute camera sender from all peer connections and renegotiate
    peerConnectionsRef.current.forEach(async (pc, peerId) => {
      const sender = cameraSendersRef.current.get(peerId);
      if (sender) {
        try {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find((t) => t.sender === sender);
          if (videoTransceiver) {
            const isStillReceiving =
              videoTransceiver.receiver.track && videoTransceiver.receiver.track.readyState === 'live';
            videoTransceiver.direction = isStillReceiving ? 'recvonly' : 'inactive';
          }
          await sender.replaceTrack(null);
          cameraSendersRef.current.delete(peerId);

          if (pc.signalingState === 'stable') {
            await sendOfferToPeer(pc, peerId);
            console.log(`[WebRTC] Câmera removida e oferta enviada para ${peerId}`);
          }
        } catch (err) {
          console.warn('[WebRTC] Erro ao remover câmera do peer:', err);
        }
      }
    });
  };

  // Toggle Camera
  const handleToggleVideo = async () => {
    if (!isVideoActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });
        cameraStreamRef.current = stream;
        setIsVideoActive(true);

        const videoTrack = stream.getVideoTracks()[0];

        // Notify server that our camera is active
        socket.emit('voice:toggle_video', true);

        // Attach track to all existing peers and renegotiate
        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
          if (videoTrack) {
            try {
              const transceivers = pc.getTransceivers();
              const screenSender = screenSendersRef.current.get(peerId);
              const cameraTransceiver = transceivers.find(
                (t) => (t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video') &&
                       (!screenSender || t.sender !== screenSender)
              );

              let sender: RTCRtpSender;
              if (cameraTransceiver) {
                cameraTransceiver.direction = 'sendrecv';
                await cameraTransceiver.sender.replaceTrack(videoTrack);
                sender = cameraTransceiver.sender;
              } else if (cameraSendersRef.current.has(peerId)) {
                sender = cameraSendersRef.current.get(peerId)!;
                await sender.replaceTrack(videoTrack);
              } else {
                sender = pc.addTrack(videoTrack, stream);
              }
              cameraSendersRef.current.set(peerId, sender);

              socket.emit('webrtc:signal', {
                to: peerId,
                from: currentUser.id,
                signal: {
                  type: 'track_metadata',
                  trackId: videoTrack.id,
                  streamId: stream.id,
                  trackKind: 'camera',
                },
              });

              if (pc.signalingState === 'stable') {
                await sendOfferToPeer(pc, peerId);
                console.log(`[WebRTC] Câmera anexada e oferta enviada para ${peerId}`);
              }
            } catch (err) {
              console.warn('[WebRTC] Erro ao anexar câmera ao peer:', err);
            }
          }
        }

        videoTrack.onended = () => {
          handleTurnOffVideo();
        };
      } catch (err) {
        console.warn('Câmera não acessível:', err);
      }
    } else {
      handleTurnOffVideo();
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
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      socket.emit('voice:toggle_video', false);
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      audioSendersRef.current.clear();
      cameraSendersRef.current.clear();
      screenSendersRef.current.clear();
      trackMetadataRef.current.clear();
      peerRemovalTimersRef.current.forEach((t) => clearTimeout(t));
      peerRemovalTimersRef.current.clear();
      setRemoteAudioStreams(new Map());
      setRemoteCameraStreams(new Map());
    };
  }, []);

  return (
    <div
      ref={stageContainerRef}
      className="flex-1 h-full bg-[var(--bg-stage)] flex flex-col justify-between p-4 sm:p-6 select-none relative overflow-hidden transition-colors"
    >
      {/* Hidden DOM Remote Audio Players: guarantees browser autoplay works reliably */}
      {Array.from(remoteAudioStreams.entries()).map(([peerId, stream]) => (
        <RemoteAudioPlayer
          key={peerId}
          stream={stream}
          isDeafened={currentUser.isDeafened}
          outputVolume={audioSettings?.outputVolume}
          outputDeviceId={audioSettings?.outputDeviceId}
        />
      ))}

      {/* Top Header */}
      <div className="flex items-center justify-between z-10 flex-shrink-0 mb-3 gap-2">
        <div className="flex items-center gap-2 truncate min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-[var(--text-interactive)] hover:text-[var(--text-header)] hover:bg-[var(--bg-hover)] rounded transition-colors cursor-pointer flex-shrink-0"
            title="Abrir Canais"
          >
            <Menu size={20} />
          </button>
          <Volume2 size={24} className="text-[#23a55a] flex-shrink-0" />
          <h2 className="text-base sm:text-xl font-bold text-[var(--text-header)] truncate">{channel.name}</h2>
          
          {/* Connection status badge */}
          {connectionStatus === 'connected' ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-[#23a55a]/20 text-[#23a55a] font-bold px-2 py-0.5 rounded whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#23a55a] animate-pulse" />
              RTC Conectado (P2P)
            </span>
          ) : connectionStatus === 'connecting' ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-[#f0b232]/20 text-[#f0b232] font-bold px-2 py-0.5 rounded whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#f0b232] animate-ping" />
              Conectando Voz...
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)] font-semibold px-2 py-0.5 rounded whitespace-nowrap">
              Sala de Voz
            </span>
          )}

          {(isScreenSharing || streamingUser) && (
            <span className="bg-[#f23f43] text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1.5 animate-pulse whitespace-nowrap">
              <Radio size={12} /> AO VIVO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-muted)] flex-shrink-0">
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
                  className={`flex items-center gap-2 bg-[var(--bg-stage-card)]/90 backdrop-blur px-3 py-1.5 rounded-full border transition-all ${
                    speaking
                      ? 'border-[#23a55a] shadow-[0_0_12px_rgba(35,165,90,0.5)]'
                      : 'border-[var(--border-stage)]'
                  }`}
                >
                  <img
                    src={member.avatar}
                    alt={member.username}
                    onError={(e) => handleAvatarError(e, member.id.startsWith('bot'))}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-xs font-medium text-[var(--text-header)] whitespace-nowrap">
                    {member.username} {isMe && '(Você)'}
                  </span>
                  {((isMe && isVideoActive) || (!isMe && member.isVideoActive)) && (
                    <span className="bg-[#23a55a]/20 text-[#23a55a] p-0.5 rounded-full" title="Câmera Ativa">
                      <Video size={11} />
                    </span>
                  )}
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
                muted={isScreenSharing}
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
        /* NORMAL USER CARDS / VIDEO CALL GRID */
        <div className="flex-1 flex flex-col items-center justify-center my-4 overflow-y-auto w-full px-2">
          <div
            className={`grid gap-4 sm:gap-6 w-full max-w-5xl ${
              displayMembers.length === 1
                ? 'grid-cols-1 max-w-2xl'
                : displayMembers.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : displayMembers.length <= 4
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {displayMembers.map((member) => {
              const isMe = member.id === currentUser.id;
              const speaking = isMe ? isSpeakingLocal : speakingUsers.has(member.id);
              const activeVideoStream = isMe
                ? isVideoActive
                  ? cameraStreamRef.current
                  : null
                : member.isVideoActive
                  ? remoteCameraStreams.get(member.id)
                  : null;

              return (
                <div
                  key={member.id}
                  className={`relative bg-[var(--bg-stage-card)] rounded-2xl overflow-hidden transition-all duration-200 border-2 shadow-xl flex flex-col ${
                    speaking
                      ? 'border-[#23a55a] shadow-[0_0_24px_rgba(35,165,90,0.45)] scale-[1.01]'
                      : 'border-[var(--border-stage)]'
                  }`}
                >
                  {/* Video Tile or Avatar Tile */}
                  {activeVideoStream ? (
                    <div className="w-full aspect-video relative bg-black flex items-center justify-center overflow-hidden">
                      <VideoStreamPlayer
                        stream={activeVideoStream}
                        isMuted={isMe}
                        className="w-full h-full object-cover"
                      />
                      {/* Gradient for text contrast */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

                      {/* Top badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 z-10 text-xs font-semibold text-white">
                        <Video size={13} className="text-[#23a55a]" />
                        <span>Câmera</span>
                      </div>

                      {/* Bottom user info bar */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
                        <div className="flex items-center gap-2 truncate">
                          <img
                            src={member.avatar}
                            alt={member.username}
                            onError={(e) => handleAvatarError(e, member.id.startsWith('bot'))}
                            className="w-6 h-6 rounded-full object-cover ring-1 ring-white/30 flex-shrink-0"
                          />
                          <span className="text-sm font-bold text-white truncate drop-shadow-md">
                            {member.username} {isMe && '(Você)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {member.isMuted && (
                            <span className="bg-[#f23f43] p-1.5 rounded-full text-white shadow-md">
                              <MicOff size={13} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-[var(--bg-stage-card-inner)] flex flex-col items-center justify-center p-6 relative transition-colors">
                      <div className="relative mb-3">
                        <img
                          src={member.avatar}
                          alt={member.username}
                          onError={(e) => handleAvatarError(e, member.id.startsWith('bot'))}
                          className={`w-24 h-24 rounded-full object-cover transition-all duration-200 ${
                            speaking
                              ? 'ring-4 ring-[#23a55a] shadow-[0_0_16px_rgba(35,165,90,0.5)]'
                              : 'ring-2 ring-transparent'
                          }`}
                        />
                        <div
                          className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-[var(--bg-stage-card)] ${
                            member.status === 'online'
                              ? 'bg-[#23a55a]'
                              : member.status === 'idle'
                              ? 'bg-[#f0b232]'
                              : 'bg-[#f23f43]'
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-[var(--text-header)] truncate max-w-[200px]">
                          {member.username} {isMe && '(Você)'}
                        </span>
                        {member.isMuted && <MicOff size={16} className="text-[#f23f43] flex-shrink-0" />}
                      </div>

                      <span className="text-xs text-[var(--text-muted)] mt-1">
                        {speaking ? 'Falando...' : member.customStatus || 'Conectado'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Integrated Voice Chat & Link Sharing Section */}
      <div className="w-full max-w-4xl mx-auto flex flex-col z-20 transition-all duration-300 mt-2 px-1 sm:px-2 flex-shrink-0">
        {isChatOpen ? (
          <div className="bg-[var(--bg-card)]/90 backdrop-blur-md rounded-2xl border border-[var(--border-card)] shadow-2xl overflow-hidden flex flex-col transition-all">
            {/* Chat Header Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-card)] bg-[var(--bg-stage-card-inner)]/50">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-[#5865f2]" />
                <span className="text-xs sm:text-sm font-bold text-[var(--text-header)]">
                  Bate-papo da Chamada
                </span>
                <span className="bg-[#5865f2]/15 text-[#5865f2] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {messages.length}
                </span>
                <span className="hidden sm:inline text-[11px] text-[var(--text-muted)]">
                  — Envie mensagens e links em tempo real
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                title="Minimizar Bate-papo"
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Chat Messages Feed */}
            <div className="max-h-32 sm:max-h-40 overflow-y-auto p-3 space-y-2.5 text-xs sm:text-sm scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-4 text-center text-xs text-[var(--text-muted)]">
                  <LinkIcon size={14} className="text-[var(--text-interactive)]" />
                  <span>Nenhuma mensagem ainda. Cole um link ou digite algo abaixo para conversar!</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.author.id === currentUser.id;
                  return (
                    <div key={msg.id} className="flex items-start gap-2.5 group">
                      <img
                        src={msg.author.avatar}
                        alt={msg.author.username}
                        onError={(e) => handleAvatarError(e, msg.author.id.startsWith('bot'))}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[var(--text-header)]">
                            {msg.author.username} {isMe && <span className="font-normal text-[var(--text-muted)]">(Você)</span>}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                        </div>
                        <div className="text-[var(--text-normal)] text-xs sm:text-sm break-words whitespace-pre-wrap leading-relaxed mt-0.5 select-text">
                          {renderMessageContent(msg.content)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Chat Input Form */}
            <form
              onSubmit={handleSendVoiceText}
              className="p-2 border-t border-[var(--border-card)] bg-[var(--bg-stage-card-inner)] flex items-center gap-2"
            >
              <div className="p-1.5 text-[var(--text-muted)] hidden sm:flex items-center">
                <LinkIcon size={16} />
              </div>
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Enviar mensagem ou link na chamada... (Pressione Enter)"
                className="flex-1 bg-transparent text-[var(--text-normal)] placeholder-[var(--text-muted)] text-xs sm:text-sm outline-none px-2"
              />
              <button
                type="submit"
                disabled={!chatText.trim()}
                title="Enviar mensagem ou link"
                className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                  chatText.trim()
                    ? 'bg-[#5865f2] hover:bg-[#4752c4] text-white shadow-md scale-105'
                    : 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                }`}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="bg-[var(--bg-card)]/90 hover:bg-[var(--bg-hover)] border border-[var(--border-card)] text-[var(--text-header)] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <MessageSquare size={14} className="text-[#5865f2]" />
              <span>Abrir Bate-papo da Chamada</span>
              {messages.length > 0 && (
                <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {messages.length}
                </span>
              )}
              <ChevronUp size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Voice Controls Bottom Toolbar */}
      <div className="flex items-center justify-center gap-3 bg-[var(--bg-card)]/90 backdrop-blur-md px-6 py-3 rounded-2xl mx-auto z-10 shadow-2xl border border-[var(--border-card)] mt-3 transition-colors">
        {/* Toggle Mute */}
        <button
          onClick={onToggleMute}
          title={currentUser.isMuted ? 'Ativar Microfone' : 'Silenciar'}
          className={`p-3 rounded-full transition-all cursor-pointer ${
            currentUser.isMuted
              ? 'bg-[#f23f43] text-white hover:bg-[#da373c]'
              : 'bg-[var(--bg-hover)] text-[var(--text-header)] hover:bg-[var(--bg-active)]'
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
              : 'bg-[var(--bg-hover)] text-[var(--text-header)] hover:bg-[var(--bg-active)]'
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
              : 'bg-[var(--bg-hover)] text-[var(--text-header)] hover:bg-[var(--bg-active)]'
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

        {/* Toggle Voice Chat */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          title={isChatOpen ? 'Minimizar Bate-papo' : 'Abrir Bate-papo'}
          className={`p-3 rounded-full transition-all cursor-pointer relative ${
            isChatOpen
              ? 'bg-[#5865f2] text-white hover:bg-[#4752c4]'
              : 'bg-[var(--bg-hover)] text-[var(--text-header)] hover:bg-[var(--bg-active)]'
          }`}
        >
          <MessageSquare size={22} />
          {messages.length > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-[#f23f43] text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {messages.length}
            </span>
          )}
        </button>

        {/* Disconnect Red Button */}
        <button
          onClick={onLeaveVoice}
          title="Desconectar do Canal"
          className="bg-[var(--bg-hover)] hover:bg-[#f23f43] text-[var(--text-header)] hover:text-white p-3 rounded-full transition-all cursor-pointer"
        >
          <PhoneOff size={22} />
        </button>
      </div>

      {/* REUNI-AI "GO LIVE" MODAL */}
      {showGoLiveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn select-none">
          <div className="bg-[var(--bg-modal)] w-full max-w-lg rounded-xl shadow-2xl border border-[var(--border-card)] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 text-center relative border-b border-[var(--border-card)] bg-[var(--bg-modal-header)]">
              <button
                onClick={() => setShowGoLiveModal(false)}
                className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-header)] p-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
              <div className="w-14 h-14 bg-[#5865f2] rounded-full flex items-center justify-center text-white mx-auto mb-3 shadow-lg">
                <Monitor size={30} />
              </div>
              <h2 className="text-xl font-bold text-[var(--text-header)] tracking-wide">
                TRANSMITIR AO VIVO
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Compartilhe sua tela, jogos ou janelas de aplicativos com todos no canal #{channel.name}.
              </p>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Stream Title */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                  Título da Transmissão
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="O que você está transmitindo?"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-card)] rounded p-2.5 text-sm text-[var(--text-normal)] outline-none focus:border-[#5865f2] transition-colors"
                />
              </div>

              {/* Quality Preset Buttons */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                  Qualidade da Transmissão
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStreamQuality('720p')}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      streamQuality === '720p'
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-[var(--text-header)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--text-header)]">720p HD</span>
                      <span className="text-[10px] bg-[var(--bg-hover)] text-[var(--text-normal)] px-1.5 py-0.5 rounded font-bold">
                        Padrão
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">Ótimo equilíbrio e desempenho leve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStreamQuality('1080p')}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      streamQuality === '1080p'
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-[var(--text-header)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[var(--text-header)]">1080p Full HD</span>
                      <span className="text-[10px] bg-[#5865f2] text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                        <Sparkles size={10} /> Pro
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">Máxima nitidez para textos e games</span>
                  </button>
                </div>
              </div>

              {/* FPS Selector */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                  Taxa de Quadros (FPS)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStreamFps(30)}
                    className={`py-2 px-3 rounded-lg border font-semibold text-sm transition-all cursor-pointer ${
                      streamFps === 30
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-[var(--text-header)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    30 FPS
                  </button>

                  <button
                    type="button"
                    onClick={() => setStreamFps(60)}
                    className={`py-2 px-3 rounded-lg border font-semibold text-sm transition-all cursor-pointer ${
                      streamFps === 60
                        ? 'bg-[#5865f2]/10 border-[#5865f2] text-[var(--text-header)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    60 FPS
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-[var(--bg-modal-header)] px-6 py-4 flex items-center justify-between border-t border-[var(--border-card)]">
              <button
                type="button"
                onClick={() => setShowGoLiveModal(false)}
                className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-header)] hover:underline cursor-pointer"
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
