/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // enable strict mode
  typescript: {
    ignoreBuildErrors: false, // ❌ show all TS errors

  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
