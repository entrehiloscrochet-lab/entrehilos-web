import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Desactiva el optimizador en servidor (/_next/image) para no consumir
    // transformaciones, cache writes, Fast Origin Transfer ni CPU en Vercel Hobby.
    unoptimized: true,
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "ventify-xead3.firebasestorage.app",
      },
      {
        protocol: "https",
        hostname: "rydogoubjnytzfctfnxz.supabase.co",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/product/:slug*",
        destination: "/",
        permanent: false,
      },
      {
        source: "/admin/:seccion",
        destination: "/admin?seccion=:seccion",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/category/:slug*",
        destination: "/catalogo/:slug*",
      },
    ];
  },
};

export default nextConfig;