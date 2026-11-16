import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Static configuration lives in app.json. This file only adds a guard for builds made on EAS.
 *
 * EXPO_PUBLIC_API_URL is bundled into the app at build time. A preview or production build
 * that silently fell back to http://localhost:8000 would install fine and then fail on every
 * phone, so such a build stops here instead. The URL comes from the EAS environment that the
 * build profile selects (eas.json "environment"), never from a file in the repository.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (process.env.EAS_BUILD === 'true' && profile && profile !== 'development') {
    const url = process.env.EXPO_PUBLIC_API_URL ?? '';
    if (!/^https:\/\/[^/\s]+/.test(url) || /localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\./.test(url)) {
      throw new Error(
        `EAS build "${profile}" needs EXPO_PUBLIC_API_URL set to the public HTTPS API ` +
          `(see docs/PRIVATE_DISTRIBUTION_GUIDE.md). Got: "${url || '(unset)'}"`,
      );
    }
  }
  return config as ExpoConfig;
};
