import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

export class AsterWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'aster';
    readonly wsUrl = 'wss://api.aster.finance/ws';

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.subscribeToOrderbooks();
    }

    private subscribeToOrderbooks(): void {
        this.send({
            action: 'subscribe',
            channel: 'orderbook',
            symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
        });

        console.log(`[${this.exchangeId}] Subscribed to orderbooks`);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            if (message.channel === 'orderbook' && message.data) {
                const { symbol, bids, asks } = message.data;
                const normalizedSymbol = normalizeSymbol(symbol);

                if (bids?.length > 0 && asks?.length > 0) {
                    this.emitPrice({
                        exchange: this.exchangeId,
                        symbol: normalizedSymbol,
                        bid: parseFloat(bids[0][0]),
                        ask: parseFloat(asks[0][0]),
                    });
                }
            }
        } catch (error) {
            console.error(`[${this.exchangeId}] Parse error:`, error);
        }
    }
}
