'use client';

import { useEffect, useState } from 'react';
import type { AlertTrigger } from '@/hooks/useAlerts';
import styles from './AlertNotification.module.css';

interface AlertNotificationProps {
    triggers: AlertTrigger[];
    onDismiss: (alertId: string) => void;
}

export function AlertNotification({ triggers, onDismiss }: AlertNotificationProps) {
    const [visible, setVisible] = useState<string[]>([]);

    // Add new triggers to visible list
    useEffect(() => {
        const newIds = triggers.map(t => t.alert.id).filter(id => !visible.includes(id));
        if (newIds.length > 0) {
            setVisible(prev => [...newIds, ...prev]);
        }
    }, [triggers, visible]);

    // Auto-dismiss after 15 seconds
    useEffect(() => {
        if (visible.length === 0) return;

        const timers = visible.map(id =>
            setTimeout(() => {
                setVisible(prev => prev.filter(v => v !== id));
                onDismiss(id);
            }, 15000)
        );

        return () => timers.forEach(clearTimeout);
    }, [visible, onDismiss]);

    const handleDismiss = (alertId: string) => {
        setVisible(prev => prev.filter(id => id !== alertId));
        onDismiss(alertId);
    };

    const visibleTriggers = triggers.filter(t => visible.includes(t.alert.id));

    if (visibleTriggers.length === 0) return null;

    return (
        <div className={styles.container}>
            {visibleTriggers.map(trigger => (
                <div key={trigger.alert.id} className={styles.notification}>
                    <div className={styles.icon}>🔔</div>
                    <div className={styles.content}>
                        <div className={styles.title}>
                            Alert Triggered!
                        </div>
                        <div className={styles.details}>
                            <span className={styles.symbol}>
                                {trigger.alert.symbol.replace('-USD', '')}
                            </span>
                            <span className={styles.exchanges}>
                                {trigger.alert.exchangeA} ⇄ {trigger.alert.exchangeB}
                            </span>
                        </div>
                        <div className={styles.spread}>
                            Spread: <span className={trigger.currentSpread >= 0 ? styles.positive : styles.negative}>
                                {trigger.currentSpread.toFixed(4)}%
                            </span>
                            <span className={styles.threshold}>
                                ({trigger.direction})
                            </span>
                        </div>
                    </div>
                    <button
                        className={styles.dismissBtn}
                        onClick={() => handleDismiss(trigger.alert.id)}
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
