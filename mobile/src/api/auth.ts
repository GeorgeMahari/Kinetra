import type { Language } from '@/i18n';

import { apiRequest } from './client';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export type SexForNorms = 'female' | 'male' | 'not_specified';

export interface Profile {
  display_name: string | null;
  date_of_birth: string | null;
  age: number | null;
  sex_for_norms: SexForNorms;
  height_cm: number | null;
}

export interface Me {
  id: string;
  email: string;
  email_verified: boolean;
  preferred_locale: Language;
  created_at: string;
  /** 'pending' = locked until a parent consents (ages 14-15). */
  parental_consent: 'not_required' | 'pending' | 'granted';
  profile: Profile;
}

export interface RegisterInput {
  email: string;
  password: string;
  date_of_birth: string; // YYYY-MM-DD
  preferred_locale: Language;
  privacy_consent: true;
  /** Required at ages 14-15 only. */
  parent_email?: string;
}

export interface ProfileUpdate {
  display_name?: string | null;
  sex_for_norms?: SexForNorms;
  height_cm?: number | null;
}

export const authApi = {
  register: (body: RegisterInput) => apiRequest<TokenPair>('/auth/register', { method: 'POST', body }),
  login: (email: string, password: string) =>
    apiRequest<TokenPair>('/auth/login', { method: 'POST', body: { email, password } }),
  refresh: (refreshToken: string) =>
    apiRequest<TokenPair>('/auth/refresh', { method: 'POST', body: { refresh_token: refreshToken } }),
  logout: (refreshToken: string) =>
    apiRequest<null>('/auth/logout', { method: 'POST', body: { refresh_token: refreshToken } }),
  /** Always succeeds (202) whether or not the email has an account. */
  forgotPassword: (email: string) => apiRequest<null>('/auth/password/forgot', { method: 'POST', body: { email } }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    apiRequest<null>('/auth/password/reset', {
      method: 'POST',
      body: { email, code, new_password: newPassword },
    }),
};
