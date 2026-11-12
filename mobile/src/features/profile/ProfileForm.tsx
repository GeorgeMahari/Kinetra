import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Profile, ProfileUpdate, SexForNorms } from '@/api/auth';
import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { parseHeight, type FieldError } from '@/features/auth/validation';
import { useTheme } from '@/theme/ThemeProvider';

export function ProfileForm({
  profile,
  onSubmit,
}: {
  profile: Profile;
  onSubmit: (update: ProfileUpdate) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
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
      <View style={{ gap: spacing.sm }}>
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
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">{t('profile.dateOfBirth')}</AppText>
        <AppText color="textMuted">{profile.date_of_birth ?? t('common.notSet')}</AppText>
      </View>
      <Button testID="save-profile" label={t('common.save')} loading={saving} onPress={() => void submit()} />
    </View>
  );
}
