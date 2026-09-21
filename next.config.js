/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions / route handlers default to a small body limit.
  // Log bundles can be large, so we raise it for the upload route.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

module.exports = nextConfig;
