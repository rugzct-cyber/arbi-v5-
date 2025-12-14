'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    PriceUpdate,
    ArbitrageOpportunity
} from '@arbitrage/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface ExchangeStatus {
    id: string;
    connected: boolean;
}

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [prices, setPrices] = useState<Map<string, Map<string, PriceUpdate>>>(new Map());
    const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
    const [exchanges, setExchanges] = useState<ExchangeStatus[]>([]);
    const socketRef = useRef<TypedSocket | null>(null);

    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

        const socket: TypedSocket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Connected to Engine');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Engine');
            setIsConnected(false);
        });

        // Handle price updates
        socket.on('price:update', (updates) => {
            setPrices((prev) => {
                const newPrices = new Map(prev);

                for (const update of updates) {
                    if (!newPrices.has(update.symbol)) {
                        newPrices.set(update.symbol, new Map());
                    }
                    newPrices.get(update.symbol)!.set(update.exchange, update);
                }

                return newPrices;
            });
        });

        // Handle arbitrage opportunities
        socket.on('arbitrage:opportunity', (opportunity) => {
            setOpportunities((prev) => {
                const updated = [opportunity, ...prev].slice(0, 100);
                return updated;
            });
        });

        // Handle exchange status
        socket.on('exchange:connected', (exchange) => {
            setExchanges((prev) => {
                const existing = prev.find(e => e.id === exchange);
                if (existing) {
                    return prev.map(e => e.id === exchange ? { ...e, connected: true } : e);
                }
                return [...prev, { id: exchange, connected: true }];
            });
        });

        socket.on('exchange:disconnected', (exchange) => {
            setExchanges((prev) =>
                prev.map(e => e.id === exchange ? { ...e, connected: false } : e)
            );
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const subscribeToSymbols = useCallback((symbols: string[]) => {
        socketRef.current?.emit('subscribe:symbols', symbols);
    }, []);

    const unsubscribeFromSymbols = useCallback((symbols: string[]) => {
        socketRef.current?.emit('unsubscribe:symbols', symbols);
    }, []);

    return {
        isConnected,
        prices,
        opportunities,
        exchanges,
        subscribeToSymbols,
        unsubscribeFromSymbols,
    };
}
