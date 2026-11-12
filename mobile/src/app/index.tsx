import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';

/**
 * "/" is the app's entry URL (cold start, deep link root, and where Stack.Protected falls back
 * when the current screen's guard flips at sign-in / sign-out). It is not guarded itself and
 * always forwards to a screen that exists for the current session state.
 */
export default function Index() {
  const { status } = useAuth();
  return <Redirect href={status === 'signedIn' ? '/today' : '/welcome'} />;
}
