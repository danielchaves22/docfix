import { Request, Response, NextFunction } from 'express';
import { ApiConfig } from './config';
import { AuthPrincipal, ErrorResponse } from './types';

export type TokenResolver = (rawToken: string) => AuthPrincipal | null;

/**
 * Gancho preparado para troca futura por JWT/OIDC.
 * No MVP validamos apenas um bearer token estático por ambiente.
 */
export function buildTokenResolver(config: ApiConfig): TokenResolver {
  return (rawToken) => {
    if (rawToken !== config.staticBearerToken) {
      return null;
    }

    return {
      tenantId: config.mvpTenantId,
      subject: 'mvp-service-token',
      rawToken,
    };
  };
}

export function authMiddleware(tokenResolver: TokenResolver) {
  return (req: Request, res: Response<ErrorResponse>, next: NextFunction) => {
    const authHeader = req.header('authorization');

    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return res.status(401).send();
    }

    const token = authHeader.slice('bearer '.length).trim();
    const principal = tokenResolver(token);

    if (!principal) {
      return res.status(403).send();
    }

    req.principal = principal;
    return next();
  };
}

declare global {
  namespace Express {
    interface Request {
      principal?: AuthPrincipal;
    }
  }
}
