import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from './service.js';
import { AppError } from '../../http/errors.js';
import type { Role, SafeUser } from '../../../src/shared/contracts.js';
import type { UserActor } from '../../domain/types.js';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      actor?: UserActor;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user } = await getCurrentUser(req);
    req.user = user;
    req.actor = {
      kind: 'user',
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Chưa đăng nhập.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Vai trò "${req.user.role}" không có quyền thực hiện hành động này.`
        )
      );
    }

    next();
  };
}

