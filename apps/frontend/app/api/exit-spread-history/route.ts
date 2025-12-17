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

/**
 * EXIT SPREAD HISTORY API
 * 
 * This endpoint calculates the EXIT spread (to close a position):
 * - Long position: we SELL at BID price
 * - Short position: we BUY BACK at ASK price
 * 
 * Exit Spread = (longBid - shortAsk) / shortAsk * 100
 * 
 * This is the INVERSE of the entry spread which uses buyAsk and sellBid.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbolRaw = searchParams.get('symbol');
    const longExchangeRaw = searchParams.get('longExchange');
    const shortExchangeRaw = searchParams.get('shortExchange');
    const rangeRaw = searchParams.get('range') || '7D';

    // Validate required parameters
    if (!symbolRaw || !longExchangeRaw || !shortExchangeRaw) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Sanitize inputs
    const symbol = sanitizeSymbol(symbolRaw);
    const longExchange = sanitizeExchange(longExchangeRaw);
    const shortExchange = sanitizeExchange(shortExchangeRaw);
    const range = sanitizeRange(rangeRaw);

    if (!symbol) {
        return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    }
    if (!longExchange) {
        return NextResponse.json({ error: 'Invalid long exchange' }, { status: 400 });
    }
    if (!shortExchange) {
        return NextResponse.json({ error: 'Invalid short exchange' }, { status: 400 });
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

        // For EXIT spread, we need:
        // - Long exchange BID (what we receive when closing long)
        // - Short exchange ASK (what we pay when closing short)
        const longBidQuery = `
            SELECT 
                timestamp as time,
                avg(bid) as bid_price
            FROM prices
            WHERE symbol = '${symbol}'
              AND exchange = '${longExchange}'
              AND timestamp > ${startTimeUs}
            SAMPLE BY ${sampleInterval}
            ORDER BY timestamp ASC
            LIMIT 500
        `;

        const shortAskQuery = `
            SELECT 
                timestamp as time,
                avg(ask) as ask_price
            FROM prices
            WHERE symbol = '${symbol}'
              AND exchange = '${shortExchange}'
              AND timestamp > ${startTimeUs}
            SAMPLE BY ${sampleInterval}
            ORDER BY timestamp ASC
            LIMIT 500
        `;

        console.log(`[exit-spread-history] Querying ${symbol}: LONG ${longExchange} (bid) vs SHORT ${shortExchange} (ask), range=${range}`);

        const [longResponse, shortResponse] = await Promise.all([
            fetch(`https://${questdbHost}/exec?query=${encodeURIComponent(longBidQuery)}`),
            fetch(`https://${questdbHost}/exec?query=${encodeURIComponent(shortAskQuery)}`)
        ]);

        if (!longResponse.ok || !shortResponse.ok) {
            console.error('[exit-spread-history] QuestDB query failed');
            return NextResponse.json({ data: [] });
        }

        const longResult = await longResponse.json();
        const shortResult = await shortResponse.json();

        console.log(`[exit-spread-history] Long BID data: ${longResult.count || 0} rows, Short ASK data: ${shortResult.count || 0} rows`);

        // Create a map of short ASK prices by exact timestamp from SAMPLE BY
        // Also keep the original entries array for tolerance-based matching
        const shortAskMap = new Map<string, number>();
        const shortEntries: Array<[string, number]> = shortResult.dataset || [];

        shortEntries.forEach((row: [string, number]) => {
            // Store with exact timestamp for primary matching
            shortAskMap.set(row[0], row[1]);
        });

        // Calculate EXIT spread by matching time buckets
        // Exit Spread = (longBid - shortAsk) / shortAsk * 100
        const data: Array<{ time: string; spread: number; longBid: number; shortAsk: number }> = [];

        (longResult.dataset || []).forEach((row: [string, number]) => {
            const time = row[0];
            const longBid = row[1];

            // First try exact match
            let shortAsk = shortAskMap.get(time);

            // If no exact match, find closest timestamp within 4 second tolerance
            if (!shortAsk && shortEntries.length > 0) {
                const longTime = new Date(time).getTime();

                for (let i = 0; i < shortEntries.length; i++) {
                    const shortTime = new Date(shortEntries[i][0]).getTime();
                    const diff = Math.abs(longTime - shortTime);

                    // Match if within 4 seconds tolerance
                    if (diff < 4000) {
                        shortAsk = shortEntries[i][1];
                        break;
                    }
                }
            }

            if (shortAsk && shortAsk > 0) {
                const spread = ((longBid - shortAsk) / shortAsk) * 100;
                data.push({
                    time,
                    spread: Math.round(spread * 10000) / 10000,
                    longBid: Math.round(longBid * 100) / 100,
                    shortAsk: Math.round(shortAsk * 100) / 100
                });
            }
        });

        console.log(`[exit-spread-history] Result: ${data.length} exit spread points calculated`);

        return NextResponse.json({ data });
    } catch (error) {
        console.error('[exit-spread-history] Error:', error);
        return NextResponse.json({ data: [] });
    }
}
