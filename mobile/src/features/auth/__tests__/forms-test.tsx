import '@/i18n';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import i18n from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { SignInForm } from '../SignInForm';
import { SignUpForm } from '../SignUpForm';

function withTheme(ui: React.ReactElement) {
  return <ThemeProvider scheme="light">{ui}</ThemeProvider>;
}

beforeEach(() => i18n.changeLanguage('en'));

describe('SignInForm', () => {
  it('validates before calling the server', async () => {
    const onSubmit = jest.fn();
    await render(withTheme(<SignInForm onSubmit={onSubmit} />));
    await fireEvent.press(screen.getByTestId('submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('This field is required.')).toHaveLength(2);
  });

  it('submits trimmed credentials', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(withTheme(<SignInForm onSubmit={onSubmit} />));
    await fireEvent.changeText(screen.getByTestId('email'), ' ana@example.com ');
    await fireEvent.changeText(screen.getByTestId('password'), 'blue tram over the river');
    await fireEvent.press(screen.getByTestId('submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('ana@example.com', 'blue tram over the river'));
  });

  it('shows a localized message for wrong credentials', async () => {
    await i18n.changeLanguage('ro');
    const onSubmit = jest.fn().mockRejectedValue(new ApiError('invalid_credentials', 'raw server text', 401));
    await render(withTheme(<SignInForm onSubmit={onSubmit} />));
    await fireEvent.changeText(screen.getByTestId('email'), 'ana@example.com');
    await fireEvent.changeText(screen.getByTestId('password'), 'wrong password');
    await fireEvent.press(screen.getByTestId('submit'));
    expect(await screen.findByText('Emailul sau parola sunt incorecte.')).toBeTruthy();
    expect(screen.queryByText('raw server text')).toBeNull();
  });
});

describe('SignUpForm', () => {
  async function fill(dob = { day: '15', month: '6', year: '1995' }) {
    await fireEvent.changeText(screen.getByTestId('email'), 'ana@example.com');
    await fireEvent.changeText(screen.getByTestId('password'), 'blue tram over the river');
    await fireEvent.changeText(screen.getByTestId('dob-day'), dob.day);
    await fireEvent.changeText(screen.getByTestId('dob-month'), dob.month);
    await fireEvent.changeText(screen.getByTestId('dob-year'), dob.year);
  }

  it('requires explicit privacy consent', async () => {
    const onSubmit = jest.fn();
    await render(withTheme(<SignUpForm onSubmit={onSubmit} />));
    await fill();
    await fireEvent.press(screen.getByTestId('submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Please confirm that you agree to continue.')).toBeTruthy();
  });

  it('blocks users under 16 on the client', async () => {
    const onSubmit = jest.fn();
    const year = String(new Date().getFullYear() - 10);
    await render(withTheme(<SignUpForm onSubmit={onSubmit} />));
    await fill({ day: '1', month: '1', year });
    await fireEvent.press(screen.getByTestId('consent'));
    await fireEvent.press(screen.getByTestId('submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('You must be at least 16 years old to create an account.')).toBeTruthy();
  });

  it('sends an ISO date, the current language and consent', async () => {
    await i18n.changeLanguage('ru');
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(withTheme(<SignUpForm onSubmit={onSubmit} />));
    await fill();
    await fireEvent.press(screen.getByTestId('consent'));
    await fireEvent.press(screen.getByTestId('submit'));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'ana@example.com',
        password: 'blue tram over the river',
        date_of_birth: '1995-06-15',
        preferred_locale: 'ru',
        privacy_consent: true,
      }),
    );
  });

  it('shows server-side field errors on the right field', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValue(new ApiError('weak_password', 'x', 422, [{ field: 'password', type: 'too_common' }]));
    await render(withTheme(<SignUpForm onSubmit={onSubmit} />));
    await fill();
    await fireEvent.press(screen.getByTestId('consent'));
    await fireEvent.press(screen.getByTestId('submit'));
    expect(await screen.findByText('This password is too common. Choose another.')).toBeTruthy();
    expect(screen.getByText('Choose a stronger password.')).toBeTruthy();
  });
});
