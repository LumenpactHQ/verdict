/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@verdict/shared'],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      'https://verdictapi-production.up.railway.app',
  },
};

export default nextConfig;
