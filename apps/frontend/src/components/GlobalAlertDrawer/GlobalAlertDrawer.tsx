'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SpreadAlert } from '@/hooks/useAlerts';
import styles from './GlobalAlertDrawer.module.css';

interface Position {
    id: string;
    token: string;
    longExchange: string;
    shortExchange: string;
    entryPriceLong: number;
    entryPriceShort: number;
    tokenAmount: number;
    alarmEnabled?: boolean;
    alarmThreshold?: number;
    alarmTriggered?: boolean;
}

interface GlobalAlertDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

// Load spread alerts from localStorage (same key as useAlerts)
function loadSpreadAlerts(): SpreadAlert[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('spread-alerts-v2');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Load positions from localStorage
function loadPositions(): Position[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('positions');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function GlobalAlertDrawer({ isOpen, onClose }: GlobalAlertDrawerProps) {
    const [spreadAlerts, setSpreadAlerts] = useState<SpreadAlert[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);

    // Reload data when drawer opens
    useEffect(() => {
        if (isOpen) {
            setSpreadAlerts(loadSpreadAlerts());
            setPositions(loadPositions());
        }
    }, [isOpen]);

    // Filter positions with alarms enabled
    const positionAlerts = useMemo(() => {
        return positions.filter(p => p.alarmEnabled);
    }, [positions]);

    const totalAlerts = spreadAlerts.length + positionAlerts.length;

    if (!isOpen) return null;

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div className={styles.drawer}>
                <div className={styles.header}>
                    <h3>🔔 Toutes les Alarmes</h3>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.content}>
                    {totalAlerts === 0 ? (
                        <div className={styles.empty}>
                            <p>Aucune alarme configurée</p>
                            <p className={styles.hint}>Configurer des alarmes depuis le Dashboard ou Positions</p>
                        </div>
                    ) : (
                        <>
                            {/* Spread Alerts Section */}
                            {spreadAlerts.length > 0 && (
                                <div className={styles.section}>
                                    <h4 className={styles.sectionTitle}>
                                        <span className={styles.entryBadge}>ENTRÉE</span>
                                        Alarmes Spread
                                    </h4>
                                    {spreadAlerts.map(alert => (
                                        <div
                                            key={alert.id}
                                            className={`${styles.alertItem} ${!alert.enabled ? styles.disabled : ''} ${alert.triggeredAt ? styles.triggered : ''}`}
                                        >
                                            <div className={styles.alertInfo}>
                                                <span className={styles.symbol}>{alert.symbol.replace('-USD', '')}</span>
                                                <span className={styles.exchanges}>{alert.exchangeA} ↔ {alert.exchangeB}</span>
                                            </div>
                                            <div className={styles.threshold}>
                                                ≥ {alert.threshold}%
                                            </div>
                                            <div className={styles.status}>
                                                {alert.triggeredAt ? '🔴' : (alert.enabled ? '🟢' : '⚫')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Position Exit Alerts Section */}
                            {positionAlerts.length > 0 && (
                                <div className={styles.section}>
                                    <h4 className={styles.sectionTitle}>
                                        <span className={styles.exitBadge}>SORTIE</span>
                                        Alarmes Position
                                    </h4>
                                    {positionAlerts.map(pos => (
                                        <div
                                            key={pos.id}
                                            className={`${styles.alertItem} ${pos.alarmTriggered ? styles.triggered : ''}`}
                                        >
                                            <div className={styles.alertInfo}>
                                                <span className={styles.symbol}>{pos.token.replace('-USD', '')}</span>
                                                <span className={styles.exchanges}>{pos.longExchange} → {pos.shortExchange}</span>
                                            </div>
                                            <div className={styles.threshold}>
                                                ≥ {pos.alarmThreshold}%
                                            </div>
                                            <div className={styles.status}>
                                                {pos.alarmTriggered ? '🔴' : '🟢'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <a href="/" className={styles.linkBtn}>
                        + Ajouter Alarme Spread
                    </a>
                    <a href="/positions" className={styles.linkBtn}>
                        + Ajouter Alarme Position
                    </a>
                </div>
            </div>
        </>
    );
}
