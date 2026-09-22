import { io, type Socket } from 'socket.io-client';
import { getAuthToken } from './auth';

// Socket.IO URL:
// - Dev: undefined → defaults to current page origin (Vite proxy handles /socket.io)
// - Production: full backend URL (e.g. https://ai-dm-api.duckdns.org)
const SOCKET_URL: string | undefined = import.meta.env.VITE_API_URL || undefined;

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => { cb({ token: getAuthToken() }); },
});
