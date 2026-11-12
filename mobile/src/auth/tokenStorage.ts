/**
 * Persistent storage for the refresh token only. The short-lived access token lives in memory.
 *
 * - iOS / Android: expo-secure-store (Keychain / Android Keystore).
 * - Web (development preview only): sessionStorage, so a page reload keeps you signed in
 *   but closing the tab signs you out. Browsers have no equivalent of a hardware-backed
 *   keystore; a production web client would use an httpOnly cookie instead.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'kinetra.refresh_token';

export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

const webStorage: TokenStorage = {
  async get() {
    try {
      return globalThis.sessionStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  },
  async set(token) {
    try {
      globalThis.sessionStorage?.setItem(KEY, token);
    } catch {
      // Storage blocked (private mode): the session simply won't survive a reload.
    }
  },
  async clear() {
    try {
      globalThis.sessionStorage?.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

const nativeStorage: TokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};

export const tokenStorage: TokenStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
