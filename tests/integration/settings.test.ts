import { describe, expect, it } from 'vitest';
import { getSettings, updateSettings } from '../../server/modules/settings/service';
import { AppError } from '../../server/http/errors';

describe('Versioned Settings Service (T10)', () => {
  it('retrieves global default settings with version', async () => {
    const s = await getSettings();
    expect(s.id).toBe('global_default');
    expect(s.version).toBeGreaterThanOrEqual(1);
    expect(typeof s.defaultBasePayLegal).toBe('number');
    expect(s.defaultBasePayLegal).toBeGreaterThanOrEqual(0);
  });

  it('updates settings and increments version atomically', async () => {
    const initial = await getSettings();
    const updated = await updateSettings(
      {
        ...initial,
        defaultBasePayLegal: 550000,
      },
      initial.version,
      { id: 'admin_test', email: 'admin@dps.media', name: 'Admin Test' }
    );

    expect(updated.version).toBe(initial.version + 1);
    expect(updated.defaultBasePayLegal).toBe(550000);
  });

  it('rejects stale version update with 409 conflict', async () => {
    const current = await getSettings();
    const staleVersion = current.version - 1;

    await expect(
      updateSettings(
        { ...current, defaultBasePayLegal: 600000 },
        staleVersion,
        { id: 'admin_test', email: 'admin@dps.media', name: 'Admin Test' }
      )
    ).rejects.toThrowError(AppError);
  });
});
