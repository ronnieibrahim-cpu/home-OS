import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e suite (playwright.config.ts) runs `next dev` bound to 127.0.0.1;
  // without this, Next.js blocks its HMR requests as cross-origin.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
