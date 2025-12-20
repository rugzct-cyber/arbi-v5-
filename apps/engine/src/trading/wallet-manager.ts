/**
 * Wallet Manager
 * Manages wallet connections and balances for each exchange
 * 
 * ⚠️ SECURITY: Never hardcode private keys!
 * Use environment variables and consider hardware wallets for production.
 */

import type { WalletConfig } from './types.js';

export class WalletManager {
    private wallets: Map<string, WalletConfig> = new Map();

    constructor() {
        // Wallets are added via addWallet() - no default initialization
        console.log('[WalletManager] Initialized (no wallets configured)');
    }

    /**
     * Add a wallet configuration for an exchange
     * Credentials should come from environment variables!
     */
    addWallet(config: WalletConfig): void {
        // Validate required fields
        if (!config.exchangeId) {
            throw new Error('Exchange ID is required');
        }

        // Log without exposing secrets
        console.log(`[WalletManager] Added wallet for ${config.exchangeId}`);
        this.wallets.set(config.exchangeId, config);
    }

    /**
     * Get wallet for an exchange
     */
    getWallet(exchangeId: string): WalletConfig | undefined {
        return this.wallets.get(exchangeId);
    }

    /**
     * Check if wallet exists and has sufficient balance
     */
    hasBalance(exchangeId: string, requiredUsd: number): boolean {
        const wallet = this.wallets.get(exchangeId);
        if (!wallet) {
            return false;
        }
        return wallet.availableBalance >= requiredUsd;
    }

    /**
     * Lock balance for a trade (move from available to locked)
     */
    lockBalance(exchangeId: string, amountUsd: number): boolean {
        const wallet = this.wallets.get(exchangeId);
        if (!wallet || wallet.availableBalance < amountUsd) {
            return false;
        }

        wallet.availableBalance -= amountUsd;
        wallet.lockedBalance += amountUsd;
        return true;
    }

    /**
     * Release locked balance (on trade completion or failure)
     */
    releaseBalance(exchangeId: string, amountUsd: number): void {
        const wallet = this.wallets.get(exchangeId);
        if (!wallet) return;

        wallet.lockedBalance = Math.max(0, wallet.lockedBalance - amountUsd);
        wallet.availableBalance += amountUsd;
    }

    /**
     * Update balance after PnL
     */
    updateBalance(exchangeId: string, pnlUsd: number): void {
        const wallet = this.wallets.get(exchangeId);
        if (!wallet) return;

        wallet.availableBalance += pnlUsd;
    }

    /**
     * Get all configured exchanges
     */
    getConfiguredExchanges(): string[] {
        return Array.from(this.wallets.keys());
    }

    /**
     * Get total available balance across all wallets
     */
    getTotalAvailableBalance(): number {
        let total = 0;
        for (const wallet of this.wallets.values()) {
            total += wallet.availableBalance;
        }
        return total;
    }

    /**
     * Get total locked balance
     */
    getTotalLockedBalance(): number {
        let total = 0;
        for (const wallet of this.wallets.values()) {
            total += wallet.lockedBalance;
        }
        return total;
    }
}
