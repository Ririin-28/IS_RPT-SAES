
import type { Metadata } from "next";
import "@fontsource/geist/400.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/700.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "RPT-SAES",
  description: "Remedial Performance Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased font-[Geist]">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}


