import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@folyo/core', '@folyo/db'],
  poweredByHeader: false
};
export default config;
