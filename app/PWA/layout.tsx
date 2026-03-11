// app/PWA/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PWALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden overflow-y-auto bg-white">
      {children}
    </div>
  );
}
