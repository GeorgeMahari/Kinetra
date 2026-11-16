import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField, type TextInputHandle } from '@/components/TextField';
import { useTheme } from '@/design-system/ThemeProvider';

import { validateEmail, type FieldErrors } from './validation';

type Field = 'email' | 'password';

export function SignInForm({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<void> }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const passwordRef = useRef<TextInputHandle>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const next: FieldErrors<Field> = {
      email: validateEmail(email),
      password: password ? undefined : { key: 'required' },
    };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;
    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (err) {
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
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={msg('email')}
      />
      <TextField
        ref={passwordRef}
        testID="password"
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={msg('password')}
      />
      <Button testID="submit" label={t('auth.signIn')} loading={submitting} onPress={() => void submit()} />
    </View>
  );
}
