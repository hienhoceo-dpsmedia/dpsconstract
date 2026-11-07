import type { Request } from 'express';
import { findUserByEmail, findUserById } from './repository.js';
import { verifyPassword } from './passwords.js';
import { checkAndIncrementRateLimit, resetRateLimit } from './rate-limit.js';
import { AppError } from '../../http/errors.js';
import { generateCsrfToken } from '../../http/csrf.js';
import type { SafeUser } from '../../../src/shared/contracts.js';

export async function loginUser(
  email: string,
  plainPassword: string,
  req: Request
): Promise<{ user: SafeUser; csrfToken: string }> {
  const ip = req.ip || req.socket.remoteAddress || 'unknown_ip';
  const rateLimitKey = `login_fail:${ip}:${email.trim().toLowerCase()}`;

  // 1. Check rate limit
  const limit = await checkAndIncrementRateLimit(rateLimitKey, 5, 900);
  if (!limit.allowed) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      `Tài khoản bị tạm khóa do nhập sai quá 5 lần. Vui lòng thử lại sau ${limit.retryAfterSeconds} giây.`
    );
  }

  // 2. Query user
  const user = await findUserByEmail(email);
  if (!user || user.status !== 'active' || !user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
  }

  // 3. Verify password
  const isValid = await verifyPassword(plainPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
  }

  // 4. Reset rate limit on success
  await resetRateLimit(rateLimitKey);

  // 5. Regenerate session to prevent session fixation
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const now = Date.now();
  req.session.userId = user.id;
  req.session.authVersion = user.authVersion;
  req.session.loginAt = now;
  req.session.lastActivity = now;

  const csrfToken = generateCsrfToken(req);

  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role as 'admin' | 'legal' | 'clerk',
    status: user.status as 'active',
  };

  return { user: safeUser, csrfToken };
}

export async function getCurrentUser(req: Request): Promise<{ user: SafeUser; csrfToken: string }> {
  if (!req.session?.userId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Phiên làm việc đã hết hạn hoặc chưa đăng nhập.');
  }

  const user = await findUserById(req.session.userId);
  if (!user || user.status !== 'active' || user.authVersion !== req.session.authVersion) {
    req.session.destroy(() => {});
    throw new AppError(401, 'SESSION_REVOKED', 'Phiên làm việc đã bị thu hồi hoặc tài khoản bị vô hiệu hoá.');
  }

  // Update last activity
  req.session.lastActivity = Date.now();
  const csrfToken = generateCsrfToken(req);

  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role as 'admin' | 'legal' | 'clerk',
    status: user.status as 'active',
  };

  return { user: safeUser, csrfToken };
}

export async function logoutUser(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

