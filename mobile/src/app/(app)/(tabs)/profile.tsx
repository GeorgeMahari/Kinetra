import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Divider, ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LANGUAGE_NAMES, type Language } from '@/i18n';
import type { ThemePreference } from '@/theme/preferences';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileTab() {
  const { t, i18n } = useTranslation();
  const { spacing, preference, setPreference } = useTheme();
  const { user } = useAuth();
  if (!user) return null;
  const p = user.profile;

  const sexLabel =
    p.sex_for_norms === 'female'
      ? t('profile.female')
      : p.sex_for_norms === 'male'
        ? t('profile.male')
        : t('profile.notSpecified');

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <AppText variant="title">{t('profileTab.title')}</AppText>

        <Card>
          <AppText variant="heading">{t('profileTab.details')}</AppText>
          <ListRow title={t('profile.displayName')} detail={p.display_name ?? t('common.notSet')} />
          <Divider />
          <ListRow title={t('home.age')} detail={p.age != null ? String(p.age) : t('common.notSet')} />
          <Divider />
          <ListRow title={t('home.height')} detail={p.height_cm != null ? String(p.height_cm) : t('common.notSet')} />
          <Divider />
          <ListRow title={t('home.sexForNorms')} detail={sexLabel} />
          <Button
            testID="edit-details"
            variant="secondary"
            label={t('profileTab.editDetails')}
            onPress={() => router.push('/edit-profile')}
          />
        </Card>

        <Card>
          <AppText variant="heading">{t('profileTab.preferences')}</AppText>
          <AppText variant="label">{t('profileTab.appearance')}</AppText>
          <SegmentedControl<ThemePreference>
            accessibilityLabel={t('profileTab.appearance')}
            value={preference}
            onChange={setPreference}
            segments={[
              { value: 'system', label: t('profileTab.appearanceSystem') },
              { value: 'light', label: t('profileTab.appearanceLight') },
              { value: 'dark', label: t('profileTab.appearanceDark') },
            ]}
          />
          <AppText variant="caption" color="textMuted">
            {t('profileTab.appearanceHint')}
          </AppText>
          <Divider />
          <ListRow
            testID="open-settings"
            icon="shield"
            title={t('profileTab.accountAndData')}
            subtitle={t('profileTab.accountAndDataHint')}
            detail={LANGUAGE_NAMES[(i18n.resolvedLanguage as Language) ?? 'en']}
            onPress={() => router.push('/settings')}
          />
          {__DEV__ ? (
            <>
              <Divider />
              <ListRow
                icon="info"
                title={t('dev.galleryTitle')}
                subtitle={t('dev.galleryHint')}
                onPress={() => router.push('/dev-gallery')}
              />
            </>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
