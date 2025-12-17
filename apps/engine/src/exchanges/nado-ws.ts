import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';

interface NadoResponse {
    status: string;
    data?: any;
    request_type?: string;
    stream?: {
        type: string;
        product_id: number;
    };
    channel?: string;
    // Data fields for book_depth
    bids?: [string, string][]; // [price, size]
    asks?: [string, string][]; // [price, size]
}

export class NadoWebSocket extends BaseExchangeAdapter {
    readonly exchangeId = 'nado';
    // Use PROD URL
    readonly wsUrl = 'wss://gateway.prod.nado.xyz/v1/subscribe';

    private pingInterval: NodeJS.Timeout | null = null;

    // Product ID to Symbol Mapping (Perps Only)
    private readonly productMap: Record<number, string> = {
        2: 'BTC',      // BTC-PERP
        4: 'ETH',      // ETH-PERP
        8: 'SOL',      // SOL-PERP
        10: 'XRP',     // XRP-PERP
        14: 'BNB',     // BNB-PERP
        16: 'HYPE',    // HYPE-PERP
        18: 'ZEC',     // ZEC-PERP
        20: 'MON',     // MON-PERP
        22: 'FARTCOIN' // FARTCOIN-PERP
    };

    protected override getWebSocketOptions(): WebSocket.ClientOptions {
        return {
            headers: {
                'Sec-WebSocket-Extensions': 'permessage-deflate'
            }
        };
    }

    protected onOpen(): void {
        console.log(`[${this.exchangeId}] WebSocket connected`);
        this.startPing();
        this.subscribe();
    }

    private subscribe(): void {
        // Subscribe to book_depth for all mapped products
        // book_depth provides top of book + depth

        Object.keys(this.productMap).forEach((idStr, index) => {
            const productId = parseInt(idStr);
            console.log(`[${this.exchangeId}] Subscribing to Product ID ${productId} (${this.productMap[productId]})`);

            this.send({
                id: index + 1, // API requires an ID in the request
                method: 'subscribe',
                stream: {
                    type: 'book_depth',
                    product_id: productId
                }
            });
        });
    }

    private startPing(): void {
        // Send ping every 30 seconds
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.ping(); // Standards compliant ping frame
            }
        }, 30000);
    }

    protected onMessage(data: WebSocket.RawData): void {
        try {
            const message = JSON.parse(data.toString());

            // Handle Book Depth Updates
            // Format found via debug:
            // {"type":"book_depth","product_id":2,"bids":[],"asks":[["86129000000000000000000","1219100000000000000"]], ...}

            if (message.type === 'book_depth') {
                const productId = message.product_id;
                const symbol = this.productMap[productId];

                if (symbol) {
                    const bids = message.bids;
                    const asks = message.asks;

                    if (bids && bids.length > 0 && asks && asks.length > 0) {
                        const bestBidRaw = BigInt(bids[0][0]);
                        const bestAskRaw = BigInt(asks[0][0]);

                        // Convert from X18 to number
                        // 1e18
                        const div = 1000000000000000000n;

                        const bestBid = Number(bestBidRaw) / 1e18;
                        const bestAsk = Number(bestAskRaw) / 1e18;

                        if (bestBid > 0 && bestAsk > 0) {
                            this.emitPrice({
                                exchange: this.exchangeId,
                                symbol,
                                bid: bestBid,
                                ask: bestAsk
                            });
                        }
                    }
                }
            }

        } catch (error) {
            // Silence parse errors for pongs or other non-JSON frames
        }
    }

    override async disconnect(): Promise<void> {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        await super.disconnect();
    }
}
