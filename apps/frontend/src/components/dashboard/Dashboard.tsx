'use client';

import { useState, useMemo, useEffect } from 'react';
import type { PriceUpdate, ArbitrageOpportunity } from '@arbitrage/shared';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
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
    alertCount?: number;
    onOpenAlerts?: () => void;
}

export function Dashboard({
    isConnected,
    isLoading,
    prices,
    opportunities,
    exchanges,
    lastRefresh,
    onRefresh,
    refreshInterval,
    onRefreshIntervalChange,
    alertCount = 0,
    onOpenAlerts,
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
        <div className={styles.page}>
            {/* Header - Full width above everything */}
            <Header
                activePage="dashboard"
                isConnected={isConnected}
                refreshOptions={{
                    refreshInterval,
                    onRefreshIntervalChange,
                    lastRefresh,
                    onRefresh
                }}
                alertOptions={onOpenAlerts ? {
                    alertCount: alertCount || 0,
                    onOpenAlerts
                } : undefined}
            />

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
        </div>
    );
}
