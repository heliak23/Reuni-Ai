import React, { useState, useEffect, useRef } from 'react';
import type { User, AudioDevice, AudioSettings } from '../types';
import { handleAvatarError, REUNI_BOT_AVATAR, DEFAULT_USER_AVATAR } from '../utils/avatar';
import {
  X,
  User as UserIcon,
  Mic,
  Headphones,
  Palette,
  Check,
  Play,
  Square,
} from 'lucide-react';

interface UserSettingsModalProps {
  currentUser: User;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  audioSettings: AudioSettings;
  onAudioSettingsChange: (settings: AudioSettings) => void;
  onUpdateUser: (updated: Partial<User>) => void;
  onClose: () => void;
}

const AVATAR_OPTIONS = [
  REUNI_BOT_AVATAR,
  DEFAULT_USER_AVATAR,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
];

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  currentUser,
  theme,
  onThemeChange,
  audioSettings,
  onAudioSettingsChange,
  onUpdateUser,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'voice' | 'appearance'>('profile');

  // Profile Form state
  const [username, setUsername] = useState(currentUser.username);
  const [customStatus, setCustomStatus] = useState(currentUser.customStatus || '');
  const [status, setStatus] = useState(currentUser.status);
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar);

  // Audio Devices state
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [headphones, setHeadphones] = useState<AudioDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState(audioSettings.inputDeviceId);
  const [selectedSpeaker, setSelectedSpeaker] = useState(audioSettings.outputDeviceId);
  const [inputVolume, setInputVolume] = useState(audioSettings.inputVolume);
  const [outputVolume, setOutputVolume] = useState(audioSettings.outputVolume);

  // Live Mic Test state
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const testAnimationRef = useRef<number | null>(null);

  // Enumerate Audio Devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request temporary mic permission if not already granted so labels are revealed
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach((track) => track.stop());
        } catch {
          // If denied, continue enumerating
        }

        const devices = await navigator.mediaDevices.enumerateDevices();

        const inputs: AudioDevice[] = [];
        const outputs: AudioDevice[] = [];

        devices.forEach((device) => {
          if (device.kind === 'audioinput') {
            inputs.push({
              deviceId: device.deviceId,
              label: device.label || `Microfone ${inputs.length + 1}`,
            });
          } else if (device.kind === 'audiooutput') {
            outputs.push({
              deviceId: device.deviceId,
              label: device.label || `Fone / Alto-falante ${outputs.length + 1}`,
            });
          }
        });

        // Add default option if empty
        if (inputs.length === 0) {
          inputs.push({ deviceId: 'default', label: 'Microfone Padrão do Sistema' });
        }
        if (outputs.length === 0) {
          outputs.push({ deviceId: 'default', label: 'Alto-falantes / Fone Padrão' });
        }

        setMicrophones(inputs);
        setHeadphones(outputs);

        if (!selectedMic && inputs.length > 0) setSelectedMic(inputs[0].deviceId);
        if (!selectedSpeaker && outputs.length > 0) setSelectedSpeaker(outputs[0].deviceId);
      } catch (err) {
        console.warn('Erro ao carregar dispositivos de áudio:', err);
      }
    }

    loadDevices();
  }, []);

  // Stop testing mic on unmount or tab switch
  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, [activeTab]);

  const startMicTest = async () => {
    try {
      stopMicTest();

      const constraints: MediaStreamConstraints = {
        audio: selectedMic && selectedMic !== 'default' ? { deviceId: { exact: selectedMic } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      testStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      testAudioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Map 0-128 to 0-100%
        const normalized = Math.min(100, Math.round((avg / 60) * 100));
        setMicLevel(normalized);

        testAnimationRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('Falha ao iniciar teste do microfone:', err);
      setIsTestingMic(false);
    }
  };

  const stopMicTest = () => {
    if (testAnimationRef.current) {
      cancelAnimationFrame(testAnimationRef.current);
      testAnimationRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((track) => track.stop());
      testStreamRef.current = null;
    }
    if (testAudioCtxRef.current) {
      testAudioCtxRef.current.close().catch(() => {});
      testAudioCtxRef.current = null;
    }
    setIsTestingMic(false);
    setMicLevel(0);
  };

  const handleSave = () => {
    stopMicTest();

    // Save profile
    onUpdateUser({
      username: username.trim() || currentUser.username,
      customStatus,
      status,
      avatar: selectedAvatar,
    });

    // Save audio settings
    onAudioSettingsChange({
      inputDeviceId: selectedMic,
      outputDeviceId: selectedSpeaker,
      inputVolume,
      outputVolume,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-[var(--bg-modal)] w-full max-w-3xl rounded-xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col md:flex-row h-[88vh] md:h-[620px] max-h-[720px] transition-colors">
        {/* Mobile Horizontal Tabs (< md) */}
        <div className="md:hidden bg-[var(--bg-modal-header)] border-b border-[var(--border-subtle)] px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#5865f2] text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <UserIcon size={14} />
            <span>Minha Conta</span>
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'voice'
                ? 'bg-[#5865f2] text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Mic size={14} />
            <span>Voz e Vídeo</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-[#5865f2] text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Palette size={14} />
            <span>Aparência</span>
          </button>
        </div>

        {/* Desktop Left Sidebar Tabs (>= md) */}
        <div className="hidden md:flex md:w-56 bg-[var(--bg-modal-header)] border-r border-[var(--border-subtle)] p-4 flex-col justify-between flex-shrink-0">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 mb-2">
              Configurações
            </h3>

            {/* Profile Tab Button */}
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[var(--bg-hover)] text-[var(--text-header)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)]'
              }`}
            >
              <UserIcon size={18} />
              <span>Minha Conta</span>
            </button>

            {/* Voice & Video Tab Button */}
            <button
              onClick={() => setActiveTab('voice')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'voice'
                  ? 'bg-[var(--bg-hover)] text-[var(--text-header)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)]'
              }`}
            >
              <Mic size={18} />
              <span>Voz e Vídeo</span>
            </button>

            {/* Appearance Tab Button */}
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'appearance'
                  ? 'bg-[var(--bg-hover)] text-[var(--text-header)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-normal)]'
              }`}
            >
              <Palette size={18} />
              <span>Aparência</span>
            </button>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] px-2 pt-4 border-t border-[var(--border-subtle)]">
            Reuni-Ai v1.2.0 • Plataforma Web
          </div>
        </div>

        {/* Right Main Content Pane */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[var(--bg-modal)]">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
            <h2 className="text-lg font-bold text-[var(--text-header)]">
              {activeTab === 'profile' && 'Minha Conta'}
              {activeTab === 'voice' && 'Configurações de Voz (Microfone & Fone)'}
              {activeTab === 'appearance' && 'Configurações de Aparência'}
            </h2>
            <button
              onClick={() => {
                stopMicTest();
                onClose();
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-header)] p-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. MINHA CONTA / PROFILE TAB */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Avatar selection */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                    Avatar do Perfil
                  </label>
                  <div className="flex items-center gap-4 mb-3">
                    <img
                      src={selectedAvatar}
                      alt="Avatar atual"
                      onError={(e) => handleAvatarError(e, currentUser.id.startsWith('bot'))}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-[#5865f2] shadow-md"
                    />
                    <span className="text-sm text-[var(--text-muted)]">Escolha um avatar pré-definido:</span>
                  </div>
                  <div className="flex gap-3">
                    {AVATAR_OPTIONS.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        onClick={() => setSelectedAvatar(url)}
                        onError={(e) => handleAvatarError(e, false)}
                        alt={`Opção ${idx + 1}`}
                        className={`w-12 h-12 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform ${
                          selectedAvatar === url ? 'ring-2 ring-[#5865f2]' : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded p-2.5 text-sm text-[var(--text-header)] outline-none focus:border-[#5865f2] transition-colors"
                  />
                </div>

                {/* Custom Status */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                    Status Personalizado
                  </label>
                  <input
                    type="text"
                    placeholder="O que você está fazendo agora?"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded p-2.5 text-sm text-[var(--text-header)] outline-none focus:border-[#5865f2] transition-colors"
                  />
                </div>

                {/* Status Radio (Online, Idle, DND) */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                    Status de Presença
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setStatus('online')}
                      className={`flex items-center gap-2 p-2.5 rounded border text-sm font-medium transition-all cursor-pointer ${
                        status === 'online'
                          ? 'bg-[#23a55a]/15 border-[#23a55a] text-[var(--text-header)]'
                          : 'bg-[var(--bg-hover)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-normal)]'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-[#23a55a]" />
                      <span>Online</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatus('idle')}
                      className={`flex items-center gap-2 p-2.5 rounded border text-sm font-medium transition-all cursor-pointer ${
                        status === 'idle'
                          ? 'bg-[#f0b232]/15 border-[#f0b232] text-[var(--text-header)]'
                          : 'bg-[var(--bg-hover)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-normal)]'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-[#f0b232]" />
                      <span>Ausente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatus('dnd')}
                      className={`flex items-center gap-2 p-2.5 rounded border text-sm font-medium transition-all cursor-pointer ${
                        status === 'dnd'
                          ? 'bg-[#f23f43]/15 border-[#f23f43] text-[var(--text-header)]'
                          : 'bg-[var(--bg-hover)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-normal)]'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-[#f23f43]" />
                      <span>Ocupado</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. VOZ E VÍDEO / AUDIO DEVICES TAB */}
            {activeTab === 'voice' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Audio Device Selectors (Input & Output) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Microfone / Entrada */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                      <Mic size={16} className="text-[#5865f2]" />
                      <span>Dispositivo de Entrada (Microfone)</span>
                    </label>
                    <select
                      value={selectedMic}
                      onChange={(e) => setSelectedMic(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded p-2.5 text-sm text-[var(--text-header)] outline-none focus:border-[#5865f2] transition-colors cursor-pointer"
                    >
                      {microphones.map((mic) => (
                        <option key={mic.deviceId} value={mic.deviceId} className="bg-[var(--bg-modal)] text-[var(--text-normal)]">
                          {mic.label}
                        </option>
                      ))}
                    </select>

                    {/* Input Volume Slider */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>Volume de Entrada</span>
                        <span>{inputVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={inputVolume}
                        onChange={(e) => setInputVolume(Number(e.target.value))}
                        className="w-full accent-[#5865f2] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Fone de Ouvido / Saída */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-interactive)] uppercase tracking-wider mb-2">
                      <Headphones size={16} className="text-[#5865f2]" />
                      <span>Dispositivo de Saída (Fone / Alto-falante)</span>
                    </label>
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded p-2.5 text-sm text-[var(--text-header)] outline-none focus:border-[#5865f2] transition-colors cursor-pointer"
                    >
                      {headphones.map((speaker) => (
                        <option key={speaker.deviceId} value={speaker.deviceId} className="bg-[var(--bg-modal)] text-[var(--text-normal)]">
                          {speaker.label}
                        </option>
                      ))}
                    </select>

                    {/* Output Volume Slider */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>Volume de Saída</span>
                        <span>{outputVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={outputVolume}
                        onChange={(e) => setOutputVolume(Number(e.target.value))}
                        className="w-full accent-[#5865f2] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Microphone Test */}
                <div className="p-4 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-header)]">
                        Teste de Microfone
                      </h4>
                      <p className="text-xs text-[var(--text-muted)]">
                        Fale no microfone selecionado para verificar o nível de volume.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={isTestingMic ? stopMicTest : startMicTest}
                      className={`px-4 py-2 rounded font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isTestingMic
                          ? 'bg-[#f23f43] hover:bg-[#da373c] text-white'
                          : 'bg-[#5865f2] hover:bg-[#4752c4] text-white'
                      }`}
                    >
                      {isTestingMic ? <Square size={14} fill="white" /> : <Play size={14} fill="white" />}
                      <span>{isTestingMic ? 'Parar Teste' : 'Testar'}</span>
                    </button>
                  </div>

                  {/* Volume Level Bar */}
                  <div className="w-full bg-[var(--bg-input)] h-4 rounded-full overflow-hidden p-0.5 border border-[var(--border-subtle)] flex items-center">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${isTestingMic ? micLevel : 0}%`,
                        background:
                          micLevel > 80
                            ? 'linear-gradient(90deg, #23a55a, #f0b232, #f23f43)'
                            : 'linear-gradient(90deg, #23a55a, #3ba55d)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 px-1">
                    <span>Silencioso</span>
                    <span>{isTestingMic ? `${micLevel}%` : 'Aguardando'}</span>
                    <span>Sensibilidade Ideal</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. APARÊNCIA / THEME TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-header)] mb-1">
                    Tema da Interface
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mb-4">
                    Escolha entre o Modo Escuro ou o Modo Claro do Reuni-Ai.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Dark Theme Card */}
                    <div
                      onClick={() => onThemeChange('dark')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'border-[#5865f2] bg-[#5865f2]/10 shadow-lg'
                          : 'border-[var(--border-card)] bg-[var(--bg-hover)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-[#1e1f22] border border-white/20" />
                          <span className="font-bold text-sm text-[var(--text-header)]">Modo Escuro</span>
                        </div>
                        {theme === 'dark' && <Check size={18} className="text-[#5865f2]" />}
                      </div>

                      {/* Mini preview */}
                      <div className="rounded-lg overflow-hidden border border-[#1f2023] flex h-24 text-[10px]">
                        <div className="w-8 bg-[#1e1f22] p-1 flex flex-col gap-1 items-center">
                          <div className="w-4 h-4 rounded-full bg-[#5865f2]" />
                          <div className="w-4 h-4 rounded-full bg-[#313338]" />
                        </div>
                        <div className="w-16 bg-[#2b2d31] p-1.5 flex flex-col gap-1">
                          <div className="w-10 h-2 bg-[#3f4147] rounded" />
                          <div className="w-8 h-2 bg-[#35373c] rounded" />
                        </div>
                        <div className="flex-1 bg-[#313338] p-2 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="w-16 h-2 bg-[#dbdee1] rounded" />
                            <div className="w-24 h-1.5 bg-[#4e5058] rounded" />
                          </div>
                          <div className="w-full h-3 bg-[#383a40] rounded" />
                        </div>
                      </div>
                    </div>

                    {/* Light Theme Card */}
                    <div
                      onClick={() => onThemeChange('light')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        theme === 'light'
                          ? 'border-[#5865f2] bg-[#5865f2]/10 shadow-lg'
                          : 'border-[var(--border-card)] bg-[var(--bg-hover)] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-white border border-black/20" />
                          <span className="font-bold text-sm text-[var(--text-header)]">Modo Claro</span>
                        </div>
                        {theme === 'light' && <Check size={18} className="text-[#5865f2]" />}
                      </div>

                      {/* Mini preview */}
                      <div className="rounded-lg overflow-hidden border border-[#d1d3d6] flex h-24 text-[10px]">
                        <div className="w-8 bg-[#e3e5e8] p-1 flex flex-col gap-1 items-center">
                          <div className="w-4 h-4 rounded-full bg-[#5865f2]" />
                          <div className="w-4 h-4 rounded-full bg-[#ffffff]" />
                        </div>
                        <div className="w-16 bg-[#f2f3f5] p-1.5 flex flex-col gap-1">
                          <div className="w-10 h-2 bg-[#d1d3d6] rounded" />
                          <div className="w-8 h-2 bg-[#e0e2e5] rounded" />
                        </div>
                        <div className="flex-1 bg-[#ffffff] p-2 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="w-16 h-2 bg-[#2e3338] rounded" />
                            <div className="w-24 h-1.5 bg-[#747f8d] rounded" />
                          </div>
                          <div className="w-full h-3 bg-[#ebedef] rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-[var(--bg-modal-header)] px-6 py-4 flex items-center justify-end gap-3 border-t border-[var(--border-subtle)]">
            <button
              onClick={() => {
                stopMicTest();
                onClose();
              }}
              className="text-sm font-medium text-[var(--text-header)] hover:underline px-4 py-2 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium text-sm px-6 py-2 rounded transition-colors cursor-pointer shadow-md"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
