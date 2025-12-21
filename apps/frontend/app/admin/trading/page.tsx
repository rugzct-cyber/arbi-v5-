'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './trading.module.css';

// Available exchanges
const ALL_EXCHANGES = ['hyperliquid', 'paradex', 'vest', 'extended', 'lighter', 'pacifica', 'ethereal', 'nado'];

interface TradingStats {
    isRunning: boolean;
    isAuthenticated: boolean;
    strategy: {
        opportunitiesSeen: number;
        opportunitiesFiltered: number;
        tradesAttempted: number;
        tradesSucceeded: number;
        tradesFailed: number;
    };
    activeTrades: any[];
    tradeHistory: any[];
}

interface BotConfig {
    paperMode: boolean;
    minSpreadPercent: number;
    maxSpreadPercent: number;
    maxPositionSizeUsd: number;
    verifyWithRest: boolean;
    selectedExchanges: string[];
    allowedTokens: string[];
}

// Loading fallback component
function LoadingFallback() {
    return (
        <div className={styles.container}>
            <div className={styles.accessDenied}>
                <div className={styles.spinner}></div>
                <p>Chargement...</p>
            </div>
        </div>
    );
}

// Main page wrapper with Suspense
export default function TradingAdminPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <TradingAdminContent />
        </Suspense>
    );
}

