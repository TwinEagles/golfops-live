import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/user-guide/download": ["./private/manuals/**/*"],
  },
};

export default nextConfig;
