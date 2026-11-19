import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nodemailer must run in Node.js, not be bundled for the edge.
  serverExternalPackages: ["nodemailer"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
};

export default nextConfig;
