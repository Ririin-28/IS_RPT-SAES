// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import PWAGuard from '@/components/PWAGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RPT-SAES',
  description: 'RPT Student Assessment and Evaluation System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RPT-SAES',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <Suspense fallback={null}>
          <PWAGuard>
            {children}
          </PWAGuard>
        </Suspense>
      </body>
    </html>
  );
}