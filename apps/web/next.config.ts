import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@folyo/core', '@folyo/db'],
  poweredByHeader: false,
};
export default config;

// Share the edge's local R2 state so account deletion reaches both buckets.
if (process.env.NODE_ENV === 'development') {
  void initOpenNextCloudflareForDev({
    persist: { path: '../edge/.wrangler/state/v3' },
    remoteBindings: false,
  });
}
