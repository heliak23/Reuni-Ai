import React from 'react';
import type { User } from '../types';
import { X } from 'lucide-react';
import { handleAvatarError } from '../utils/avatar';

interface MemberListProps {
  users: User[];
  currentUser: User;
  onClose?: () => void;
}

export const MemberList: React.FC<MemberListProps> = ({ users, currentUser, onClose }) => {
  // Ensure current user is present
  const allUsers = users.some((u) => u.id === currentUser.id)
    ? users
    : [currentUser, ...users];

  const bots = allUsers.filter((u) => u.id.startsWith('bot'));
  const onlineHumans = allUsers.filter(
    (u) => !u.id.startsWith('bot') && u.status !== 'offline'
  );
  const offlineHumans = allUsers.filter(
    (u) => !u.id.startsWith('bot') && u.status === 'offline'
  );

  return (
    <div className="w-60 h-full bg-[var(--bg-channels)] flex flex-col select-none flex-shrink-0 z-10 border-l border-[var(--border-subtle)] px-3 py-4 overflow-y-auto transition-colors">
      {/* Mobile close button */}
      {onClose && (
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border-subtle)] lg:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-header)]">
            Membros
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-header)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
            title="Fechar membros"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bot Section */}
      {bots.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] tracking-wider mb-1 px-1">
            BOTS INTELIGENTES — {bots.length}
          </h3>
          <div className="space-y-[2px]">
            {bots.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] hover:bg-[var(--bg-hover)] cursor-pointer group transition-colors"
              >
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    onError={(e) => handleAvatarError(e, true)}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-channels)] bg-[#23a55a]" />
                </div>
                <div className="flex flex-col truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[#5865f2] group-hover:underline truncate">
                      {user.username}
                    </span>
                    <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1 py-0.2 rounded uppercase">
                      BOT
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] truncate">
                    {user.customStatus || 'Assistente Reuni-Ai'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Online Users Section */}
      <div className="mb-4">
        <h3 className="text-xs font-bold text-[var(--text-muted)] tracking-wider mb-1 px-1">
          ONLINE — {onlineHumans.length}
        </h3>
        <div className="space-y-[2px]">
          {onlineHumans.map((user) => {
            const isMe = user.id === currentUser.id;

            return (
              <div
                key={user.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] hover:bg-[var(--bg-hover)] cursor-pointer group transition-colors"
              >
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    onError={(e) => handleAvatarError(e, false)}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-channels)] ${
                      user.status === 'online'
                        ? 'bg-[#23a55a]'
                        : user.status === 'idle'
                        ? 'bg-[#f0b232]'
                        : 'bg-[#f23f43]'
                    }`}
                  />
                </div>
                <div className="flex flex-col truncate">
                  <span
                    className={`text-sm font-medium truncate group-hover:underline ${
                      isMe ? 'text-[var(--text-header)] font-semibold' : 'text-[var(--text-normal)]'
                    }`}
                  >
                    {user.username} {isMe && '(Você)'}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] truncate">
                    {user.customStatus || 'Conectado'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Offline Section if any */}
      {offlineHumans.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-[var(--text-muted)] tracking-wider mb-1 px-1">
            OFFLINE — {offlineHumans.length}
          </h3>
          <div className="space-y-[2px]">
            {offlineHumans.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] hover:bg-[var(--bg-hover)] cursor-pointer group opacity-60 transition-colors"
              >
                <div className="relative">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    onError={(e) => handleAvatarError(e, false)}
                    className="w-8 h-8 rounded-full object-cover grayscale"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-channels)] bg-[#80848e]" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium text-[var(--text-muted)] truncate">
                    {user.username}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
