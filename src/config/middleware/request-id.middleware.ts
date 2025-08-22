import { randomUUID } from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';

export const requestIdMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length > 0 ? incoming : randomUUID();

  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
