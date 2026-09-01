import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {
    extensionAlias: { ".js": [".ts", ".tsx", ".js", ".jsx"], ".mjs": [".mts", ".mjs"] },
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
};
export default nextConfig;
