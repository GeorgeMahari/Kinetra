import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/Button';
import { ListGroup, ListRow } from '@/components/ListRow';
import { FadeInItem } from '@/design-system/motion';
import { Screen } from '@/components/Screen';
import { CompletionTrail } from '@/features/profile/CompletionTrail';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { useProgression } from '@/features/progression/useProgression';
import { LANGUAGE_NAMES, type Language } from '@/i18n';
import { useTheme } from '@/design-system/ThemeProvider';

export default function ProfileTab() {
  const { t, i18n } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { spacing, preference } = useTheme();
  const { user } = useAuth();
  const progression = useProgression();
  if (!user) return null;
  const p = user.profile;

  const sexLabel =
    p.sex_for_norms === 'female'
      ? t('profile.female')
      : p.sex_for_norms === 'male'
        ? t('profile.male')
        : t('profile.notSpecified');
  const appearance =
    preference === 'light'
      ? t('profileTab.appearanceLight')
      : preference === 'dark'
        ? t('profileTab.appearanceDark')
        : t('profileTab.appearanceSystem');
  const earned = progression.data?.achievements.filter((a) => a.earned_at).length ?? 0;
  const total = progression.data?.achievements.length ?? 0;

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <AppText variant="title">{t('profileTab.title')}</AppText>

        <ProfileHeader user={user} progression={progression.data} />

        <FadeInItem index={1}>
          <CompletionTrail profile={p} />
        </FadeInItem>

        <FadeInItem index={2}>
          <ListGroup title={t('profileTab.details')}>
            <ListRow title={t('profile.displayName')} detail={p.display_name ?? t('common.notSet')} />
            <ListRow title={t('home.age')} detail={p.age != null ? String(p.age) : t('common.notSet')} />
            <ListRow title={t('home.height')} detail={p.height_cm != null ? `${p.height_cm} cm` : t('common.notSet')} />
            <ListRow title={t('home.sexForNorms')} detail={sexLabel} />
          </ListGroup>
          <View style={{ marginTop: spacing.md }}>
            <Button
              testID="edit-details"
              variant="secondary"
              label={t('profileTab.editDetails')}
              onPress={() => router.push('/edit-profile')}
            />
          </View>
        </FadeInItem>

        <FadeInItem index={3}>
          <ListGroup title={tr('redesignProfile.groups.explore')}>
            <ListRow
              testID="open-sport-profile"
              icon="trail"
              title={t('personal.profile.entry')}
              subtitle={t('personal.profile.entryCaption')}
              onPress={() => router.push('/sport-profile')}
            />
            <ListRow
              testID="open-body"
              icon="body"
              title={t('body.entry')}
              subtitle={t('body.entryCaption')}
              onPress={() => router.push('/body')}
            />
            <ListRow
              testID="open-achievements"
              icon="flame"
              title={tr('redesignProfile.rows.achievements')}
              subtitle={total ? tr('redesignProfile.rows.achievementsCaption', { earned, total }) : undefined}
              onPress={() => router.push('/achievements')}
            />
          </ListGroup>
        </FadeInItem>

        <FadeInItem index={4}>
          <ListGroup title={tr('redesignProfile.groups.app')} footer={t('profileTab.appearanceHint')}>
            <ListRow
              testID="open-settings"
              icon="shield"
              title={t('profileTab.accountAndData')}
              subtitle={t('profileTab.accountAndDataHint')}
              detail={LANGUAGE_NAMES[(i18n.resolvedLanguage as Language) ?? 'en']}
              onPress={() => router.push('/settings')}
            />
            <ListRow
              testID="open-appearance"
              icon={preference === 'dark' ? 'moon' : 'sun'}
              title={tr('redesignProfile.rows.appearance')}
              detail={appearance}
              onPress={() => router.push('/settings')}
            />
            <ListRow
              testID="open-connected-data"
              icon="device"
              title={t('devices.title')}
              subtitle={t('devices.rowHint')}
              onPress={() => router.push('/connected-data')}
            />
          </ListGroup>
        </FadeInItem>
      </View>
    </Screen>
  );
}
