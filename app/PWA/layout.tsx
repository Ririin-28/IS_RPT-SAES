// app/PWA/layout.tsx
import type { Metadata } from 'next';
import NetworkStatusToast from "@/components/Common/NetworkStatusToast";
import PWAVersionControl from "@/components/PWA/PWAVersionControl";
import { pwaVersionLabel } from "@/lib/pwa-version";

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
      <NetworkStatusToast />
      <PWAVersionControl versionLabel={pwaVersionLabel} />
      {children}
    </div>
  );
}
