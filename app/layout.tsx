import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "@fontsource/geist/400.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/700.css";
import "./globals.css";
import { Providers } from "./providers";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "RPT-SAES",
  description: "Remedial Performance Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RPT Quiz",
  },
};

export const viewport: Viewport = {
  themeColor: "#013300",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon512_rounded.png" />
      </head>
      <body className="antialiased font-[Geist]" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}


