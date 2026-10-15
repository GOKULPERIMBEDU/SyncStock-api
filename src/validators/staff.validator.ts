import { z } from 'zod';

/** `Standard` is the legacy label for `Staff`; it is still accepted on input and stored as `Staff`. */
const role = z.enum(['Admin', 'Manager', 'Staff', 'Standard']).transform((value) => (value === 'Standard' ? ('Staff' as const) : value));

const staffBody = {
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role,
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
    role: role.optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    joinedDate: z.coerce.date().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
