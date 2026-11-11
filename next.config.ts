import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Lets phones/tablets on the same Wi-Fi load the dev server by IP (dev only; ignored in production).
  allowedDevOrigins: ["192.168.31.142", "192.168.0.5", "192.168.0.2"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
