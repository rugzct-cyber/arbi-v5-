import type { PriceUpdate, AggregatedPrice } from './price.js';
import type { ArbitrageOpportunity, ArbitrageStats } from './arbitrage.js';

/**
 * Trading bot stats structure
 */
export interface TradingStats {
    isRunning: boolean;
    isAuthenticated: boolean;
    strategy: {
        opportunitiesSeen: number;
        opportunitiesFiltered: number;
        tradesAttempted: number;
        tradesSucceeded: number;
        tradesFailed: number;
    };
    activeTrades: unknown[];
    tradeHistory: unknown[];
}

/**
 * Events emitted from server to client
 */
export interface ServerToClientEvents {
    // Price events
    'price:update': (data: PriceUpdate[]) => void;
    'price:aggregated': (data: AggregatedPrice[]) => void;

    // Arbitrage events
    'arbitrage:opportunity': (data: ArbitrageOpportunity) => void;
    'arbitrage:stats': (data: ArbitrageStats) => void;

    // Connection events
    'exchange:connected': (exchange: string) => void;
    'exchange:disconnected': (exchange: string) => void;
    'exchange:error': (data: { exchange: string; error: string }) => void;

    // Trading events
    'trading:update': (data: TradingStats) => void;
    'trading:error': (message: string) => void;
}

/**
 * Events emitted from client to server
 */
export interface ClientToServerEvents {
    // Subscriptions
    'subscribe:symbols': (symbols: string[]) => void;
    'unsubscribe:symbols': (symbols: string[]) => void;
    'subscribe:exchanges': (exchanges: string[]) => void;

    // Configuration
    'config:update': (config: { minSpread?: number }) => void;

    // Trading control
    'trading:start': (token: string) => void;
    'trading:stop': () => void;
    'trading:config': (config: Record<string, unknown>) => void;
    'trading:stats': () => void;
}

/**
 * Inter-server events (if scaling with Redis adapter)
 */
export interface InterServerEvents {
    ping: () => void;
}

/**
 * Socket data attached to each connection
 */
export interface SocketData {
    subscribedSymbols: string[];
    subscribedExchanges: string[];
}
