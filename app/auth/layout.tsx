import type { Metadata } from 'next';
import HydrationBoundary from "@/components/Common/HydrationBoundary";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HydrationBoundary>{children}</HydrationBoundary>;
}
