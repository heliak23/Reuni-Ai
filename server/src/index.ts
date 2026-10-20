import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

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
  users: string[]; // user IDs
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

// Initial mock data for servers
const INITIAL_SERVERS: Guild[] = [
  {
    id: 'server-reuni-ai',
    name: 'Reuni-Ai Comunidade',
    icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop&crop=faces',
    channels: [
      { id: 'ch-boas-vindas', guildId: 'server-reuni-ai', name: 'boas-vindas', type: 'text', topic: 'Regras e novidades da comunidade Reuni-Ai!' },
      { id: 'ch-geral', guildId: 'server-reuni-ai', name: 'geral', type: 'text', topic: 'Converse sobre qualquer assunto livremente.' },
      { id: 'ch-desenvolvimento', guildId: 'server-reuni-ai', name: 'desenvolvimento', type: 'text', topic: 'Projetos, código e novidades técnicas.' },
      { id: 'ch-musica-bots', guildId: 'server-reuni-ai', name: 'bots-comandos', type: 'text', topic: 'Comandos e integrações inteligentes.' },
      { id: 'voice-geral', guildId: 'server-reuni-ai', name: 'Sala de Bate-Papo', type: 'voice' },
      { id: 'voice-reuniao', guildId: 'server-reuni-ai', name: 'Reunião de Equipe', type: 'voice' },
      { id: 'voice-jogos', guildId: 'server-reuni-ai', name: 'Jogos & Resenha', type: 'voice' },
    ],
  },
  {
    id: 'server-devs',
    name: 'Fullstack Brasil',
    icon: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=100&h=100&fit=crop&crop=faces',
    channels: [
      { id: 'ch-dev-geral', guildId: 'server-devs', name: 'geral', type: 'text', topic: 'Espaço de desenvolvedores.' },
      { id: 'ch-react-next', guildId: 'server-devs', name: 'react-nextjs', type: 'text', topic: 'Frontend moderno e performance.' },
      { id: 'voice-dev-coworking', guildId: 'server-devs', name: 'Coworking Silencioso', type: 'voice' },
    ],
  },
  {
    id: 'server-gaming',
    name: 'Arena Games & Chill',
    icon: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&h=100&fit=crop&crop=faces',
    channels: [
      { id: 'ch-gaming-geral', guildId: 'server-gaming', name: 'chat-games', type: 'text', topic: 'Combinar partidas e clipes.' },
      { id: 'voice-duo-1', guildId: 'server-gaming', name: 'Duo 1', type: 'voice' },
      { id: 'voice-squad', guildId: 'server-gaming', name: 'Squad Principal', type: 'voice' },
    ],
  },
];

const REUNI_BOT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='bgGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%235865F2'/%3E%3Cstop offset='100%25' stop-color='%233b48c8'/%3E%3C/linearGradient%3E%3ClinearGradient id='glowGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2357F287'/%3E%3Cstop offset='100%25' stop-color='%2323a55a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='60' cy='60' r='60' fill='url(%23bgGrad)'/%3E%3Crect x='57' y='18' width='6' height='16' rx='3' fill='%23ffffff' opacity='0.9'/%3E%3Ccircle cx='60' cy='18' r='7' fill='url(%23glowGrad)'/%3E%3Crect x='20' y='52' width='10' height='24' rx='5' fill='%23ebedef'/%3E%3Crect x='90' y='52' width='10' height='24' rx='5' fill='%23ebedef'/%3E%3Crect x='26' y='32' width='68' height='54' rx='18' fill='%23ffffff'/%3E%3Crect x='34' y='40' width='52' height='38' rx='10' fill='%2323272A'/%3E%3Ccircle cx='48' cy='56' r='6' fill='%235865F2'/%3E%3Ccircle cx='46.5' cy='54.5' r='2' fill='%23ffffff'/%3E%3Ccircle cx='72' cy='56' r='6' fill='%235865F2'/%3E%3Ccircle cx='70.5' cy='54.5' r='2' fill='%23ffffff'/%3E%3Cpath d='M52 68 Q60 74 68 68' stroke='%2357F287' stroke-width='3' stroke-linecap='round' fill='none'/%3E%3C/svg%3E`;

const BOT_USER: User = {
  id: 'bot-reuni-ai',
  username: 'Reuni-Bot',
  discriminator: '0000',
  avatar: REUNI_BOT_AVATAR,
  status: 'online',
  customStatus: '🤖 Assistente Inteligente',
};

// Initial messages
let messages: Message[] = [
  {
    id: 'msg-1',
    channelId: 'ch-boas-vindas',
    guildId: 'server-reuni-ai',
    author: BOT_USER,
    content: '🎉 **Seja muito bem-vindo ao Reuni-Ai!**\nEste é o seu novo espaço para reuniões, bate-papo em tempo real e canais de áudio de alta qualidade.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    reactions: [{ emoji: '👋', count: 4, users: [] }, { emoji: '🚀', count: 3, users: [] }],
  },
  {
    id: 'msg-2',
    channelId: 'ch-geral',
    guildId: 'server-reuni-ai',
    author: {
      id: 'user-carlos',
      username: 'CarlosDev',
      discriminator: '1337',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      status: 'online',
      customStatus: 'Codando em TypeScript 💻',
    },
    content: 'E aí pessoal! Como tá o projeto? Essa interface do Reuni-Ai tá incrível!',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    reactions: [{ emoji: '🔥', count: 2, users: [] }],
  },
  {
    id: 'msg-3',
    channelId: 'ch-geral',
    guildId: 'server-reuni-ai',
    author: BOT_USER,
    content: 'O suporte a canais de voz WebRTC e mensagens em tempo real com WebSockets já está totalmente ativo! 🎙️✨',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    reactions: [{ emoji: '❤️', count: 1, users: [] }],
  },
];

