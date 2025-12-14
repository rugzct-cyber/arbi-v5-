/**
 * Exchange configuration
 */
export interface ExchangeConfig {
    id: string;
    name: string;
    wsUrl: string;
    restUrl?: string;
    type: 'cex' | 'dex';
    enabled: boolean;
}

/**
 * Supported exchanges - All DEX perpetual platforms
 */
export const EXCHANGES: Record<string, ExchangeConfig> = {
    paradex: {
        id: 'paradex',
        name: 'Paradex',
        wsUrl: 'wss://ws.api.paradex.trade/v1',
        restUrl: 'https://api.paradex.trade/v1',
        type: 'dex',
        enabled: true,
    },
    vest: {
        id: 'vest',
        name: 'Vest',
        wsUrl: 'wss://api.vest.exchange/ws',
        restUrl: 'https://api.vest.exchange',
        type: 'dex',
        enabled: true,
    },
    extended: {
        id: 'extended',
        name: 'Extended',
        wsUrl: 'wss://ws.prod.extended.exchange/orderbooks',
        type: 'dex',
        enabled: true,
    },
    hyperliquid: {
        id: 'hyperliquid',
        name: 'Hyperliquid',
        wsUrl: 'wss://api.hyperliquid.xyz/ws',
        restUrl: 'https://api.hyperliquid.xyz',
        type: 'dex',
        enabled: true,
    },
    lighter: {
        id: 'lighter',
        name: 'Lighter',
        wsUrl: 'wss://api.lighter.xyz/ws/v1',
        restUrl: 'https://api.lighter.xyz',
        type: 'dex',
        enabled: true,
    },
    hibachi: {
        id: 'hibachi',
        name: 'Hibachi',
        wsUrl: 'wss://api.hibachi.xyz/ws',
        type: 'dex',
        enabled: true,
    },
    aster: {
        id: 'aster',
        name: 'Aster',
        wsUrl: 'wss://api.aster.finance/ws',
        type: 'dex',
        enabled: true,
    },
    pacifica: {
        id: 'pacifica',
        name: 'Pacifica',
        wsUrl: 'wss://api.pacifica.exchange/ws',
        type: 'dex',
        enabled: true,
    },
    xyz: {
        id: 'xyz',
        name: 'XYZ',
        wsUrl: 'wss://api.xyz.exchange/ws',
        type: 'dex',
        enabled: true,
    },
    ostium: {
        id: 'ostium',
        name: 'Ostium',
        wsUrl: 'wss://api.ostium.io/ws',
        restUrl: 'https://api.ostium.io',
        type: 'dex',
        enabled: true,
    },
    ethereal: {
        id: 'ethereal',
        name: 'Ethereal',
        wsUrl: 'wss://api.ethereal.trade/ws',
        type: 'dex',
        enabled: true,
    },
    edgex: {
        id: 'edgex',
        name: 'EdgeX',
        wsUrl: 'wss://api.edgex.exchange/ws',
        type: 'dex',
        enabled: true,
    },
    backpack: {
        id: 'backpack',
        name: 'Backpack',
        wsUrl: 'wss://ws.backpack.exchange',
        restUrl: 'https://api.backpack.exchange',
        type: 'dex',
        enabled: true,
    },
} as const;

export type ExchangeId = keyof typeof EXCHANGES;

/**
 * Get enabled exchanges
 */
export function getEnabledExchanges(): ExchangeConfig[] {
    return Object.values(EXCHANGES).filter(e => e.enabled);
}

/**
 * Get exchange by ID
 */
export function getExchange(id: string): ExchangeConfig | undefined {
    return EXCHANGES[id];
}
