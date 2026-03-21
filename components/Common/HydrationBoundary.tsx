"use client";

import { useEffect, useState, type ReactNode } from "react";

type HydrationBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export default function HydrationBoundary({ children, fallback = null }: HydrationBoundaryProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
