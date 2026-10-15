import type { Request } from 'express';

/**
 * Facility a request is acting on, from the `X-Site-Id` header (`WH-01`..`WH-05`). The web app sends the site picked
 * in the top bar; the network-wide "ALL" view and a missing header both fall back to the primary site server-side.
 */
export function siteFromRequest(req: Request): string | undefined {
  const raw = req.header('x-site-id')?.trim().toUpperCase();
  return raw && raw !== 'ALL' ? raw : undefined;
}
