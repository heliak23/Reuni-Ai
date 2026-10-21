import React, { useState, useEffect, useRef } from 'react';
import type { Guild, Channel, Message, User, AudioSettings } from './types';
import { socket } from './socket';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { ChatArea } from './components/ChatArea';
import { MemberList } from './components/MemberList';
import { VoiceRoomOverlay } from './components/VoiceRoomOverlay';
import { UserSettingsModal } from './components/UserSettingsModal';
import { CreateServerModal } from './components/CreateServerModal';
import { ServerPasswordModal } from './components/ServerPasswordModal';

// Audio feedback effects (synthesized with Web Audio API for lightweight, zero-dependency sound)
const playNotificationSound = (type: 'message' | 'join' | 'leave') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'message') {
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'join') {
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'leave') {
      osc.frequency.setValueAtTime(500, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    }
  } catch {
    // Audio context may require user interaction first
  }
};

export const App: React.FC = () => {
  // Current user state with local persistence
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('reuni_ai_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    const rand = Math.floor(1000 + Math.random() * 9000);
    const initialUser: User = {
      id: `user-${Date.now()}-${rand}`,
      username: `Membro_${rand}`,
      discriminator: String(rand),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=user_${rand}`,
      status: 'online',
      customStatus: 'Online no Reuni-Ai 🎧',
      isMuted: false,
      isDeafened: false,
      voiceChannelId: null,
    };
    try {
      localStorage.setItem('reuni_ai_user', JSON.stringify(initialUser));
    } catch {}
    return initialUser;
  });

  // Guilds and Channels
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>('server-reuni-ai');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Messages and Members
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [typingUsersMap, setTypingUsersMap] = useState<{ [channelId: string]: string[] }>({});

  // UI state
  const [isMemberListOpen, setIsMemberListOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1200);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState<Channel | null>(null);
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);

  // Password-protected servers state
  const [unlockedGuildIds, setUnlockedGuildIds] = useState<Set<string>>(new Set());
  const [pendingPasswordGuild, setPendingPasswordGuild] = useState<Guild | null>(null);

  // Theme state ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('reuni_ai_theme') as 'dark' | 'light') || 'dark';
  });

  // Audio settings state (Microphone & Headphones)
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    try {
      const saved = localStorage.getItem('reuni_ai_audio');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      inputDeviceId: 'default',
      outputDeviceId: 'default',
      inputVolume: 100,
      outputVolume: 100,
    };
  });

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('reuni_ai_theme', newTheme);
  };

  const handleAudioSettingsChange = (newSettings: AudioSettings) => {
    setAudioSettings(newSettings);
    localStorage.setItem('reuni_ai_audio', JSON.stringify(newSettings));
  };

  const currentUserRef = useRef<User>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const currentVoiceChannelRef = useRef<Channel | null>(currentVoiceChannel);
  useEffect(() => {
    currentVoiceChannelRef.current = currentVoiceChannel;
  }, [currentVoiceChannel]);

  // Connect to Socket server and setup listeners
  useEffect(() => {
    const handleConnect = () => {
      console.log('[Socket] Conectado/Reconectado ao servidor Socket.IO');
      const payload: Partial<User> = {
        ...currentUserRef.current,
        voiceChannelId: currentVoiceChannelRef.current?.id || null,
      };
      socket.emit('user:join', payload);
      if (currentVoiceChannelRef.current) {
        socket.emit('voice:join', currentVoiceChannelRef.current.id);
      }
    };

    socket.on('connect', handleConnect);
    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    socket.on('ready', (data: { self: User; guilds: Guild[]; messages: Message[]; onlineUsers: User[] }) => {
      setGuilds(data.guilds);
      setMessages(data.messages);
      
      const myId = currentUserRef.current.id;
      const meInOnline = data.onlineUsers.find((u) => u.id === myId);
      const activeVoiceId = currentVoiceChannelRef.current?.id || null;
      const mergedMe: User = {
        ...(meInOnline || currentUserRef.current),
        voiceChannelId: activeVoiceId ?? meInOnline?.voiceChannelId ?? null,
      };
      const others = data.onlineUsers.filter((u) => u.id !== myId);
      setOnlineUsers([mergedMe, ...others]);

      // Default select first channel of first guild
      if (data.guilds.length > 0 && data.guilds[0].channels.length > 0) {
        setSelectedGuildId(data.guilds[0].id);
        setSelectedChannel(data.guilds[0].channels[0]);
      }
    });

    socket.on('message:new', (newMsg: Message) => {
      setMessages((prev) => [...prev, newMsg]);
      playNotificationSound('message');
    });

    socket.on('message:reaction_update', (data: { messageId: string; reactions: any[] }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg))
      );
    });

    socket.on('typing:update', (data: { channelId: string; users: string[] }) => {
      setTypingUsersMap((prev) => ({ ...prev, [data.channelId]: data.users }));
    });

    socket.on('presence:update', (user: User) => {
      setOnlineUsers((prev) => {
        const filtered = prev.filter((u) => u.id !== user.id);
        return [...filtered, user];
      });
    });

    socket.on('presence:remove', (userId: string) => {
      // Do not remove self from local online list if presence:remove was emitted during socket reconnect
      if (userId === currentUserRef.current.id) return;
      setOnlineUsers((prev) => prev.filter((u) => u.id !== userId));
    });

    socket.on('guild:new', (newGuild: Guild) => {
      setGuilds((prev) => {
        if (prev.some((g) => g.id === newGuild.id)) return prev;
        return [...prev, newGuild];
      });
    });

    socket.on('voice:state_update', (data: { userId: string; voiceChannelId: string | null; isMuted?: boolean; isDeafened?: boolean; isStreaming?: boolean; streamTitle?: string; isVideoActive?: boolean }) => {
      setOnlineUsers((prev) => {
        const exists = prev.some((u) => u.id === data.userId);
        if (exists) {
          return prev.map((u) =>
            u.id === data.userId
              ? {
                  ...u,
                  voiceChannelId: data.voiceChannelId,
                  isMuted: data.isMuted !== undefined ? data.isMuted : u.isMuted,
                  isDeafened: data.isDeafened !== undefined ? data.isDeafened : u.isDeafened,
                  isStreaming: data.isStreaming !== undefined ? data.isStreaming : u.isStreaming,
                  streamTitle: data.streamTitle !== undefined ? data.streamTitle : u.streamTitle,
                  isVideoActive: data.isVideoActive !== undefined ? data.isVideoActive : u.isVideoActive,
                }
              : u
          );
        } else {
          const fallbackUser: User = data.userId === currentUserRef.current.id
            ? currentUserRef.current
            : {
                id: data.userId,
                username: `Membro`,
                discriminator: '0000',
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.userId}`,
                status: 'online' as const,
              };
          return [
            ...prev,
            {
              ...fallbackUser,
              voiceChannelId: data.voiceChannelId,
              isMuted: data.isMuted,
              isDeafened: data.isDeafened,
              isStreaming: data.isStreaming,
              streamTitle: data.streamTitle,
              isVideoActive: data.isVideoActive,
            },
          ];
        }
      });

      if (data.userId === currentUserRef.current.id) {
        setCurrentUser((prev) => ({
          ...prev,
          voiceChannelId: data.voiceChannelId,
          isMuted: data.isMuted !== undefined ? data.isMuted : prev.isMuted,
          isDeafened: data.isDeafened !== undefined ? data.isDeafened : prev.isDeafened,
          isStreaming: data.isStreaming !== undefined ? data.isStreaming : prev.isStreaming,
          streamTitle: data.streamTitle !== undefined ? data.streamTitle : prev.streamTitle,
          isVideoActive: data.isVideoActive !== undefined ? data.isVideoActive : prev.isVideoActive,
        }));
      }
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('ready');
      socket.off('message:new');
      socket.off('message:reaction_update');
      socket.off('typing:update');
      socket.off('presence:update');
      socket.off('presence:remove');
      socket.off('voice:state_update');
      socket.off('guild:new');
    };
  }, []);

  const currentGuild = guilds.find((g) => g.id === selectedGuildId) || null;

  const handleSelectGuild = (guildId: string | null) => {
    if (!guildId) {
      setSelectedGuildId(null);
      setSelectedChannel(null);
      return;
    }

    const g = guilds.find((item) => item.id === guildId);
    if (!g) return;

    // Check if server is protected by password and not yet unlocked
    if ((g.hasPassword || g.password) && !unlockedGuildIds.has(g.id)) {
      setPendingPasswordGuild(g);
      return;
    }

    setSelectedGuildId(guildId);
    if (g.channels.length > 0) {
      setSelectedChannel(g.channels[0]);
    }
  };

  const handleUnlockGuildSuccess = (guildId: string) => {
    setUnlockedGuildIds((prev) => new Set(prev).add(guildId));
    setSelectedGuildId(guildId);
    const g = guilds.find((item) => item.id === guildId);
    if (g && g.channels.length > 0) {
      setSelectedChannel(g.channels[0]);
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsMobileMenuOpen(false);
    if (channel.type === 'voice') {
      handleJoinVoice(channel);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!selectedChannel || !selectedGuildId) return;
    socket.emit('message:send', {
      channelId: selectedChannel.id,
      guildId: selectedGuildId,
      content,
    });
  };

  const handleReact = (messageId: string, emoji: string) => {
    socket.emit('message:react', { messageId, emoji });
  };

  const handleStartTyping = () => {
    if (selectedChannel) {
      socket.emit('typing:start', selectedChannel.id);
    }
  };

  const handleStopTyping = () => {
    if (selectedChannel) {
      socket.emit('typing:stop', selectedChannel.id);
    }
  };

  const handleJoinVoice = (channel: Channel) => {
    setCurrentVoiceChannel(channel);
    setIsVoiceOverlayOpen(true);
    const updatedUser: User = { ...currentUser, voiceChannelId: channel.id };
    setCurrentUser(updatedUser);
    setOnlineUsers((prev) => {
      const filtered = prev.filter((u) => u.id !== currentUser.id);
      return [{ ...updatedUser }, ...filtered];
    });
    socket.emit('voice:join', channel.id);
    playNotificationSound('join');
  };

  const handleLeaveVoice = () => {
    setCurrentVoiceChannel(null);
    setIsVoiceOverlayOpen(false);
    const updatedUser: User = {
      ...currentUser,
      voiceChannelId: null,
      isStreaming: false,
      isVideoActive: false,
    };
    setCurrentUser(updatedUser);
    setOnlineUsers((prev) => {
      const filtered = prev.filter((u) => u.id !== currentUser.id);
      return [{ ...updatedUser }, ...filtered];
    });
    socket.emit('voice:leave');
    playNotificationSound('leave');
  };

  const handleToggleMute = () => {
    setCurrentUser((prev) => ({ ...prev, isMuted: !prev.isMuted }));
    socket.emit('voice:toggle_mute');
  };

  const handleToggleDeafen = () => {
    setCurrentUser((prev) => ({
      ...prev,
      isDeafened: !prev.isDeafened,
      isMuted: !prev.isDeafened ? true : prev.isMuted,
    }));
    socket.emit('voice:toggle_deafen');
  };

  const handleSpeakingChange = (isSpeaking: boolean) => {
    socket.emit('voice:speaking', isSpeaking);
  };

  const handleStartStream = (title?: string) => {
    if (currentVoiceChannel) {
      setCurrentUser((prev) => ({ ...prev, isStreaming: true, streamTitle: title }));
      socket.emit('stream:start', { channelId: currentVoiceChannel.id, title });
    }
  };

  const handleStopStream = () => {
    setCurrentUser((prev) => ({ ...prev, isStreaming: false, streamTitle: undefined }));
    socket.emit('stream:stop');
  };

  const handleSendVoiceMessage = (content: string) => {
    if (!currentVoiceChannel) return;
    socket.emit('message:send', {
      channelId: currentVoiceChannel.id,
      guildId: currentVoiceChannel.guildId || selectedGuildId || '',
      content,
    });
  };

  const handleCreateServer = (name: string, iconUrl?: string, password?: string) => {
    const hasPassword = Boolean(password?.trim());
    const newGuild: Guild = {
      id: `server-${Date.now()}`,
      name,
      icon: iconUrl,
      password: password?.trim() || undefined,
      hasPassword,
      channels: [
        { id: `ch-${Date.now()}-geral`, guildId: `server-${Date.now()}`, name: 'geral', type: 'text', topic: 'Canal geral do servidor' },
        { id: `voice-${Date.now()}-geral`, guildId: `server-${Date.now()}`, name: 'Voz Geral', type: 'voice' },
      ],
    };

    // Auto-unlock for the creator
    setUnlockedGuildIds((prev) => new Set(prev).add(newGuild.id));
    setGuilds((prev) => [...prev, newGuild]);
    setSelectedGuildId(newGuild.id);
    setSelectedChannel(newGuild.channels[0]);

    socket.emit('guild:create', {
      name,
      icon: iconUrl,
      password: password?.trim() || undefined,
    });
  };

  const handleUpdateUser = (updated: Partial<User>) => {
    setCurrentUser((prev) => {
      const merged = { ...prev, ...updated };
      try {
        localStorage.setItem('reuni_ai_user', JSON.stringify(merged));
      } catch {}
      socket.emit('user:join', merged);
      return merged;
    });
  };

  // Filter messages for active channel
  const activeChannelMessages = messages.filter(
    (m) => selectedChannel && m.channelId === selectedChannel.id
  );

  const activeTypingUsers =
    selectedChannel && typingUsersMap[selectedChannel.id]
      ? typingUsersMap[selectedChannel.id].filter((name) => name !== currentUser.username)
      : [];

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${theme === 'light' ? 'theme-light' : ''} bg-[var(--bg-servers)] text-[var(--text-normal)] transition-colors relative`}>
      {/* Mobile Drawer Backdrop for Server + Channel sidebars */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs transition-opacity cursor-pointer"
        />
      )}

      {/* 1 & 2. Server & Channel Sidebars (Drawer on mobile/tablet, static on desktop) */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-shrink-0 transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <ServerSidebar
          guilds={guilds}
          selectedGuildId={selectedGuildId}
          onSelectGuild={handleSelectGuild}
          onOpenCreateServer={() => setIsCreateServerOpen(true)}
        />

        <ChannelSidebar
          currentGuild={currentGuild}
          selectedChannelId={selectedChannel?.id || ''}
          onSelectChannel={handleSelectChannel}
          currentUser={currentUser}
          connectedUsers={onlineUsers}
          currentVoiceChannel={currentVoiceChannel}
          onJoinVoice={handleJoinVoice}
          onLeaveVoice={handleLeaveVoice}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onOpenSettings={() => setIsUserSettingsOpen(true)}
        />
      </div>

      {/* 3. Main Center Area (Voice Room or Text Chat) */}
      {isVoiceOverlayOpen && currentVoiceChannel ? (
        <VoiceRoomOverlay
          channel={currentVoiceChannel}
          connectedUsers={onlineUsers}
          currentUser={currentUser}
          audioSettings={audioSettings}
          messages={messages.filter((m) => m.channelId === currentVoiceChannel.id)}
          onSendMessage={handleSendVoiceMessage}
          onLeaveVoice={handleLeaveVoice}
          onToggleMute={handleToggleMute}
          onToggleDeafen={handleToggleDeafen}
          onSpeakingChange={handleSpeakingChange}
          onStartStream={handleStartStream}
          onStopStream={handleStopStream}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
      ) : (
        <ChatArea
          currentChannel={selectedChannel}
          messages={activeChannelMessages}
          currentUser={currentUser}
          onSendMessage={handleSendMessage}
          onReact={handleReact}
          isMemberListOpen={isMemberListOpen}
          onToggleMemberList={() => setIsMemberListOpen(!isMemberListOpen)}
          typingUsers={activeTypingUsers}
          onStartTyping={handleStartTyping}
          onStopTyping={handleStopTyping}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
      )}

      {/* 4. Member List (Right Panel / Floating drawer on < lg screens) */}
      {isMemberListOpen && !isVoiceOverlayOpen && (
        <>
          <div
            onClick={() => setIsMemberListOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-xs transition-opacity cursor-pointer"
          />
          <div className="fixed inset-y-0 right-0 z-40 lg:static flex flex-shrink-0 shadow-2xl lg:shadow-none transition-transform duration-300">
            <MemberList
              users={onlineUsers}
              currentUser={currentUser}
              onClose={() => setIsMemberListOpen(false)}
            />
          </div>
        </>
      )}

      {/* Modals */}
      {isUserSettingsOpen && (
        <UserSettingsModal
          currentUser={currentUser}
          theme={theme}
          onThemeChange={handleThemeChange}
          audioSettings={audioSettings}
          onAudioSettingsChange={handleAudioSettingsChange}
          onUpdateUser={handleUpdateUser}
          onClose={() => setIsUserSettingsOpen(false)}
        />
      )}

      {isCreateServerOpen && (
        <CreateServerModal
          onClose={() => setIsCreateServerOpen(false)}
          onCreateServer={handleCreateServer}
        />
      )}

      {pendingPasswordGuild && (
        <ServerPasswordModal
          guild={pendingPasswordGuild}
          onClose={() => setPendingPasswordGuild(null)}
          onSuccess={handleUnlockGuildSuccess}
        />
      )}
    </div>
  );
};

export default App;
