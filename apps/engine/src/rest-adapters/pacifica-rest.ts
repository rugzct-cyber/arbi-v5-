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
            // Complete list from WebSocket adapter
            symbols: config?.symbols || [
                // Tier 1 - Major tokens
                'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK', 'LTC',
                // Tier 2 - Popular alts
                'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
                'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
                // Tier 3 - Trending tokens
                'PEPE', 'BONK', 'WLD', 'TRUMP', 'FARTCOIN', 'PENGU', 'ONDO',
                'PENDLE', 'LDO', 'ATOM', 'ADA',
                // Tier 4 - Additional tokens
                'AERO', 'APEX', 'ASTER', 'AVNT', 'CAKE', 'CRV', 'EIGEN', 'GOAT', 'GRASS', 'IP',
                'KAITO', 'LINEA', 'MNT', 'MON', 'MOODENG', 'POPCAT', 'PUMP', 'RESOLV', 'S',
                'SNX', 'STRK', 'TRX', 'VIRTUAL', 'WLFI', 'XPL', 'ZEC', 'ZORA', 'ZRO',
                // Tier 5 - More tokens
                '0G', 'AIXBT', 'BCH', 'FIL', 'GMX', 'DYDX', 'HBAR', 'ICP', 'INIT', 'INJ', 'JTO',
                'OM', 'ORDI', 'PAXG', 'POL', 'PYTH', 'RUNE', 'XLM', 'XMR', 'ZK',
                'MELANIA', 'MORPHO', 'USUAL', 'VVV', 'WCT', 'MEGA', 'LIT',
            ],
        });
    }

    // Batch size for parallel requests (conservative to avoid rate limits)
    private readonly BATCH_SIZE = 5;
    private readonly BATCH_DELAY_MS = 500;

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];
        const symbols = this.config.symbols;

        // Split symbols into chunks for parallel processing
        const chunks: string[][] = [];
        for (let i = 0; i < symbols.length; i += this.BATCH_SIZE) {
            chunks.push(symbols.slice(i, i + this.BATCH_SIZE));
        }

        // Process chunks sequentially, items within each chunk in parallel
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];

            const chunkPromises = chunk.map(async (symbol) => {
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

            const chunkResults = await Promise.all(chunkPromises);
            for (const result of chunkResults) {
                if (result) prices.push(result);
            }

            // Delay between batches (except for last batch)
            if (chunkIndex < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
            }
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length}/${symbols.length} prices (${chunks.length} batches)`);
        return prices;
    }
}
