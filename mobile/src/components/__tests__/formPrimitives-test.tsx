import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import { TrailRail } from '@/features/onboarding/TrailRail';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { OptionCard } from '../Choice';
import { TextField } from '../TextField';

const themed = (ui: React.ReactElement) => <ThemeProvider scheme="light">{ui}</ThemeProvider>;

beforeEach(() => i18n.changeLanguage('en'));

describe('TextField', () => {
  it('lets a secure field be revealed and hidden again', async () => {
    await render(themed(<TextField testID="pw" label="Password" secureTextEntry value="secret" onChangeText={jest.fn()} />));
    expect(screen.getByTestId('pw')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByTestId('pw')).toHaveProp('secureTextEntry', false);
    await fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByTestId('pw')).toHaveProp('secureTextEntry', true);
  });

  it('has no toggle on an ordinary field, and shows the error text', async () => {
    await render(themed(<TextField testID="email" label="Email" value="" onChangeText={jest.fn()} error="Enter an email." />));
    expect(screen.queryByLabelText('Show password')).toBeNull();
    expect(screen.getByText('Enter an email.')).toBeTruthy();
  });
});

describe('OptionCard', () => {
  it('reports selection to screen readers and calls back on press', async () => {
    const onPress = jest.fn();
    await render(themed(<OptionCard testID="opt" title="Get stronger" multi selected onPress={onPress} />));
    expect(screen.getByTestId('opt')).toHaveProp('accessibilityState', { checked: true });
    await fireEvent.press(screen.getByTestId('opt'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('TrailRail', () => {
  it('exposes the step as a progress value', async () => {
    await render(themed(<TrailRail current={2} total={5} />));
    const rail = screen.getByTestId('onboarding-rail');
    expect(rail).toHaveProp('accessibilityValue', { min: 0, max: 5, now: 2 });
    expect(rail).toHaveProp('accessibilityLabel', 'Trail of the questionnaire: step 2 of 5');
  });
});
