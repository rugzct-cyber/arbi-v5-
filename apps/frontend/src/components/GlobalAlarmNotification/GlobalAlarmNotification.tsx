'use client';

import { useSocket } from '@/hooks/useSocket';
import { usePositionAlarms } from '@/hooks/usePositionAlarms';
import styles from './GlobalAlarmNotification.module.css';

export function GlobalAlarmNotification() {
    const { prices } = useSocket();
    const { triggeredAlarm, dismissAlarm } = usePositionAlarms(prices);

    if (!triggeredAlarm) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.icon}>🔔</div>
                <h2 className={styles.title}>ALARME PROFIT!</h2>
                <p className={styles.message}>
                    Position <strong>{triggeredAlarm.token}</strong> a atteint le seuil
                </p>
                <div className={styles.details}>
                    <div className={styles.detailRow}>
                        <span>Spread Sortie</span>
                        <span className={styles.value}>{triggeredAlarm.exitSpread.toFixed(4)}%</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span>Seuil</span>
                        <span className={styles.threshold}>{triggeredAlarm.threshold}%</span>
                    </div>
                </div>
                <button className={styles.dismissBtn} onClick={dismissAlarm}>
                    ✓ Fermer l'alarme
                </button>
            </div>
        </div>
    );
}
