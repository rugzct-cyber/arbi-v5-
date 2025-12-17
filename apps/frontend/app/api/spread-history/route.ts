import { NextRequest, NextResponse } from 'next/server';

// Allowed values for validation (whitelist approach)
const VALID_EXCHANGES = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal'];
const VALID_RANGES = ['24H', '7D', '30D', 'ALL'];
const SYMBOL_PATTERN = /^[A-Z0-9]+-USD$/; // e.g., BTC-USD, SOL-USD, 1000PEPE-USD

/**
 * Sanitize and validate input to prevent SQL injection
 */
function sanitizeSymbol(symbol: string): string | null {
    const upper = symbol.toUpperCase();
    if (!SYMBOL_PATTERN.test(upper)) {
        return null;
    }
    // Additional check: max length and no special SQL chars
    if (upper.length > 20 || /[;'"\\]/.test(upper)) {
        return null;
    }
    return upper;
}

function sanitizeExchange(exchange: string): string | null {
    const lower = exchange.toLowerCase();
    if (!VALID_EXCHANGES.includes(lower)) {
        return null;
    }
    return lower;
}

function sanitizeRange(range: string): string {
    const upper = range.toUpperCase();
    return VALID_RANGES.includes(upper) ? upper : '7D';
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbolRaw = searchParams.get('symbol');
    const buyExchangeRaw = searchParams.get('buyExchange');
    const sellExchangeRaw = searchParams.get('sellExchange');
    const rangeRaw = searchParams.get('range') || '7D';

    // Validate required parameters
    if (!symbolRaw || !buyExchangeRaw || !sellExchangeRaw) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Sanitize inputs
    const symbol = sanitizeSymbol(symbolRaw);
    const buyExchange = sanitizeExchange(buyExchangeRaw);
    const sellExchange = sanitizeExchange(sellExchangeRaw);
    const range = sanitizeRange(rangeRaw);

    if (!symbol) {
        return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    }
    if (!buyExchange) {
        return NextResponse.json({ error: 'Invalid buy exchange' }, { status: 400 });
    }
    if (!sellExchange) {
        return NextResponse.json({ error: 'Invalid sell exchange' }, { status: 400 });
    }

    // Calculate time range and sample interval
    const nowMs = Date.now();
    let startTimeMs: number;
    let sampleInterval: string;

    switch (range) {
        case '24H':
            startTimeMs = nowMs - 24 * 60 * 60 * 1000;
            sampleInterval = '15m';
            break;
        case '7D':
            startTimeMs = nowMs - 7 * 24 * 60 * 60 * 1000;
            sampleInterval = '1h';
            break;
        case '30D':
            startTimeMs = nowMs - 30 * 24 * 60 * 60 * 1000;
            sampleInterval = '4h';
            break;
        case 'ALL':
        default:
            startTimeMs = nowMs - 365 * 24 * 60 * 60 * 1000;
            sampleInterval = '1d';
            break;
    }

    // Convert to microseconds for QuestDB
    const startTimeUs = startTimeMs * 1000;

    try {
        const questdbHost = process.env.QUESTDB_HOST || 'questdbquestdb-production-cc7b.up.railway.app';

        // Build queries with sanitized values
        // NOTE: Since QuestDB HTTP API doesn't support parameterized queries,
        // we rely on whitelist validation above to prevent injection
        const buyQuery = `
            SELECT 
                timestamp as time,
                avg(ask) as ask_price
            FROM prices
            WHERE symbol = '${symbol}'
              AND exchange = '${buyExchange}'
              AND timestamp > ${startTimeUs}
            SAMPLE BY ${sampleInterval}
            ORDER BY timestamp ASC
            LIMIT 500
        `;

        const sellQuery = `
            SELECT 
                timestamp as time,
                avg(bid) as bid_price
            FROM prices
            WHERE symbol = '${symbol}'
              AND exchange = '${sellExchange}'
              AND timestamp > ${startTimeUs}
            SAMPLE BY ${sampleInterval}
            ORDER BY timestamp ASC
            LIMIT 500
        `;

        console.log(`[spread-history] Querying ${symbol}: ${buyExchange} vs ${sellExchange}, range=${range}`);

        const [buyResponse, sellResponse] = await Promise.all([
            fetch(`https://${questdbHost}/exec?query=${encodeURIComponent(buyQuery)}`),
            fetch(`https://${questdbHost}/exec?query=${encodeURIComponent(sellQuery)}`)
        ]);

        if (!buyResponse.ok || !sellResponse.ok) {
            console.error('[spread-history] QuestDB query failed');
            return NextResponse.json({ data: [] });
        }

        const buyResult = await buyResponse.json();
        const sellResult = await sellResponse.json();

        console.log(`[spread-history] Buy data: ${buyResult.count || 0} rows, Sell data: ${sellResult.count || 0} rows`);

        // Create a map of sell prices by exact timestamp from SAMPLE BY
        // Also keep the original entries array for tolerance-based matching
        const sellPriceMap = new Map<string, number>();
        const sellEntries: Array<[string, number]> = sellResult.dataset || [];

        sellEntries.forEach((row: [string, number]) => {
            // Store with exact timestamp for primary matching
            sellPriceMap.set(row[0], row[1]);
        });

        // Calculate spread by matching time buckets
        const data: Array<{ time: string; spread: number }> = [];

        (buyResult.dataset || []).forEach((row: [string, number]) => {
            const time = row[0];
            const askPrice = row[1];

            // First try exact match
            let bidPrice = sellPriceMap.get(time);

            // If no exact match, find closest timestamp within 4 second tolerance
            if (!bidPrice && sellEntries.length > 0) {
                const buyTime = new Date(time).getTime();

                for (let i = 0; i < sellEntries.length; i++) {
                    const sellTime = new Date(sellEntries[i][0]).getTime();
                    const diff = Math.abs(buyTime - sellTime);

                    // Match if within 4 seconds tolerance
                    if (diff < 4000) {
                        bidPrice = sellEntries[i][1];
                        break;
                    }
                }
            }

            if (bidPrice && askPrice > 0) {
                const spread = ((bidPrice - askPrice) / askPrice) * 100;
                data.push({
                    time,
                    spread: Math.round(spread * 10000) / 10000
                });
            }
        });

        console.log(`[spread-history] Result: ${data.length} spread points calculated`);

        return NextResponse.json({ data });
    } catch (error) {
        console.error('[spread-history] Error:', error);
        return NextResponse.json({ data: [] });
    }
}
