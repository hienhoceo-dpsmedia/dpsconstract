import { describe, expect, it } from 'vitest';
import { validateIsoDeadline, formatToVietnamTime, parseVietnamDate } from '../../server/domain/dates';

describe('Date & Timezone Validation (T10)', () => {
  it('rejects ISO deadlines without timezone offset', () => {
    expect(() => validateIsoDeadline('2026-11-07T17:00:00')).toThrow(/timezone/i);
    expect(() => validateIsoDeadline('2026-11-07 17:00:00')).toThrow(/timezone/i);
  });

  it('accepts ISO deadlines with Z or +07:00 timezone offset', () => {
    expect(validateIsoDeadline('2026-11-07T17:00:00Z')).toBe(true);
    expect(validateIsoDeadline('2026-11-07T17:00:00+07:00')).toBe(true);
  });

  it('formats Vietnam time consistently without 7-hour timezone shift', () => {
    // 10:00:00 UTC = 17:00:00 Vietnam time (UTC+7)
    const formatted = formatToVietnamTime('2026-11-07T10:00:00Z');
    expect(formatted).toContain('17:00');
  });
});

