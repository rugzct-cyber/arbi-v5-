import type { AggregatedPrice, ArbitrageOpportunity, ArbitrageConfig } from '@arbitrage/shared';

export class ArbitrageDetector {
    private config: ArbitrageConfig;
    private recentOpportunities: Map<string, ArbitrageOpportunity> = new Map();
    private cooldownMs = 1000; // 1 second cooldown per pair

    constructor(config: Partial<ArbitrageConfig> = {}) {
        this.config = {
            minSpreadPercent: config.minSpreadPercent ?? 0.1,
            maxAge: config.maxAge ?? 5000,
            symbols: config.symbols ?? [],
        };
    }

    /**
     * Detect arbitrage opportunity from aggregated price
     */
    detect(aggregated: AggregatedPrice): ArbitrageOpportunity | null {
        const { symbol, bestBid, bestAsk, prices } = aggregated;

        // Need at least 2 exchanges
        if (prices.length < 2) {
            return null;
        }

        // Check if best bid > best ask (arbitrage opportunity)
        // Buy at bestAsk exchange, sell at bestBid exchange
        if (bestBid.price <= bestAsk.price) {
            return null;
        }

        // Different exchanges required
        if (bestBid.exchange === bestAsk.exchange) {
            return null;
        }

        const spreadPercent = ((bestBid.price - bestAsk.price) / bestAsk.price) * 100;

        // Check minimum spread threshold
        if (spreadPercent < this.config.minSpreadPercent) {
            return null;
        }

        // Check cooldown
        const pairKey = `${symbol}:${bestAsk.exchange}:${bestBid.exchange}`;
        const recent = this.recentOpportunities.get(pairKey);

        if (recent && Date.now() - recent.timestamp < this.cooldownMs) {
            return null;
        }

        const opportunity: ArbitrageOpportunity = {
            id: `${Date.now()}-${symbol}-${bestAsk.exchange}-${bestBid.exchange}`,
            symbol,
            buyExchange: bestAsk.exchange,
            sellExchange: bestBid.exchange,
            buyPrice: bestAsk.price,
            sellPrice: bestBid.price,
            spreadPercent,
            potentialProfit: bestBid.price - bestAsk.price,
            timestamp: Date.now(),
        };

        this.recentOpportunities.set(pairKey, opportunity);

        // Cleanup old opportunities
        this.cleanup();

        return opportunity;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ArbitrageConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get recent opportunities
     */
    getRecent(limit = 100): ArbitrageOpportunity[] {
        return Array.from(this.recentOpportunities.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Cleanup old opportunities
     */
    private cleanup(): void {
        const now = Date.now();
        const maxAge = 60000; // 1 minute

        for (const [key, opportunity] of this.recentOpportunities) {
            if (now - opportunity.timestamp > maxAge) {
                this.recentOpportunities.delete(key);
            }
        }
    }
}
