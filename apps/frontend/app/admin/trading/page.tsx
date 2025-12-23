'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './trading.module.css';

// Available exchanges
const ALL_EXCHANGES = ['hyperliquid', 'paradex', 'vest', 'extended', 'lighter', 'pacifica', 'ethereal', 'nado'];
const LEVERAGE_OPTIONS = [1, 2, 5, 10, 20];

interface TradingStats {
    isRunning: boolean;
    isAuthenticated: boolean;
    performance: {
        totalPnl: number;
        todayPnl: number;
        winRate: number;
        totalTrades: number;
    };
    strategy: {
        opportunitiesSeen: number;
        opportunitiesFiltered: number;
        tradesAttempted: number;
        tradesSucceeded: number;
        tradesFailed: number;
    };
    activeTrades: ActiveTrade[];
    tradeHistory: TradeRecord[];
}

interface ActiveTrade {
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

interface TradeRecord {
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

interface BotConfig {
    paperMode: boolean;
    minSpreadPercent: number;
    maxSpreadPercent: number;
    positionSizePerLeg: number;
    leverage: number;
    verifyWithRest: boolean;
    antiLiquidation: boolean;
    selectedExchanges: string[];
    allowedTokens: string[];
}

// Loading fallback
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

export default function TradingAdminPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <TradingAdminContent />
        </Suspense>
    );
}

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
        minSpreadPercent: 0.2,
        maxSpreadPercent: 5.0,
        positionSizePerLeg: 100,
        leverage: 5,
        verifyWithRest: true,
        antiLiquidation: true,
        selectedExchanges: ['hyperliquid', 'paradex'],
        allowedTokens: [],
    });

    // Calculate collateral
    const estimatedCollateral = (config.positionSizePerLeg * 2) / config.leverage;
    const liquidationBuffer = config.antiLiquidation ? ' (protection active)' : '';

    // Verify token
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setError('Token manquant');
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`/api/trading/auth?token=${token}`);
                if (response.ok) {
                    setIsAuthenticated(true);
                    fetchStats();
                } else {
                    setError('Token invalide');
                }
            } catch {
                setError('Erreur réseau');
            }
            setIsLoading(false);
        };
        verifyToken();
    }, [token]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        if (!token) return;
        try {
            const response = await fetch(`/api/trading/stats?token=${token}`);
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    }, [token]);

    useEffect(() => {
        if (isAuthenticated) {
            const interval = setInterval(fetchStats, 2000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, fetchStats]);

    // Bot controls
    const startBot = async () => {
        await fetch(`/api/trading/control?token=${token}&action=start`, { method: 'POST' });
        fetchStats();
    };

    const stopBot = async () => {
        await fetch(`/api/trading/control?token=${token}&action=stop`, { method: 'POST' });
        fetchStats();
    };

    const updateConfig = async () => {
        await fetch(`/api/trading/config?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        fetchStats();
    };

    const closeTrade = async (tradeId: string) => {
        await fetch(`/api/trading/close?token=${token}&tradeId=${tradeId}`, { method: 'POST' });
        fetchStats();
    };

    // Loading/Error states
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
                    <p>{error || 'Token requis'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>🤖 Trading Bot</h1>
                    <span className={stats?.isRunning ? styles.statusActive : styles.statusInactive}>
                        {stats?.isRunning ? '● RUNNING' : '○ STOPPED'}
                    </span>
                    {config.paperMode && <span className={styles.paperBadge}>PAPER</span>}
                </div>
                <div className={styles.headerControls}>
                    <button className={styles.startBtn} onClick={startBot} disabled={stats?.isRunning}>
                        ▶ Start
                    </button>
                    <button className={styles.stopBtn} onClick={stopBot} disabled={!stats?.isRunning}>
                        ⏹ Stop
                    </button>
                </div>
            </header>

            {/* Performance Dashboard */}
            <section className={styles.performanceBar}>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue} data-positive={stats?.performance?.totalPnl >= 0}>
                        {stats?.performance?.totalPnl >= 0 ? '+' : ''}{stats?.performance?.totalPnl?.toFixed(2) || '0.00'}$
                    </span>
                    <span className={styles.perfLabel}>PnL Total</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue} data-positive={stats?.performance?.todayPnl >= 0}>
                        {stats?.performance?.todayPnl >= 0 ? '+' : ''}{stats?.performance?.todayPnl?.toFixed(2) || '0.00'}$
                    </span>
                    <span className={styles.perfLabel}>Aujourd'hui</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue}>{stats?.performance?.winRate?.toFixed(1) || '0'}%</span>
                    <span className={styles.perfLabel}>Win Rate</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue}>{stats?.performance?.totalTrades || 0}</span>
                    <span className={styles.perfLabel}>Trades</span>
                </div>
                <div className={styles.perfItem}>
                    <span className={styles.perfValue}>{stats?.strategy?.opportunitiesSeen || 0}</span>
                    <span className={styles.perfLabel}>Opportunités</span>
                </div>
            </section>

            <div className={styles.mainGrid}>
                {/* Left Column - Config */}
                <div className={styles.leftColumn}>
                    {/* Configuration */}
                    <section className={styles.panel}>
                        <h2>⚙️ Configuration</h2>
                        <div className={styles.configGrid}>
                            <label className={styles.configItem}>
                                <span>Paper Mode</span>
                                <input
                                    type="checkbox"
                                    checked={config.paperMode}
                                    onChange={(e) => setConfig({ ...config, paperMode: e.target.checked })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Vérification REST</span>
                                <input
                                    type="checkbox"
                                    checked={config.verifyWithRest}
                                    onChange={(e) => setConfig({ ...config, verifyWithRest: e.target.checked })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Anti-Liquidation</span>
                                <input
                                    type="checkbox"
                                    checked={config.antiLiquidation}
                                    onChange={(e) => setConfig({ ...config, antiLiquidation: e.target.checked })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Spread Min (%)</span>
                                <input
                                    type="number"
                                    step="0.05"
                                    value={config.minSpreadPercent}
                                    onChange={(e) => setConfig({ ...config, minSpreadPercent: parseFloat(e.target.value) || 0 })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Spread Max (%)</span>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={config.maxSpreadPercent}
                                    onChange={(e) => setConfig({ ...config, maxSpreadPercent: parseFloat(e.target.value) || 0 })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Taille/Jambe ($)</span>
                                <input
                                    type="number"
                                    step="50"
                                    value={config.positionSizePerLeg}
                                    onChange={(e) => setConfig({ ...config, positionSizePerLeg: parseFloat(e.target.value) || 0 })}
                                />
                            </label>
                            <label className={styles.configItem}>
                                <span>Levier</span>
                                <select
                                    value={config.leverage}
                                    onChange={(e) => setConfig({ ...config, leverage: parseInt(e.target.value) })}
                                >
                                    {LEVERAGE_OPTIONS.map((lev) => (
                                        <option key={lev} value={lev}>{lev}x</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className={styles.collateralInfo}>
                            💰 Collateral estimé: <strong>${estimatedCollateral.toFixed(2)}</strong>
                            {liquidationBuffer}
                        </div>
                        <button className={styles.updateBtn} onClick={updateConfig}>
                            Sauvegarder
                        </button>
                    </section>

                    {/* Exchanges */}
                    <section className={styles.panel}>
                        <h2>📡 Exchanges ({config.selectedExchanges.length})</h2>
                        <div className={styles.exchangeGrid}>
                            {ALL_EXCHANGES.map((ex) => (
                                <label key={ex} className={styles.exchangeChip} data-active={config.selectedExchanges.includes(ex)}>
                                    <input
                                        type="checkbox"
                                        checked={config.selectedExchanges.includes(ex)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setConfig({ ...config, selectedExchanges: [...config.selectedExchanges, ex] });
                                            } else {
                                                setConfig({ ...config, selectedExchanges: config.selectedExchanges.filter(x => x !== ex) });
                                            }
                                        }}
                                    />
                                    {ex.toUpperCase()}
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Tokens */}
                    <section className={styles.panel}>
                        <h2>🪙 Tokens ({config.allowedTokens.length || 'Tous'})</h2>
                        <div className={styles.tokenInput}>
                            <input
                                type="text"
                                placeholder="BTC-USD, ETH-USD..."
                                value={tokenInput}
                                onChange={(e) => setTokenInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && tokenInput.trim()) {
                                        const newToken = tokenInput.trim().toUpperCase();
                                        if (!config.allowedTokens.includes(newToken)) {
                                            setConfig({ ...config, allowedTokens: [...config.allowedTokens, newToken] });
                                        }
                                        setTokenInput('');
                                    }
                                }}
                            />
                            <button onClick={() => {
                                if (tokenInput.trim()) {
                                    const newToken = tokenInput.trim().toUpperCase();
                                    if (!config.allowedTokens.includes(newToken)) {
                                        setConfig({ ...config, allowedTokens: [...config.allowedTokens, newToken] });
                                    }
                                    setTokenInput('');
                                }
                            }}>+</button>
                        </div>
                        <div className={styles.tokenList}>
                            {config.allowedTokens.length === 0 ? (
                                <span className={styles.allTokens}>Tous les tokens autorisés</span>
                            ) : (
                                config.allowedTokens.map((t) => (
                                    <span key={t} className={styles.tokenChip}>
                                        {t}
                                        <button onClick={() => setConfig({
                                            ...config,
                                            allowedTokens: config.allowedTokens.filter(x => x !== t)
                                        })}>×</button>
                                    </span>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column - Trades */}
                <div className={styles.rightColumn}>
                    {/* Active Trades */}
                    <section className={styles.panel}>
                        <h2>🔥 Trades Actifs ({stats?.activeTrades?.length || 0})</h2>
                        {stats?.activeTrades && stats.activeTrades.length > 0 ? (
                            <div className={styles.tradesTable}>
                                <div className={styles.tableHeader}>
                                    <span>Token</span>
                                    <span>Long → Short</span>
                                    <span>Entry</span>
                                    <span>Current</span>
                                    <span>PnL</span>
                                    <span>Action</span>
                                </div>
                                {stats.activeTrades.map((trade) => (
                                    <div key={trade.id} className={styles.tableRow}>
                                        <span className={styles.tradeSymbol}>{trade.symbol.replace('-USD', '')}</span>
                                        <span className={styles.tradeExchanges}>
                                            {trade.longExchange} → {trade.shortExchange}
                                        </span>
                                        <span>{trade.entrySpread.toFixed(3)}%</span>
                                        <span>{trade.currentSpread.toFixed(3)}%</span>
                                        <span className={styles.tradePnl} data-positive={trade.pnl >= 0}>
                                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}$
                                        </span>
                                        <button className={styles.closeBtn} onClick={() => closeTrade(trade.id)}>
                                            Fermer
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.emptyState}>Aucun trade actif</p>
                        )}
                    </section>

                    {/* Trade History */}
                    <section className={styles.panel}>
                        <h2>📜 Historique</h2>
                        {stats?.tradeHistory && stats.tradeHistory.length > 0 ? (
                            <div className={styles.tradesTable}>
                                <div className={styles.tableHeader}>
                                    <span>Token</span>
                                    <span>Exchanges</span>
                                    <span>Entry → Exit</span>
                                    <span>PnL</span>
                                    <span>Status</span>
                                </div>
                                {stats.tradeHistory.slice(0, 10).map((trade) => (
                                    <div key={trade.id} className={styles.tableRow}>
                                        <span className={styles.tradeSymbol}>{trade.symbol.replace('-USD', '')}</span>
                                        <span className={styles.tradeExchanges}>
                                            {trade.longExchange} / {trade.shortExchange}
                                        </span>
                                        <span>{trade.entrySpread.toFixed(2)}% → {trade.exitSpread.toFixed(2)}%</span>
                                        <span className={styles.tradePnl} data-positive={trade.pnl >= 0}>
                                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}$
                                        </span>
                                        <span className={styles.tradeStatus} data-status={trade.status}>
                                            {trade.status === 'COMPLETED' ? '✅' : trade.status === 'LIQUIDATED' ? '💀' : '❌'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.emptyState}>Aucun historique</p>
                        )}
                    </section>
                </div>
            </div>

            {/* Footer Warning */}
            <footer className={styles.footer}>
                ⚠️ Page secrète - Ne partagez jamais l'URL
            </footer>
        </div>
    );
}
