import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.18.112.1'],
  async redirects() {
    return [
      { source: "/Parent/welcome", destination: "/Parent/home", permanent: false },
      { source: "/Super_Admin", destination: "/IT_Admin", permanent: false },
      { source: "/Super_Admin/:path*", destination: "/IT_Admin/:path*", permanent: false },
      { source: "/super-admin", destination: "/IT_Admin", permanent: false },
      { source: "/super-admin/:path*", destination: "/IT_Admin/:path*", permanent: false },
      { source: "/it-admin", destination: "/IT_Admin", permanent: false },
      { source: "/it-admin/:path*", destination: "/IT_Admin/:path*", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/it-admin/:path*", destination: "/api/it_admin/:path*" },
      { source: "/api/super-admin/:path*", destination: "/api/super_admin/:path*" },
    ];
  },
};

export default nextConfig;
