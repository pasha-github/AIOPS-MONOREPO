/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ⬇️ This is the important part
  output: 'export',
  trailingSlash: true,

  // If you use <Image> from 'next/image', add this too:
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
