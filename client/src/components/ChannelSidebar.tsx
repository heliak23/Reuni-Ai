import React, { useState } from 'react';
import type { Guild, Channel, User } from '../types';
import { handleAvatarError } from '../utils/avatar';
import {
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  Plus,
  Mic,
  MicOff,
  Headphones,
  Settings,
  PhoneOff,
  Wifi,
} from 'lucide-react';

interface ChannelSidebarProps {
  currentGuild: Guild | null;
  selectedChannelId: string;
  onSelectChannel: (channel: Channel) => void;
  currentUser: User;
  connectedUsers: User[];
  currentVoiceChannel: Channel | null;
  onJoinVoice: (channel: Channel) => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  currentGuild,
  selectedChannelId,
  onSelectChannel,
  currentUser,
  connectedUsers,
  currentVoiceChannel,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onOpenSettings,
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<{ [key: string]: boolean }>({});

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const textChannels = currentGuild?.channels.filter((c) => c.type === 'text') || [];
  const voiceChannels = currentGuild?.channels.filter((c) => c.type === 'voice') || [];

  return (
    <div className="w-60 h-full bg-[var(--bg-channels)] flex flex-col select-none flex-shrink-0 z-10 border-r border-[var(--border-subtle)] transition-colors">
      {/* Server Header */}
      <div className="h-12 border-b border-[var(--border-subtle)] px-4 flex items-center justify-between font-semibold text-[var(--text-header)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <span className="truncate">{currentGuild ? currentGuild.name : 'Mensagens Diretas'}</span>
        <ChevronDown size={18} className="text-[var(--text-muted)]" />
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {currentGuild ? (
          <>
            {/* Text Channels Section */}
            <div>
              <div
                onClick={() => toggleCategory('text')}
                className="flex items-center justify-between text-[var(--text-muted)] hover:text-[var(--text-normal)] text-xs font-bold tracking-wider px-1 mb-1 cursor-pointer group"
              >
                <div className="flex items-center gap-1">
                  {collapsedCategories['text'] ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  <span>CANAIS DE TEXTO</span>
                </div>
                <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {!collapsedCategories['text'] && (
                <div className="space-y-[2px]">
                  {textChannels.map((channel) => {
                    const isActive = selectedChannelId === channel.id;
                    return (
                      <button
                        key={channel.id}
                        onClick={() => onSelectChannel(channel)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] text-sm font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[var(--bg-hover)] text-[var(--text-header)] font-semibold'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)]'
                        }`}
                      >
                        <Hash size={18} className={isActive ? 'text-[var(--text-header)]' : 'text-[var(--text-muted)]'} />
                        <span className="truncate">{channel.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Voice Channels Section */}
            <div>
              <div
                onClick={() => toggleCategory('voice')}
                className="flex items-center justify-between text-[var(--text-muted)] hover:text-[var(--text-normal)] text-xs font-bold tracking-wider px-1 mb-1 cursor-pointer group"
              >
                <div className="flex items-center gap-1">
                  {collapsedCategories['voice'] ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  <span>CANAIS DE VOZ</span>
                </div>
                <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {!collapsedCategories['voice'] && (
                <div className="space-y-[2px]">
                  {voiceChannels.map((channel) => {
                    const isConnected = currentVoiceChannel?.id === channel.id;
                    const rawMembersInChannel = connectedUsers.filter(
                      (u) => u.voiceChannelId === channel.id
                    );
                    const membersInChannel =
                      isConnected && !rawMembersInChannel.some((m) => m.id === currentUser.id)
                        ? [{ ...currentUser, voiceChannelId: channel.id }, ...rawMembersInChannel]
                        : rawMembersInChannel;

                    return (
                      <div key={channel.id} className="flex flex-col">
                        <button
                          onClick={() => onJoinVoice(channel)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-[4px] text-sm font-medium transition-colors cursor-pointer ${
                            isConnected
                              ? 'bg-[var(--bg-hover)] text-[#23a55a]'
                              : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Volume2
                              size={18}
                              className={isConnected ? 'text-[#23a55a]' : 'text-[var(--text-muted)]'}
                            />
                            <span className="truncate">{channel.name}</span>
                          </div>
                          {isConnected && (
                            <span className="text-[10px] bg-[#23a55a]/20 text-[#23a55a] font-bold px-1.5 py-0.5 rounded">
                              Conectado
                            </span>
                          )}
                        </button>

                        {/* Connected Members in this Voice Channel */}
                        {membersInChannel.length > 0 && (
                          <div className="pl-6 pr-2 py-1 space-y-1">
                            {membersInChannel.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[var(--bg-hover)] text-xs text-[var(--text-normal)]"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <div className="relative">
                                    <img
                                      src={member.avatar}
                                      alt={member.username}
                                      onError={(e) => handleAvatarError(e, member.id.startsWith('bot'))}
                                      className={`w-5 h-5 rounded-full object-cover ${
                                        member.id === currentUser.id && !currentUser.isMuted
                                          ? 'ring-2 ring-[#23a55a]'
                                          : ''
                                      }`}
                                    />
                                  </div>
                                  <span className="truncate">{member.username}</span>
                                  {member.isStreaming && (
                                    <span className="bg-[#f23f43] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                      AO VIVO
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[var(--text-muted)]">
                                  {member.isMuted && <MicOff size={12} className="text-[#f23f43]" />}
                                  {member.isDeafened && (
                                    <Headphones size={12} className="text-[#f23f43]" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Direct Messages View */
          <div className="space-y-1">
            <div className="text-[var(--text-muted)] text-xs font-bold tracking-wider px-1 mb-2">
              MENSAGENS DIRETAS
            </div>
            {connectedUsers.map((user) => (
              <button
                key={user.id}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-[4px] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-normal)] transition-colors cursor-pointer"
              >
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    onError={(e) => handleAvatarError(e, user.id.startsWith('bot'))}
                    className="w-8 h-8 rounded-full"
                  />
                  <div
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-channels)] ${
                      user.status === 'online'
                        ? 'bg-[#23a55a]'
                        : user.status === 'idle'
                        ? 'bg-[#f0b232]'
                        : user.status === 'dnd'
                        ? 'bg-[#f23f43]'
                        : 'bg-[#80848e]'
                    }`}
                  />
                </div>
                <div className="flex flex-col text-left truncate">
                  <span className="text-sm font-medium text-[var(--text-header)] truncate">{user.username}</span>
                  <span className="text-[11px] text-[var(--text-muted)] truncate">{user.customStatus}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Connected Voice Info Bar (when active) */}
      {currentVoiceChannel && (
        <div className="bg-[var(--bg-userbar)] border-b border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 truncate">
            <Wifi size={18} className="text-[#23a55a] animate-pulse flex-shrink-0" />
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-[#23a55a] leading-tight">Voz Conectada</span>
              <span className="text-[11px] text-[var(--text-muted)] truncate">
                {currentVoiceChannel.name} / {currentGuild?.name}
              </span>
            </div>
          </div>
          <button
            onClick={onLeaveVoice}
            title="Desconectar"
            className="p-1.5 text-[var(--text-muted)] hover:text-[#f23f43] hover:bg-[var(--bg-hover)] rounded transition-colors cursor-pointer"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      )}

      {/* User Status Bar (Bottom) */}
      <div className="h-[52px] bg-[var(--bg-userbar)] px-2 flex items-center justify-between border-t border-[var(--border-subtle)]">
        <div
          onClick={onOpenSettings}
          className="flex items-center gap-2 p-1 -ml-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer max-w-[120px] truncate group transition-colors"
        >
          <div className="relative flex-shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              onError={(e) => handleAvatarError(e, currentUser.id.startsWith('bot'))}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-userbar)] ${
                currentUser.status === 'online'
                  ? 'bg-[#23a55a]'
                  : currentUser.status === 'idle'
                  ? 'bg-[#f0b232]'
                  : currentUser.status === 'dnd'
                  ? 'bg-[#f23f43]'
                  : 'bg-[#80848e]'
              }`}
            />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-[var(--text-header)] truncate leading-tight group-hover:underline">
              {currentUser.username}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] leading-tight">
              #{currentUser.discriminator}
            </span>
          </div>
        </div>

        {/* Audio / Control Icons */}
        <div className="flex items-center text-[var(--text-interactive)]">
          <button
            onClick={onToggleMute}
            title={currentUser.isMuted ? 'Desativar Mudo' : 'Silenciar Microfone'}
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)] transition-colors cursor-pointer ${
              currentUser.isMuted ? 'text-[#f23f43] hover:text-[#f23f43]' : ''
            }`}
          >
            {currentUser.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={onToggleDeafen}
            title={currentUser.isDeafened ? 'Reativar Áudio' : 'Desativar Áudio'}
            className={`p-1.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)] transition-colors cursor-pointer ${
              currentUser.isDeafened ? 'text-[#f23f43] hover:text-[#f23f43]' : ''
            }`}
          >
            <Headphones size={18} />
          </button>
          <button
            onClick={onOpenSettings}
            title="Configurações do Usuário"
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)] transition-colors cursor-pointer"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
