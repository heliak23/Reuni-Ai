import React, { useState } from 'react';
import type { Guild } from '../types';
import { Plus, Compass, Lock } from 'lucide-react';

interface ServerSidebarProps {
  guilds: Guild[];
  selectedGuildId: string | null;
  onSelectGuild: (guildId: string | null) => void;
  onOpenCreateServer: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  guilds,
  selectedGuildId,
  onSelectGuild,
  onOpenCreateServer,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <nav className="w-[72px] h-full bg-[var(--bg-servers)] border-r border-[var(--border-subtle)] flex flex-col items-center py-3 select-none flex-shrink-0 z-20 transition-colors">
      {/* Reuni-Ai Direct Messages / Home Button */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        {/* White / Contrast Pill indicator */}
        <div
          className={`absolute left-0 w-1 bg-[var(--text-header)] rounded-r transition-all duration-200 ${
            selectedGuildId === null
              ? 'h-10'
              : hoveredId === 'home'
              ? 'h-5'
              : 'h-0'
          }`}
        />

        <button
          onClick={() => onSelectGuild(null)}
          onMouseEnter={() => setHoveredId('home')}
          onMouseLeave={() => setHoveredId(null)}
          className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer ${
            selectedGuildId === null
              ? 'bg-[#5865f2] rounded-[16px] text-white shadow-lg'
              : 'bg-[var(--bg-chat)] hover:bg-[#5865f2] rounded-[24px] hover:rounded-[16px] text-[var(--text-normal)] hover:text-white'
          }`}
        >
          {/* Reuni-Ai SVG Logo */}
          <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2.1 21.2a1 1 0 0 0 1.27 1.27l4.13-1.28A9.95 9.95 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-3 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
          </svg>
        </button>

        {/* Tooltip */}
        <div className="absolute left-[80px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-header)] text-sm font-semibold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
          Reuni-Ai • Início
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--bg-card)] rotate-45 border-l border-b border-[var(--border-card)]" />
        </div>
      </div>

      {/* Separator Line */}
      <div className="w-8 h-[2px] bg-[var(--border-card)] rounded my-1" />

      {/* Guilds List */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 py-1 scrollbar-none">
        {guilds.map((guild) => {
          const isActive = selectedGuildId === guild.id;
          const isHovered = hoveredId === guild.id;

          return (
            <div
              key={guild.id}
              className="relative group flex items-center justify-center w-full"
            >
              {/* Pill indicator */}
              <div
                className={`absolute left-0 w-1 bg-[var(--text-header)] rounded-r transition-all duration-200 ${
                  isActive
                    ? 'h-10'
                    : isHovered
                    ? 'h-5'
                    : 'h-0'
                }`}
              />

              <button
                onClick={() => onSelectGuild(guild.id)}
                onMouseEnter={() => setHoveredId(guild.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#5865f2] rounded-[16px] text-white shadow-md'
                    : 'bg-[var(--bg-chat)] hover:bg-[#5865f2] rounded-[24px] hover:rounded-[16px] text-[var(--text-normal)] hover:text-white'
                }`}
              >
                <div className="w-full h-full rounded-inherit overflow-hidden flex items-center justify-center">
                  {guild.icon ? (
                    <img
                      src={guild.icon}
                      alt={guild.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold text-sm">
                      {guild.name
                        .split(' ')
                        .map((word) => word[0])
                        .slice(0, 3)
                        .join('')
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                {(guild.hasPassword || guild.password) && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 bg-[#1e1f22] p-1 rounded-full border border-black/40 text-[#f0b232] shadow-sm z-10"
                    title="Servidor protegido por senha"
                  >
                    <Lock size={10} />
                  </div>
                )}
              </button>

              {/* Tooltip */}
              <div className="absolute left-[80px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-header)] text-sm font-semibold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 flex items-center gap-2">
                <span>{guild.name}</span>
                {(guild.hasPassword || guild.password) && (
                  <span className="text-[10px] bg-[#f0b232]/20 text-[#f0b232] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Lock size={10} /> Protegido
                  </span>
                )}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--bg-card)] rotate-45 border-l border-b border-[var(--border-card)]" />
              </div>
            </div>
          );
        })}

        {/* Add Server Button */}
        <div className="relative group flex items-center justify-center w-full mt-1">
          <button
            onClick={onOpenCreateServer}
            className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] hover:bg-[#23a55a] text-[#23a55a] hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
          >
            <Plus size={24} />
          </button>
          <div className="absolute left-[80px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-header)] text-sm font-semibold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
            Adicionar um Servidor
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--bg-card)] rotate-45 border-l border-b border-[var(--border-card)]" />
          </div>
        </div>

        {/* Explore Public Servers Button */}
        <div className="relative group flex items-center justify-center w-full">
          <button className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] hover:bg-[#23a55a] text-[#23a55a] hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer">
            <Compass size={24} />
          </button>
          <div className="absolute left-[80px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-header)] text-sm font-semibold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
            Explorar Servidores Públicos
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--bg-card)] rotate-45 border-l border-b border-[var(--border-card)]" />
          </div>
        </div>
      </div>
    </nav>
  );
};
