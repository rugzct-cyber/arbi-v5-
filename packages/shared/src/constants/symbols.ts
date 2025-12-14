/**
 * Supported trading symbols
 */
export const SUPPORTED_SYMBOLS = [
    'BTC-USD',
    'ETH-USD',
    'SOL-USD',
    'AVAX-USD',
    'ARB-USD',
    'OP-USD',
    'MATIC-USD',
    'LINK-USD',
    'UNI-USD',
    'AAVE-USD',
    'CRV-USD',
    'LDO-USD',
    'MKR-USD',
    'SNX-USD',
    'COMP-USD',
    'DOGE-USD',
    'SHIB-USD',
    'PEPE-USD',
    'WIF-USD',
    'BONK-USD',
    'SPX-USD',
] as const;

export type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number];

/**
 * Symbol aliases mapping (exchange-specific → normalized)
 */
export const SYMBOL_ALIASES: Record<string, string> = {
    // Binance style
    'BTCUSDT': 'BTC-USD',
    'ETHUSDT': 'ETH-USD',
    'SOLUSDT': 'SOL-USD',

    // Hyperliquid style
    'BTC': 'BTC-USD',
    'ETH': 'ETH-USD',
    'SOL': 'SOL-USD',

    // Extended style
    'spx6900': 'SPX-USD',
    'SPX6900-USD': 'SPX-USD',
};
