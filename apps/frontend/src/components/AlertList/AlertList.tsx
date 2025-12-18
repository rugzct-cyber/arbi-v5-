'use client';

import type { SpreadAlert } from '@/hooks/useAlerts';
import styles from './AlertList.module.css';

interface AlertListProps {
    alerts: SpreadAlert[];
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
    onReset: (id: string) => void;
    getSpread: (alert: SpreadAlert) => { spread: number; direction: string } | null;
}

export function AlertList({ alerts, onToggle, onRemove, onReset, getSpread }: AlertListProps) {
    if (alerts.length === 0) {
        return (
            <div className={styles.empty}>
                <p>No alerts configured</p>
                <p className={styles.hint}>Click "Add Alert" to create one</p>
            </div>
        );
    }

    return (
        <div className={styles.list}>
            {alerts.map(alert => {
                const result = getSpread(alert);
                const isTriggered = !!alert.triggeredAt;

                return (
                    <div
                        key={alert.id}
                        className={`${styles.item} ${!alert.enabled ? styles.disabled : ''} ${isTriggered ? styles.triggered : ''}`}
                    >
                        <div className={styles.info}>
                            <div className={styles.symbol}>
                                {alert.symbol.replace('-USD', '')}
                            </div>
                            <div className={styles.exchanges}>
                                {alert.exchangeA} ⇄ {alert.exchangeB}
                            </div>
                        </div>

                        <div className={styles.condition}>
                            <span className={styles.direction}>≥</span>
                            <span className={styles.threshold}>{alert.threshold}%</span>
                        </div>

                        {result !== null && (
                            <div className={styles.current}>
                                <span className={result.spread >= 0 ? styles.positive : styles.negative}>
                                    {result.spread.toFixed(3)}%
                                </span>
                            </div>
                        )}

                        <div className={styles.actions}>
                            {isTriggered && (
                                <button
                                    className={styles.resetBtn}
                                    onClick={() => onReset(alert.id)}
                                    title="Re-arm alert"
                                >
                                    🔄
                                </button>
                            )}
                            <button
                                className={styles.toggleBtn}
                                onClick={() => onToggle(alert.id)}
                                title={alert.enabled ? 'Disable' : 'Enable'}
                            >
                                {alert.enabled ? '🔔' : '🔕'}
                            </button>
                            <button
                                className={styles.removeBtn}
                                onClick={() => onRemove(alert.id)}
                                title="Delete"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
