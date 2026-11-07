import { Router } from 'express';
import { getSettings, updateSettings } from './service.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { getSettingsRecord } from './repository.js';

export const settingsRouter = Router();

// GET /api/settings - Retrieve global settings
settingsRouter.get('/', async (req, res, next) => {
  try {
    const data = await getSettings();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings or PUT /api/settings - Update global settings
const handleUpdateSettings = async (req: any, res: any, next: any) => {
  try {
    const current = await getSettingsRecord();
    const expectedVersion = req.body.version ?? current.version;
    const actor = {
      id: req.user?.id || 'admin_user',
      name: req.user?.name || 'Administrator',
      email: req.user?.email || 'admin@dps.media',
    };

    const updated = await updateSettings(req.body, expectedVersion, actor);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

settingsRouter.post('/', requireRole(['admin']), handleUpdateSettings);
settingsRouter.put('/', requireRole(['admin']), handleUpdateSettings);

// POST /api/settings/toggle-vtp - Toggle ViettelPost mock connection status
settingsRouter.post('/toggle-vtp', requireRole(['admin']), async (req: any, res, next) => {
  try {
    const current = await getSettingsRecord();
    const nextStatus = current.vtpConnectionStatus === 'connected' ? 'disconnected' : 'connected';
    const actor = {
      id: req.user?.id || 'admin_user',
      name: req.user?.name || 'Administrator',
      email: req.user?.email || 'admin@dps.media',
    };

    const updated = await updateSettings(
      { ...current, vtpConnectionStatus: nextStatus },
      current.version,
      actor
    );

    res.json({
      success: true,
      vtpConnectionStatus: updated.vtpConnectionStatus,
    });
  } catch (err) {
    next(err);
  }
});
