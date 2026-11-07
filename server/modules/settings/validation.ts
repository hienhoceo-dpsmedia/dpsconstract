import { z } from 'zod';

export const settingsSchema = z.object({
  defaultBasePayLegal: z.number().int().min(0).max(1_000_000_000).default(500000),
  defaultBasePayClerk: z.number().int().min(0).max(1_000_000_000).default(100000),
  slaInternalHours: z.number().int().min(1).max(8760).default(24),
  slaViettelPostDays: z.number().int().min(1).max(365).default(3),
  slaPrintingHours: z.number().int().min(1).max(8760).default(2),
  slaCourierHours: z.number().int().min(1).max(8760).default(4),
  slaRetrievalDays: z.number().int().min(1).max(365).default(7),

  // SLA Rates (percentages: -100 to 100)
  slaEarlyMaxRate: z.number().int().min(-100).max(100).default(30),
  slaEarlyMidRate: z.number().int().min(-100).max(100).default(20),
  slaEarlyMinRate: z.number().int().min(-100).max(100).default(10),
  slaOnTimeRate: z.number().int().min(-100).max(100).default(0),
  slaLateMinRate: z.number().int().min(-100).max(100).default(-10),
  slaLateMidRate: z.number().int().min(-100).max(100).default(-20),
  slaLateMaxRate: z.number().int().min(-100).max(100).default(-30),

  // Threshold Percentages
  slaEarlyMaxTimePct: z.number().int().min(1).max(100).default(50),
  slaEarlyMidTimePct: z.number().int().min(1).max(100).default(25),
  slaEarlyMinTimePct: z.number().int().min(1).max(100).default(10),

  // Urgency thresholds (hours, strictly ascending: emergency < urgent < priority)
  urgencyEmergencyMaxHours: z.number().int().min(1).max(8760).default(1),
  urgencyUrgentBeforeHours: z.number().int().min(2).max(8760).default(3),
  urgencyPriorityBeforeHours: z.number().int().min(3).max(8760).default(24),

  // Urgency Rates
  urgencyEmergencyRate: z.number().int().min(-100).max(100).default(30),
  urgencyUrgentRate: z.number().int().min(-100).max(100).default(20),
  urgencyPriorityRate: z.number().int().min(-100).max(100).default(10),

  // Quality Rates
  qualityZeroRate: z.number().int().min(-100).max(100).default(0),
  qualityOneRate: z.number().int().min(-100).max(100).default(-10),
  qualityTwoRate: z.number().int().min(-100).max(100).default(-20),
  qualityThreePlusRate: z.number().int().min(-100).max(100).default(-30),

  // Optional integration endpoints & templates
  teamsWebhookUrl: z.string().url().or(z.literal('')).optional().nullable(),
  teamsPayloadTemplate: z.string().optional().nullable(),
  googleDriveFolderId: z.string().optional().nullable(),
  vtpConnectionStatus: z.enum(['connected', 'disconnected']).default('disconnected'),
}).passthrough().superRefine((data, ctx) => {
  // Threshold % ordering: earlyMin < earlyMid < earlyMax
  const earlyMin = data.slaEarlyMinTimePct ?? 10;
  if (data.slaEarlyMidTimePct <= earlyMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'slaEarlyMidTimePct must be strictly greater than slaEarlyMinTimePct',
      path: ['slaEarlyMidTimePct'],
    });
  }
  if (data.slaEarlyMaxTimePct <= data.slaEarlyMidTimePct) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'slaEarlyMaxTimePct must be strictly greater than slaEarlyMidTimePct',
      path: ['slaEarlyMaxTimePct'],
    });
  }

  // Urgency threshold hours: emergency < urgent < priority
  if (data.urgencyUrgentBeforeHours <= data.urgencyEmergencyMaxHours) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'urgencyUrgentBeforeHours must be strictly greater than urgencyEmergencyMaxHours',
      path: ['urgencyUrgentBeforeHours'],
    });
  }
  if (data.urgencyPriorityBeforeHours <= data.urgencyUrgentBeforeHours) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'urgencyPriorityBeforeHours must be strictly greater than urgencyUrgentBeforeHours',
      path: ['urgencyPriorityBeforeHours'],
    });
  }
});

export type ValidatedSettings = z.infer<typeof settingsSchema>;

export function validateSettingsData(input: unknown) {
  return settingsSchema.safeParse(input);
}
