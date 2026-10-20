export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  customStatus?: string;
  voiceChannelId?: string | null;
  isMuted?: boolean;
  isDeafened?: boolean;
  isStreaming?: boolean;
  streamTitle?: string;
}

export interface Channel {
  id: string;
  guildId: string;
  name: string;
  type: 'text' | 'voice';
  topic?: string;
}

export interface Guild {
  id: string;
  name: string;
  icon?: string;
  password?: string;
  hasPassword?: boolean;
  channels: Channel[];
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface Message {
  id: string;
  channelId: string;
  guildId: string;
  author: User;
  content: string;
  timestamp: string;
  reactions: Reaction[];
  attachments?: string[];
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface AudioSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  inputVolume: number;
  outputVolume: number;
}
