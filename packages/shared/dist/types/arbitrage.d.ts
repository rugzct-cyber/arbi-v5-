/**
 * Arbitrage opportunity detected between exchanges
 */
export interface ArbitrageOpportunity {
    id: string;
    symbol: string;
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    spreadPercent: number;
    potentialProfit: number;
    timestamp: number;
}
/**
 * Arbitrage detection configuration
 */
export interface ArbitrageConfig {
    minSpreadPercent: number;
    maxAge: number;
    symbols: string[];
}
/**
 * Arbitrage statistics
 */
export interface ArbitrageStats {
    totalOpportunities: number;
    avgSpread: number;
    maxSpread: number;
    bestPair: {
        symbol: string;
        buyExchange: string;
        sellExchange: string;
        spread: number;
    } | null;
    lastUpdate: number;
}
