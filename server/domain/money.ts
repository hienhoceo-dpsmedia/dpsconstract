export interface ParsedMoney {
  valueText: string;
  valueAmount: number | null;
  currency: string;
  valueKind: 'total' | 'recurring' | 'unit_price' | 'unknown';
}

export function parseContractValue(input: string): ParsedMoney {
  const text = (input || '').trim();
  if (!text) {
    return {
      valueText: '',
      valueAmount: null,
      currency: 'VND',
      valueKind: 'unknown',
    };
  }

  // Detect recurring indicators (/ tháng, / năm, / quý, hàng tháng)
  const isRecurring = /\/\s*(tháng|năm|quý|tuần|month|year|day|ngày)/i.test(text) ||
    /hàng\s*(tháng|năm|quý)/i.test(text);

  // Detect unit price indicators (/ km, / giờ, / người, / m2, / đơn vị, per)
  const isUnitPrice = /\/\s*(km|giờ|người|m2|m²|đơn vị|cái|chiếc|trang|word|hour)/i.test(text);

  // Extract currency
  let currency = 'VND';
  if (/USD|\$/i.test(text)) currency = 'USD';
  else if (/EUR|€/i.test(text)) currency = 'EUR';
  else if (/JPY|¥/i.test(text)) currency = 'JPY';

  // Extract numeric digits with dot or comma thousands separators
  const match = text.match(/([0-9]{1,3}(?:[.,][0-9]{3})*(?:\.[0-9]+)?|[0-9]+)/);
  if (!match) {
    return {
      valueText: text,
      valueAmount: null,
      currency,
      valueKind: 'unknown',
    };
  }

  // Normalize string: remove dots/commas as thousand separators
  let numStr = match[1];
  if (numStr.includes(',') && numStr.includes('.')) {
    // e.g. 1,000.50
    numStr = numStr.replace(/,/g, '');
  } else if (numStr.includes('.') && !numStr.includes(',')) {
    // Could be Vietnamese 1.000.000 or decimal 10.5
    const parts = numStr.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      numStr = numStr.replace(/\./g, '');
    }
  } else if (numStr.includes(',') && !numStr.includes('.')) {
    // Could be Vietnamese 1,000,000
    const parts = numStr.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      numStr = numStr.replace(/,/g, '');
    } else {
      numStr = numStr.replace(/,/g, '.');
    }
  }

  const amount = parseFloat(numStr);
  if (isNaN(amount) || !isFinite(amount)) {
    return {
      valueText: text,
      valueAmount: null,
      currency,
      valueKind: 'unknown',
    };
  }

  let valueKind: 'total' | 'recurring' | 'unit_price' | 'unknown' = 'total';
  if (isRecurring) {
    valueKind = 'recurring';
  } else if (isUnitPrice) {
    valueKind = 'unit_price';
  }

  return {
    valueText: text,
    valueAmount: amount,
    currency,
    valueKind,
  };
}

