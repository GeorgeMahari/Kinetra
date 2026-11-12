import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { TestCode } from '@/api/assessments';
import { ApiError } from '@/api/client';
import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorState } from '@/components/States';
import { TextField } from '@/components/TextField';
import { Timer } from '@/components/Timer';
import { FORMS, parseForm, type FieldError, type FormValues } from '@/features/assessments/forms';
import { useAssessmentsApi, useInvalidateAssessments } from '@/features/assessments/useAssessments';
import { useTheme } from '@/theme/ThemeProvider';

export default function RecordResult() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const testCode = code as TestCode;
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { api } = useAssessmentsApi();
  const invalidate = useInvalidateAssessments();
  const spec = FORMS[testCode];

  const [values, setValues] = useState<FormValues>({});
  const [stopped, setStopped] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (name: string, v: string | boolean) => setValues((prev) => ({ ...prev, [name]: v }));

  // Stopwatch tests: copy the elapsed time into the first empty seconds field.
  const onTimerStop = useCallback(
    (elapsed: number) => {
      if (!spec?.timer || spec.timer.mode !== 'stopwatch') return;
      setValues((prev) => {
        const target = spec.fields.find((f) => f.kind === 'int' && !prev[f.name]);
        return target ? { ...prev, [target.name]: String(Math.round(elapsed)) } : prev;
      });
    },
    [spec],
  );

  if (!spec) return <ErrorState error={new Error('unknown test')} />;

  const save = async () => {
    const parsed = parseForm(spec, values);
    setErrors(parsed.errors);
    setFormError(null);
    if (Object.keys(parsed.errors).length) return;
    setSaving(true);
    try {
      const result = await api.record(testCode, parsed.inputs, stopped);
      await invalidate();
      router.replace({ pathname: '/result/[id]', params: { id: result.id } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_error') {
        const fieldErrs: Record<string, FieldError> = {};
        for (const d of err.details) {
          const f = d.field?.replace(/^inputs\./, '');
          if (f) fieldErrs[f] = 'invalid';
        }
        setErrors(fieldErrs);
      }
      setFormError(errorMessage(t, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t(`assess.tests.${testCode}.name`) }} />
      <Screen
        header
        footer={<Button testID="save-result" label={t('assess.saveResult')} loading={saving} onPress={() => void save()} />}
      >
        <View style={{ gap: spacing.xl }}>
          {formError ? <Notice tone="error" message={formError} testID="record-error" /> : null}
          {spec.timer ? (
            <Timer
              mode={spec.timer.mode}
              seconds={spec.timer.mode === 'countdown' ? spec.timer.seconds : 0}
              capSeconds={spec.timer.mode === 'stopwatch' ? spec.timer.capSeconds : undefined}
              onStop={onTimerStop}
            />
          ) : null}
          {spec.fields.map((f) => {
            const label = t(`assess.fields.${f.name}` as 'assess.fields.reps');
            const err = errors[f.name] ? t(`assess.fields.${errors[f.name]}` as 'assess.fields.invalid') : undefined;
            if (f.kind === 'choice') {
              return (
                <View key={f.name} style={{ gap: spacing.sm }}>
                  <AppText variant="label">{label}</AppText>
                  <SegmentedControl<string>
                    accessibilityLabel={label}
                    value={typeof values[f.name] === 'string' ? (values[f.name] as string) : ''}
                    onChange={(v) => set(f.name, v)}
                    segments={f.options.map((o) => ({ value: o, label: t(`assess.fields.${o}` as 'assess.fields.run') }))}
                  />
                  {err ? (
                    <AppText variant="caption" color="danger">
                      {err}
                    </AppText>
                  ) : null}
                </View>
              );
            }
            if (f.kind === 'bool') {
              return (
                <Checkbox
                  key={f.name}
                  testID={`field-${f.name}`}
                  checked={values[f.name] === true}
                  onChange={(v) => set(f.name, v)}
                  label={label}
                />
              );
            }
            return (
              <TextField
                key={f.name}
                testID={`field-${f.name}`}
                label={label}
                value={typeof values[f.name] === 'string' ? (values[f.name] as string) : ''}
                onChangeText={(v) => set(f.name, v)}
                keyboardType={f.kind === 'decimal' ? 'numbers-and-punctuation' : 'number-pad'}
                inputMode={f.kind === 'decimal' ? 'decimal' : 'numeric'}
                error={err}
              />
            );
          })}
          <View style={{ gap: spacing.xs }}>
            <Checkbox testID="stopped-early" checked={stopped} onChange={setStopped} label={t('assess.stoppedEarly')} />
            <AppText variant="caption" color="textMuted">
              {t('assess.stoppedEarlyHint')}
            </AppText>
          </View>
        </View>
      </Screen>
    </>
  );
}
