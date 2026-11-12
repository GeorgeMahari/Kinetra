import type { Profile } from '@/api/auth';

export type CompletionItem = 'name' | 'height' | 'sex';

/** Basic-profile details the user can still add. Date of birth is always present (required at sign-up). */
export function missingProfileItems(profile: Profile): CompletionItem[] {
  const missing: CompletionItem[] = [];
  if (!profile.display_name) missing.push('name');
  if (profile.height_cm == null) missing.push('height');
  if (profile.sex_for_norms === 'not_specified') missing.push('sex');
  return missing;
}

export const COMPLETION_TOTAL = 3;
