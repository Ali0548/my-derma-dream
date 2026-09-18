import type { Request, Response } from 'express';
import { rulesService } from './rules.service.js';
import { sendSuccess } from '../../utils/response.js';
import type { OverlapBody, PreviewBody, RuleBody } from './rules.validation.js';

function bodyOf<T>(req: Request): T {
  return req.body as T;
}

export class RulesController {
  list = async (_req: Request, res: Response) => {
    const data = await rulesService.list();
    return sendSuccess(res, data);
  };

  getById = async (req: Request, res: Response) => {
    const data = await rulesService.getById(String(req.params.id));
    return sendSuccess(res, data);
  };

  nextId = async (_req: Request, res: Response) => {
    const ruleId = await rulesService.nextRuleId();
    return sendSuccess(res, { ruleId });
  };

  overlap = async (req: Request, res: Response) => {
    const data = await rulesService.checkOverlap(bodyOf<OverlapBody>(req));
    return sendSuccess(res, data);
  };

  preview = async (req: Request, res: Response) => {
    const data = await rulesService.preview(bodyOf<PreviewBody>(req));
    return sendSuccess(res, data);
  };

  create = async (req: Request, res: Response) => {
    const data = await rulesService.create(bodyOf<RuleBody>(req), req.user?.sub);
    return sendSuccess(res, data, 201);
  };

  update = async (req: Request, res: Response) => {
    const data = await rulesService.update(String(req.params.id), bodyOf<RuleBody>(req), req.user?.sub);
    return sendSuccess(res, data);
  };

  deactivate = async (req: Request, res: Response) => {
    const data = await rulesService.deactivate(String(req.params.id), req.user?.sub);
    return sendSuccess(res, data);
  };
}

export const rulesController = new RulesController();
