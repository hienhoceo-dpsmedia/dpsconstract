import { getSettingsRecord, updateSettingsRecord } from './repository.js';
import { validateSettingsData, type ValidatedSettings } from './validation.js';
import { AppError } from '../../http/errors.js';

export async function getSettings() {
  const record = await getSettingsRecord();
  // Strip secret from returned settings
  return {
    ...record,
    // Hide teams webhook URL for non-admin callers if needed
  };
}

export async function updateSettings(
  input: unknown,
  expectedVersion: number,
  actor: { id: string; name?: string; email: string }
) {
  const validation = validateSettingsData(input);
  if (!validation.success) {
    const details = validation.error.issues.reduce<Record<string, unknown>>((acc, issue) => {
      acc[issue.path.join('.')] = issue.message;
      return acc;
    }, {});
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu cấu hình không hợp lệ.', details);
  }

  try {
    return await updateSettingsRecord(validation.data, expectedVersion, actor);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'STALE_SETTINGS_VERSION') {
      const msg = err instanceof Error ? err.message : 'Cấu hình đã bị thay đổi bởi người khác. Vui lòng tải lại.';
      throw new AppError(409, 'STALE_SETTINGS_VERSION', msg);
    }
    throw err;
  }
}
