/**
 * Normalize a symbol to the standard format (e.g., BTC-USD)
 */
export declare function normalizeSymbol(symbol: string): string;
/**
 * Parse symbol into base and quote
 */
export declare function parseSymbol(symbol: string): {
    base: string;
    quote: string;
};
/**
 * Normalize exchange name to lowercase ID
 */
export declare function normalizeExchange(exchange: string): string;
/**
 * Format price for display
 */
export declare function formatPrice(price: number, decimals?: number): string;
/**
 * Calculate spread percentage
 */
export declare function calculateSpread(bid: number, ask: number): number;
