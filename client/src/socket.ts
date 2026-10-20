import { io, Socket } from 'socket.io-client';

// In development with Vite dev server (port 5173), default to localhost:3001
// In production (Railway, etc.), connect to the same host/origin automatically
const getDefaultServerUrl = () => {
  if (typeof window !== 'undefined' && window.location.port !== '5173') {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const SERVER_URL = import.meta.env.VITE_SERVER_URL || getDefaultServerUrl();

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});
