import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * dYdX v4 WebSocket Adapter
 * 
 * Uses orderbooks channel to get real Bid/Ask prices.
 * Docs: https://docs.dydx.xyz/indexer-client/websockets
 * 
 * IMPORTANT: dYdX sends INCREMENTAL updates - each message only has bids OR asks.
 * We must cache the orderbook and merge updates.
 */
export class DydxWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'dydx';
    readonly wsUrl = 'wss://indexer.dydx.trade/v4/ws';

    private pingInterval: NodeJS.Timeout | null = null;

    // Start with major tokens only
    private readonly symbols = ['BTC', 'ETH', 'SOL'];

    // Cache orderbooks per market: { 'BTC-USD': { bids: Map<price, size>, asks: Map<price, size> } }
    private orderbooks: Map<string, { bids: Map<string, number>; asks: Map<string, number> }> = new Map();

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.startPing();
        this.subscribeToOrderbooks();
    }

    private async subscribeToOrderbooks(): Promise<void> {
        // Subscribe to orderbook channel for each market
        for (const coin of this.symbols) {
            const marketId = `${coin}-USD`;
            // Initialize orderbook cache
            this.orderbooks.set(marketId, { bids: new Map(), asks: new Map() });

            this.send({
                type: 'subscribe',
                channel: 'v4_orderbook',
                id: marketId,
            });
            // Small delay between subscriptions
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`[${this.exchangeId}] Subscribed to orderbooks for ${this.symbols.length} markets`);
    }

    private startPing(): void {
        // Send ping every 30 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, 30000);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle pong
            if (message.type === 'pong') {
                return;
            }

            // Handle connected message
            if (message.type === 'connected') {
                console.log(`[${this.exchangeId}] Connection confirmed`);
                return;
            }

            // Handle subscribed message (initial snapshot)
            if (message.type === 'subscribed' && message.channel === 'v4_orderbook') {
                console.log(`[${this.exchangeId}] Subscribed to ${message.channel}:${message.id}`);
                // Initial snapshot
                if (message.contents) {
                    this.handleOrderbookSnapshot(message.id, message.contents);
                }
                return;
            }

            // Handle channel_data (orderbook updates)
            if (message.type === 'channel_data' && message.channel === 'v4_orderbook') {
                this.handleOrderbookUpdate(message.id, message.contents);
            }

        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }

    private handleOrderbookSnapshot(marketId: string, data: any): void {
        const orderbook = this.orderbooks.get(marketId);
        if (!orderbook) return;

        // Clear and rebuild
        orderbook.bids.clear();
        orderbook.asks.clear();

        for (const bid of data.bids || []) {
            const [price, size] = Array.isArray(bid) ? bid : [bid.price, bid.size];
            const sizeNum = parseFloat(size);
            if (sizeNum > 0) {
                orderbook.bids.set(price, sizeNum);
            }
        }

        for (const ask of data.asks || []) {
            const [price, size] = Array.isArray(ask) ? ask : [ask.price, ask.size];
            const sizeNum = parseFloat(size);
            if (sizeNum > 0) {
                orderbook.asks.set(price, sizeNum);
            }
        }

        this.emitBestPrices(marketId);
    }

    private handleOrderbookUpdate(marketId: string, data: any): void {
        const orderbook = this.orderbooks.get(marketId);
        if (!orderbook || !data) return;

        // Update bids (size=0 means remove)
        for (const bid of data.bids || []) {
            const [price, size] = Array.isArray(bid) ? bid : [bid.price, bid.size];
            const sizeNum = parseFloat(size);
            if (sizeNum === 0) {
                orderbook.bids.delete(price);
            } else {
                orderbook.bids.set(price, sizeNum);
            }
        }

        // Update asks (size=0 means remove)
        for (const ask of data.asks || []) {
            const [price, size] = Array.isArray(ask) ? ask : [ask.price, ask.size];
            const sizeNum = parseFloat(size);
            if (sizeNum === 0) {
                orderbook.asks.delete(price);
            } else {
                orderbook.asks.set(price, sizeNum);
            }
        }

        this.emitBestPrices(marketId);
    }

    private emitBestPrices(marketId: string): void {
        const orderbook = this.orderbooks.get(marketId);
        if (!orderbook) return;

        // Find best bid (highest price)
        let bestBid = 0;
        for (const priceStr of orderbook.bids.keys()) {
            const price = parseFloat(priceStr);
            if (price > bestBid) bestBid = price;
        }

        // Find best ask (lowest price)
        let bestAsk = Infinity;
        for (const priceStr of orderbook.asks.keys()) {
            const price = parseFloat(priceStr);
            if (price < bestAsk) bestAsk = price;
        }

        if (bestBid > 0 && bestAsk < Infinity && bestAsk > 0) {
            const symbol = normalizeSymbol(marketId.replace('-USD', ''));

            this.emitPrice({
                exchange: this.exchangeId,
                symbol,
                bid: bestBid,
                ask: bestAsk,
            });
        }
    }

    async disconnect(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.orderbooks.clear();
        await super.disconnect();
    }
}
