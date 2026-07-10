import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 상위 디렉터리의 lockfile로 인한 workspace root 추론 경고 방지
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "t1.kakaocdn.net",
      },
      {
        protocol: "https",
        hostname: "img1.kakaocdn.net",
      },
      {
        protocol: "http",
        hostname: "img1.kakaocdn.net",
      },
      {
        protocol: "https",
        hostname: "t1.kakaocdn.net",
      },
      {
        protocol: "https",
        hostname: "yfpvgxbmxgpjuzmpnbia.supabase.co",
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
