import { readinessKey } from '../SummaryViews';

const r = (intensity_ceiling: 'maximal' | 'submaximal' | 'non_exertional', reasons: string[] = []) =>
  ({ result: 'clear', intensity_ceiling, reasons, answered_at: '2026-11-13T10:00:00Z' }) as Parameters<
    typeof readinessKey
  >[0];

describe('readinessKey', () => {
  it('explains the under-18 cap separately from "build up first"', () => {
    expect(readinessKey(r('submaximal', ['under_18']))).toBe('submaximal_minor');
    expect(readinessKey(r('submaximal', ['build_up_first']))).toBe('submaximal_build');
    expect(readinessKey(r('submaximal', ['musculoskeletal']))).toBe('submaximal');
    expect(readinessKey(r('maximal'))).toBe('maximal');
    expect(readinessKey(r('non_exertional', ['chest_pain']))).toBe('non_exertional');
  });
});
