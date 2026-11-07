import { describe, expect, it } from 'vitest';
import { parseContractValue } from '../../server/domain/money';

describe('Conservative Money Parser (T10)', () => {
  it('parses total monetary amounts accurately', () => {
    const res = parseContractValue('840,000,000 VND');
    expect(res.valueAmount).toBe(840000000);
    expect(res.currency).toBe('VND');
    expect(res.valueKind).toBe('total');
    expect(res.valueText).toBe('840,000,000 VND');
  });

  it('detects recurring and unit price amounts without converting them to total', () => {
    const recurring = parseContractValue('45,000,000 VND / Tháng');
    expect(recurring.valueKind).toBe('recurring');
    expect(recurring.valueAmount).toBe(45000000);

    const unitPrice = parseContractValue('5,000 đ / km');
    expect(unitPrice.valueKind).toBe('unit_price');
  });

  it('preserves ambiguous strings with unknown kind and null amount', () => {
    const ambiguous = parseContractValue('Thương thảo sau khi nghiệm thu');
    expect(ambiguous.valueKind).toBe('unknown');
    expect(ambiguous.valueAmount).toBeNull();
    expect(ambiguous.valueText).toBe('Thương thảo sau khi nghiệm thu');
  });
});

