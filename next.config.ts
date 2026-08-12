/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bỏ qua lỗi TypeScript khi build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Bỏ qua cảnh báo ESLint khi build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;