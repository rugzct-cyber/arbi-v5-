import type { PriceUpdate, AggregatedPrice } from './price';
import type { ArbitrageOpportunity, ArbitrageStats } from './arbitrage';

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
