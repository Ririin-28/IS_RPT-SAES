// app/PWA/layout.tsx
import type { Metadata } from 'next';
import PWARegister from "@/components/PWA/PWARegister";

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
    <div className="h-screen w-full overflow-hidden bg-white">
      <PWARegister />
      {children}
    </div>
  );
}
