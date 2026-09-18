import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MOTION is a client-side data visualisation; export it as static assets so
  // it can be served by Vercel's neutral/static deployment preset.
  output: "export",
};

export default nextConfig;
