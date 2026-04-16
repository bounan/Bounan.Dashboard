/* global process */
const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "export",
  basePath: isProd ? basePath : "",
  assetPrefix: isProd ? `${basePath}/` : "",
};

export default nextConfig;
