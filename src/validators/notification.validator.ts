import { z } from 'zod';

export const notificationIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
