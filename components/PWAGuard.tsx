// components/PWAGuard.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const PWAGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const isPWA = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || 
     (window.navigator as any).standalone);

  useEffect(() => {
    if (isPWA && !pathname.startsWith('/PWA')) {
      router.replace('/PWA');
    }
  }, [isPWA, pathname, router]);

  if (isPWA && !pathname.startsWith('/PWA')) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
};

export default PWAGuard;