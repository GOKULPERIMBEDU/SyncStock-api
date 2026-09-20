import { z } from 'zod';

const staffBody = {
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(['Admin', 'Manager', 'Standard']),
  status: z.enum(['Active', 'Inactive']).optional(),
  joinedDate: z.coerce.date().optional(),
};

export const createStaffSchema = z.object({
  body: z.object(staffBody),
});

export const updateStaffSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    role: z.enum(['Admin', 'Manager', 'Standard']).optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    joinedDate: z.coerce.date().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
