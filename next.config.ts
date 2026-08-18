/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Kiểm tra kiểu TypeScript thực sự khi build (dự án đã vượt qua `tsc --noEmit`).
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;