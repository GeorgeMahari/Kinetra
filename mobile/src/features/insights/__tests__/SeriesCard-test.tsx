import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProfileMap } from '@/components/charts/ProfileMap';
import i18n from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { SeriesCard } from '../SeriesCard';

const themed = (ui: React.ReactElement) => <ThemeProvider scheme="dark">{ui}</ThemeProvider>;

beforeEach(() => i18n.changeLanguage('en'));

const SERIES = {
  protocol_key: 'hrr_step|1|recovery_mode=passive_seated',
  points: [
    { result_id: 'a', performed_at: '2026-09-01T10:00:00Z', value: 25 },
    { result_id: 'b', performed_at: '2026-10-01T10:00:00Z', value: 28 },
    { result_id: 'c', performed_at: '2026-11-01T10:00:00Z', value: 32 },
  ],
  change_vs_previous: 4,
  change_vs_first: 7,
};

describe('SeriesCard', () => {
  it('shows latest value, neutral changes and the protocol', async () => {
    await render(themed(<SeriesCard testID="s" title="Recovery after 60 s" unit="bpm" provenance="calculated" series={SERIES} />));
    expect(screen.getByTestId('s-latest')).toHaveTextContent('32 bpm');
    expect(screen.getByTestId('s-delta-prev')).toHaveTextContent('+4 vs previous');
    expect(screen.getByText('Recorded as: Seated, not moving')).toBeTruthy();
    expect(screen.getByTestId('provenance-calculated')).toBeTruthy();
  });

  it('every value is reachable without hover: tap a point or open the table', async () => {
    await render(themed(<SeriesCard testID="s" title="Recovery" unit="bpm" provenance="calculated" series={SERIES} />));
    // The chart lays out on first measure.
    await fireEvent(screen.getByTestId('line-chart'), 'layout', { nativeEvent: { layout: { width: 320, height: 160 } } });
    await fireEvent.press(screen.getByTestId('point-b'));
    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent(/28 bpm/);

    await fireEvent.press(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByTestId('s-table');
    expect(table).toHaveTextContent(/25 bpm/);
    expect(table).toHaveTextContent(/32 bpm/);
  });

  it('a first result says so instead of inventing a change', async () => {
    await render(
      themed(
        <SeriesCard testID="s" title="Push-ups" unit="reps" provenance="measured"
          series={{ ...SERIES, points: SERIES.points.slice(0, 1), change_vs_previous: null, change_vs_first: null }} />,
      ),
    );
    expect(screen.getByText('First result — repeat the test to see a change.')).toBeTruthy();
  });
});

describe('ProfileMap', () => {
  const items = [
    { key: 'cardio', label: 'Cardio', coverage: 'current', level: 0.66 },
    { key: 'body', label: 'Body', coverage: 'dated', level: 1 },
    { key: 'strength', label: 'Strength', coverage: 'current', level: null },
    { key: 'balance', label: 'Balance', coverage: 'unknown', level: null },
  ] as const;

  it('places a point only where a verified norm rates the dimension', async () => {
    await render(themed(<ProfileMap items={[...items]} />));
    expect(screen.getByTestId('profile-map-count')).toHaveTextContent('2 of 4 dimensions are rated against a norm');
    expect(screen.getByTestId('map-point-cardio')).toBeTruthy();
    expect(screen.getByTestId('map-point-body')).toBeTruthy();
    // Measured without a norm, and not assessed: both stay at the centre, drawn differently.
    expect(screen.queryByTestId('map-point-strength')).toBeNull();
    expect(screen.getByTestId('map-unrated-strength')).toBeTruthy();
    expect(screen.getByTestId('map-unassessed-balance')).toBeTruthy();
  });

  it('ends every dimension spoke in its trail blaze, so each spoke is named', async () => {
    await render(themed(<ProfileMap items={[...items]} />));
    expect(screen.getByTestId('map-badge-cardio')).toBeTruthy();
    expect(screen.getByTestId('map-badge-balance')).toBeTruthy();
  });
});
