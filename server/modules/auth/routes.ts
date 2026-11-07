import { Router } from 'express';
import { z } from 'zod';
import { loginUser, getCurrentUser, logoutUser } from './service.js';
import { generateCsrfToken, verifyCsrfToken } from '../../http/csrf.js';
import { requireAuth, requireRole } from './middleware.js';
import {
  inviteUserRecord,
  acceptUserInvite,
  updateUserRole,
  disableUser,
  listAllUsers,
  findUserByEmail,
} from './repository.js';
import { createAuthToken, consumeAuthToken } from './tokens.js';
import { hashPassword } from './passwords.js';
import { AppError } from '../../http/errors.js';
import { loadConfig } from '../../config.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const inviteSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  role: z.enum(['admin', 'legal', 'clerk']),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Mã token là bắt buộc'),
  password: z.string().min(12, 'Mật khẩu phải từ 12 ký tự trở lên'),
  name: z.string().optional(),
});

// GET /api/auth/csrf
authRouter.get('/csrf', (req, res) => {
  const csrfToken = generateCsrfToken(req);
  res.json({ csrfToken });
});

// POST /api/auth/login
authRouter.post('/login', verifyCsrfToken, async (req, res, next) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      throw new AppError(400, 'INVALID_INPUT', 'Vui lòng cung cấp email và mật khẩu hợp lệ.');
    }

    const result = await loginUser(parse.data.email, parse.data.password, req);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
authRouter.get('/me', async (req, res, next) => {
  try {
    const result = await getCurrentUser(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', verifyCsrfToken, async (req, res, next) => {
  try {
    await logoutUser(req);
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users (Authenticated users)
authRouter.get('/users', requireAuth, async (req, res, next) => {
  try {
    const usersList = await listAllUsers();
    res.json(usersList);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/invite (Admin-only)
authRouter.post('/invite', requireAuth, requireRole(['admin']), verifyCsrfToken, async (req, res, next) => {
  try {
    const parse = inviteSchema.safeParse(req.body);
    if (!parse.success) {
      throw new AppError(400, 'INVALID_INPUT', 'Thông tin mời người dùng không hợp lệ.');
    }

    const user = await inviteUserRecord({
      email: parse.data.email,
      role: parse.data.role,
      actorId: req.user?.id,
    });

    // Generate 48-hour invite token
    const tokenInfo = await createAuthToken(user.id, 'invite', 48 * 3600 * 1000);
    const config = loadConfig();
    const inviteLink = `${config.PUBLIC_APP_URL}/accept-invite?token=${tokenInfo.rawToken}`;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      inviteLink,
      rawToken: tokenInfo.rawToken,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/invite/:email (Admin-only)
authRouter.delete('/invite/:email', requireAuth, requireRole(['admin']), verifyCsrfToken, async (req, res, next) => {
  try {
    const user = await findUserByEmail(req.params.email);
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng với email này.');
    }
    await disableUser(user.id, req.user!.id);
    res.json({ success: true, message: 'Đã hủy quyền người dùng.' });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'LAST_ADMIN_PROTECTED') {
      return next(new AppError(409, 'LAST_ADMIN_PROTECTED', (err as unknown as Error).message));
    }
    next(err);
  }
});

// POST /api/auth/accept-invite (Public with valid token)
authRouter.post('/accept-invite', async (req, res, next) => {
  try {
    const parse = acceptInviteSchema.safeParse(req.body);
    if (!parse.success) {
      throw new AppError(400, 'INVALID_INPUT', parse.error.issues[0]?.message || 'Dữ liệu không hợp lệ.');
    }

    const tokenRecord = await consumeAuthToken(parse.data.token, 'invite');
    if (!tokenRecord) {
      throw new AppError(400, 'INVALID_TOKEN', 'Mã liên kết mời không tồn tại hoặc đã hết hạn.');
    }

    const passwordHash = await hashPassword(parse.data.password);
    const user = await acceptUserInvite({
      userId: tokenRecord.userId,
      passwordHash,
      name: parse.data.name,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/users/:id/role (Admin-only)
authRouter.patch('/users/:id/role', requireAuth, requireRole(['admin']), verifyCsrfToken, async (req, res, next) => {
  try {
    const newRole = req.body.role;
    if (!['admin', 'legal', 'clerk'].includes(newRole)) {
      throw new AppError(400, 'INVALID_ROLE', 'Vai trò mới không hợp lệ.');
    }

    const user = await updateUserRole(req.params.id, newRole, req.user!.id);
    res.json({ success: true, user });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'LAST_ADMIN_PROTECTED') {
      return next(new AppError(409, 'LAST_ADMIN_PROTECTED', (err as unknown as Error).message));
    }
    next(err);
  }
});

// PATCH /api/auth/users/:id/disable (Admin-only)
authRouter.patch('/users/:id/disable', requireAuth, requireRole(['admin']), verifyCsrfToken, async (req, res, next) => {
  try {
    const user = await disableUser(req.params.id, req.user!.id);
    res.json({ success: true, user });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'LAST_ADMIN_PROTECTED') {
      return next(new AppError(409, 'LAST_ADMIN_PROTECTED', (err as unknown as Error).message));
    }
    next(err);
  }
});
