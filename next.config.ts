
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // This allows the Next.js dev server to accept requests from any origin.
    // This is needed for the cloud-based development environment.
    allowedDevOrigins: ['*'],
  },
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN: 'pk.eyJ1Ijoid2pzaGV3aXR0IiwiYSI6ImNtZjczNGR4ajBkZjMybHM2MDFhazV0OTIifQ.EQrYlQl16I2Z9VKJHAArKw',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
