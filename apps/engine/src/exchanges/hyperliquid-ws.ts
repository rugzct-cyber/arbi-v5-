import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

// Type definitions for Hyperliquid L2 Data
interface WsLevel {
    px: string; // Price
    sz: string; // Size
    n: number;  // Number of orders
}

interface WsBook {
    coin: string;
    levels: [WsLevel[], WsLevel[]]; // [Bids, Asks]
    time: number;
}

/**
 * Hyperliquid WebSocket Adapter
 * 
 * Uses l2Book channel to get real Bid/Ask prices.
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions
 * 
 * L2 Format:
 * levels[0] = Bids (High to Low)
 * levels[1] = Asks (Low to High)
 */
export class HyperliquidWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'hyperliquid';
    readonly wsUrl = 'wss://api.hyperliquid.xyz/ws';

    private pingInterval: NodeJS.Timeout | null = null;

    // Full list of tokens - rate limit is 1000 subscriptions & 2000 messages/min
    // With 200ms delay, we send 5 msg/sec which is well under the 33 msg/sec limit
    private readonly symbols = [
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
        'SNX', 'STRK', 'VIRTUAL', 'WLFI', 'XPL', 'ZEC', 'ZORA', 'ZRO', '4',
        // Tier 5 - More tokens
        '0G', 'AIXBT', 'BCH', 'FIL', 'HBAR', 'ICP', 'INIT', 'INJ', 'JTO',
        'OM', 'ORDI', 'PAXG', 'POL', 'PYTH', 'RUNE', 'XLM', 'XMR', 'ZK',
        'kBONK', 'kFLOKI', 'kPEPE', 'kSHIB', 'MELANIA', 'MORPHO', 'USUAL', 'VVV', 'WCT', 'LIT',
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        // Start ping FIRST to keep connection alive during subscriptions
        this.startPing();
        this.subscribeToL2Books();
    }

    private async subscribeToL2Books(): Promise<void> {
        // Subscribe to L2 OrderBook for each coin
        // Using 200ms delay = 5 messages/sec, well under the 2000/min (33/sec) rate limit
        for (const coin of this.symbols) {
            this.send({
                method: 'subscribe',
                subscription: {
                    type: 'l2Book',
                    coin,
                },
            });
            // 200ms delay between subscriptions to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`[${this.exchangeId}] Subscribed to L2 OrderBook for ${this.symbols.length} coins`);
    }

    private startPing(): void {
        // Send ping every 10 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            this.send({ method: 'ping' });
        }, 10000);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle pong
            if (message.channel === 'pong') {
                return;
            }

            // Handle L2 Book updates
            // Format: { "channel": "l2Book", "data": { "coin": "BTC", "levels": [[...bids], [...asks]], "time": ... } }
            if (message.channel === 'l2Book' && message.data) {
                const book: WsBook = message.data;
                const symbol = normalizeSymbol(book.coin);

                const bids = book.levels[0];
                const asks = book.levels[1];

                if (bids && bids.length > 0 && asks && asks.length > 0) {
                    const bestBid = parseFloat(bids[0].px);
                    const bestAsk = parseFloat(asks[0].px);

                    if (bestBid > 0 && bestAsk > 0) {
                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
                            bid: bestBid,
                            ask: bestAsk,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }

    async disconnect(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        await super.disconnect();
    }
}
