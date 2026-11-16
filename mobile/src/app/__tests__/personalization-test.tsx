/** Personalised catalogue, "why this test", the sport profile editor and module forms (personalization-1). */
import '@/i18n';

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { Battery, BatteryTest } from '@/api/personalization';
import { FORMS, parseForm } from '@/features/assessments/forms';
import { recommendationText } from '@/features/insights/present';
import { whyLines } from '@/features/personalization/why';
import i18n from '@/i18n';
import { createFakeBackend, providers } from '@/test-utils/fakeBackend';

import Assess from '../(app)/(tabs)/assess';
import SportProfileScreen from '../(app)/sport-profile';
import TestDetail from '../(app)/test/[code]';

const routes = {
  '(tabs)/today': () => <Text>Today stub</Text>,
  '(tabs)/assess': Assess,
  'test/[code]': TestDetail,
  'sport-profile': SportProfileScreen,
};

const AGILITY = {
  code: 'agility_505', version: '1', dimension: 'balance', intensity: 'submaximal',
  equipment: ['markers', 'video_app'], allowed: true, locked_reason: null,
};
const JUMP = {
  code: 'broad_jump', version: '1', dimension: 'strength', intensity: 'submaximal',
  equipment: ['tape_measure'], allowed: true, locked_reason: null,
};

function item(test_code: string, tier: BatteryTest['tier'], extra: Partial<BatteryTest> = {}): BatteryTest {
  return {
    test_code: test_code as BatteryTest['test_code'], tier, relevance: tier === 'priority' ? 9 : 0,
    capacities: ['agility'], evidence: 'validated_norms', retest_weeks: 8, status: 'not_done', allowed: true, why: [],
    ...extra,
  };
}

const TENNIS_BATTERY: Battery = {
  version: 'personalization-1',
  capacities: [
    { capacity: 'agility', dimension: 'balance', weight: 9, reasons: [{ source: 'sport', code: 'tennis', capacity: 'agility' }] },
  ],
  tests: [
    item('agility_505', 'priority', {
      capacities: ['agility', 'speed'], evidence: 'self_comparison', retest_weeks: 6,
      why: [{ source: 'sport', code: 'tennis', capacity: 'agility' }],
    }),
    item('pushups', 'core', { capacities: ['muscular_endurance'] }),
    item('resting_hr', 'core'),
    item('cooper_12min', 'core'),
    item('body_measurements', 'core'),
    item('broad_jump', 'inactive', { capacities: ['power'], evidence: 'self_comparison' }),
  ],
};

const PROFILE = {
  sports: [{ code: 'tennis', category: 'racket', sessions_per_week: 3, level: null }],
  goals: ['sport_performance'],
  goals_ranked: true,
  priorities: [],
};

beforeEach(() => i18n.changeLanguage('en'));

describe('personalised catalogue', () => {
  it('leads with the priority tests, says why, and hides tests the profile does not need', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.setBattery(TENNIS_BATTERY, [AGILITY, JUMP]);
    backend.setSportProfile(PROFILE);
    await renderRouter(routes, { initialUrl: '/assess', wrapper: providers(backend.request) });

    expect(await screen.findByTestId('assess-section-priority')).toHaveTextContent(/Priority for you/);
    expect(screen.getByTestId('test-agility_505-why')).toHaveTextContent('Tennis relies on agility.');
    expect(screen.getByTestId('test-agility_505-evidence')).toHaveTextContent('Your own trend');
    expect(screen.getByTestId('test-pushups-evidence')).toHaveTextContent('Compared with norms');
    expect(screen.queryByTestId('test-broad_jump')).toBeNull();
    // General tests carry no "why" line.
    expect(screen.queryByTestId('test-pushups-why')).toBeNull();
  });

  it('falls back to the plain catalogue when the battery is unavailable', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    await renderRouter(routes, { initialUrl: '/assess', wrapper: providers(backend.request) });
    expect(await screen.findByTestId('test-pushups')).toBeTruthy();
    expect(screen.queryByTestId('assess-section-priority')).toBeNull();
    expect(screen.queryByTestId('test-pushups-evidence')).toBeNull();
  });

  it('the test page explains why it is shown and how its result can be read', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.setBattery(TENNIS_BATTERY, [AGILITY, JUMP]);
    backend.setSportProfile(PROFILE);
    await renderRouter(routes, { initialUrl: '/test/agility_505', wrapper: providers(backend.request) });
    const why = await screen.findByTestId('test-why');
    expect(why).toHaveTextContent(/Tennis relies on agility\./);
    expect(why).toHaveTextContent(/Measures: agility, speed/);
    expect(why).toHaveTextContent(/Repeat every 6 weeks/);
    expect(screen.getByTestId('test-evidence')).toHaveTextContent('Your own trend');
  });
});

