/**
 * Simple Arbitrage Strategy
 * 
 * This strategy:
 * 1. Monitors arbitrage opportunities from the detector
 * 2. Filters based on configurable criteria
 * 3. Sends valid opportunities to the TradeExecutor
 */

import type { ArbitrageOpportunity } from '@arbitrage/shared';
import type { TradingConfig, TradeResult } from '../types.js';
import { TradeExecutor } from '../trade-executor.js';
import { DEFAULT_TRADING_CONFIG } from '../types.js';

export interface StrategyConfig {
    // Minimum spread to consider (%)
    minSpread: number;

    // Maximum spread to consider (%)
    maxSpread: number;

    // Default trade size in USD
    defaultSizeUsd: number;

    // Only trade these symbols (empty = all)
    allowedSymbols: string[];

    // Only trade on these exchanges (empty = all)
    allowedExchanges: string[];

    // Blacklisted symbols
    blacklistedSymbols: string[];
}

const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
    minSpread: 0.15,
    maxSpread: 2.0,
    defaultSizeUsd: 100,
    allowedSymbols: [],
    allowedExchanges: [],
    blacklistedSymbols: [],
};

export class SimpleArbStrategy {
    private config: StrategyConfig;
    private executor: TradeExecutor;
    private isRunning: boolean = false;
    private stats = {
        opportunitiesSeen: 0,
        opportunitiesFiltered: 0,
        tradesAttempted: 0,
        tradesSucceeded: 0,
        tradesFailed: 0,
    };

    constructor(
        executor: TradeExecutor,
        config: Partial<StrategyConfig> = {}
    ) {
        this.config = { ...DEFAULT_STRATEGY_CONFIG, ...config };
        this.executor = executor;

        console.log('[SimpleArbStrategy] Initialized');
        console.log(`  - Min Spread: ${this.config.minSpread}%`);
        console.log(`  - Max Spread: ${this.config.maxSpread}%`);
        console.log(`  - Default Size: $${this.config.defaultSizeUsd}`);
    }

    /**
     * Start the strategy
     */
    start(): void {
        this.isRunning = true;
        console.log('[SimpleArbStrategy] Strategy started');
    }

    /**
     * Stop the strategy
     */
    stop(): void {
        this.isRunning = false;
        console.log('[SimpleArbStrategy] Strategy stopped');
    }

    /**
     * Process an arbitrage opportunity
     * Call this from the arbitrage detector when an opportunity is found
     */
    async process(opportunity: ArbitrageOpportunity): Promise<TradeResult | null> {
        this.stats.opportunitiesSeen++;

        if (!this.isRunning) {
            return null;
        }

        // Apply filters
        if (!this.passesFilters(opportunity)) {
            this.stats.opportunitiesFiltered++;
            return null;
        }

        console.log(`[SimpleArbStrategy] 🎯 Processing opportunity: ${opportunity.symbol}`);
        console.log(`  - Spread: ${opportunity.spreadPercent.toFixed(3)}%`);
        console.log(`  - Buy: ${opportunity.buyExchange} @ ${opportunity.buyPrice}`);
        console.log(`  - Sell: ${opportunity.sellExchange} @ ${opportunity.sellPrice}`);

        // Execute trade
        this.stats.tradesAttempted++;

        const result = await this.executor.execute(
            opportunity.symbol,
            opportunity.buyExchange,  // Long side
            opportunity.sellExchange, // Short side
            opportunity.spreadPercent,
            this.config.defaultSizeUsd
        );

        if (result.success) {
            this.stats.tradesSucceeded++;
            console.log(`[SimpleArbStrategy] ✅ Trade succeeded: ${result.trade?.id}`);
        } else {
            this.stats.tradesFailed++;
            console.log(`[SimpleArbStrategy] ❌ Trade failed: ${result.error}`);
        }

        return result;
    }

    /**
     * Check if opportunity passes all filters
     */
    private passesFilters(opp: ArbitrageOpportunity): boolean {
        // Spread bounds
        if (opp.spreadPercent < this.config.minSpread) {
            return false;
        }
        if (opp.spreadPercent > this.config.maxSpread) {
            return false;
        }

        // Symbol whitelist
        if (this.config.allowedSymbols.length > 0) {
            if (!this.config.allowedSymbols.includes(opp.symbol)) {
                return false;
            }
        }

        // Symbol blacklist
        if (this.config.blacklistedSymbols.includes(opp.symbol)) {
            return false;
        }

        // Exchange whitelist
        if (this.config.allowedExchanges.length > 0) {
            if (!this.config.allowedExchanges.includes(opp.buyExchange) ||
                !this.config.allowedExchanges.includes(opp.sellExchange)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get strategy statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            opportunitiesSeen: 0,
            opportunitiesFiltered: 0,
            tradesAttempted: 0,
            tradesSucceeded: 0,
            tradesFailed: 0,
        };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<StrategyConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Check if strategy is running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}
