// Shared trading state (in production, this would be in the engine)

export interface ActiveTrade {
    id: string;
    symbol: string;
    longExchange: string;
    shortExchange: string;
    entrySpread: number;
    currentSpread: number;
    entryPriceLong: number;
    entryPriceShort: number;
    positionSize: number;
    pnl: number;
    openedAt: string;
}

export interface TradeRecord {
    id: string;
    symbol: string;
    longExchange: string;
    shortExchange: string;
    entrySpread: number;
    exitSpread: number;
    pnl: number;
    duration: string;
    status: 'COMPLETED' | 'FAILED' | 'LIQUIDATED';
    closedAt: string;
}

export const tradingState = {
    isRunning: false,
    isAuthenticated: false,
    performance: {
        totalPnl: 0,
        todayPnl: 0,
        winRate: 0,
        totalTrades: 0,
    },
    strategy: {
        opportunitiesSeen: 0,
        opportunitiesFiltered: 0,
        tradesAttempted: 0,
        tradesSucceeded: 0,
        tradesFailed: 0,
    },
    activeTrades: [] as ActiveTrade[],
    tradeHistory: [] as TradeRecord[],
};
