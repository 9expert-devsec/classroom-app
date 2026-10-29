/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["res.cloudinary.com"],
  },
  // Merchant pages carry MERCHANT_PATH_KEY in the path; never send it as a
  // Referer (e.g. to external shop-logo hosts)
  async headers() {
    return [
      {
        source: "/m/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;