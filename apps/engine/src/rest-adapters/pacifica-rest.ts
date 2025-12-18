import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface BookResponse {
    success: boolean;
    data: {
        s: string; // symbol
        l: [
            Array<{ p: string; a: string; n: number }>, // Bids [0]
            Array<{ p: string; a: string; n: number }>  // Asks [1]
        ];
        t: number; // timestamp
    };
}

/**
 * Pacifica REST Adapter
 * 
 * Uses GET https://api.pacifica.fi/api/v1/book?symbol={symbol}
 * 
 * Response: { success: true, data: { s: "BTC", l: [[{p,a,n}...], [{p,a,n}...]], t: ... } }
 * l[0] = Bids (sorted high to low), l[1] = Asks (sorted low to high)
 */
export class PacificaRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'pacifica';
    private readonly apiUrl = 'https://api.pacifica.fi/api/v1/book';

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({
            symbols: config?.symbols || [
                'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK', 'LTC',
                'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
                'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
                'PEPE', 'BONK', 'WLD', 'TRUMP', 'FARTCOIN', 'PENGU', 'ONDO',
                'PENDLE', 'LDO', 'ATOM', 'ADA', 'CRV', 'GMX', 'DYDX', 'TRX', 'PAXG',
            ],
        });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        const fetchPromises = this.config.symbols.map(async (symbol, index) => {
            await new Promise(resolve => setTimeout(resolve, index * 30));

            try {
                const response = await fetch(`${this.apiUrl}?symbol=${symbol}`);

                if (!response.ok) {
                    if (response.status !== 404) {
                        console.error(`[${this.exchangeId}] REST error for ${symbol}: ${response.status}`);
                    }
                    return null;
                }

                const data: BookResponse = await response.json();

                if (data.success && data.data?.l) {
                    const bids = data.data.l[0];
                    const asks = data.data.l[1];

                    if (bids?.length > 0 && asks?.length > 0) {
                        const bestBid = parseFloat(bids[0].p);
                        const bestAsk = parseFloat(asks[0].p);

                        if (bestBid > 0 && bestAsk > 0) {
                            return this.createPriceData(normalizeSymbol(symbol), bestBid, bestAsk);
                        }
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
