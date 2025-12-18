import type { PriceData, AggregatedPrice } from '@arbitrage/shared';
import { EngineConfig } from '../config.js';

export class PriceAggregator {
    private prices: Map<string, Map<string, PriceData>> = new Map();
    private maxAge = EngineConfig.MAX_PRICE_AGE;
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Run cleanup every second
        this.cleanupInterval = setInterval(() => this.cleanup(), 1000);
    }

    /**
     * Update price and return aggregated view
     */
    update(price: PriceData): AggregatedPrice {
        // Get or create symbol map
        if (!this.prices.has(price.symbol)) {
            this.prices.set(price.symbol, new Map());
        }

        const symbolPrices = this.prices.get(price.symbol)!;
        symbolPrices.set(price.exchange, price);

        return this.aggregate(price.symbol);
    }

    /**
     * Get aggregated price for a symbol
     */
    aggregate(symbol: string): AggregatedPrice {
        const symbolPrices = this.prices.get(symbol);

        if (!symbolPrices || symbolPrices.size === 0) {
            return {
                symbol,
                prices: [],
                bestBid: { exchange: '', price: 0 },
                bestAsk: { exchange: '', price: 0 },
                timestamp: Date.now(),
            };
        }

        // Filter out stale prices
        const now = Date.now();
        const validPrices: PriceData[] = [];

        for (const [exchange, price] of symbolPrices) {
            if (now - price.timestamp <= this.maxAge) {
                validPrices.push(price);
            }
        }

        // Find best bid (highest) and best ask (lowest)
        let bestBid = { exchange: '', price: 0 };
        let bestAsk = { exchange: '', price: Infinity };

        for (const price of validPrices) {
            if (price.bid > bestBid.price) {
                bestBid = { exchange: price.exchange, price: price.bid };
            }
            if (price.ask < bestAsk.price) {
                bestAsk = { exchange: price.exchange, price: price.ask };
            }
        }

        // Reset bestAsk if no valid prices
        if (bestAsk.price === Infinity) {
            bestAsk = { exchange: '', price: 0 };
        }

        return {
            symbol,
            prices: validPrices,
            bestBid,
            bestAsk,
            timestamp: Date.now(),
        };
    }

    /**
     * Get all aggregated prices
     */
    getAll(): AggregatedPrice[] {
        const result: AggregatedPrice[] = [];

        for (const symbol of this.prices.keys()) {
            result.push(this.aggregate(symbol));
        }

        return result;
    }

    /**
     * Get raw price for a specific exchange and symbol
     */
    getPrice(exchange: string, symbol: string): PriceData | undefined {
        return this.prices.get(symbol)?.get(exchange);
    }

    /**
     * Clear all prices
     */
    clear(): void {
        this.prices.clear();
    }
    /**
     * Periodic cleanup of stale prices
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [symbol, symbolPrices] of this.prices) {
            for (const [exchange, price] of symbolPrices) {
                if (now - price.timestamp > this.maxAge) {
                    symbolPrices.delete(exchange);
                }
            }
            if (symbolPrices.size === 0) {
                this.prices.delete(symbol);
            }
        }
    }
}
