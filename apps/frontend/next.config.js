/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@arbitrage/shared'],
    experimental: {
        serverComponentsExternalPackages: [],
    },
};

module.exports = nextConfig;
