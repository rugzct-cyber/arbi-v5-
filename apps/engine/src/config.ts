export const EngineConfig = {
    // Arbitrage settings
    MAX_PRICE_AGE: 2000, // 2 seconds
    ARBITRAGE_COOLDOWN: 1000, // 1 second
    ARBITRAGE_MAX_HISTORY_AGE: 60000, // 1 minute

    // Cleanup settings
    CLEANUP_INTERVAL_ARBITRAGE: 30000, // 30 seconds
    CLEANUP_INTERVAL_PRICES: 1000, // 1 second

    // WebSocket settings
    DEFAULT_WATCHDOG_INTERVAL: 15000, // 15 seconds
    DEFAULT_RECONNECT_DELAY: 1000,
    MAX_RECONNECT_ATTEMPTS: 10,

    // Database

    DB_SNAPSHOT_MAX_AGE: 10000, // 10 seconds - older prices are excluded from snapshots
};
