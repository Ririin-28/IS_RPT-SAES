// components/PWAGuard.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const REDIRECTABLE_STANDALONE_PATHS = new Set(["/", "/auth/login", "/auth/adminlogin"]);

const PWAGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPWA =
    typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone);
  const shouldRedirectToPwaHome = isPWA && REDIRECTABLE_STANDALONE_PATHS.has(pathname);

  useEffect(() => {
    if (shouldRedirectToPwaHome) {
      const query = searchParams?.toString();
      const target = query ? `/PWA?${query}` : "/PWA";
      router.replace(target);
    }
  }, [router, searchParams, shouldRedirectToPwaHome]);

  if (shouldRedirectToPwaHome) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
};

export default PWAGuard;
