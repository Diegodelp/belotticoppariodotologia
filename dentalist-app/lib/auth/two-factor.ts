const TWO_FACTOR_DIGITS = 6;

export function generateTwoFactorCode(): string {
  const min = 10 ** (TWO_FACTOR_DIGITS - 1);
  const max = 10 ** TWO_FACTOR_DIGITS - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

