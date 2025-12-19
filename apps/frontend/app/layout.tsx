import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClientLayout } from '@/components/ClientLayout';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Arbitrage v5 | Real-Time Crypto Arbitrage Dashboard',
    description: 'High-performance crypto arbitrage detection across multiple exchanges',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={inter.className}>
                <ClientLayout>
                    {children}
                </ClientLayout>
            </body>
        </html>
    );
}

