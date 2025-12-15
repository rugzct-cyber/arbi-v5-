/**
 * Price data from an exchange
 */
export interface PriceData {
    exchange: string;
    symbol: string;
    bid: number;
    ask: number;
    timestamp: number;
}
/**
 * Price update event payload
 */
export interface PriceUpdate {
    exchange: string;
    symbol: string;
    bid: number;
    ask: number;
    spread: number;
    timestamp: number;
}
/**
 * Aggregated price across exchanges for a single symbol
 */
export interface AggregatedPrice {
    symbol: string;
    prices: PriceData[];
    bestBid: {
        exchange: string;
        price: number;
    };
    bestAsk: {
        exchange: string;
        price: number;
    };
    timestamp: number;
}
/**
 * Historical price point from QuestDB
 */
export interface HistoricalPrice {
    exchange: string;
    symbol: string;
    bid: number;
    ask: number;
    timestamp: Date;
}
