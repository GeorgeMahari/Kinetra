import { FORMS, parseForm } from '../forms';

describe('parseForm', () => {
  it('converts valid values, accepting a decimal comma', () => {
    expect(parseForm(FORMS.body_measurements, { weight_kg: '72,5', waist_cm: '81' })).toEqual({
      inputs: { weight_kg: 72.5, waist_cm: 81 },
      errors: {},
    });
  });

  it('leaves optional empty fields out instead of inventing a value', () => {
    const r = parseForm(FORMS.body_measurements, { weight_kg: '70' });
    expect(r.inputs).toEqual({ weight_kg: 70 });
    expect('waist_cm' in r.inputs).toBe(false);
  });

  it('flags required, out-of-range and malformed values', () => {
    const r = parseForm(FORMS.hrr_step, { hr_end: '300', hr_60: '12.5' });
    expect(r.errors).toEqual({ recovery_mode: 'required', hr_end: 'invalid', hr_60: 'invalid' });
  });

  it('rejects too many decimals and non-numbers', () => {
    expect(parseForm(FORMS.sit_reach, { reach_cm: '3.25' }).errors).toEqual({ reach_cm: 'invalid' });
    expect(parseForm(FORMS.plank, { seconds: 'abc' }).errors).toEqual({ seconds: 'invalid' });
  });

  it('accepts negative reach and zero repetitions as real results', () => {
    expect(parseForm(FORMS.sit_reach, { reach_cm: '-6.5' }).inputs).toEqual({ reach_cm: -6.5 });
    expect(parseForm(FORMS.pushups, { variant: 'knees', reps: '0' }).inputs).toEqual({ variant: 'knees', reps: 0 });
  });

  it('mirrors the pulling test limits: a 0-rep baseline is valid, the variant is required', () => {
    expect(parseForm(FORMS.pulls, { variant: 'inverted_row', reps: '0' }).inputs).toEqual({
      variant: 'inverted_row',
      reps: 0,
    });
    expect(parseForm(FORMS.pulls, { reps: '101' }).errors).toEqual({ variant: 'required', reps: 'invalid' });
  });

  it('defaults booleans to false', () => {
    expect(parseForm(FORMS.chair_stand_30s, { reps: '12' }).inputs).toEqual({ reps: 12, used_arms: false });
  });
});
