import { NextRequest, NextResponse } from 'next/server';

interface ExchangePrice {
    bid: number;
    ask: number;
    timestamp: number;
}

// REST API endpoints for each exchange
const EXCHANGE_APIS: Record<string, (symbol: string) => Promise<ExchangePrice | null>> = {
    hyperliquid: async (symbol: string) => {
        try {
            const coin = symbol.replace('-USD', '');
            const response = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'l2Book', coin }),
            });
            const data = await response.json();
            if (data.levels?.[0]?.length > 0 && data.levels?.[1]?.length > 0) {
                return {
                    bid: parseFloat(data.levels[0][0].px),
                    ask: parseFloat(data.levels[1][0].px),
                    timestamp: Date.now(),
                };
            }
        } catch (error) {
            console.error(`[hyperliquid] Error fetching ${symbol}:`, error);
        }
        return null;
    },

    paradex: async (symbol: string) => {
        try {
            const market = symbol.replace('-USD', '-USD-PERP');
            const response = await fetch(`https://api.prod.paradex.trade/v1/orderbook/${market}?depth=1`);
            const data = await response.json();
            if (data.bids?.length > 0 && data.asks?.length > 0) {
                return {
                    bid: parseFloat(data.bids[0][0]),
                    ask: parseFloat(data.asks[0][0]),
                    timestamp: Date.now(),
                };
            }
        } catch (error) {
            console.error(`[paradex] Error fetching ${symbol}:`, error);
        }
        return null;
    },

    vest: async (symbol: string) => {
        try {
            const pair = symbol.replace('-USD', '_USDC');
            const response = await fetch(`https://api.vest.exchange/v1/orderbook/${pair}?depth=1`);
            const data = await response.json();
            if (data.bids?.length > 0 && data.asks?.length > 0) {
                return {
                    bid: parseFloat(data.bids[0].price),
                    ask: parseFloat(data.asks[0].price),
                    timestamp: Date.now(),
                };
            }
        } catch (error) {
            console.error(`[vest] Error fetching ${symbol}:`, error);
        }
        return null;
    },

    extended: async (symbol: string) => {
        try {
            const response = await fetch('https://api.starknet.extended.exchange/api/v1/info/markets');
            const data = await response.json();
            const market = data.data?.find((m: any) => 
                m.assetName === symbol.replace('-USD', '') && m.status === 'ACTIVE'
            );
            if (market?.marketStats?.bidPrice && market?.marketStats?.askPrice) {
                return {
                    bid: parseFloat(market.marketStats.bidPrice),
                    ask: parseFloat(market.marketStats.askPrice),
                    timestamp: Date.now(),
                };
            }
        } catch (error) {
            console.error(`[extended] Error fetching ${symbol}:`, error);
        }
        return null;
    },

    lighter: async (symbol: string) => {
        try {
            const response = await fetch('https://api.lighter.xyz/v1/markets');
            const data = await response.json();
            const ticker = symbol.replace('-USD', 'USD');
            const market = data.markets?.find((m: any) => m.ticker === ticker);
            if (market?.bestBid && market?.bestAsk) {
                return {
                    bid: parseFloat(market.bestBid),
                    ask: parseFloat(market.bestAsk),
                    timestamp: Date.now(),
                };
            }
        } catch (error) {
            console.error(`[lighter] Error fetching ${symbol}:`, error);
        }
        return null;
    },
};

/**
 * GET /api/verify-spread?symbol=ETH-USD&exchange1=vest&exchange2=lighter
 * 
 * Returns the real-time spread between two exchanges for a specific symbol.
 * Used to verify WebSocket data before executing trades.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || '';
    const exchange1 = searchParams.get('exchange1')?.toLowerCase() || '';
    const exchange2 = searchParams.get('exchange2')?.toLowerCase() || '';

    if (!symbol || !exchange1 || !exchange2) {
        return NextResponse.json({
            error: 'Missing required parameters: symbol, exchange1, exchange2',
            example: '/api/verify-spread?symbol=ETH-USD&exchange1=vest&exchange2=lighter'
        }, { status: 400 });
    }

    const fetchPrice1 = EXCHANGE_APIS[exchange1];
    const fetchPrice2 = EXCHANGE_APIS[exchange2];

    if (!fetchPrice1) {
        return NextResponse.json({ error: `Unknown exchange: ${exchange1}` }, { status: 400 });
    }
    if (!fetchPrice2) {
        return NextResponse.json({ error: `Unknown exchange: ${exchange2}` }, { status: 400 });
    }

    // Fetch prices from both exchanges in parallel
    const startTime = Date.now();
    const [price1, price2] = await Promise.all([
        fetchPrice1(symbol),
        fetchPrice2(symbol),
    ]);
    const latencyMs = Date.now() - startTime;

    if (!price1) {
        return NextResponse.json({ error: `Could not fetch price from ${exchange1}` }, { status: 404 });
    }
    if (!price2) {
        return NextResponse.json({ error: `Could not fetch price from ${exchange2}` }, { status: 404 });
    }

    // Calculate spreads in both directions
    // Long exchange1 (buy at ask1), Short exchange2 (sell at bid2)
    const spreadLong1Short2 = ((price2.bid - price1.ask) / price1.ask) * 100;
    // Long exchange2 (buy at ask2), Short exchange1 (sell at bid1)
    const spreadLong2Short1 = ((price1.bid - price2.ask) / price2.ask) * 100;

    // Best strategy
    const bestSpread = Math.max(spreadLong1Short2, spreadLong2Short1);
    const bestStrategy = spreadLong1Short2 > spreadLong2Short1
        ? { long: exchange1, short: exchange2, spread: spreadLong1Short2 }
        : { long: exchange2, short: exchange1, spread: spreadLong2Short1 };

    return NextResponse.json({
        symbol,
        timestamp: new Date().toISOString(),
        latencyMs,
        exchanges: {
            [exchange1]: {
                bid: price1.bid,
                ask: price1.ask,
            },
            [exchange2]: {
                bid: price2.bid,
                ask: price2.ask,
            },
        },
        spreads: {
            [`long_${exchange1}_short_${exchange2}`]: `${spreadLong1Short2.toFixed(4)}%`,
            [`long_${exchange2}_short_${exchange1}`]: `${spreadLong2Short1.toFixed(4)}%`,
        },
        bestStrategy: {
            action: `Long ${bestStrategy.long.toUpperCase()}, Short ${bestStrategy.short.toUpperCase()}`,
            spread: `${bestStrategy.spread.toFixed(4)}%`,
            viable: bestStrategy.spread > 0.05, // > 0.05% to cover fees
        },
    });
}
