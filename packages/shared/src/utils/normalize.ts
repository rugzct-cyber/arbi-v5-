import { SYMBOL_ALIASES } from '../constants/symbols.js';

/**
 * Normalize a symbol to the standard format (e.g., BTC-USD)
 */
export function normalizeSymbol(symbol: string): string {
    // Check aliases first
    if (SYMBOL_ALIASES[symbol]) {
        return SYMBOL_ALIASES[symbol];
    }

    // Handle common formats
    const upper = symbol.toUpperCase();

    // Remove common suffixes
    const cleaned = upper
        .replace(/USDT$/, '')
        .replace(/USD$/, '')
        .replace(/PERP$/, '')
        .replace(/-PERP$/, '')
        .replace(/-USD$/, '');

    return `${cleaned}-USD`;
}

/**
 * Parse symbol into base and quote
 */
export function parseSymbol(symbol: string): { base: string; quote: string } {
    const normalized = normalizeSymbol(symbol);
    const [base, quote] = normalized.split('-');
    return { base: base || symbol, quote: quote || 'USD' };
}

/**
 * Normalize exchange name to lowercase ID
 */
export function normalizeExchange(exchange: string): string {
    return exchange.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals: number = 2): string {
    if (price >= 1000) {
        return price.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    // For small prices, show more decimals
    const effectiveDecimals = price < 1 ? 6 : price < 10 ? 4 : decimals;
    return price.toFixed(effectiveDecimals);
}

/**
 * Calculate spread percentage
 */
export function calculateSpread(bid: number, ask: number): number {
    if (bid === 0) return 0;
    return ((ask - bid) / bid) * 100;
}
