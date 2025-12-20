import { NextRequest, NextResponse } from 'next/server';

/**
 * Trading Authentication API
 * Verifies the secret token for trading access
 * 
 * GET /api/trading/auth?token=xxx
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Get secret token from environment
    const secretToken = process.env.TRADING_SECRET_TOKEN;

    if (!secretToken) {
        return NextResponse.json(
            { error: 'Trading not configured' },
            { status: 503 }
        );
    }

    if (!token || token !== secretToken) {
        return NextResponse.json(
            { error: 'Invalid token' },
            { status: 401 }
        );
    }

    return NextResponse.json({ authenticated: true });
}
