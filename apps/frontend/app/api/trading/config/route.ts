import { NextRequest, NextResponse } from 'next/server';

// Trading configuration (in production, this would be in the engine)
let tradingConfig = {
    paperMode: true,
    minSpreadPercent: 0.2,
    maxSpreadPercent: 5.0,
    positionSizePerLeg: 100,
    leverage: 5,
    verifyWithRest: true,
    antiLiquidation: true,
    selectedExchanges: ['hyperliquid', 'paradex'] as string[],
    allowedTokens: [] as string[],
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

    const secretToken = process.env.TRADING_SECRET_TOKEN;
    if (!secretToken || token !== secretToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(tradingConfig);
}

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

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
            tradingConfig.maxSpreadPercent = Math.min(20, updates.maxSpreadPercent);
        }
        if (typeof updates.positionSizePerLeg === 'number') {
            tradingConfig.positionSizePerLeg = Math.max(10, updates.positionSizePerLeg);
        }
        if (typeof updates.leverage === 'number') {
            tradingConfig.leverage = Math.min(20, Math.max(1, updates.leverage));
        }
        if (typeof updates.verifyWithRest === 'boolean') {
            tradingConfig.verifyWithRest = updates.verifyWithRest;
        }
        if (typeof updates.antiLiquidation === 'boolean') {
            tradingConfig.antiLiquidation = updates.antiLiquidation;
        }
        if (Array.isArray(updates.selectedExchanges)) {
            tradingConfig.selectedExchanges = updates.selectedExchanges;
        }
        if (Array.isArray(updates.allowedTokens)) {
            tradingConfig.allowedTokens = updates.allowedTokens;
        }

        console.log('[Trading API] Config updated:', tradingConfig);

        return NextResponse.json({ success: true, config: tradingConfig });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
}
