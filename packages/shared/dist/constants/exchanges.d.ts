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
export declare const EXCHANGES: Record<string, ExchangeConfig>;
export type ExchangeId = keyof typeof EXCHANGES;
/**
 * Get enabled exchanges
 */
export declare function getEnabledExchanges(): ExchangeConfig[];
/**
 * Get exchange by ID
 */
export declare function getExchange(id: string): ExchangeConfig | undefined;
