/**
 * Depth Analyzer
 * 
 * Analyzes order book depth to determine:
 * - Maximum executable size at target slippage
 * - Optimal position sizing
 * - Liquidity warnings
 */

export interface OrderLevel {
    price: number;
    size: number; // In base currency (e.g., BTC)
    total: number; // Cumulative size up to this level
}

export interface DepthData {
    exchange: string;
    symbol: string;
    bids: OrderLevel[]; // Sorted by price descending (best first)
    asks: OrderLevel[]; // Sorted by price ascending (best first)
    timestamp: number;
}

export interface LiquidityAnalysis {
    exchange: string;
    symbol: string;
    side: 'BUY' | 'SELL';

    // Best price available
    bestPrice: number;

    // How much can we execute at different slippage levels
    maxSizeAt01Percent: number; // 0.1% slippage
    maxSizeAt05Percent: number; // 0.5% slippage
    maxSizeAt1Percent: number;  // 1% slippage

    // Average fill price for a given size
    avgPriceForSize: (sizeUsd: number) => number;

    // Slippage for a given size
    slippageForSize: (sizeUsd: number) => number;

    // Is there enough liquidity?
    hasLiquidity: boolean;
    warning?: string;
}

export class DepthAnalyzer {
    // Store latest depth data per exchange/symbol
    private depthCache: Map<string, DepthData> = new Map();

    // Minimum depth levels required for analysis
    private minLevels = 5;

    // Maximum cache age (ms)
    private maxCacheAge = 10000; // 10 seconds

    constructor() {
        console.log('[DepthAnalyzer] Initialized');
    }

    /**
     * Update depth data from WebSocket
     */
    updateDepth(exchange: string, symbol: string, bids: [number, number][], asks: [number, number][]): void {
        const key = this.getKey(exchange, symbol);

        // Convert to OrderLevel format with cumulative totals
        const parsedBids = this.parseOrderBook(bids);
        const parsedAsks = this.parseOrderBook(asks);

        this.depthCache.set(key, {
            exchange,
            symbol,
            bids: parsedBids,
            asks: parsedAsks,
            timestamp: Date.now(),
        });
    }

    /**
     * Parse order book array to OrderLevel with cumulative totals
     */
    private parseOrderBook(levels: [number, number][]): OrderLevel[] {
        let cumulative = 0;
        return levels.map(([price, size]) => {
            cumulative += size;
            return { price, size, total: cumulative };
        });
    }

    /**
     * Analyze liquidity for a BUY order (hitting asks)
     */
    analyzeBuy(exchange: string, symbol: string): LiquidityAnalysis | null {
        const depth = this.getDepth(exchange, symbol);
        if (!depth) return null;

        return this.analyzeSide(depth, 'BUY', depth.asks);
    }

    /**
     * Analyze liquidity for a SELL order (hitting bids)
     */
    analyzeSell(exchange: string, symbol: string): LiquidityAnalysis | null {
        const depth = this.getDepth(exchange, symbol);
        if (!depth) return null;

        return this.analyzeSide(depth, 'SELL', depth.bids);
    }

    /**
     * Analyze one side of the order book
     */
    private analyzeSide(depth: DepthData, side: 'BUY' | 'SELL', levels: OrderLevel[]): LiquidityAnalysis {
        if (levels.length === 0) {
            return {
                exchange: depth.exchange,
                symbol: depth.symbol,
                side,
                bestPrice: 0,
                maxSizeAt01Percent: 0,
                maxSizeAt05Percent: 0,
                maxSizeAt1Percent: 0,
                avgPriceForSize: () => 0,
                slippageForSize: () => Infinity,
                hasLiquidity: false,
                warning: 'No order book data',
            };
        }

        const bestPrice = levels[0].price;

        // Calculate max size at different slippage levels
        const maxSizeAt01Percent = this.calculateMaxSizeAtSlippage(levels, bestPrice, 0.001);
        const maxSizeAt05Percent = this.calculateMaxSizeAtSlippage(levels, bestPrice, 0.005);
        const maxSizeAt1Percent = this.calculateMaxSizeAtSlippage(levels, bestPrice, 0.01);

        // Create functions for dynamic calculations
        const avgPriceForSize = (sizeUsd: number) => this.calculateAvgPrice(levels, sizeUsd, bestPrice);
        const slippageForSize = (sizeUsd: number) => {
            const avgPrice = avgPriceForSize(sizeUsd);
            return Math.abs((avgPrice - bestPrice) / bestPrice);
        };

        // Check if there's reasonable liquidity
        const hasLiquidity = maxSizeAt05Percent >= 1000; // At least $1000 at 0.5% slippage
        let warning: string | undefined;

        if (!hasLiquidity) {
            warning = `Low liquidity: only $${maxSizeAt05Percent.toFixed(0)} available at 0.5% slippage`;
        } else if (levels.length < this.minLevels) {
            warning = `Shallow order book: only ${levels.length} levels`;
        }

        return {
            exchange: depth.exchange,
            symbol: depth.symbol,
            side,
            bestPrice,
            maxSizeAt01Percent,
            maxSizeAt05Percent,
            maxSizeAt1Percent,
            avgPriceForSize,
            slippageForSize,
            hasLiquidity,
            warning,
        };
    }

