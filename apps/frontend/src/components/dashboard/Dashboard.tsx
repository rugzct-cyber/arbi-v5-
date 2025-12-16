'use client';

import { useState, useMemo } from 'react';
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
    prices: Map<string, Map<string, PriceUpdate>>;
    opportunities: ArbitrageOpportunity[];
    exchanges: ExchangeStatus[];
    lastRefresh: Date;
    onRefresh: () => void;
}

export function Dashboard({
    isConnected,
    prices,
    opportunities,
    exchanges,
    lastRefresh,
    onRefresh
}: DashboardProps) {
    // State for filtering
    const [selectedExchanges, setSelectedExchanges] = useState<Set<string>>(() => {
        return new Set(exchanges.map(e => e.id));
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [favorites, setFavorites] = useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('favorites');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        }
        return new Set();
    });
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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
                showFavoritesOnly={showFavoritesOnly}
                onShowFavoritesOnlyChange={setShowFavoritesOnly}
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
                            <a href="/history" className={styles.navLinkInactive}>History</a>
                            <a href="/settings" className={styles.navLinkInactive}>Settings</a>
                        </nav>

                        <div className={styles.headerRight}>
                            <div className={styles.refreshSection}>
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
                    />
                </section>
            </div>
        </div>
    );
}
