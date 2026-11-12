import '@/i18n';

import { render, screen } from '@testing-library/react-native';

import type { TestResult } from '@/api/assessments';
import i18n from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { formatNumber, ResultView } from '../ResultView';

const COOPER: TestResult = {
  id: 'c1',
  test_code: 'cooper_12min',
  test_version: '1',
  dimension: 'cardio',
  protocol_key: 'cooper_12min|1|mode=run',
  performed_at: '2026-11-12T12:00:00Z',
  status: 'completed',
  inputs: { distance_m: 2500, mode: 'run' },
  indicators: [
    { code: 'distance_12min', value: 2500, unit: 'm', provenance: 'measured', interpretation: null, notes: ['mode_run'], reference_ids: [] },
    {
      code: 'vo2max_estimated',
      value: 44.6,
      unit: 'mL/kg/min',
      provenance: 'estimated',
      interpretation: { reference_id: 'friend_2015_treadmill', scheme: 'percentile_band', label: 'p50_75', detail: { age_group: '30-39', sex: 'male' } },
      notes: ['estimate_not_measurement'],
      reference_ids: ['cooper_1968', 'friend_2015_treadmill'],
    },
  ],
  headline: 'vo2max_estimated',
  engine_version: 'engine-1',
  references: [{ id: 'friend_2015_treadmill', citation: 'Kaminsky LA et al. 2015', url: 'https://example.org', note: '' }],
};

const themed = (ui: React.ReactElement) => <ThemeProvider scheme="light">{ui}</ThemeProvider>;

beforeEach(() => i18n.changeLanguage('en'));

describe('ResultView', () => {
  it('labels provenance and explains the comparison with its source', async () => {
    await render(themed(<ResultView result={COOPER} />));
    expect(screen.getByTestId('value-vo2max_estimated')).toHaveTextContent('44.6 mL/kg/min');
    expect(screen.getByTestId('provenance-estimated')).toHaveTextContent('Estimated');
    expect(screen.getByTestId('provenance-measured')).toBeTruthy();
    expect(screen.getByTestId('interpretation-vo2max_estimated')).toHaveTextContent(
      'Compared with men aged 30-39 in the FRIEND reference: between the 50th and 75th percentiles.',
    );
    expect(screen.getByText('Kaminsky LA et al. 2015')).toBeTruthy();
    expect(screen.queryByTestId('no-comparison')).toBeNull();
  });

  it('shows a missing value as unknown, never as zero', async () => {
    const stopped: TestResult = {
      ...COOPER,
      status: 'stopped_early',
      indicators: [{ ...COOPER.indicators[1]!, value: null, interpretation: null, notes: ['not_estimated_stopped_early'] }],
      references: [],
    };
    await render(themed(<ResultView result={stopped} />));
    expect(screen.getByTestId('value-vo2max_estimated')).toHaveTextContent('—');
    expect(screen.getByText('Not estimated: the estimate needs a full 12 minutes.')).toBeTruthy();
    expect(screen.getByText('Incomplete (stopped early)')).toBeTruthy();
    expect(screen.getByTestId('no-comparison')).toBeTruthy();
  });

  it('formats numbers for the language', () => {
    expect(formatNumber(44.6, 'ro', 'mL/kg/min')).toBe('44,6');
    expect(formatNumber(0.46, 'en', 'ratio')).toBe('0.46');
  });
});
