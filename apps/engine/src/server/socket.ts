import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
} from '@arbitrage/shared';

export function initSocketServer(httpServer: HttpServer) {
    const io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer, {
        cors: {
            origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        console.log(`📱 Client connected: ${socket.id}`);

        // Initialize socket data
        socket.data.subscribedSymbols = [];
        socket.data.subscribedExchanges = [];

        // Handle symbol subscriptions
        socket.on('subscribe:symbols', (symbols) => {
            socket.data.subscribedSymbols = symbols;
            console.log(`📊 [${socket.id}] Subscribed to symbols:`, symbols);
        });

        socket.on('unsubscribe:symbols', (symbols) => {
            socket.data.subscribedSymbols = socket.data.subscribedSymbols.filter(
                (s) => !symbols.includes(s)
            );
        });

        // Handle exchange subscriptions
        socket.on('subscribe:exchanges', (exchanges) => {
            socket.data.subscribedExchanges = exchanges;
            console.log(`🏦 [${socket.id}] Subscribed to exchanges:`, exchanges);
        });

        // Handle configuration updates
        socket.on('config:update', (config) => {
            console.log(`⚙️ [${socket.id}] Config update:`, config);
            // TODO: Apply configuration
        });

        socket.on('disconnect', (reason) => {
            console.log(`👋 Client disconnected: ${socket.id} (${reason})`);
        });
    });

    return io;
}

export type SocketServer = ReturnType<typeof initSocketServer>;
