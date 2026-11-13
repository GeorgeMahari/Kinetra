import { ApiError } from '@/api/client';

import {
  ageOn,
  fieldErrorsFromApi,
  parseHeight,
  toIsoDate,
  needsParentEmail,
  validateDateOfBirth,
  validateParentEmail,
  validateEmail,
  validateNewPassword,
} from '../validation';

const TODAY = new Date(2026, 10, 12); // 12 Nov 2026 (local time)

describe('validateEmail', () => {
  it.each([
    ['', 'required'],
    ['ana', 'invalidEmail'],
    ['ana@example', 'invalidEmail'],
    ['ana @example.com', 'invalidEmail'],
  ])('%p -> %s', (input, key) => {
    expect(validateEmail(input)?.key).toBe(key);
  });

  it('accepts a normal address with surrounding spaces', () => {
    expect(validateEmail('  ana.pop@example.ro ')).toBeUndefined();
  });
});

describe('validateNewPassword (mirrors the server policy)', () => {
  it.each([
    ['', 'required'],
    ['short', 'passwordTooShort'],
    ['x'.repeat(129), 'passwordTooLong'],
    ['abababababab', 'passwordTooRepetitive'],
    ['maria.popescu-2026', 'passwordContainsEmail'],
  ])('%p -> %s', (pw, key) => {
    expect(validateNewPassword(pw, 'maria.popescu@example.com')?.key).toBe(key);
  });

  it('accepts a passphrase', () => {
    expect(validateNewPassword('blue tram over the river', 'ana@example.com')).toBeUndefined();
  });
});

describe('dates', () => {
  it('builds ISO dates only for real calendar days', () => {
    expect(toIsoDate({ day: '5', month: '3', year: '1990' })).toBe('1990-03-05');
    expect(toIsoDate({ day: '29', month: '2', year: '2024' })).toBe('2024-02-29');
    expect(toIsoDate({ day: '29', month: '2', year: '2025' })).toBeNull();
    expect(toIsoDate({ day: '31', month: '4', year: '2000' })).toBeNull();
    expect(toIsoDate({ day: '1', month: '1', year: '1850' })).toBeNull();
    expect(toIsoDate({ day: 'a', month: '1', year: '2000' })).toBeNull();
  });

  it('computes completed years', () => {
    expect(ageOn('2010-11-12', TODAY)).toBe(16);
    expect(ageOn('2010-11-13', TODAY)).toBe(15);
  });

  it('validates date of birth', () => {
    expect(validateDateOfBirth({ day: '', month: '', year: '' }, TODAY)?.key).toBe('required');
    expect(validateDateOfBirth({ day: '31', month: '2', year: '2000' }, TODAY)?.key).toBe('invalidDate');
    expect(validateDateOfBirth({ day: '1', month: '1', year: '2027' }, TODAY)?.key).toBe('futureDate');
    // The absolute minimum is 14 (from 14 to 15 a parent must agree).
    expect(validateDateOfBirth({ day: '13', month: '11', year: '2012' }, TODAY)).toEqual({
      key: 'underage',
      values: { age: 14 },
    });
    expect(validateDateOfBirth({ day: '12', month: '11', year: '2012' }, TODAY)).toBeUndefined();
  });

  it('asks for a parent email only at 14 and 15, and never accepts the user’s own', () => {
    expect(needsParentEmail({ day: '12', month: '11', year: '2012' }, TODAY)).toBe(true); // 14
    expect(needsParentEmail({ day: '13', month: '11', year: '2010' }, TODAY)).toBe(true); // 15
    expect(needsParentEmail({ day: '12', month: '11', year: '2010' }, TODAY)).toBe(false); // 16
    expect(needsParentEmail({ day: '13', month: '11', year: '2012' }, TODAY)).toBe(false); // 13: refused anyway
    expect(validateParentEmail('Teen@Example.com ', 'teen@example.com')?.key).toBe('parentEmailSame');
    expect(validateParentEmail('', 'teen@example.com')?.key).toBe('required');
    expect(validateParentEmail('parent@example.com', 'teen@example.com')).toBeUndefined();
  });
});

describe('parseHeight', () => {
  it.each([
    ['', null, undefined],
    ['172', 172, undefined],
    ['172,5', 172.5, undefined],
    ['172.55', null, 'heightRange'],
    ['20', null, 'heightRange'],
    ['300', null, 'heightRange'],
    ['abc', null, 'heightRange'],
  ])('%p', (input, value, errorKey) => {
    const r = parseHeight(input);
    expect(r.value).toBe(value);
    expect(r.error?.key).toBe(errorKey);
  });
});

describe('fieldErrorsFromApi', () => {
  it('maps server field errors onto form fields', () => {
    const err = new ApiError('weak_password', 'x', 422, [
      { field: 'password', type: 'too_common' },
      { field: 'unrelated', type: 'too_short' },
    ]);
    expect(fieldErrorsFromApi(err, ['email', 'password'] as const)).toEqual({
      password: { key: 'passwordTooCommon' },
    });
  });
});
