import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const buyExchange = searchParams.get('buyExchange');
    const sellExchange = searchParams.get('sellExchange');
    const range = searchParams.get('range') || '7D';

    if (!symbol || !buyExchange || !sellExchange) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Calculate time range and sample interval
    const now = Date.now();
    let startTime: number;
    let sampleInterval: string;

    switch (range) {
        case '24H':
            startTime = now - 24 * 60 * 60 * 1000;
            sampleInterval = '15m'; // 15 minute buckets
            break;
        case '7D':
            startTime = now - 7 * 24 * 60 * 60 * 1000;
            sampleInterval = '1h'; // 1 hour buckets
            break;
        case '30D':
            startTime = now - 30 * 24 * 60 * 60 * 1000;
            sampleInterval = '4h'; // 4 hour buckets
            break;
        case 'ALL':
        default:
            startTime = now - 365 * 24 * 60 * 60 * 1000;
            sampleInterval = '1d'; // 1 day buckets
            break;
    }

    try {
        const questdbHost = process.env.QUESTDB_HOST || 'questdbquestdb-production-cc7b.up.railway.app';

        // Simpler approach: get prices from both exchanges separately, then combine
        // First, get average prices per time bucket for buy exchange
        const buyQuery = `
            SELECT 
                timestamp as time,
                avg(ask) as ask_price
            FROM prices
            WHERE symbol = '${symbol}'
              AND exchange = '${buyExchange}'
              AND timestamp > ${startTime * 1000}
            SAMPLE BY ${sampleInterval}
            ORDER BY timestamp ASC
            LIMIT 500
        `;

        // Get prices for sell exchange
        const sellQuery = `
            SELECT 
                timestamp as time,
                avg(bid) as bid_price
            FROM prices
            WHERE symbol = '${symbol}'
              AND exchange = '${sellExchange}'
              AND timestamp > ${startTime * 1000}
            SAMPLE BY ${sampleInterval}
            ORDER BY timestamp ASC
            LIMIT 500
        `;

        const [buyResponse, sellResponse] = await Promise.all([
            fetch(`https://${questdbHost}/exec?query=${encodeURIComponent(buyQuery)}`),
            fetch(`https://${questdbHost}/exec?query=${encodeURIComponent(sellQuery)}`)
        ]);

        if (!buyResponse.ok || !sellResponse.ok) {
            console.error('QuestDB query failed');
            return NextResponse.json({ data: [] });
        }

        const buyResult = await buyResponse.json();
        const sellResult = await sellResponse.json();

        // Create a map of sell prices by time
        const sellPriceMap = new Map<string, number>();
        (sellResult.dataset || []).forEach((row: [string, number]) => {
            sellPriceMap.set(row[0], row[1]);
        });

        // Calculate spread by matching timestamps
        const data: Array<{ time: string; spread: number }> = [];

        (buyResult.dataset || []).forEach((row: [string, number]) => {
            const time = row[0];
            const askPrice = row[1];
            const bidPrice = sellPriceMap.get(time);

            if (bidPrice && askPrice > 0) {
                const spread = ((bidPrice - askPrice) / askPrice) * 100;
                if (spread >= 0) {
                    data.push({
                        time,
                        spread: Math.round(spread * 10000) / 10000 // 4 decimal places
                    });
                }
            }
        });

        console.log(`[spread-history] ${symbol}: found ${data.length} data points for ${buyExchange} vs ${sellExchange}`);

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Failed to fetch spread history:', error);
        return NextResponse.json({ data: [] });
    }
}
