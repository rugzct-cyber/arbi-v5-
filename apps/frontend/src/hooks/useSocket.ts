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

// Only show exchanges that are actually implemented in the engine
const ACTIVE_EXCHANGE_IDS = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal'];
const ALL_EXCHANGES: ExchangeStatus[] = ACTIVE_EXCHANGE_IDS.map(id => ({
    id,
    connected: false
}));

const REFRESH_INTERVAL = 5000; // 5 seconds

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false);

    // Live prices (constantly updated)
    const livePricesRef = useRef<Map<string, Map<string, PriceUpdate>>>(new Map());

    // Display prices (frozen snapshot, updated on interval or manual refresh)
    const [displayPrices, setDisplayPrices] = useState<Map<string, Map<string, PriceUpdate>>>(new Map());

    // Last refresh timestamp
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
    const [exchanges, setExchanges] = useState<ExchangeStatus[]>(ALL_EXCHANGES);
    const socketRef = useRef<TypedSocket | null>(null);

    // Refresh function - copies live prices to display prices
    const refreshPrices = useCallback(() => {
        // Deep copy the live prices
        const snapshot = new Map<string, Map<string, PriceUpdate>>();
        livePricesRef.current.forEach((exchangeMap, symbol) => {
            snapshot.set(symbol, new Map(exchangeMap));
        });
        setDisplayPrices(snapshot);
        setLastRefresh(new Date());
    }, []);

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

        // Handle price updates - update live prices ref (no re-render)
        socket.on('price:update', (updates) => {
            for (const update of updates) {
                if (!livePricesRef.current.has(update.symbol)) {
                    livePricesRef.current.set(update.symbol, new Map());
                }
                livePricesRef.current.get(update.symbol)!.set(update.exchange, update);
            }
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

    // Auto-refresh every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refreshPrices();
        }, REFRESH_INTERVAL);

        // Initial refresh after 1 second to show something
        const initialTimeout = setTimeout(() => {
            refreshPrices();
        }, 1000);

        return () => {
            clearInterval(interval);
            clearTimeout(initialTimeout);
        };
    }, [refreshPrices]);

    const subscribeToSymbols = useCallback((symbols: string[]) => {
        socketRef.current?.emit('subscribe:symbols', symbols);
    }, []);

    const unsubscribeFromSymbols = useCallback((symbols: string[]) => {
        socketRef.current?.emit('unsubscribe:symbols', symbols);
    }, []);

    return {
        isConnected,
        prices: displayPrices,
        opportunities,
        exchanges,
        lastRefresh,
        refreshPrices,
        subscribeToSymbols,
        unsubscribeFromSymbols,
    };
}
