'use client';

import { useState } from 'react';
import Image from 'next/image';
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
            {/* Collapse Button */}
            <button
                className={styles.collapseBtn}
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? 'Expand' : 'Collapse'}
            >
                <span className={styles.collapseIcon}>{isCollapsed ? '▸' : '◂'}</span>
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
                    <button
                        className={`${styles.favoritesBtn} ${showFavoritesOnly ? styles.active : ''}`}
                        onClick={onShowFavoritesToggle}
                    >
                        <span className={styles.starIcon}>★</span>
                        <span className={styles.favoritesText}>Favorites</span>
                    </button>

                    {/* Exchanges */}
                    <div className={styles.exchangesSection}>
                        <span className={styles.sectionTitle}>EXCHANGES</span>
                        <div className={styles.exchangeList}>
                            {exchanges.map((exchange) => (
                                <button
                                    key={exchange.id}
                                    className={`${styles.exchangeBtn} ${selectedExchanges.has(exchange.id) ? styles.selected : ''}`}
                                    onClick={() => onExchangeToggle(exchange.id)}
                                >
                                    <Image
                                        src={`/assets/logos/${exchange.id}.png`}
                                        alt={exchange.id}
                                        width={24}
                                        height={24}
                                        className={styles.exchangeLogo}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.opacity = '0.3';
                                        }}
                                    />
                                    <span className={styles.exchangeName}>
                                        {exchange.id.toUpperCase()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </aside>
    );
}
