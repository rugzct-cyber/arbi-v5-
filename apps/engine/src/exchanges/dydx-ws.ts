import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

/**
 * dYdX v4 WebSocket Adapter
 * 
 * Uses REST API polling for reliable price updates.
 * WebSocket was unreliable with incremental updates.
 */
export class DydxWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'dydx';
    readonly wsUrl = 'wss://indexer.dydx.trade/v4/ws'; // Not used, but required by base class

    private pollInterval: NodeJS.Timeout | null = null;
    private readonly symbols = ['BTC', 'ETH', 'SOL'];
    private readonly baseUrl = 'https://indexer.dydx.trade/v4';

    async connect(): Promise<void> {
        console.log(`[${this.exchangeId}] Starting REST polling (every 500ms)`);
        this.startPolling();
        this.emitConnected();
    }

    private startPolling(): void {
        // Poll immediately
        this.fetchAllPrices();

        // Then poll every 500ms
        this.pollInterval = setInterval(() => {
            this.fetchAllPrices();
        }, 500);
    }

    private async fetchAllPrices(): Promise<void> {
        for (const coin of this.symbols) {
            try {
                const market = `${coin}-USD`;
                const url = `${this.baseUrl}/orderbooks/perpetualMarket/${market}`;
                const response = await fetch(url);

                if (!response.ok) continue;

                const data = await response.json();
                const bids = data.bids || [];
                const asks = data.asks || [];

                if (bids.length > 0 && asks.length > 0) {
                    const bestBid = parseFloat(bids[0].price);
                    const bestAsk = parseFloat(asks[0].price);

                    if (bestBid > 0 && bestAsk > 0) {
                        const symbol = normalizeSymbol(coin);
                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
                            bid: bestBid,
                            ask: bestAsk,
                        });
                    }
                }
            } catch (error) {
                // Silently fail for individual requests
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log(`[${this.exchangeId}] Stopped REST polling`);
    }

    // These methods are required by base class but not used
    protected onOpen(): void { }
    protected onMessage(): void { }
}
