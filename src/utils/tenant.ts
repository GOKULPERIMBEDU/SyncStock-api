import type { Request } from 'express';

/**
 * Workspace a request is acting in, from the `X-Tenant-Id` header. Missing or unknown values fall back to the default
 * workspace server-side, so older clients keep working.
 */
export function tenantFromRequest(req: Request): string | undefined {
  const raw = req.header('x-tenant-id')?.trim().toLowerCase();
  return raw || undefined;
}
