/**
 * Risk Manager
 * Controls position sizing, exposure limits, and trade validation
 */

import type { TradingConfig, RiskCheckResult, ArbitrageTrade } from './types.js';

export class RiskManager {
    private config: TradingConfig;
    private activeTrades: Map<string, ArbitrageTrade> = new Map();
    private tradeCooldowns: Map<string, number> = new Map();

    constructor(config: TradingConfig) {
        this.config = config;
    }

    /**
     * Check if a trade is allowed based on risk parameters
     */
    checkTrade(
        symbol: string,
        longExchange: string,
        shortExchange: string,
        spreadPercent: number,
        requestedSizeUsd: number
    ): RiskCheckResult {
        // Check if trading is enabled
        if (!this.config.enabled && !this.config.paperMode) {
            return { allowed: false, reason: 'Trading is disabled' };
        }

        // Check spread bounds
        if (spreadPercent < this.config.minSpreadPercent) {
            return { allowed: false, reason: `Spread ${spreadPercent.toFixed(3)}% below minimum ${this.config.minSpreadPercent}%` };
        }

        if (spreadPercent > this.config.maxSpreadPercent) {
            return { allowed: false, reason: `Spread ${spreadPercent.toFixed(3)}% above maximum ${this.config.maxSpreadPercent}% (likely error)` };
        }

        // Check cooldown
        const pairKey = `${symbol}:${longExchange}:${shortExchange}`;
        const lastTrade = this.tradeCooldowns.get(pairKey);
        if (lastTrade && Date.now() - lastTrade < this.config.tradeCooldownMs) {
            const remaining = this.config.tradeCooldownMs - (Date.now() - lastTrade);
            return { allowed: false, reason: `Cooldown active, ${remaining}ms remaining` };
        }

        // Check position size
        let adjustedSize = Math.min(requestedSizeUsd, this.config.maxPositionSizeUsd);

        // Check total exposure
        const currentExposure = this.getTotalExposure();
        const availableExposure = this.config.maxTotalExposureUsd - currentExposure;

        if (availableExposure <= 0) {
            return { allowed: false, reason: `Max exposure reached (${currentExposure}/${this.config.maxTotalExposureUsd} USD)` };
        }

        adjustedSize = Math.min(adjustedSize, availableExposure);

        return { allowed: true, adjustedSize };
    }

    /**
     * Get total current exposure in USD
     */
    getTotalExposure(): number {
        let total = 0;
        for (const trade of this.activeTrades.values()) {
            if (trade.status === 'COMPLETED' || trade.status === 'PARTIAL') {
                total += trade.quantity * trade.entryPriceLong;
            }
        }
        return total;
    }

    /**
     * Register a new active trade
     */
    registerTrade(trade: ArbitrageTrade): void {
        this.activeTrades.set(trade.id, trade);
        const pairKey = `${trade.symbol}:${trade.longExchange}:${trade.shortExchange}`;
        this.tradeCooldowns.set(pairKey, Date.now());
    }

    /**
     * Close a trade
     */
    closeTrade(tradeId: string): void {
        this.activeTrades.delete(tradeId);
    }

    /**
     * Get all active trades
     */
    getActiveTrades(): ArbitrageTrade[] {
        return Array.from(this.activeTrades.values());
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<TradingConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): TradingConfig {
        return { ...this.config };
    }
}
