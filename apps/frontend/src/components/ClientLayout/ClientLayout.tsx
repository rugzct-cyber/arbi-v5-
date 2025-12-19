'use client';

import { useState, useEffect } from 'react';
import { GlobalAlarmNotification } from '@/components/GlobalAlarmNotification';
import { GlobalAlertDrawer } from '@/components/GlobalAlertDrawer';
import styles from './ClientLayout.module.css';

// Count total alerts from localStorage
function countAlerts(): number {
    if (typeof window === 'undefined') return 0;
    try {
        const spreadAlerts = JSON.parse(localStorage.getItem('spread-alerts-v2') || '[]');
        const positions = JSON.parse(localStorage.getItem('positions') || '[]');
        const positionAlerts = positions.filter((p: any) => p.alarmEnabled);
        return spreadAlerts.length + positionAlerts.length;
    } catch {
        return 0;
    }
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const [showDrawer, setShowDrawer] = useState(false);
    const [alertCount, setAlertCount] = useState(0);

    // Update alert count periodically
    useEffect(() => {
        setAlertCount(countAlerts());
        const interval = setInterval(() => {
            setAlertCount(countAlerts());
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Also update when drawer closes
    const handleCloseDrawer = () => {
        setShowDrawer(false);
        setAlertCount(countAlerts());
    };

    return (
        <>
            <GlobalAlarmNotification />
            <GlobalAlertDrawer isOpen={showDrawer} onClose={handleCloseDrawer} />

            {/* Global Alert Button */}
            <button
                className={styles.globalAlertBtn}
                onClick={() => setShowDrawer(true)}
                title="Voir toutes les alarmes"
            >
                🔔
                {alertCount > 0 && (
                    <span className={styles.alertBadge}>{alertCount}</span>
                )}
            </button>

            {children}
        </>
    );
}
