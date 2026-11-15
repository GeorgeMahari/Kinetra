import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Profile, ProfileUpdate, SexForNorms } from '@/api/auth';
import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { FadeInItem } from '@/components/motion';
import { Notice } from '@/components/Notice';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { parseHeight, type FieldError } from '@/features/auth/validation';
import { useTheme } from '@/theme/ThemeProvider';
import { iconSize } from '@/theme/tokens';

export function ProfileForm({
  profile,
  onSubmit,
}: {
  profile: Profile;
  onSubmit: (update: ProfileUpdate) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
  const [name, setName] = useState(profile.display_name ?? '');
  const [height, setHeight] = useState(profile.height_cm != null ? String(profile.height_cm) : '');
  const [sex, setSex] = useState<SexForNorms>(profile.sex_for_norms);
  const [errors, setErrors] = useState<{ name?: FieldError; height?: FieldError }>({});
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = parseHeight(height);
    const next = {
      name: name.trim().length > 80 ? ({ key: 'nameTooLong' } as const) : undefined,
      height: parsed.error,
    };
    setErrors(next);
    setStatus(null);
    if (next.name || next.height) return;
    setSaving(true);
    try {
      await onSubmit({ display_name: name.trim() || null, height_cm: parsed.value, sex_for_norms: sex });
      setStatus({ tone: 'success', message: t('profile.saved') });
    } catch (err) {
      setStatus({ tone: 'error', message: errorMessage(t, err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: spacing.xl }}>
      {status ? <Notice tone={status.tone} message={status.message} testID="profile-status" /> : null}
      <FadeInItem index={0}>
        <FormSection title={tr('redesignProfile.edit.identityTitle')}>
          <TextField
            testID="display-name"
            label={t('profile.displayName')}
            hint={t('profile.displayNameHint')}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={80}
            error={errors.name ? t(`validation.${errors.name.key}`) : undefined}
          />
        </FormSection>
      </FadeInItem>
      <FadeInItem index={1}>
        <FormSection title={tr('redesignProfile.edit.bodyTitle')}>
          <TextField
            testID="height"
            label={t('profile.height')}
            hint={t('profile.heightHint')}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={5}
            error={errors.height ? t(`validation.${errors.height.key}`) : undefined}
          />
        </FormSection>
      </FadeInItem>
      <FadeInItem index={2}>
        <FormSection title={tr('redesignProfile.edit.normsTitle')}>
          <AppText variant="label">{t('profile.sexForNorms')}</AppText>
          <SegmentedControl<SexForNorms>
            accessibilityLabel={t('profile.sexForNorms')}
            value={sex}
            onChange={setSex}
            segments={[
              { value: 'female', label: t('profile.female') },
              { value: 'male', label: t('profile.male') },
              { value: 'not_specified', label: t('profile.notSpecified') },
            ]}
          />
          <AppText variant="caption" color="textMuted">
            {t('profile.sexForNormsHint')}
          </AppText>
        </FormSection>
      </FadeInItem>
      <FadeInItem index={3}>
        <View
          accessible
          accessibilityLabel={`${t('profile.dateOfBirth')}: ${profile.date_of_birth ?? t('common.notSet')}. ${tr('redesignProfile.edit.dobLocked')}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceSunken,
          }}
        >
          <Icon name="shield" size={iconSize.md} color={colors.textMuted} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label">{t('profile.dateOfBirth')}</AppText>
            <AppText variant="caption" color="textMuted">
              {tr('redesignProfile.edit.dobLocked')}
            </AppText>
          </View>
          <AppText style={{ fontVariant: ['tabular-nums'] }}>{profile.date_of_birth ?? t('common.notSet')}</AppText>
        </View>
      </FadeInItem>
      <Button testID="save-profile" label={t('common.save')} loading={saving} onPress={() => void submit()} />
    </View>
  );
}

/** A titled group of fields on one surface. */
function FormSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors, spacing, radius, elevation } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="micro" color="textMuted" style={{ textTransform: 'uppercase', marginLeft: spacing.xs }} accessibilityRole="header">
        {title}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
          ...elevation.card,
        }}
      >
        {children}
      </View>
    </View>
  );
}
