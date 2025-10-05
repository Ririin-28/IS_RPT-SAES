declare module 'next-pwa' {
  import type { NextConfig } from 'next';
  interface PWAOptions {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    fallbacks?: {
      document?: string;
      image?: string;
      audio?: string;
      video?: string;
    };
    [key: string]: any; // allow future options without breaking build
  }
  type WithPWA = (config?: NextConfig) => NextConfig;
  export default function withPWA(options?: PWAOptions): WithPWA;
}