// Active users map
const connectedUsers = new Map<string, { socketId: string; user: User }>();
// Typing users tracking: channelId -> Set of usernames
const typingStatus = new Map<string, Set<string>>();

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Conectado: ${socket.id}`);

  // Handle user identification
  socket.on('user:join', (userData: Partial<User>) => {
    const user: User = {
      id: userData.id || `user-${socket.id.slice(0, 6)}`,
      username: userData.username || `Viajante_${Math.floor(1000 + Math.random() * 9000)}`,
      discriminator: userData.discriminator || String(Math.floor(1000 + Math.random() * 9000)),
      avatar: userData.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${socket.id}`,
      status: userData.status || 'online',
      customStatus: userData.customStatus || 'Online no Reuni-Ai',
      voiceChannelId: null,
      isMuted: false,
      isDeafened: false,
    };

    // Clean up any old session with the same user ID to prevent ghost sockets
    for (const [sId, sess] of connectedUsers.entries()) {
      if (sess.user.id === user.id && sId !== socket.id) {
        connectedUsers.delete(sId);
      }
    }

    socket.join(`user:${user.id}`);
    connectedUsers.set(socket.id, { socketId: socket.id, user });

    // Send initial bootstrap payload
    socket.emit('ready', {
      self: user,
      guilds: INITIAL_SERVERS,
      messages,
      onlineUsers: [BOT_USER, ...Array.from(connectedUsers.values()).map((u) => u.user)],
    });

    // Broadcast user presence to everyone else
    socket.broadcast.emit('presence:update', user);
  });

  // Handle message creation
  socket.on('message:send', (data: { channelId: string; guildId: string; content: string }) => {
    const sender = connectedUsers.get(socket.id)?.user;
    if (!sender || !data.content?.trim()) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      channelId: data.channelId,
      guildId: data.guildId,
      author: sender,
      content: data.content,
      timestamp: new Date().toISOString(),
      reactions: [],
    };

    messages.push(newMessage);
    if (messages.length > 500) messages.shift(); // retain last 500 messages

    // Stop typing indicator for this user
    const channelTypers = typingStatus.get(data.channelId);
    if (channelTypers) {
      channelTypers.delete(sender.username);
      io.to(data.channelId).emit('typing:update', {
        channelId: data.channelId,
        users: Array.from(channelTypers),
      });
    }

    // Broadcast to all clients
    io.emit('message:new', newMessage);
  });

  // Handle message reactions
  socket.on('message:react', (data: { messageId: string; emoji: string }) => {
    const sender = connectedUsers.get(socket.id)?.user;
    if (!sender) return;

    const msg = messages.find((m) => m.id === data.messageId);
    if (!msg) return;

    let reaction = msg.reactions.find((r) => r.emoji === data.emoji);
    if (reaction) {
      if (reaction.users.includes(sender.id)) {
        // Toggle off
        reaction.users = reaction.users.filter((id) => id !== sender.id);
        reaction.count -= 1;
        if (reaction.count <= 0) {
          msg.reactions = msg.reactions.filter((r) => r.emoji !== data.emoji);
        }
      } else {
        // Add
        reaction.users.push(sender.id);
        reaction.count += 1;
      }
    } else {
      msg.reactions.push({
        emoji: data.emoji,
        count: 1,
        users: [sender.id],
      });
    }

    io.emit('message:reaction_update', {
      messageId: msg.id,
      reactions: msg.reactions,
    });
  });

  // Handle typing indicators
  socket.on('typing:start', (channelId: string) => {
    const sender = connectedUsers.get(socket.id)?.user;
    if (!sender) return;

    if (!typingStatus.has(channelId)) {
      typingStatus.set(channelId, new Set());
    }
    const current = typingStatus.get(channelId)!;
    current.add(sender.username);

    socket.broadcast.emit('typing:update', {
      channelId,
      users: Array.from(current),
    });
  });

  socket.on('typing:stop', (channelId: string) => {
    const sender = connectedUsers.get(socket.id)?.user;
    if (!sender) return;

    const current = typingStatus.get(channelId);
    if (current) {
      current.delete(sender.username);
      socket.broadcast.emit('typing:update', {
        channelId,
        users: Array.from(current),
      });
    }
  });

  // Handle voice room state
  socket.on('voice:join', (channelId: string) => {
    const session = connectedUsers.get(socket.id);
    if (!session) return;

    session.user.voiceChannelId = channelId;
    io.emit('voice:state_update', {
      userId: session.user.id,
      voiceChannelId: channelId,
      isMuted: session.user.isMuted,
      isDeafened: session.user.isDeafened,
    });
  });

  socket.on('voice:leave', () => {
    const session = connectedUsers.get(socket.id);
    if (!session) return;

    session.user.voiceChannelId = null;
    session.user.isStreaming = false;
    session.user.streamTitle = undefined;
    io.emit('voice:state_update', {
      userId: session.user.id,
      voiceChannelId: null,
      isStreaming: false,
    });
  });

  // Handle screen streaming (Reuni-Ai Go Live)
  socket.on('stream:start', (data: { channelId: string; title?: string }) => {
    const session = connectedUsers.get(socket.id);
    if (!session) return;

    session.user.isStreaming = true;
    session.user.streamTitle = data.title || `${session.user.username}'s Screen`;
    io.emit('voice:state_update', {
      userId: session.user.id,
      voiceChannelId: session.user.voiceChannelId,
      isStreaming: true,
      streamTitle: session.user.streamTitle,
    });
    io.emit('stream:started', {
      userId: session.user.id,
      channelId: data.channelId,
      title: session.user.streamTitle,
    });
  });

  socket.on('stream:stop', () => {
    const session = connectedUsers.get(socket.id);
    if (!session) return;

    session.user.isStreaming = false;
    session.user.streamTitle = undefined;
    io.emit('voice:state_update', {
      userId: session.user.id,
      voiceChannelId: session.user.voiceChannelId,
      isStreaming: false,
    });
    io.emit('stream:stopped', {
      userId: session.user.id,
    });
  });

  // Handle server/guild creation with optional password
  socket.on('guild:create', (guildData: { name: string; icon?: string; password?: string }) => {
    const newGuild: Guild = {
      id: `server-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: guildData.name,
      icon: guildData.icon,
      password: guildData.password?.trim() || undefined,
      hasPassword: Boolean(guildData.password?.trim()),
      channels: [
        { id: `ch-${Date.now()}-geral`, guildId: `server-${Date.now()}`, name: 'geral', type: 'text', topic: 'Canal geral do servidor' },
        { id: `voice-${Date.now()}-geral`, guildId: `server-${Date.now()}`, name: 'Voz Geral', type: 'voice' },
      ],
    };
    INITIAL_SERVERS.push(newGuild);
    io.emit('guild:new', newGuild);
  });

  socket.on('voice:toggle_mute', () => {
    const session = connectedUsers.get(socket.id);
    if (!session) return;

    session.user.isMuted = !session.user.isMuted;
    io.emit('voice:state_update', {
      userId: session.user.id,
      voiceChannelId: session.user.voiceChannelId,
      isMuted: session.user.isMuted,
    });
  });

  socket.on('voice:toggle_deafen', () => {
    const session = connectedUsers.get(socket.id);
    if (!session) return;

    session.user.isDeafened = !session.user.isDeafened;
    if (session.user.isDeafened) {
      session.user.isMuted = true;
    }
    io.emit('voice:state_update', {
      userId: session.user.id,
      voiceChannelId: session.user.voiceChannelId,
      isMuted: session.user.isMuted,
      isDeafened: session.user.isDeafened,
    });
  });

  socket.on('voice:speaking', (isSpeaking: boolean) => {
    const session = connectedUsers.get(socket.id);
    if (!session || !session.user.voiceChannelId) return;

    socket.broadcast.emit('voice:user_speaking', {
      userId: session.user.id,
      channelId: session.user.voiceChannelId,
      isSpeaking,
    });
  });

  // WebRTC Signaling for multi-user voice audio
  socket.on('webrtc:signal', (data: { to: string; signal: any; from?: string }) => {
    const sender = connectedUsers.get(socket.id)?.user;
    const senderId = sender?.id || data.from;
    if (!senderId || !data.to) return;

    console.log(`[WebRTC Signal] De ${sender?.username || senderId} para ${data.to} (${data.signal?.type || 'candidate'})`);

    // Emit to target user's personal room
    io.to(`user:${data.to}`).emit('webrtc:signal', {
      from: senderId,
      signal: data.signal,
    });

    // Also emit directly to matching active socket IDs for redundancy
    for (const [targetSocketId, targetSession] of connectedUsers.entries()) {
      if (targetSession.user.id === data.to && targetSocketId !== socket.id) {
        io.to(targetSocketId).emit('webrtc:signal', {
          from: senderId,
          signal: data.signal,
        });
      }
    }
  });

  // Disconnection
  socket.on('disconnect', () => {
    const session = connectedUsers.get(socket.id);
    if (session) {
      console.log(`[Socket] Desconectado: ${session.user.username}`);
      io.emit('presence:remove', session.user.id);
      connectedUsers.delete(socket.id);
    }
  });
});

// Serve frontend static files in production / Railway
const possibleDistPaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
];
const clientDistPath = possibleDistPaths.find((p) => fs.existsSync(p));

if (clientDistPath) {
  console.log(`📦 [Servidor Reuni-Ai] Servindo frontend de: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 [Servidor Reuni-Ai] Rodando na porta ${PORT}`);
});
