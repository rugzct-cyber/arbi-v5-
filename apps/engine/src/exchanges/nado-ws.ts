import WebSocket from 'ws';
import { BaseExchangeAdapter } from './base-adapter.js';
import { normalizeSymbol } from '@arbitrage/shared';

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
    private priceCache: Record<string, { bid: number; ask: number }> = {};

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
                const rawSymbol = this.productMap[productId];
                const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : undefined;

                if (symbol) {
                    if (!this.priceCache[symbol]) {
                        this.priceCache[symbol] = { bid: 0, ask: 0 };
                    }

                    const bids = message.bids;
                    const asks = message.asks;

                    // Update Bid Cache
                    if (bids && bids.length > 0) {
                        // Find best bid with size > 0
                        // Assuming Nado sends updates where the first entry is relevant for top of book
                        // or simply taking the most recent "best" we see.
                        // Ideally we'd maintain a full book, but for now caching the latest non-zero update is a good L1 approximation.
                        const validBid = bids.find((b: string[]) => BigInt(b[1]) > 0n);
                        if (validBid) {
                            const priceRaw = BigInt(validBid[0]);
                            this.priceCache[symbol].bid = Number(priceRaw) / 1e18;
                        }
                    }

                    // Update Ask Cache
                    if (asks && asks.length > 0) {
                        const validAsk = asks.find((a: string[]) => BigInt(a[1]) > 0n);
                        if (validAsk) {
                            const priceRaw = BigInt(validAsk[0]);
                            this.priceCache[symbol].ask = Number(priceRaw) / 1e18;
                        }
                    }

                    const { bid, ask } = this.priceCache[symbol];



                    if (bid > 0 && ask > 0) {
                        this.emitPrice({
                            exchange: this.exchangeId,
                            symbol,
                            bid,
                            ask
                        });
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
