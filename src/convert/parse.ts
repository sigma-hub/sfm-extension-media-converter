export function parsePositiveInteger(value: unknown) {
  const parsedValue = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function parsePositiveNumber(value: unknown) {
  const parsedValue = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function parseFractionalNumber(value: unknown) {
  if (!value || value === '0/0') {
    return null;
  }

  if (String(value).includes('/')) {
    const [numeratorValue, denominatorValue] = String(value).split('/');
    const numerator = parsePositiveNumber(numeratorValue);
    const denominator = parsePositiveNumber(denominatorValue);
    if (numerator !== null && denominator !== null) {
      return numerator / denominator;
    }
  }

  return parsePositiveNumber(value);
}

export function parseDurationSeconds(value: unknown) {
  const parsedValue = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function isValidTimeValue(value: string) {
  if (/^\d+(\.\d+)?$/.test(value.trim())) {
    return true;
  }
  return /^\d{1,2}:\d{2}(:\d{2})?(\.\d+)?$/.test(value.trim());
}
