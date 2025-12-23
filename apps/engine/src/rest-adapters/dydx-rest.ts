/**
 * dYdX v4 REST Adapter
 * 
 * Fetches orderbook data from dYdX v4 indexer API.
 * Docs: https://docs.dydx.xyz/indexer-client/http
 * 
 * Orderbook endpoint: https://indexer.dydx.trade/v4/orderbooks/perpetualMarket/{market}
 */

import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';
import { BaseRESTAdapter, RESTAdapterConfig } from './base-rest-adapter.js';

export class DydxRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'dydx';
    private readonly baseUrl = 'https://indexer.dydx.trade/v4';

    // Markets to fetch (start with major tokens)
    private readonly markets = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({ symbols: config?.symbols || [] });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        // Fetch all markets in parallel
        const results = await Promise.all(
            this.markets.map(market => this.fetchMarketOrderbook(market))
        );

        // Filter out nulls and add to prices
        for (const price of results) {
            if (price) {
                prices.push(price);
            }
        }

        return prices;
    }

    private async fetchMarketOrderbook(market: string): Promise<PriceData | null> {
        try {
            const url = `${this.baseUrl}/orderbooks/perpetualMarket/${market}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`[dydx REST] Failed to fetch ${market}: ${response.status}`);
                return null;
            }

            const data = await response.json();

            // Response format: { bids: [{price: "42000", size: "1.5"}, ...], asks: [...] }
            const bids = data.bids || [];
            const asks = data.asks || [];

            if (bids.length === 0 || asks.length === 0) {
                return null;
            }

            // Get best bid (first/highest) and best ask (first/lowest)
            const bestBid = parseFloat(bids[0].price);
            const bestAsk = parseFloat(asks[0].price);

            if (bestBid > 0 && bestAsk > 0) {
                // Normalize: "BTC-USD" -> "BTC-USD"
                const symbol = normalizeSymbol(market.replace('-USD', ''));

                return this.createPriceData(symbol, bestBid, bestAsk);
            }

            return null;
        } catch (error) {
            console.error(`[dydx REST] Error fetching ${market}:`, error);
            return null;
        }
    }
}
