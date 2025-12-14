import { io } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@arbitrage/shared';
import type { Socket } from 'socket.io-client';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const createSocket = (): AppSocket => {
    return io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        autoConnect: false,
    });
};
