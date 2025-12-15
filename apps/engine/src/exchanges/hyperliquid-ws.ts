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

    // Unified list of common tokens across all exchanges
    private readonly symbols = [
        // Tier 1 - Major tokens (all exchanges)
        'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'AVAX', 'SUI', 'LINK',
        // Tier 2 - Popular alts (most exchanges)
        'ARB', 'OP', 'APT', 'NEAR', 'DOT', 'TON', 'TAO', 'TIA',
        'AAVE', 'UNI', 'ENA', 'SEI', 'WIF', 'JUP', 'HYPE', 'BERA',
        // Tier 3 - Trending tokens (multiple exchanges)
        'PEPE', 'BONK', 'WLD', 'TRUMP', 'FARTCOIN', 'PENGU', 'ONDO',
        'PENDLE', 'LDO', 'CRV', 'GMX', 'DYDX', 'TRX', 'ATOM', 'ADA',
    ];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToL2Books();
        this.startPing();
    }

    private async subscribeToL2Books(): Promise<void> {
        // Subscribe to L2 OrderBook for each coin with delay to prevent rate limiting
        for (const coin of this.symbols) {
            this.send({
                method: 'subscribe',
                subscription: {
                    type: 'l2Book',
                    coin,
                },
            });
            // Small delay between subscriptions (50ms)
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`[${this.exchangeId}] Subscribed to L2 OrderBook for ${this.symbols.length} coins`);
    }

    private startPing(): void {
        // Send ping every 30 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            this.send({ method: 'ping' });
        }, 30000);
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
