import type { PriceData, PriceUpdate, ArbitrageOpportunity } from '@arbitrage/shared';
import type { SocketServer } from '../server/socket.js';

export class Broadcaster {
    private io: SocketServer;
    private batchInterval = 100; // 100ms batch interval
    private priceBatch: PriceUpdate[] = [];
    private batchTimer: NodeJS.Timeout | null = null;

    constructor(io: SocketServer) {
        this.io = io;
        this.startBatching();
    }

    private startBatching(): void {
        this.batchTimer = setInterval(() => {
            if (this.priceBatch.length > 0) {
                this.io.emit('price:update', this.priceBatch);
                this.priceBatch = [];
            }
        }, this.batchInterval);
    }

    /**
     * Add price to broadcast batch
     */
    broadcastPrice(price: PriceData): void {
        const update: PriceUpdate = {
            ...price,
            spread: ((price.ask - price.bid) / price.bid) * 100,
        };

        this.priceBatch.push(update);
    }

    /**
     * Broadcast arbitrage opportunity immediately
     */
    broadcastOpportunity(opportunity: ArbitrageOpportunity): void {
        this.io.emit('arbitrage:opportunity', opportunity);
        console.log(
            `🎯 Arbitrage: ${opportunity.symbol} | ` +
            `Buy ${opportunity.buyExchange} @ ${opportunity.buyPrice.toFixed(2)} → ` +
            `Sell ${opportunity.sellExchange} @ ${opportunity.sellPrice.toFixed(2)} | ` +
            `Spread: ${opportunity.spreadPercent.toFixed(3)}%`
        );
    }

    /**
     * Broadcast exchange connection status
     */
    broadcastExchangeConnected(exchange: string): void {
        this.io.emit('exchange:connected', exchange);
    }

    broadcastExchangeDisconnected(exchange: string): void {
        this.io.emit('exchange:disconnected', exchange);
    }

    broadcastExchangeError(exchange: string, error: string): void {
        this.io.emit('exchange:error', { exchange, error });
    }

    /**
     * Stop broadcasting
     */
    stop(): void {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
    }
}
