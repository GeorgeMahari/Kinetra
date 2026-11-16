import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { authApi, type Me, type ProfileUpdate, type RegisterInput, type TokenPair } from '@/api/auth';
import { ApiError, apiRequest, type RequestOptions } from '@/api/client';
import i18n, { isSupportedLanguage, restoreDeviceLanguage, type Language } from '@/i18n';

import { tokenStorage, type TokenStorage } from './tokenStorage';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: Me | null;
  /** Set when the user was signed out because their session could not be renewed. */
  sessionExpired: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: RegisterInput): Promise<void>;
  signOut(): Promise<void>;
  /** Authenticated request: attaches the access token and renews it once on 401. */
  request<T>(path: string, options?: Omit<RequestOptions, 'token'>): Promise<T>;
  updateProfile(update: ProfileUpdate): Promise<Me>;
  setLanguage(language: Language): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  /** Reloads /me (e.g. after the email was verified). */
  refreshUser(): Promise<void>;
}

/** Exported so tests and previews can provide a fixed auth state. App code uses `useAuth`. */
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, storage = tokenStorage }: { children: ReactNode; storage?: TokenStorage }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const accessToken = useRef<string | null>(null);
  // Concurrent 401s share one refresh call: refresh tokens are single-use, so two parallel
  // refreshes with the same token would trigger the server's reuse detection.
  const refreshing = useRef<Promise<boolean> | null>(null);

  const applyUser = useCallback((me: Me) => {
    setUser(me);
    if (isSupportedLanguage(me.preferred_locale) && i18n.resolvedLanguage !== me.preferred_locale) {
      void i18n.changeLanguage(me.preferred_locale);
    }
  }, []);

  const storeTokens = useCallback(
    async (tokens: TokenPair) => {
      accessToken.current = tokens.access_token;
      await storage.set(tokens.refresh_token);
    },
    [storage],
  );

  const clearSession = useCallback(
    async (expired: boolean) => {
      accessToken.current = null;
      await storage.clear();
      setUser(null);
      setSessionExpired(expired);
      setStatus('signedOut');
    },
    [storage],
  );

  const renew = useCallback((): Promise<boolean> => {
    if (!refreshing.current) {
      refreshing.current = (async () => {
        const stored = await storage.get();
        if (!stored) return false;
        try {
          await storeTokens(await authApi.refresh(stored));
          return true;
        } catch (err) {
          // Only a definitive rejection ends the session; network trouble keeps the token for later.
          if (err instanceof ApiError && err.status === 401) await storage.clear();
          throw err;
        }
      })().finally(() => {
        refreshing.current = null;
      });
    }
    return refreshing.current;
  }, [storage, storeTokens]);

  const request = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T> => {
      const send = () => apiRequest<T>(path, { ...options, token: accessToken.current });
      try {
        return await send();
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 401) throw err;
        let renewed = false;
        try {
          renewed = await renew();
        } catch (refreshErr) {
          if (refreshErr instanceof ApiError && refreshErr.status === 401) await clearSession(true);
          throw refreshErr;
        }
        if (!renewed) {
          await clearSession(true);
          throw err;
        }
        return send();
      }
    },
    [renew, clearSession],
  );

  const loadUser = useCallback(async () => {
    applyUser(await request<Me>('/me'));
    setSessionExpired(false);
    setStatus('signedIn');
  }, [applyUser, request]);

  // Restore a session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Device language first, so the account's language (applied in loadUser) wins afterwards.
      await restoreDeviceLanguage();
      try {
        const ok = await renew();
        if (!ok) {
          if (!cancelled) setStatus('signedOut');
          return;
        }
        if (!cancelled) await loadUser();
      } catch {
        // Offline or token rejected: show the signed-out flow (the welcome screen reports server status).
        if (!cancelled) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [renew, loadUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionExpired,
      request,
      async signIn(email, password) {
        await storeTokens(await authApi.login(email, password));
        await loadUser();
      },
      async signUp(input) {
        await storeTokens(await authApi.register(input));
        await loadUser();
      },
      async signOut() {
        const stored = await storage.get();
        if (stored) {
          // Best effort: even if the server can't be reached, the device forgets the session.
          await authApi.logout(stored).catch(() => undefined);
        }
        await clearSession(false);
      },
      async updateProfile(update) {
        const me = await request<Me>('/me/profile', { method: 'PATCH', body: update });
        applyUser(me);
        return me;
      },
      async setLanguage(language) {
        await i18n.changeLanguage(language);
        const me = await request<Me>('/me', { method: 'PATCH', body: { preferred_locale: language } });
        applyUser(me);
      },
      async refreshUser() {
        applyUser(await request<Me>('/me'));
      },
      async deleteAccount(password) {
        await request<null>('/me/delete', { method: 'POST', body: { password } });
        await clearSession(false);
      },
    }),
    [status, user, sessionExpired, request, storeTokens, loadUser, storage, clearSession, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
