import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff } from 'lucide-react';

interface CreateServerModalProps {
  onClose: () => void;
  onCreateServer: (name: string, iconUrl?: string, password?: string) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  onClose,
  onCreateServer,
}) => {
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateServer(name.trim(), iconUrl.trim() || undefined, password.trim() || undefined);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-[var(--bg-modal)] w-full max-w-md rounded-xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="p-6 text-center relative border-b border-[var(--border-subtle)] bg-[var(--bg-modal-header)]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-header)] p-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
          <h2 className="text-2xl font-bold text-[var(--text-header)] mb-2">
            Crie seu servidor
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a conversar.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
              Nome do Servidor
            </label>
            <input
              type="text"
              required
              placeholder="Servidor dos Amigos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded p-2.5 text-sm text-[var(--text-header)] outline-none focus:border-[#5865f2] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
              URL do Ícone (Opcional)
            </label>
            <input
              type="url"
              placeholder="https://exemplo.com/icone.png"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded p-2.5 text-sm text-[var(--text-header)] outline-none focus:border-[#5865f2] transition-colors"
            />
          </div>

          {/* Optional Password field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider">
                <Lock size={14} className="text-[#5865f2]" />
                <span>Senha de Acesso (Opcional)</span>
              </label>
              <span className="text-[10px] text-[var(--text-muted)]">Privacidade</span>
            </div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Deixe em branco para acesso livre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded p-2.5 pr-10 text-sm text-[var(--text-header)] outline-none focus:border-[#5865f2] transition-colors"
              />
              {password && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              Se definida, outros usuários precisarão digitar essa senha para entrar no servidor.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-[var(--text-header)] hover:underline cursor-pointer"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white font-medium text-sm px-6 py-2.5 rounded transition-colors cursor-pointer shadow-md"
            >
              Criar Servidor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
