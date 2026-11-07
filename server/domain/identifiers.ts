export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizeContractNumber(contractNumber: string): string {
  if (!contractNumber) return '';
  // Unicode NFC normalization, trimmed
  return contractNumber.trim().normalize('NFC');
}

