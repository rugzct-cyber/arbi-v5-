import type { AggregatedPrice, ArbitrageOpportunity, ArbitrageConfig, PriceData } from '@arbitrage/shared';
import { EngineConfig } from '../config.js';

export class ArbitrageDetector {
    private config: ArbitrageConfig;
    private recentOpportunities: Map<string, ArbitrageOpportunity> = new Map();
    private cooldownMs = 1000; // 1 second cooldown per pair

    // Freshness protection settings
    private readonly maxPriceAge = 2000; // 2 seconds - prices older than this are stale
    private readonly maxRealisticSpread = 5; // 5% - spreads above this are likely errors
    private readonly minConfirmations = 1; // Number of confirmations needed (future use)

    constructor(config: Partial<ArbitrageConfig> = {}) {
        this.config = {
            minSpreadPercent: config.minSpreadPercent ?? 0.1,
            maxAge: config.maxAge ?? EngineConfig.ARBITRAGE_COOLDOWN,
            symbols: config.symbols ?? [],
        };

        // Run cleanup every 30 seconds to avoid O(N) on hot path
        setInterval(() => this.cleanup(), 30000);
    }

    /**
     * Detect arbitrage opportunity from aggregated price
     * Now with freshness validation to prevent false spikes
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

        // ===== FRESHNESS PROTECTION =====
        // Check that both prices are fresh
        const now = Date.now();
        const bidPrice = prices.find(p => p.exchange === bestBid.exchange);
        const askPrice = prices.find(p => p.exchange === bestAsk.exchange);

        if (!bidPrice || !askPrice) {
            return null;
        }

        const bidAge = now - bidPrice.timestamp;
        const askAge = now - askPrice.timestamp;

        if (bidAge > this.maxPriceAge || askAge > this.maxPriceAge) {
            // One of the prices is stale - skip this opportunity
            console.log(`[ArbitrageDetector] Skipping ${symbol}: stale price (bid age: ${bidAge}ms, ask age: ${askAge}ms)`);
            return null;
        }

        // ===== SANITY CHECK =====
        // Spreads > 5% are almost certainly errors (flash crash, bad data, etc.)
        if (spreadPercent > this.maxRealisticSpread) {
            console.warn(`[ArbitrageDetector] Skipping ${symbol}: unrealistic spread ${spreadPercent.toFixed(2)}% (> ${this.maxRealisticSpread}%)`);
            return null;
        }

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

