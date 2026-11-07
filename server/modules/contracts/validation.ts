import { z } from 'zod';
import { CONTRACT_STATUSES } from '../../../src/shared/contracts.js';

export const contractQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  status: z.enum(CONTRACT_STATUSES).optional(),
  processingMethod: z.enum(['physical', 'digital']).optional(),
  assigneeId: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  sortBy: z.enum(['uploadedAt', 'contractNumber', 'status', 'value']).default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ContractQuery = z.infer<typeof contractQuerySchema>;

