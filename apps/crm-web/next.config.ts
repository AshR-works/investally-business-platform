import type { NextConfig } from 'next';

const config: NextConfig = {
  // Même origine côté navigateur : pas de CORS, l'API reste sur 127.0.0.1.
  async rewrites() {
    const api = process.env.CRM_API_URL ?? 'http://127.0.0.1:3001';
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
  poweredByHeader: false,
};

export default config;
