/**
 * Supported trading symbols
 */
export declare const SUPPORTED_SYMBOLS: readonly ["BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD", "ARB-USD", "OP-USD", "MATIC-USD", "LINK-USD", "UNI-USD", "AAVE-USD", "CRV-USD", "LDO-USD", "MKR-USD", "SNX-USD", "COMP-USD", "DOGE-USD", "SHIB-USD", "PEPE-USD", "WIF-USD", "BONK-USD", "SPX-USD"];
export type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number];
/**
 * Symbol aliases mapping (exchange-specific → normalized)
 */
export declare const SYMBOL_ALIASES: Record<string, string>;
