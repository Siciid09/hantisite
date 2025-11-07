/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // ❌ Do NOT ignore TypeScript errors
    ignoreBuildErrors: false,
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


/*       
 nj
 /** @type {import('next').NextConfig} */
//const nextConfig = {
  //reactStrictMode: true,
  //typescript: {
    // ✅ completely ignore TypeScript errors during build
    //ignoreBuildErrors: true,
  //},
  //images: {
    //remotePatterns: [
      //{
        //protocol: 'https',
        //hostname: 'firebasestorage.googleapis.com',
        //port: '',
        //pathname: '**',
      //},
    //],
  //},
//};

//module.exports = nextConfig;


