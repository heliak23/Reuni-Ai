import React, { useState } from 'react';
import type { Guild } from '../types';
import { X, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface ServerPasswordModalProps {
  guild: Guild;
  onClose: () => void;
  onSuccess: (guildId: string) => void;
}

export const ServerPasswordModal: React.FC<ServerPasswordModalProps> = ({
  guild,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    if (guild.password && password.trim() === guild.password) {
      setError(false);
      onSuccess(guild.id);
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-[var(--bg-modal)] w-full max-w-md rounded-xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="p-6 text-center relative border-b border-[var(--border-subtle)] bg-[var(--bg-modal-header)]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-header)] p-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          <div className="w-14 h-14 bg-[#5865f2]/15 border border-[#5865f2]/30 rounded-full flex items-center justify-center text-[#5865f2] mx-auto mb-3 shadow-md">
            <Lock size={26} />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-header)] mb-1">
            Servidor Protegido
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            O servidor <strong className="text-[var(--text-header)]">{guild.name}</strong> requer uma senha de acesso.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
              Senha do Servidor
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Digite a senha de acesso"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                className={`w-full bg-[var(--bg-input)] border rounded p-2.5 pr-10 text-sm text-[var(--text-header)] outline-none transition-colors ${
                  error ? 'border-[#f23f43]' : 'border-[var(--border-subtle)] focus:border-[#5865f2]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-[#f23f43] mt-2 animate-shake">
                <AlertCircle size={14} />
                <span>Senha incorreta! Verifique e tente novamente.</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-[var(--text-header)] hover:underline cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!password.trim()}
              className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white font-bold text-sm px-6 py-2.5 rounded transition-colors cursor-pointer shadow-md"
            >
              Entrar no Servidor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
