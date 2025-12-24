import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * dYdX v4 WebSocket Adapter
 * 
 * Uses orderbooks channel to get real Bid/Ask prices.
 * Docs: https://docs.dydx.xyz/indexer-client/websockets
 * 
 * WebSocket URL: wss://indexer.dydx.trade/v4/ws
 * 
 * Subscribe message format:
 * {
 *   "type": "subscribe",
 *   "channel": "v4_orderbook",
 *   "id": "BTC-USD"
 * }
 */
export class DydxWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'dydx';
    readonly wsUrl = 'wss://indexer.dydx.trade/v4/ws';

    private pingInterval: NodeJS.Timeout | null = null;

    // Start with major tokens only
    private readonly symbols = ['BTC', 'ETH', 'SOL'];

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.startPing();
        this.subscribeToOrderbooks();
    }

    private async subscribeToOrderbooks(): Promise<void> {
        // Subscribe to orderbook channel for each market
        for (const coin of this.symbols) {
            const marketId = `${coin}-USD`;
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

            // Handle subscribed message
            if (message.type === 'subscribed') {
                console.log(`[${this.exchangeId}] Subscribed to ${message.channel}:${message.id}`);
                return;
            }

            // Handle channel_data (orderbook updates)
            if (message.type === 'channel_data' && message.channel === 'v4_orderbook') {
                this.handleOrderbookUpdate(message);
            }

            // Handle channel_batch_data (batched orderbook updates)
            if (message.type === 'channel_batch_data' && message.channel === 'v4_orderbook') {
                // Process each update in the batch
                for (const update of message.contents || []) {
                    this.handleOrderbookData(message.id, update);
                }
            }

        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }

    private handleOrderbookUpdate(message: any): void {
        const marketId = message.id; // e.g., "BTC-USD"
        const contents = message.contents;

        if (!contents) return;

        this.handleOrderbookData(marketId, contents);
    }

    private handleOrderbookData(marketId: string, data: any): void {
        // Extract bids and asks
        // dYdX format: { bids: [["42000", "1.5"], ...], asks: [...] }
        // Each entry is [price, size] as strings
        const bids = data.bids || [];
        const asks = data.asks || [];

        if (bids.length === 0 && asks.length === 0) return;

        // Find best bid (highest) and best ask (lowest)
        let bestBid = 0;
        let bestAsk = Infinity;

        for (const bid of bids) {
            // bid can be [price, size] or {price, size}
            const price = Array.isArray(bid) ? parseFloat(bid[0]) : parseFloat(bid.price);
            if (!isNaN(price) && price > bestBid) bestBid = price;
        }

        for (const ask of asks) {
            // ask can be [price, size] or {price, size}
            const price = Array.isArray(ask) ? parseFloat(ask[0]) : parseFloat(ask.price);
            if (!isNaN(price) && price < bestAsk) bestAsk = price;
        }

        if (bestBid > 0 && bestAsk < Infinity && bestAsk > 0) {
            // Normalize symbol: "BTC-USD" -> "BTC-USD"
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
        await super.disconnect();
    }
}
