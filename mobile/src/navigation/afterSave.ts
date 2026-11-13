import { router } from 'expo-router';

import type { TestCode } from '@/api/assessments';

/** After something is saved: drop the screens above the tabs and show Today. */
export function goHome(): void {
  router.dismissTo('/today');
}

/** After a result is saved: open the next test's instructions with Today underneath, so Back goes home. */
export function goToTest(code: TestCode): void {
  router.dismissTo('/today');
  router.push({ pathname: '/test/[code]', params: { code } });
}