describe('sport profile editor', () => {
  it('saves sports, ordered goals and priorities', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.setSportProfile({ sports: [], goals: ['improve_endurance'], goals_ranked: true, priorities: [] });
    backend.setBattery(TENNIS_BATTERY);
    await renderRouter(routes, { initialUrl: '/sport-profile', wrapper: providers(backend.request) });

    expect(await screen.findByTestId('sp-goal-improve_endurance')).toHaveTextContent(/Main goal/);
    await fireEvent.press(screen.getByTestId('sp-goal-improve_endurance')); // remove
    await fireEvent.press(screen.getByTestId('sp-goal-build_muscle')); // now the main goal
    await fireEvent.press(screen.getByTestId('sp-goal-agility_coordination'));
    await fireEvent.press(screen.getByTestId('sp-sport-cycling'));
    await fireEvent.press(screen.getByTestId('sp-priority-speed'));
    await fireEvent.press(screen.getByTestId('sp-priority-speed'));
    await fireEvent.press(screen.getByTestId('sport-profile-save'));

    await waitFor(() => expect(screen.getByTestId('sport-profile-message')).toHaveTextContent(/Profile saved/));
    const put = backend.calls.find((c) => c.method === 'PUT' && c.path === '/personalization/profile');
    expect(put?.body).toEqual({
      sports: [{ code: 'cycling', sessions_per_week: 2, level: null }],
      goals: ['build_muscle', 'agility_coordination'],
      priorities: [{ capacity: 'speed', weight: 2 }],
    });
  });

  it('refuses to save without a goal', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.setSportProfile({ sports: [], goals: ['improve_endurance'], goals_ranked: true, priorities: [] });
    await renderRouter(routes, { initialUrl: '/sport-profile', wrapper: providers(backend.request) });
    await fireEvent.press(await screen.findByTestId('sp-goal-improve_endurance'));
    await fireEvent.press(screen.getByTestId('sport-profile-save'));
    expect(await screen.findByTestId('sport-profile-message')).toHaveTextContent('Choose at least one goal.');
    expect(backend.calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});

describe('goals saved before ranks existed', () => {
  it('shows no positions and asks for an order before saving', async () => {
    const backend = createFakeBackend({ status: 'completed' });
    backend.setSportProfile({ sports: [], goals: ['get_stronger', 'improve_mobility'], goals_ranked: false, priorities: [] });
    await renderRouter(routes, { initialUrl: '/sport-profile', wrapper: providers(backend.request) });
    expect(await screen.findByTestId('sp-goal-get_stronger')).not.toHaveTextContent(/Main goal|Goal 2/);
    await fireEvent.press(screen.getByTestId('sport-profile-save'));
    expect(await screen.findByTestId('sport-profile-message')).toHaveTextContent(/in order of importance/);
    expect(backend.calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});

describe('module forms', () => {
  it('ruler drop sends the five catches as one list', () => {
    const { inputs, errors } = parseForm(FORMS.ruler_drop, {
      drop_1: '18', drop_2: '22', drop_3: '20', drop_4: '61', drop_5: '20,5',
    });
    expect(errors).toEqual({});
    expect(inputs).toEqual({ drops_cm: [18, 22, 20, 61, 20.5] });
  });

  it('a missing catch is required, not filled in', () => {
    const { inputs, errors } = parseForm(FORMS.ruler_drop, { drop_1: '18', drop_2: '22', drop_3: '20', drop_4: '61' });
    expect(errors).toEqual({ drop_5: 'required' });
    expect(inputs).not.toHaveProperty('drops_cm');
  });

  it('the sprint offers no stopwatch timing', () => {
    const timing = FORMS.sprint_20m.fields.find((f) => f.name === 'timing');
    expect(timing && timing.kind === 'choice' ? timing.options : []).toEqual(['video_app', 'timing_gates']);
  });
});

describe('texts', () => {
  const t = i18n.t.bind(i18n);

  it('personal recommendations name their reason', () => {
    const text = recommendationText(t, {
      code: 'assess_test_agility_505', kind: 'assess', priority: 78, dimension: 'balance', test_code: 'agility_505',
      params: { capacity: 'agility', for: [{ source: 'sport', code: 'tennis' }] }, reasons: [], reference: null,
      general_guidance: true,
    });
    expect(text.title).toBe('Measure your agility');
    expect(text.body).toBe('A priority for Tennis: the 505 change of direction test.');
  });

  it('training advice names the goal it serves', () => {
    const text = recommendationText(t, {
      code: 'train_strength', kind: 'habit', priority: 74, dimension: 'strength', test_code: null,
      params: { capacity: 'max_strength', for: [{ source: 'goal', code: 'build_muscle' }] }, reasons: [],
      reference: null, general_guidance: true,
    });
    expect(text.body).toMatch(/for your goal “Build muscle”/);
  });

  it('why lines use "main goal" for the primary goal and explain locks', () => {
    const lines = whyLines(
      t,
      item('pushups', 'priority', {
        capacities: ['muscular_endurance'], allowed: false,
        why: [{ source: 'goal', code: 'build_muscle', capacity: 'muscular_endurance' }],
      }),
      'build_muscle',
    );
    expect(lines[0]).toBe('Your main goal “Build muscle” works on muscular endurance.');
    expect(lines.at(-1)).toMatch(/Not offered for now/);
  });

  it('every module test has its texts in every language', () => {
    const modules = ['broad_jump', 'vertical_jump', 'agility_505', 'sprint_20m', 'ruler_drop', 'back_scratch',
      'anterior_reach', 'single_leg_hop', 'circumferences', 'swim_12min'];
    for (const lng of ['en', 'ro', 'ru']) {
      for (const code of modules) {
        for (const part of ['name', 'purpose', 'safety', 'limitations']) {
          const key = `assess.tests.${code}.${part}`;
          expect(i18n.exists(key, { lng })).toBe(true);
        }
        const steps = i18n.t(`assess.tests.${code}.steps` as 'assess.tests.pushups.steps', { lng, returnObjects: true });
        expect(Array.isArray(steps) && steps.length >= 4).toBe(true);
        for (const f of FORMS[code as keyof typeof FORMS].fields) {
          expect(i18n.exists(`assess.fields.${f.name}`, { lng })).toBe(true);
        }
      }
    }
  });
});