    /**
     * Calculate maximum size (in USD) executable at given slippage
     */
    private calculateMaxSizeAtSlippage(levels: OrderLevel[], bestPrice: number, maxSlippage: number): number {
        let totalSize = 0;
        let totalValue = 0;

        for (const level of levels) {
            const slippage = Math.abs((level.price - bestPrice) / bestPrice);

            if (slippage > maxSlippage) break;

            totalSize += level.size;
            totalValue += level.size * level.price;
        }

        return totalValue;
    }

    /**
     * Calculate average fill price for a given size in USD
     */
    private calculateAvgPrice(levels: OrderLevel[], sizeUsd: number, bestPrice: number): number {
        if (sizeUsd <= 0 || levels.length === 0) return bestPrice;

        let remaining = sizeUsd;
        let totalQuote = 0;
        let totalBase = 0;

        for (const level of levels) {
            const levelValue = level.size * level.price;

            if (remaining <= levelValue) {
                // Partial fill at this level
                const fillSize = remaining / level.price;
                totalBase += fillSize;
                totalQuote += remaining;
                break;
            }

            // Full fill at this level
            totalBase += level.size;
            totalQuote += levelValue;
            remaining -= levelValue;
        }

        return totalBase > 0 ? totalQuote / totalBase : bestPrice;
    }

    /**
     * Get recommended position size for an arbitrage trade
     */
    getRecommendedSize(
        longExchange: string,
        shortExchange: string,
        symbol: string,
        maxSlippagePercent: number = 0.5,
        maxSizeUsd: number = 10000
    ): { size: number; warning?: string } {
        // For long side, we're buying (hitting asks)
        const longLiquidity = this.analyzeBuy(longExchange, symbol);
        // For short side, we're selling (hitting bids)
        const shortLiquidity = this.analyzeSell(shortExchange, symbol);

        if (!longLiquidity || !shortLiquidity) {
            return { size: 0, warning: 'Missing order book data for one or both exchanges' };
        }

        // Get max size at target slippage for each side
        const maxSlippage = maxSlippagePercent / 100;
        const longMaxSize = this.calculateMaxSizeAtSlippage(
            this.getDepth(longExchange, symbol)!.asks,
            longLiquidity.bestPrice,
            maxSlippage
        );
        const shortMaxSize = this.calculateMaxSizeAtSlippage(
            this.getDepth(shortExchange, symbol)!.bids,
            shortLiquidity.bestPrice,
            maxSlippage
        );

        // Take the minimum of both sides
        const liquidityLimit = Math.min(longMaxSize, shortMaxSize);
        const recommendedSize = Math.min(liquidityLimit, maxSizeUsd);

        let warning: string | undefined;
        if (liquidityLimit < maxSizeUsd) {
            warning = `Size limited to $${recommendedSize.toFixed(0)} due to liquidity (${longExchange}: $${longMaxSize.toFixed(0)}, ${shortExchange}: $${shortMaxSize.toFixed(0)})`;
        }

        return { size: recommendedSize, warning };
    }

    /**
     * Get depth data with cache check
     */
    private getDepth(exchange: string, symbol: string): DepthData | null {
        const key = this.getKey(exchange, symbol);
        const data = this.depthCache.get(key);

        if (!data) return null;

        // Check if cache is too old
        if (Date.now() - data.timestamp > this.maxCacheAge) {
            return null;
        }

        return data;
    }

    private getKey(exchange: string, symbol: string): string {
        return `${exchange}:${symbol}`;
    }

    /**
     * Get summary for all cached depth data
     */
    getSummary(): Array<{ exchange: string; symbol: string; bidDepth: number; askDepth: number; age: number }> {
        const now = Date.now();
        return Array.from(this.depthCache.entries()).map(([key, data]) => ({
            exchange: data.exchange,
            symbol: data.symbol,
            bidDepth: data.bids.length > 0 ? data.bids[data.bids.length - 1].total : 0,
            askDepth: data.asks.length > 0 ? data.asks[data.asks.length - 1].total : 0,
            age: now - data.timestamp,
        }));
    }
}
