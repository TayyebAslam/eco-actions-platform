import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  images: {
    // Security: Whitelist specific image domains instead of allowing all
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "localhost",
      },
      // Production/staging domains
      {
        protocol: "https",
        hostname: "*.thrive.com",
      },
      {
        protocol: "https",
        hostname: "*.thrive.virtuenetz.pk",
      },
      {
        protocol: "http",
        hostname: "*.thrive.virtuenetz.pk",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/thrive-*/**", // If using GCS
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
        pathname: "/thrive-*/**", // If using S3
      },
      // Gravatar for user avatars
      {
        protocol: "https",
        hostname: "gravatar.com",
      },
      {
        protocol: "https",
        hostname: "*.gravatar.com",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Security: Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com", // Next.js requires these; gstatic for Firebase SW
              "style-src 'self' 'unsafe-inline'", // Tailwind/UI libraries need inline styles
              "img-src 'self' data: https: http: http://localhost:* https://localhost:* blob:",
              "font-src 'self' data:",
              "connect-src 'self' ws: wss: http://localhost:* https://localhost:* https://fcm.googleapis.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Proxy API requests through frontend domain so cookies work correctly
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/user/:path*",
        destination: `${backendUrl}/user/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
      {
        source: "/activities/:path*",
        destination: `${backendUrl}/activities/:path*`,
      },
      // WARNING: This rewrite could clash with Next.js page routes under /articles.
      // If you add a /articles page route, requests will be rewritten to the backend
      // instead of serving the page. Use a distinct prefix (e.g., /api/articles) to avoid conflicts.
      {
        source: "/articles/:path*",
        destination: `${backendUrl}/articles/:path*`,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
