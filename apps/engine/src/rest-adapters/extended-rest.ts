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
            symbols: config?.symbols || [
                'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK', 'LTC',
                'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
                'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
                'PEPE', 'BONK', 'WLD', 'TRUMP', 'PENGU', 'ONDO',
                'PENDLE', 'LDO', 'ATOM', 'ADA', 'CRV', 'GMX', 'DYDX', 'TRX', 'PAXG',
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
