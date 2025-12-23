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

        // Helper function to fetch all data with pagination (Supabase limits to 1000 per request)
        async function fetchAllPaginated(exchange: string, priceField: 'ask' | 'bid') {
            const allData: any[] = [];
            const pageSize = 1000;
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('prices')
                    .select(`timestamp, ${priceField}`)
                    .eq('symbol', symbol)
                    .eq('exchange', exchange)
                    .gte('timestamp', startTime.toISOString())
                    .order('timestamp', { ascending: true })
                    .range(offset, offset + pageSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData.push(...data);
                    offset += pageSize;
                    hasMore = data.length === pageSize;
                }
            }
            return allData;
        }

        // Fetch all data with pagination
        let buyData: any[] = [];
        let sellData: any[] = [];
        let buyError: any = null;
        let sellError: any = null;

        try {
            buyData = await fetchAllPaginated(buyExchange, 'ask');
        } catch (e) {
            buyError = e;
        }

        try {
            sellData = await fetchAllPaginated(sellExchange, 'bid');
        } catch (e) {
            sellError = e;
        }

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

        // Downsample data based on time range to keep chart performant
        // Target: ~300 data points max
        const downsampledData = downsampleData(data, range);

        console.log(`[spread-history] Result: ${data.length} points calculated, ${downsampledData.length} after downsampling`);

        return NextResponse.json({ data: downsampledData });
    } catch (error) {
        console.error('[spread-history] Error:', error);
        return NextResponse.json({ data: [] });
    }
}

// Downsample data to reduce points for larger time ranges
function downsampleData(data: Array<{ time: string; spread: number }>, range: string): Array<{ time: string; spread: number }> {
    if (data.length === 0) return data;

    // Target number of points per range
    const targetPoints: Record<string, number> = {
        '24H': 288,   // Every 5 min (no downsampling)
        '7D': 336,    // Every 30 min (~300 points)
        '30D': 360,   // Every 2 hours (~360 points)
        'ALL': 300,   // ~300 points regardless of range
    };

    const target = targetPoints[range] || 300;

    // If we have fewer points than target, return as is
    if (data.length <= target) return data;

    // Calculate step size
    const step = Math.ceil(data.length / target);

    // Sample every nth point
    const sampled: Array<{ time: string; spread: number }> = [];
    for (let i = 0; i < data.length; i += step) {
        sampled.push(data[i]);
    }

    // Always include the last point for accuracy
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
        sampled.push(data[data.length - 1]);
    }

    return sampled;
}
