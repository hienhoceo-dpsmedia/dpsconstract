export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function validateIsoDeadline(isoString: string): boolean {
  if (!isoString) {
    throw new Error('Deadline cannot be empty');
  }

  // Must have Z or timezone offset (+HH:MM or -HH:MM)
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(isoString.trim());
  if (!hasTimezone) {
    throw new Error(`Deadline must contain explicit timezone offset (e.g. Z or +07:00). Received: "${isoString}"`);
  }

  const parsed = new Date(isoString);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date format: "${isoString}"`);
  }

  return true;
}

export function formatToVietnamTime(dateOrIso: Date | string): string {
  const date = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function parseVietnamDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  // Format YYYY-MM-DD
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return dateStr.trim();
  }
  return null;
}

