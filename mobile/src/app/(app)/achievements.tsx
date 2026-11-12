import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { AchievementsList } from '@/features/progression/ProgressionCards';
import { useProgression } from '@/features/progression/useProgression';

export default function Achievements() {
  useTranslation();
  const p = useProgression();
  if (p.isPending) return <LoadingState />;
  if (p.isError) return <ErrorState error={p.error} onRetry={() => void p.refetch()} />;
  return (
    <Screen header>
      <AchievementsList p={p.data} />
    </Screen>
  );
}
