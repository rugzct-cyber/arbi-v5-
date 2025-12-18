import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface DepthResponse {
    bids: Array<[string, string]>; // [price, qty]
    asks: Array<[string, string]>; // [price, qty]
    ts_ms: number;
}

/**
 * Vest Exchange REST Adapter
 * 
 * Uses GET https://server-prod.hz.vestmarkets.com/v2/depth?symbol={symbol}&limit=5
 * Requires header: xrestservermm: restserver0
 * 
 * Response: { bids: [["88720.56", "0.0014"], ...], asks: [["88782.60", "0.0024"], ...] }
 */
export class VestRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'vest';
    private readonly apiUrl = 'https://server-prod.hz.vestmarkets.com/v2/depth';

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({
            // Complete list from WebSocket adapter (crypto only - no stocks)
            symbols: config?.symbols || [
                'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX',
                'SUI', 'TON', 'TAO', 'NEAR', 'AAVE', 'HYPE', 'BERA',
                'WLD', 'WIF', 'JUP', 'ENA', 'FARTCOIN', 'ONDO',
                'KAITO', 'ASTER', 'ZRO', 'ZK', 'PAXG', 'MEGA',
            ],
        });
    }

    private formatSymbol(symbol: string): string {
        return `${symbol}-PERP`;
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        const fetchPromises = this.config.symbols.map(async (symbol, index) => {
            await new Promise(resolve => setTimeout(resolve, index * 50));

            try {
                const vestSymbol = this.formatSymbol(symbol);
                const response = await fetch(`${this.apiUrl}?symbol=${vestSymbol}&limit=5`, {
                    headers: {
                        'xrestservermm': 'restserver0',
                        'Accept': 'application/json',
                    },
                });

                if (!response.ok) {
                    if (response.status !== 404) {
                        console.error(`[${this.exchangeId}] REST error for ${symbol}: ${response.status}`);
                    }
                    return null;
                }

                const data: DepthResponse = await response.json();

                if (data.bids?.length > 0 && data.asks?.length > 0) {
                    const bestBid = parseFloat(data.bids[0][0]);
                    const bestAsk = parseFloat(data.asks[0][0]);

                    if (bestBid > 0 && bestAsk > 0) {
                        return this.createPriceData(normalizeSymbol(symbol), bestBid, bestAsk);
                    }
                }
            } catch (error) {
                console.error(`[${this.exchangeId}] REST fetch error for ${symbol}:`, error);
            }
            return null;
        });

        const results = await Promise.all(fetchPromises);
        for (const result of results) {
            if (result) prices.push(result);
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${this.config.symbols.length} prices`);
        return prices;
    }
}
