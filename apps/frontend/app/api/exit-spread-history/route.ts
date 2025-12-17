import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Allowed values for validation (whitelist approach)
const VALID_EXCHANGES = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal'];
const VALID_RANGES = ['24H', '7D', '30D', 'ALL'];
const SYMBOL_PATTERN = /^[A-Z0-9]+-USD$/;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function sanitizeSymbol(symbol: string): string | null {
    const upper = symbol.toUpperCase();
    if (!SYMBOL_PATTERN.test(upper)) return null;
    if (upper.length > 20 || /[;'"\\]/.test(upper)) return null;
    return upper;
}

function sanitizeExchange(exchange: string): string | null {
    const lower = exchange.toLowerCase();
    return VALID_EXCHANGES.includes(lower) ? lower : null;
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

    const symbol = sanitizeSymbol(symbolRaw);
    const longExchange = sanitizeExchange(longExchangeRaw);
    const shortExchange = sanitizeExchange(shortExchangeRaw);
    const range = sanitizeRange(rangeRaw);

    if (!symbol) return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    if (!longExchange) return NextResponse.json({ error: 'Invalid long exchange' }, { status: 400 });
    if (!shortExchange) return NextResponse.json({ error: 'Invalid short exchange' }, { status: 400 });

    // Calculate time range
    const now = new Date();
    let startTime: Date;

    switch (range) {
        case '24H':
            startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7D':
            startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30D':
            startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'ALL':
        default:
            startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
    }

    try {
        console.log(`[exit-spread-history] Querying ${symbol}: LONG ${longExchange} (bid) vs SHORT ${shortExchange} (ask), range=${range}`);

        // For EXIT spread, we need:
        // - Long exchange BID (what we receive when closing long)
        // - Short exchange ASK (what we pay when closing short)
        const { data: longData, error: longError } = await supabase
            .from('prices')
            .select('timestamp, bid')
            .eq('symbol', symbol)
            .eq('exchange', longExchange)
            .gte('timestamp', startTime.toISOString())
            .order('timestamp', { ascending: true })
            .limit(500);

        const { data: shortData, error: shortError } = await supabase
            .from('prices')
            .select('timestamp, ask')
            .eq('symbol', symbol)
            .eq('exchange', shortExchange)
            .gte('timestamp', startTime.toISOString())
            .order('timestamp', { ascending: true })
            .limit(500);

        if (longError || shortError) {
            console.error('[exit-spread-history] Supabase query failed:', longError || shortError);
            return NextResponse.json({ data: [] });
        }

        console.log(`[exit-spread-history] Long BID data: ${longData?.length || 0} rows, Short ASK data: ${shortData?.length || 0} rows`);

        // Create a map of short ASK prices by timestamp
        const shortAskMap = new Map<string, number>();
        (shortData || []).forEach((row) => {
            shortAskMap.set(row.timestamp, parseFloat(row.ask));
        });

        // Calculate EXIT spread by matching timestamps
        const data: Array<{ time: string; spread: number; longBid: number; shortAsk: number }> = [];

        (longData || []).forEach((row) => {
            const time = row.timestamp;
            const longBid = parseFloat(row.bid);

            // Try exact match first
            let shortAsk = shortAskMap.get(time);

            // If no exact match, find closest within 10 seconds
            if (!shortAsk && shortData && shortData.length > 0) {
                const longTime = new Date(time).getTime();
                for (const shortRow of shortData) {
                    const shortTime = new Date(shortRow.timestamp).getTime();
                    if (Math.abs(longTime - shortTime) < 10000) {
                        shortAsk = parseFloat(shortRow.ask);
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
