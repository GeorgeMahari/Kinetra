import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Me } from '@/api/auth';
import { resetOnboardingAutoOpen } from '@/features/onboarding/OnboardingCard';
import i18n from '@/i18n';
import { ApiError } from '@/api/client';
import { createFakeBackend, providers, TEST_USER } from '@/test-utils/fakeBackend';

import EditProfile from '../(app)/edit-profile';
import Onboarding from '../(app)/onboarding';
import TabsLayout from '../(app)/(tabs)/_layout';
import ProfileTab from '../(app)/(tabs)/profile';
import Today from '../(app)/(tabs)/today';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/today': Today,
  '(tabs)/profile': ProfileTab,
  'edit-profile': EditProfile,
  onboarding: Onboarding,
};

beforeEach(() => {
  resetOnboardingAutoOpen();
  return i18n.changeLanguage('en');
});

async function open(user: Me = TEST_USER, backend = createFakeBackend({ status: 'in_progress', step: 1 })) {
  await renderRouter(routes, { initialUrl: '/today', wrapper: providers(backend.request, user) });
  return backend;
}

describe('signed-in navigation', () => {
  it('opens on Today with all eight dimensions shown as not assessed', async () => {
    await open();
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hello, Ana');
    expect(screen.getAllByText('Not assessed')).toHaveLength(8);
    expect(screen.queryByText(/\d+\s*\/\s*100/)).toBeNull();
  });

  it('offers to continue an unfinished onboarding', async () => {
    await open();
    expect(await screen.findByText('Continue setting up')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-open'));
    expect(screen).toHavePathname('/onboarding');
  });

  it('opens the questionnaire automatically for a new user, once', async () => {
    await open(TEST_USER, createFakeBackend());
    // Redirects as soon as the onboarding status has loaded.
    await waitFor(() => expect(screen).toHavePathname('/onboarding'));
    expect(await screen.findByText('Let’s get to know you')).toBeTruthy();
  });

  it('shows the focus from a completed onboarding', async () => {
    await open(TEST_USER, createFakeBackend({ status: 'completed', completed_at: '2026-11-12T12:00:00Z' }));
    expect(await screen.findByTestId('onboarding-focus')).toBeTruthy();
    expect(screen.getByTestId('priority-strength')).toHaveTextContent(/Your goal: Get stronger/);
    // Only dimensions with a reason are listed, at most three.
    expect(screen.queryByTestId('priority-cardio')).toBeNull();
    expect(screen.getByText(/Maximal-effort tests can be suggested/)).toBeTruthy();
  });

  it('shows the profile-completion card only while details are missing', async () => {
    await open();
    expect(screen.getByText('Complete your profile')).toBeTruthy();
  });

  it('switches to the Profile tab and opens the editor', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('tab-profile'));
    expect(await screen.findByText('Personal details')).toBeTruthy();
    expect(screen).toHavePathname('/profile');
    await fireEvent.press(screen.getByTestId('edit-details'));
    expect(screen).toHavePathname('/edit-profile');
  });

  it('saving the profile returns to Today', async () => {
    const updateProfile = jest.fn().mockResolvedValue(TEST_USER);
    const backend = createFakeBackend({ status: 'in_progress', step: 1 });
    await renderRouter(routes, { initialUrl: '/edit-profile', wrapper: providers(backend.request, TEST_USER, { updateProfile }) });
    await fireEvent.changeText(await screen.findByTestId('display-name'), 'Ana Maria');
    await fireEvent.press(screen.getByTestId('save-profile'));
    await waitFor(() => expect(screen).toHavePathname('/today'));
    expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Ana Maria' }));
  });

  it('a failed profile save stays on the form and explains why', async () => {
    const updateProfile = jest.fn().mockRejectedValue(new ApiError('network_error', 'offline', 0));
    const backend = createFakeBackend({ status: 'in_progress', step: 1 });
    await renderRouter(routes, { initialUrl: '/edit-profile', wrapper: providers(backend.request, TEST_USER, { updateProfile }) });
    await fireEvent.press(await screen.findByTestId('save-profile'));
    expect(await screen.findByTestId('profile-status')).toBeTruthy();
    expect(screen).toHavePathname('/edit-profile');
  });
});
