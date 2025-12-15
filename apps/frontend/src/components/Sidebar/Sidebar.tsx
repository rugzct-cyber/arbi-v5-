'use client';

import { useState } from 'react';
import styles from './Sidebar.module.css';

interface ExchangeStatus {
    id: string;
    connected: boolean;
}

interface SidebarProps {
    exchanges: ExchangeStatus[];
    selectedExchanges: Set<string>;
    onExchangeToggle: (exchangeId: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    favorites: Set<string>;
    onFavoriteToggle: (symbol: string) => void;
    showFavoritesOnly: boolean;
    onShowFavoritesToggle: () => void;
}

export function Sidebar({
    exchanges,
    selectedExchanges,
    onExchangeToggle,
    searchQuery,
    onSearchChange,
    favorites,
    showFavoritesOnly,
    onShowFavoritesToggle,
}: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
            {/* Collapse Toggle */}
            <button
                className={styles.collapseBtn}
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? 'Expand' : 'Collapse'}
            >
                {isCollapsed ? '»' : '«'}
            </button>

            {!isCollapsed && (
                <>
                    {/* Search */}
                    <div className={styles.searchSection}>
                        <input
                            type="text"
                            placeholder="SEARCH PAIR..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>

                    {/* Favorites */}
                    <div className={styles.section}>
                        <button
                            className={`${styles.favoritesBtn} ${showFavoritesOnly ? styles.active : ''}`}
                            onClick={onShowFavoritesToggle}
                        >
                            <span className={styles.starIcon}>★</span>
                            Favorites
                            {favorites.size > 0 && (
                                <span className={styles.count}>({favorites.size})</span>
                            )}
                        </button>
                    </div>

                    {/* Exchanges */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>EXCHANGES</h3>
                        <ul className={styles.exchangeList}>
                            {exchanges.map((exchange) => (
                                <li key={exchange.id} className={styles.exchangeItem}>
                                    <label className={styles.exchangeLabel}>
                                        <input
                                            type="checkbox"
                                            checked={selectedExchanges.has(exchange.id)}
                                            onChange={() => onExchangeToggle(exchange.id)}
                                            className={styles.checkbox}
                                        />
                                        <span
                                            className={`${styles.statusDot} ${exchange.connected ? styles.online : styles.offline
                                                }`}
                                        />
                                        <span className={styles.exchangeName}>
                                            {exchange.id.toUpperCase()}
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </aside>
    );
}
