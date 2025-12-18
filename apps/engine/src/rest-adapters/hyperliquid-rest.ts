import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface L2BookResponse {
    levels: [
        Array<{ px: string; sz: string; n: number }>, // Bids
        Array<{ px: string; sz: string; n: number }>  // Asks
    ];
}

/**
 * Hyperliquid REST Adapter
 * 
 * Uses POST https://api.hyperliquid.xyz/info with type: "l2Book"
 * Returns at most 20 levels per side.
 */
export class HyperliquidRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'hyperliquid';
    private readonly apiUrl = 'https://api.hyperliquid.xyz/info';

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({
            symbols: config?.symbols || [
                'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK', 'LTC',
                'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
                'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
                'PEPE', 'BONK', 'WLD', 'TRUMP', 'FARTCOIN', 'PENGU', 'ONDO',
                'PENDLE', 'LDO', 'CRV', 'GMX', 'DYDX', 'TRX', 'ATOM', 'ADA',
                'PAXG',
            ],
        });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        // Fetch all symbols in parallel with slight delay to avoid rate limits
        const fetchPromises = this.config.symbols.map(async (coin, index) => {
            // Stagger requests by 50ms each to avoid burst
            await new Promise(resolve => setTimeout(resolve, index * 50));

            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'l2Book', coin }),
                });

                if (!response.ok) {
                    console.error(`[${this.exchangeId}] REST error for ${coin}: ${response.status}`);
                    return null;
                }

                const data: L2BookResponse = await response.json();
                const bids = data.levels[0];
                const asks = data.levels[1];

                if (bids?.length > 0 && asks?.length > 0) {
                    const bestBid = parseFloat(bids[0].px);
                    const bestAsk = parseFloat(asks[0].px);

                    if (bestBid > 0 && bestAsk > 0) {
                        return this.createPriceData(normalizeSymbol(coin), bestBid, bestAsk);
                    }
                }
            } catch (error) {
                console.error(`[${this.exchangeId}] REST fetch error for ${coin}:`, error);
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
