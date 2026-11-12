import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RegisterInput } from '@/api/auth';
import { ApiError } from '@/api/client';
import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { DateOfBirthField } from '@/components/DateOfBirthField';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { isSupportedLanguage } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

import {
  fieldErrorsFromApi,
  toIsoDate,
  validateDateOfBirth,
  validateEmail,
  validateNewPassword,
  type DateParts,
  type FieldErrors,
} from './validation';

const FIELDS = ['email', 'password', 'date_of_birth', 'privacy_consent'] as const;
type Field = (typeof FIELDS)[number];

export function SignUpForm({ onSubmit }: { onSubmit: (input: RegisterInput) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState<DateParts>({ day: '', month: '', year: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const next: FieldErrors<Field> = {
      email: validateEmail(email),
      password: validateNewPassword(password, email),
      date_of_birth: validateDateOfBirth(dob),
      privacy_consent: consent ? undefined : { key: 'consentRequired' },
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;

    const lang = i18n.resolvedLanguage;
    setSubmitting(true);
    try {
      await onSubmit({
        email: email.trim(),
        password,
        date_of_birth: toIsoDate(dob)!,
        preferred_locale: isSupportedLanguage(lang) ? lang : 'en',
        privacy_consent: true,
      });
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? fieldErrorsFromApi(err, FIELDS) : {};
      setErrors(fieldErrors);
      // Field-specific problems are shown on the fields; the banner explains the rest.
      setFormError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  };

  const msg = (f: Field) => (errors[f] ? t(`validation.${errors[f].key}`, errors[f].values ?? {}) : undefined);

  return (
    <View style={{ gap: spacing.lg }}>
      {formError ? <Notice tone="error" message={formError} testID="form-error" /> : null}
      <TextField
        testID="email"
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        error={msg('email')}
      />
      <TextField
        testID="password"
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t('auth.passwordHint')}
        error={msg('password')}
      />
      <DateOfBirthField
        label={t('auth.dateOfBirth')}
        hint={t('auth.dateOfBirthHint')}
        value={dob}
        onChange={setDob}
        error={msg('date_of_birth')}
      />
      <AppText variant="caption" color="textMuted">
        {t('auth.privacyNotice')}
      </AppText>
      <Checkbox
        testID="consent"
        checked={consent}
        onChange={setConsent}
        label={t('auth.consent')}
        error={msg('privacy_consent')}
      />
      <Button testID="submit" label={t('auth.signUp')} loading={submitting} onPress={() => void submit()} />
    </View>
  );
}
