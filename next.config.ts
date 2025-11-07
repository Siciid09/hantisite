/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // enable React strict mode
  typescript: {
    // ✅ ignore TypeScript errors during build
    ignoreBuildErrors: true
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
