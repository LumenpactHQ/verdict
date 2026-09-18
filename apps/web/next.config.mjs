/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@verdict/shared'],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      'http://localhost:4000',
  },
};

export default nextConfig;
