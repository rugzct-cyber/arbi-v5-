import { BaseRESTAdapter, type RESTAdapterConfig } from './base-rest-adapter.js';
import type { PriceData } from '@arbitrage/shared';
import { normalizeSymbol } from '@arbitrage/shared';

interface MarketData {
    name: string;
    assetName: string;
    status: string;
    marketStats?: {
        bidPrice?: string;
        askPrice?: string;
        markPrice?: string;
    };
}

interface MarketsResponse {
    status: string;
    data: MarketData[];
}

/**
 * Extended Exchange REST Adapter
 * 
 * Uses GET https://api.starknet.extended.exchange/api/v1/info/markets
 * 
 * Response: { data: [{ assetName, marketStats: { bidPrice, askPrice } }] }
 */
export class ExtendedRESTAdapter extends BaseRESTAdapter {
    readonly exchangeId = 'extended';
    private readonly apiUrl = 'https://api.starknet.extended.exchange/api/v1/info/markets';

    constructor(config?: Partial<RESTAdapterConfig>) {
        super({
            // Complete list from WebSocket adapters (auto-filter on API response)
            symbols: config?.symbols || [
                // Tier 1 - Major tokens
                'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK', 'LTC',
                // Tier 2 - Popular alts
                'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
                'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
                // Tier 3 - Trending tokens
                'PEPE', 'BONK', 'WLD', 'TRUMP', 'FARTCOIN', 'PENGU', 'ONDO',
                'PENDLE', 'LDO', 'CRV', 'GMX', 'DYDX', 'TRX', 'ATOM', 'ADA',
                // Tier 4 - Additional tokens
                'AERO', 'APEX', 'ASTER', 'AVNT', 'CAKE', 'EIGEN', 'GOAT', 'GRASS', 'IP',
                'KAITO', 'LINEA', 'MNT', 'MON', 'MOODENG', 'POPCAT', 'PUMP', 'RESOLV', 'S',
                'SNX', 'STRK', 'VIRTUAL', 'WLFI', 'XPL', 'ZEC', 'ZORA', 'ZRO',
                // Tier 5 - More tokens
                '0G', 'AIXBT', 'BCH', 'FIL', 'HBAR', 'ICP', 'INIT', 'INJ', 'JTO',
                'OM', 'ORDI', 'PAXG', 'POL', 'PYTH', 'RUNE', 'XLM', 'XMR', 'ZK',
                'MELANIA', 'MORPHO', 'USUAL', 'VVV', 'WCT', 'MEGA',
            ],
        });
    }

    async fetchPrices(): Promise<PriceData[]> {
        const prices: PriceData[] = [];

        try {
            const response = await fetch(this.apiUrl, {
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                console.error(`[${this.exchangeId}] REST error: ${response.status}`);
                return prices;
            }

            const data: MarketsResponse = await response.json();

            if (!data.data) return prices;

            for (const market of data.data) {
                if (market.status !== 'ACTIVE') continue;

                const symbol = market.assetName || market.name.replace('-USD', '');
                if (!this.config.symbols.includes(symbol)) continue;

                const stats = market.marketStats || {};
                const bidPrice = parseFloat(stats.bidPrice || '0');
                const askPrice = parseFloat(stats.askPrice || '0');

                if (bidPrice > 0 && askPrice > 0) {
                    prices.push(this.createPriceData(normalizeSymbol(symbol), bidPrice, askPrice));
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] REST fetch error:`, error);
        }

        console.log(`[${this.exchangeId}] REST fetched ${prices.length} prices`);
        return prices;
    }
}
