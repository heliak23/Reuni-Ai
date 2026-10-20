import React, { useState, useRef, useEffect } from 'react';
import type { Channel, Message, User } from '../types';
import { handleAvatarError } from '../utils/avatar';
import {
  Hash,
  Bell,
  Pin,
  Users,
  Search,
  Inbox,
  HelpCircle,
  PlusCircle,
  Smile,
  Gift,
  Send,
  SmilePlus,
  Menu,
} from 'lucide-react';

interface ChatAreaProps {
  currentChannel: Channel | null;
  messages: Message[];
  currentUser: User;
  onSendMessage: (content: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  isMemberListOpen: boolean;
  onToggleMemberList: () => void;
  typingUsers: string[];
  onStartTyping: () => void;
  onStopTyping: () => void;
  onOpenMobileMenu?: () => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '🚀', '🎉', '😂', '👀', '✨'];

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentChannel,
  messages,
  currentUser,
  onSendMessage,
  onReact,
  isMemberListOpen,
  onToggleMemberList,
  typingUsers,
  onStartTyping,
  onStopTyping,
  onOpenMobileMenu,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    onStartTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim()) {
        onSendMessage(inputText.trim());
        setInputText('');
        onStopTyping();
      }
    }
  };

  const handleSendButtonClick = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
      onStopTyping();
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Hoje às ${time}` : `${date.toLocaleDateString()} ${time}`;
    } catch {
      return '';
    }
  };

  const renderContent = (content: string) => {
    // Basic markdown parsing for bold, code, and mentions
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-bold text-[var(--text-header)]">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div className="flex-1 h-full bg-[var(--bg-chat)] flex flex-col min-w-0 transition-colors">
      {/* Top Header Bar */}
      <div className="h-12 border-b border-[var(--border-subtle)] px-3 sm:px-4 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex-shrink-0 z-10">
        <div className="flex items-center gap-2 truncate min-w-0">
          {/* Hamburger Menu on Mobile */}
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 -ml-1 text-[var(--text-interactive)] hover:text-[var(--text-header)] hover:bg-[var(--bg-hover)] rounded transition-colors cursor-pointer flex-shrink-0"
            title="Abrir Canais"
          >
            <Menu size={20} />
          </button>

          <Hash size={22} className="text-[var(--text-muted)] flex-shrink-0" />
          <span className="font-bold text-[var(--text-header)] truncate text-sm sm:text-base">
            {currentChannel ? currentChannel.name : 'geral'}
          </span>
          {currentChannel?.topic && (
            <span className="hidden md:inline text-xs text-[var(--text-muted)] truncate max-w-xs border-l border-[var(--border-card)] pl-2 ml-1">
              {currentChannel.topic}
            </span>
          )}
        </div>

        {/* Right Header Icons */}
        <div className="flex items-center gap-2 sm:gap-4 text-[var(--text-interactive)] flex-shrink-0">
          <button title="Notificações" className="hidden sm:block hover:text-[var(--text-normal)] transition-colors cursor-pointer">
            <Bell size={20} />
          </button>
          <button title="Mensagens Fixadas" className="hidden sm:block hover:text-[var(--text-normal)] transition-colors cursor-pointer">
            <Pin size={20} />
          </button>
          <button
            onClick={onToggleMemberList}
            title={isMemberListOpen ? 'Ocultar Lista de Membros' : 'Mostrar Lista de Membros'}
            className={`transition-colors cursor-pointer p-1 rounded hover:bg-[var(--bg-hover)] ${
              isMemberListOpen ? 'text-[var(--text-header)]' : 'hover:text-[var(--text-normal)]'
            }`}
          >
            <Users size={20} />
          </button>

          {/* Search Box */}
          <div className="relative hidden md:flex items-center">
            <input
              type="text"
              placeholder="Buscar"
              className="bg-[var(--bg-input)] text-xs text-[var(--text-normal)] placeholder-[var(--text-muted)] px-2 py-1.5 pr-6 rounded focus:w-48 w-32 transition-all outline-none"
            />
            <Search size={14} className="absolute right-2 text-[var(--text-muted)] pointer-events-none" />
          </div>

          <button title="Caixa de Entrada" className="hidden sm:block hover:text-[var(--text-normal)] transition-colors cursor-pointer">
            <Inbox size={20} />
          </button>
          <button title="Ajuda" className="hidden sm:block hover:text-[var(--text-normal)] transition-colors cursor-pointer">
            <HelpCircle size={20} />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* Welcome Banner */}
        {currentChannel && (
          <div className="mb-6 pt-4 pb-2 border-b border-[var(--border-subtle)]">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-header)] mb-2">
              <Hash size={40} />
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-header)] mb-1">
              Bem-vindo a #{currentChannel.name}!
            </h1>
            <p className="text-[var(--text-muted)] text-sm">
              Este é o início do canal #{currentChannel.name}.
            </p>
          </div>
        )}

        {/* Message Items */}
        {messages.map((message) => {
          const isBot = message.author.id.startsWith('bot');

          return (
            <div
              key={message.id}
              className="group relative flex gap-4 -mx-4 px-4 py-1 hover:bg-[var(--bg-hover)]/40 transition-colors"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0 mt-0.5">
                <img
                  src={message.author.avatar}
                  alt={message.author.username}
                  onError={(e) => handleAvatarError(e, isBot)}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-header)] hover:underline cursor-pointer text-sm">
                    {message.author.username}
                  </span>
                  {isBot && (
                    <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase leading-none">
                      BOT
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>

                <div className="text-[var(--text-normal)] text-sm mt-1 whitespace-pre-wrap leading-relaxed select-text">
                  {renderContent(message.content)}
                </div>

                {/* Reactions list */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {message.reactions.map((reaction) => {
                      const hasReacted = reaction.users.includes(currentUser.id);
                      return (
                        <button
                          key={reaction.emoji}
                          onClick={() => onReact(message.id, reaction.emoji)}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-xs font-semibold cursor-pointer transition-colors ${
                            hasReacted
                              ? 'bg-[#5865f2]/20 border-[#5865f2] text-[var(--text-header)]'
                              : 'bg-[var(--bg-channels)] border-transparent hover:border-[var(--border-card)] text-[var(--text-interactive)]'
                          }`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      );
                    })}

                    {/* Quick Add Reaction Button */}
                    <button
                      onClick={() =>
                        setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)
                      }
                      className="px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-channels)] text-[var(--text-muted)] hover:text-[var(--text-normal)] text-xs cursor-pointer"
                    >
                      <SmilePlus size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Floating Quick Action Bar on Hover */}
              <div className="absolute right-4 -top-3 hidden group-hover:flex items-center bg-[var(--bg-card)] border border-[var(--border-card)] rounded shadow-md px-1 py-0.5 gap-1 z-10">
                {COMMON_EMOJIS.slice(0, 3).map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(message.id, emoji)}
                    className="p-1 hover:bg-[var(--bg-hover)] rounded text-base cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)
                  }
                  className="p-1 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-normal)] rounded cursor-pointer"
                >
                  <SmilePlus size={16} />
                </button>
              </div>

              {/* Emoji Picker Popover */}
              {showEmojiPicker === message.id && (
                <div className="absolute right-4 top-6 bg-[var(--bg-card)] border border-[var(--border-card)] p-2 rounded-lg shadow-2xl flex gap-2 z-20 animate-fadeIn">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact(message.id, emoji);
                        setShowEmojiPicker(null);
                      }}
                      className="text-xl hover:scale-125 transition-transform p-1 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      <div className="h-6 px-4 flex items-center text-xs text-[var(--text-muted)]">
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span className="font-semibold text-[var(--text-header)]">
              {typingUsers.join(', ')}
            </span>
            <span>{typingUsers.length === 1 ? 'está digitando...' : 'estão digitando...'}</span>
          </div>
        )}
      </div>

      {/* Chat Input Box Container */}
      <div className="px-4 pb-6 flex-shrink-0">
        <div className="relative bg-[var(--bg-input)] rounded-lg flex items-center px-4 py-2.5">
          {/* Add Attachment Button */}
          <button
            title="Enviar Arquivo ou Imagem"
            className="text-[var(--text-interactive)] hover:text-[var(--text-header)] p-1 mr-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <PlusCircle size={22} />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${currentChannel ? currentChannel.name : 'geral'}`}
            className="flex-1 bg-transparent text-[var(--text-normal)] placeholder-[var(--text-muted)] text-sm outline-none"
          />

          {/* Input Actions (Presente, GIF, Sticker, Emoji, Send) */}
          <div className="flex items-center gap-2 text-[var(--text-interactive)]">
            <button
              title="Enviar Presente"
              className="hover:text-[var(--text-header)] p-1 transition-colors cursor-pointer"
            >
              <Gift size={20} />
            </button>
            <button
              title="GIFs"
              className="hover:text-[var(--text-header)] p-1 font-bold text-xs uppercase px-1.5 py-0.5 rounded bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              GIF
            </button>
            <button
              onClick={() => setShowInputEmoji(!showInputEmoji)}
              title="Emojis"
              className="hover:text-[var(--text-header)] p-1 transition-colors cursor-pointer"
            >
              <Smile size={20} />
            </button>

            {inputText.trim() && (
              <button
                onClick={handleSendButtonClick}
                title="Enviar Mensagem"
                className="bg-[#5865f2] hover:bg-[#4752c4] text-white p-1.5 rounded-full transition-colors cursor-pointer shadow-md"
              >
                <Send size={16} />
              </button>
            )}
          </div>

          {/* Emoji Quick Picker above input */}
          {showInputEmoji && (
            <div className="absolute right-4 bottom-14 bg-[var(--bg-card)] border border-[var(--border-card)] p-2.5 rounded-lg shadow-2xl flex gap-2 z-30">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInputText((prev) => prev + emoji);
                    setShowInputEmoji(false);
                  }}
                  className="text-2xl hover:scale-125 transition-transform p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
