// components/PWAGuard.tsx
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const PWAGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPWA = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || 
     (window.navigator as any).standalone);

  useEffect(() => {
    if (isPWA && !pathname.startsWith('/PWA')) {
      const query = searchParams?.toString();
      const target = query ? `/PWA?${query}` : '/PWA';
      router.replace(target);
    }
  }, [isPWA, pathname, router, searchParams]);

  if (isPWA && !pathname.startsWith('/PWA')) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
};

export default PWAGuard;