"use client";

import { useEffect, useState, type ReactNode } from "react";

type HydrationBoundaryProps = {
  children: ReactNode;
};

export default function HydrationBoundary({ children }: HydrationBoundaryProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return null;
  }

  return <>{children}</>;
}