// Actual content component
function TradingAdminContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<TradingStats | null>(null);
    const [tokenInput, setTokenInput] = useState('');
    const [config, setConfig] = useState<BotConfig>({
        paperMode: true,
        minSpreadPercent: 0.15,
        maxSpreadPercent: 5.0,
        maxPositionSizeUsd: 100,
        verifyWithRest: true,
        selectedExchanges: ['hyperliquid', 'paradex'],
        allowedTokens: [],
    });

    // Verify token on load
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setError('Token manquant. Accès refusé.');
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/trading/auth?token=${token}`);
                if (response.ok) {
                    setIsAuthenticated(true);
                    fetchStats();
                } else {
                    setError('Token invalide. Accès refusé.');
                }
            } catch (err) {
                setError('Erreur de vérification du token.');
            }
            setIsLoading(false);
        };

        verifyToken();
    }, [token]);

    // Fetch stats periodically
    const fetchStats = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch(`/api/trading/stats?token=${token}`);
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, [token]);

    useEffect(() => {
        if (isAuthenticated) {
            const interval = setInterval(fetchStats, 2000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, fetchStats]);

    // Bot control functions
    const startBot = async () => {
        const response = await fetch(`/api/trading/control?token=${token}&action=start`, { method: 'POST' });
        if (response.ok) fetchStats();
    };

    const stopBot = async () => {
        const response = await fetch(`/api/trading/control?token=${token}&action=stop`, { method: 'POST' });
        if (response.ok) fetchStats();
    };

    const updateConfig = async () => {
        await fetch(`/api/trading/config?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        fetchStats();
    };

    // Access denied screen
    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.accessDenied}>
                    <div className={styles.spinner}></div>
                    <p>Vérification...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || error) {
        return (
            <div className={styles.container}>
                <div className={styles.accessDenied}>
                    <div className={styles.lockIcon}>🔒</div>
                    <h1>Accès Refusé</h1>
                    <p>{error || 'Cette page est protégée.'}</p>
                    <code className={styles.hint}>?token=TRADING_SECRET_TOKEN</code>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <h1>🤖 Trading Bot Admin</h1>
                <div className={styles.status}>
                    <span className={stats?.isRunning ? styles.statusActive : styles.statusInactive}>
                        {stats?.isRunning ? '● RUNNING' : '○ STOPPED'}
                    </span>
                </div>
            </header>

            <div className={styles.grid}>
                {/* Control Panel */}
                <section className={styles.panel}>
                    <h2>Contrôles</h2>
                    <div className={styles.controlButtons}>
                        <button
                            className={styles.startButton}
                            onClick={startBot}
                            disabled={stats?.isRunning}
                        >
                            ▶ Démarrer
                        </button>
                        <button
                            className={styles.stopButton}
                            onClick={stopBot}
                            disabled={!stats?.isRunning}
                        >
                            ⏹ Arrêter
                        </button>
                    </div>
                </section>

                {/* Stats Panel */}
                <section className={styles.panel}>
                    <h2>Statistiques</h2>
                    <div className={styles.statsGrid}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{stats?.strategy.opportunitiesSeen || 0}</span>
                            <span className={styles.statLabel}>Opportunités vues</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{stats?.strategy.tradesAttempted || 0}</span>
                            <span className={styles.statLabel}>Trades tentés</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue} style={{ color: '#4ade80' }}>
                                {stats?.strategy.tradesSucceeded || 0}
                            </span>
                            <span className={styles.statLabel}>Réussis</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue} style={{ color: '#f87171' }}>
                                {stats?.strategy.tradesFailed || 0}
                            </span>
                            <span className={styles.statLabel}>Échoués</span>
                        </div>
                    </div>
                </section>

                {/* Configuration Panel */}
                <section className={styles.panel}>
                    <h2>Configuration</h2>
                    <div className={styles.configForm}>
                        <label className={styles.configRow}>
                            <span>Paper Mode (simulation)</span>
                            <input
                                type="checkbox"
                                checked={config.paperMode}
                                onChange={(e) => setConfig({ ...config, paperMode: e.target.checked })}
                            />
                        </label>
                        <label className={styles.configRow}>
                            <span>Vérification REST</span>
                            <input
                                type="checkbox"
                                checked={config.verifyWithRest}
                                onChange={(e) => setConfig({ ...config, verifyWithRest: e.target.checked })}
                            />
                        </label>
                        <label className={styles.configRow}>
                            <span>Spread minimum (%)</span>
                            <input
                                type="number"
                                step="0.01"
                                value={config.minSpreadPercent}
                                onChange={(e) => setConfig({ ...config, minSpreadPercent: parseFloat(e.target.value) })}
                            />
                        </label>
                        <label className={styles.configRow}>
                            <span>Spread maximum (%)</span>
                            <input
                                type="number"
                                step="0.1"
                                value={config.maxSpreadPercent}
                                onChange={(e) => setConfig({ ...config, maxSpreadPercent: parseFloat(e.target.value) })}
                            />
                        </label>
                        <label className={styles.configRow}>
                            <span>Taille max position ($)</span>
                            <input
                                type="number"
                                step="10"
                                value={config.maxPositionSizeUsd}
                                onChange={(e) => setConfig({ ...config, maxPositionSizeUsd: parseFloat(e.target.value) })}
                            />
                        </label>
                        <button className={styles.updateButton} onClick={updateConfig}>
                            Mettre à jour
                        </button>
                    </div>
                </section>

                {/* Exchange Selection Panel */}
                <section className={styles.panel}>
                    <h2>Exchanges Actifs</h2>
                    <p className={styles.panelHint}>Sélectionne les exchanges sur lesquels le bot peut trader :</p>
                    <div className={styles.exchangeGrid}>
                        {ALL_EXCHANGES.map((exchange) => (
                            <label key={exchange} className={styles.exchangeItem}>
                                <input
                                    type="checkbox"
                                    checked={config.selectedExchanges.includes(exchange)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setConfig({
                                                ...config,
                                                selectedExchanges: [...config.selectedExchanges, exchange]
                                            });
                                        } else {
                                            setConfig({
                                                ...config,
                                                selectedExchanges: config.selectedExchanges.filter(ex => ex !== exchange)
                                            });
                                        }
                                    }}
                                />
                                <span className={styles.exchangeName}>{exchange.toUpperCase()}</span>
                            </label>
                        ))}
                    </div>
                    <p className={styles.selectedCount}>
                        {config.selectedExchanges.length} exchange(s) sélectionné(s)
                    </p>
                </section>

                {/* Token Whitelist Panel */}
                <section className={styles.panel}>
                    <h2>Tokens Autorisés</h2>
                    <p className={styles.panelHint}>Ajoute les tokens sur lesquels le bot peut trader (laisser vide = tous) :</p>
                    <div className={styles.tokenInputRow}>
                        <input
                            type="text"
                            placeholder="Ex: BTC-USD, ETH-USD"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && tokenInput.trim()) {
                                    const newToken = tokenInput.trim().toUpperCase();
                                    if (!config.allowedTokens.includes(newToken)) {
                                        setConfig({
                                            ...config,
                                            allowedTokens: [...config.allowedTokens, newToken]
                                        });
                                    }
                                    setTokenInput('');
                                }
                            }}
                            className={styles.tokenInput}
                        />
                        <button
                            className={styles.addTokenButton}
                            onClick={() => {
                                if (tokenInput.trim()) {
                                    const newToken = tokenInput.trim().toUpperCase();
                                    if (!config.allowedTokens.includes(newToken)) {
                                        setConfig({
                                            ...config,
                                            allowedTokens: [...config.allowedTokens, newToken]
                                        });
                                    }
                                    setTokenInput('');
                                }
                            }}
                        >
                            + Ajouter
                        </button>
                    </div>
                    <div className={styles.tokenTags}>
                        {config.allowedTokens.length === 0 ? (
                            <span className={styles.allTokensHint}>Tous les tokens (aucune restriction)</span>
                        ) : (
                            config.allowedTokens.map((t) => (
                                <span key={t} className={styles.tokenTag}>
                                    {t}
                                    <button
                                        className={styles.removeTokenBtn}
                                        onClick={() => setConfig({
                                            ...config,
                                            allowedTokens: config.allowedTokens.filter(tok => tok !== t)
                                        })}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))
                        )}
                    </div>
                </section>


                {/* Active Trades */}
                <section className={styles.panel}>
                    <h2>Trades actifs</h2>
                    {stats?.activeTrades && stats.activeTrades.length > 0 ? (
                        <div className={styles.tradesList}>
                            {stats.activeTrades.map((trade: any) => (
                                <div key={trade.id} className={styles.tradeItem}>
                                    <span className={styles.tradeSymbol}>{trade.symbol}</span>
                                    <span className={styles.tradeInfo}>
                                        Long {trade.longExchange} / Short {trade.shortExchange}
                                    </span>
                                    <span className={styles.tradeSpread}>
                                        {trade.entrySpread?.toFixed(3)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.emptyState}>Aucun trade actif</p>
                    )}
                </section>

                {/* Trade History */}
                <section className={styles.panel}>
                    <h2>Historique récent</h2>
                    {stats?.tradeHistory && stats.tradeHistory.length > 0 ? (
                        <div className={styles.tradesList}>
                            {stats.tradeHistory.map((trade: any) => (
                                <div key={trade.id} className={styles.tradeItem}>
                                    <span className={styles.tradeSymbol}>{trade.symbol}</span>
                                    <span className={styles.tradeStatus}>
                                        {trade.status === 'COMPLETED' ? '✅' : trade.status === 'FAILED' ? '❌' : '⏳'}
                                    </span>
                                    <span className={styles.tradeSpread}>
                                        {trade.entrySpread?.toFixed(3)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.emptyState}>Aucun historique</p>
                    )}
                </section>
            </div>

            {/* Warning Banner */}
            <div className={styles.warningBanner}>
                ⚠️ Cette page est secrète et protégée par token. Ne partagez jamais l'URL.
            </div>
        </div>
    );
}
