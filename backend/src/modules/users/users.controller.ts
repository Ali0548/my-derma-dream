import type { Request, Response } from 'express';
import { usersService } from './users.service.js';
import { sendSuccess } from '../../utils/response.js';

export class UsersController {
  list = async (_req: Request, res: Response) => {
    const result = await usersService.list();
    return sendSuccess(res, result.users, 200, { fromCache: result.fromCache });
  };

  getById = async (req: Request, res: Response) => {
    const result = await usersService.getById(req.params.id as string);
    return sendSuccess(res, result.user, 200, { fromCache: result.fromCache });
  };
}

export const usersController = new UsersController();
