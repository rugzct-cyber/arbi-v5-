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

    // Calculate time range
    const now = Date.now();
    let startTime: number;
    switch (range) {
        case '24H':
            startTime = now - 24 * 60 * 60 * 1000;
            break;
        case '7D':
            startTime = now - 7 * 24 * 60 * 60 * 1000;
            break;
        case '30D':
            startTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
        case 'ALL':
        default:
            startTime = now - 365 * 24 * 60 * 60 * 1000; // 1 year
            break;
    }

    try {
        const questdbHost = process.env.QUESTDB_HOST || 'questdbquestdb-production-cc7b.up.railway.app';

        // Query to get spread history between two exchanges
        // We need to join prices from both exchanges at the same timestamp
        const query = `
            SELECT 
                a.timestamp as time,
                ((b.bid - a.ask) / a.ask * 100) as spread
            FROM prices a
            JOIN prices b ON a.timestamp = b.timestamp AND a.symbol = b.symbol
            WHERE a.symbol = '${symbol}'
              AND a.exchange = '${buyExchange}'
              AND b.exchange = '${sellExchange}'
              AND a.timestamp > ${startTime * 1000}
            ORDER BY a.timestamp ASC
            LIMIT 1000
        `;

        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`https://${questdbHost}/exec?query=${encodedQuery}`);

        if (!response.ok) {
            console.error('QuestDB query failed:', await response.text());
            return NextResponse.json({ data: [] });
        }

        const result = await response.json();

        // Transform QuestDB response to our format
        const data = (result.dataset || []).map((row: [string, number]) => ({
            time: row[0],
            spread: row[1] || 0
        }));

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Failed to fetch spread history:', error);
        return NextResponse.json({ data: [] });
    }
}
