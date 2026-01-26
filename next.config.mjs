/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["res.cloudinary.com"],
  },
};

console.log("NEXT CONFIG DEBUG", {
  output: nextConfig.output,
  NEXT_OUTPUT: process.env.NEXT_OUTPUT,
  OUTPUT: process.env.OUTPUT,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

export default nextConfig;