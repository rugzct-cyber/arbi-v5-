import { NextRequest, NextResponse } from 'next/server';

// Trading configuration (in production, this would be in the engine)
let tradingConfig = {
    paperMode: true,
    minSpreadPercent: 0.15,
    maxSpreadPercent: 5.0,
    maxPositionSizeUsd: 100,
    maxTotalExposureUsd: 500,
    verifyWithRest: true,
    tradeCooldownMs: 5000,
    slippageTolerance: 0.1,
};

/**
 * Get/Update trading configuration
 * 
 * GET /api/trading/config?token=xxx
 * POST /api/trading/config?token=xxx (body: config updates)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Verify token
    const secretToken = process.env.TRADING_SECRET_TOKEN;
    if (!secretToken || token !== secretToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(tradingConfig);
}

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Verify token
    const secretToken = process.env.TRADING_SECRET_TOKEN;
    if (!secretToken || token !== secretToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const updates = await request.json();

        // Validate and merge config
        if (typeof updates.paperMode === 'boolean') {
            tradingConfig.paperMode = updates.paperMode;
        }
        if (typeof updates.minSpreadPercent === 'number') {
            tradingConfig.minSpreadPercent = Math.max(0.01, updates.minSpreadPercent);
        }
        if (typeof updates.maxSpreadPercent === 'number') {
            tradingConfig.maxSpreadPercent = Math.min(10, updates.maxSpreadPercent);
        }
        if (typeof updates.maxPositionSizeUsd === 'number') {
            tradingConfig.maxPositionSizeUsd = Math.max(10, updates.maxPositionSizeUsd);
        }
        if (typeof updates.verifyWithRest === 'boolean') {
            tradingConfig.verifyWithRest = updates.verifyWithRest;
        }

        console.log('[Trading API] Config updated:', tradingConfig);

        return NextResponse.json({ success: true, config: tradingConfig });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
}

// Export for other modules
export function getTradingConfig() {
    return { ...tradingConfig };
}
