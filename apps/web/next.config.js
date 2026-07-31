/** @type {import('next').NextConfig} */

const apiServerUrl = process.env.API_URL?.replace(/\/$/, '');
const useProxy =
  Boolean(apiServerUrl) &&
  (process.env.VERCEL === '1' || process.env.USE_API_PROXY === 'true');

const publicApiUrl = useProxy
  ? '/backend'
  : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: publicApiUrl,
  },
  async rewrites() {
    if (!useProxy || !apiServerUrl) return [];
    return [
      {
        source: '/backend/:path*',
        destination: `${apiServerUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
