'use client';

import { useState, useMemo, useEffect } from 'react';
import type { PriceUpdate, ArbitrageOpportunity } from '@arbitrage/shared';
import { Sidebar } from '@/components/Sidebar';
import { PriceTable } from './PriceTable';
import styles from './Dashboard.module.css';

interface ExchangeStatus {
    id: string;
    connected: boolean;
}

interface DashboardProps {
    isConnected: boolean;
    isLoading: boolean;
    prices: Map<string, Map<string, PriceUpdate>>;
    opportunities: ArbitrageOpportunity[];
    exchanges: ExchangeStatus[];
    lastRefresh: Date;
    onRefresh: () => void;
    refreshInterval: number;
    onRefreshIntervalChange: (interval: number) => void;
}

const REFRESH_OPTIONS = [
    { label: 'Instant', value: 0 },
    { label: '5s', value: 5000 },
    { label: '15s', value: 15000 },
    { label: '30s', value: 30000 },
    { label: '1min', value: 60000 },
];

export function Dashboard({
    isConnected,
    isLoading,
    prices,
    opportunities,
    exchanges,
    lastRefresh,
    onRefresh,
    refreshInterval,
    onRefreshIntervalChange
}: DashboardProps) {
    // State for filtering
    const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(() => {
        return new Set(exchanges.map(e => e.id));
    });
    const [searchQuery, setSearchQuery] = useState('');
    // Initialize favorites as empty Set to avoid hydration mismatch
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // Load favorites from localStorage after mount (client-side only)
    useEffect(() => {
        const saved = localStorage.getItem('favorites');
        if (saved) {
            setFavorites(new Set(JSON.parse(saved)));
        }
    }, []);

    // Update selectedExchanges when exchanges list changes
    useMemo(() => {
        if (exchanges.length > 0 && selectedExchanges.size === 0) {
            setSelectedExchanges(new Set(exchanges.map(e => e.id)));
        }
    }, [exchanges]);

    // Handlers
    const handleExchangeToggle = (exchangeId: string) => {
        setSelectedExchanges(prev => {
            const next = new Set(prev);
            if (next.has(exchangeId)) {
                next.delete(exchangeId);
            } else {
                next.add(exchangeId);
            }
            return next;
        });
    };

    const handleFavoriteToggle = (symbol: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) {
                next.delete(symbol);
            } else {
                next.add(symbol);
            }
            localStorage.setItem('favorites', JSON.stringify([...next]));
            return next;
        });
    };

    // Get list of active exchange ids for column headers
    const activeExchangeIds = useMemo(() => {
        return Array.from(selectedExchanges).sort();
    }, [selectedExchanges]);

    return (
        <div className={styles.dashboardLayout}>
            <Sidebar
                exchanges={exchanges}
                selectedExchanges={selectedExchanges}
                onExchangeToggle={handleExchangeToggle}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                favorites={favorites}
                onFavoriteToggle={handleFavoriteToggle}
                showFavoritesOnly={showFavoritesOnly}
                onShowFavoritesToggle={() => setShowFavoritesOnly(!showFavoritesOnly)}
            />

            <div className={styles.mainContent}>
                {/* Header */}
                <header className={styles.header}>
                    <div className={styles.headerContent}>
                        <h1 className={styles.title}>
                            <span className={styles.logo}>📈</span>
                            Arbitrage Dashboard
                        </h1>

                        <nav className={styles.nav}>
                            <a href="/" className={styles.navLink}>Dashboard</a>
                            <a href="/positions" className={styles.navLinkInactive}>Positions</a>
                        </nav>

                        <div className={styles.headerRight}>
                            <div className={styles.refreshSection}>
                                <select
                                    className={styles.refreshSelect}
                                    value={refreshInterval}
                                    onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
                                >
                                    {REFRESH_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <span className={styles.lastRefresh} suppressHydrationWarning>
                                    Updated: {lastRefresh.toLocaleTimeString()}
                                </span>
                                <button className={styles.refreshBtn} onClick={onRefresh}>
                                    Refresh
                                </button>
                            </div>

                            <div className={styles.status}>
                                <span className={`status-dot ${isConnected ? 'status-connected' : 'status-disconnected'}`} />
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Price Table */}
                <section className={styles.section}>
                    <PriceTable
                        prices={prices}
                        selectedExchanges={selectedExchanges}
                        searchQuery={searchQuery}
                        showFavoritesOnly={showFavoritesOnly}
                        favorites={favorites}
                        activeExchangeIds={activeExchangeIds}
                        onFavoriteToggle={handleFavoriteToggle}
                        isLoading={isLoading}
                    />
                </section>
            </div>
        </div>
    );
}
