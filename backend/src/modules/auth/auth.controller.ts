import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../errors/AppError.js';
import type { LoginInput } from './auth.validation.js';

export class AuthController {
  login = async (req: Request, res: Response) => {
    const result = await authService.login(req.body as LoginInput);
    return sendSuccess(res, result);
  };

  me = async (req: Request, res: Response) => {
    if (!req.user?.sub) {
      throw AppError.unauthorized();
    }

    const user = await authService.me(req.user.sub);
    return sendSuccess(res, user);
  };
}

export const authController = new AuthController();
