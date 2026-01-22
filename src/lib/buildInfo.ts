// Build metadata - auto-generated during build
export const BUILD_TIME = new Date().toISOString();
export const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || 'local';
export const BUILD_ENV = process.env.VERCEL_ENV || 'development';

// Log build info on import
if (typeof window !== 'undefined') {
  console.log('[WotNow Build Info]', {
    buildTime: BUILD_TIME,
    buildId: BUILD_ID.substring(0, 7),
    env: BUILD_ENV,
    timestamp: Date.now()
  });
}
