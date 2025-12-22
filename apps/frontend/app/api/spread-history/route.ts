import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Allowed values for validation (whitelist approach)
const VALID_EXCHANGES = ['paradex', 'vest', 'extended', 'hyperliquid', 'lighter', 'pacifica', 'ethereal', 'nado'];
const VALID_RANGES = ['24H', '7D', '30D', 'ALL'];
const SYMBOL_PATTERN = /^[A-Z0-9]+-USD$/;

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

    const symbol = sanitizeSymbol(symbolRaw);
    const buyExchange = sanitizeExchange(buyExchangeRaw);
    const sellExchange = sanitizeExchange(sellExchangeRaw);
    const range = sanitizeRange(rangeRaw);

    if (!symbol) return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    if (!buyExchange) return NextResponse.json({ error: 'Invalid buy exchange' }, { status: 400 });
    if (!sellExchange) return NextResponse.json({ error: 'Invalid sell exchange' }, { status: 400 });

    // Initialize Supabase client inside the function to avoid build-time issues
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('[spread-history] Missing Supabase credentials');
        return NextResponse.json({ data: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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
        console.log(`[spread-history] Querying ${symbol}: ${buyExchange} vs ${sellExchange}, range=${range}`);

        // Query buy exchange prices (ask)
        // Query buy exchange prices (ask) - order DESCENDING to get latest data first
        const { data: buyDataDesc, error: buyError } = await supabase
            .from('prices')
            .select('timestamp, ask')
            .eq('symbol', symbol)
            .eq('exchange', buyExchange)
            .gte('timestamp', startTime.toISOString())
            .order('timestamp', { ascending: false })
            .limit(2000);

        // Reverse to get chronological order for charting
        const buyData = buyDataDesc?.reverse() || [];

        // Query sell exchange prices (bid)
        // Query sell exchange prices (bid) - order DESCENDING to get latest data first
        const { data: sellDataDesc, error: sellError } = await supabase
            .from('prices')
            .select('timestamp, bid')
            .eq('symbol', symbol)
            .eq('exchange', sellExchange)
            .gte('timestamp', startTime.toISOString())
            .order('timestamp', { ascending: false })
            .limit(2000);

        // Reverse to get chronological order for charting
        const sellData = sellDataDesc?.reverse() || [];

        if (buyError || sellError) {
            console.error('[spread-history] Supabase query failed:', buyError || sellError);
            return NextResponse.json({ data: [] });
        }

        console.log(`[spread-history] Buy data: ${buyData?.length || 0} rows, Sell data: ${sellData?.length || 0} rows`);

        // Create a map of sell prices by timestamp
        const sellPriceMap = new Map<string, number>();
        (sellData || []).forEach((row: { timestamp: string; bid: string | number }) => {
            sellPriceMap.set(row.timestamp, parseFloat(String(row.bid)));
        });

        // Calculate spread by matching timestamps
        const data: Array<{ time: string; spread: number }> = [];

        (buyData || []).forEach((row: { timestamp: string; ask: string | number }) => {
            const time = row.timestamp;
            const askPrice = parseFloat(String(row.ask));

            // Try exact match first
            let bidPrice = sellPriceMap.get(time);

            // If no exact match, find closest within 10 seconds
            if (!bidPrice && sellData && sellData.length > 0) {
                const buyTime = new Date(time).getTime();
                for (const sellRow of sellData) {
                    const sellTime = new Date(sellRow.timestamp).getTime();
                    if (Math.abs(buyTime - sellTime) < 10000) {
                        bidPrice = parseFloat(String(sellRow.bid));
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
