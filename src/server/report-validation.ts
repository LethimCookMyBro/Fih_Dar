import { z } from 'zod';

export const REPORT_PROVINCES = ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง'] as const;
export const REPORT_QUANTITY_RANGES = [
  'ONE',
  'TWO_TO_FIVE',
  'SIX_TO_TEN',
  'OVER_TEN',
  'UNKNOWN'
] as const;
export const REPORT_QUANTITY_RANGE_LABELS: Record<(typeof REPORT_QUANTITY_RANGES)[number], string> =
  {
    ONE: '1 ตัว',
    TWO_TO_FIVE: '2–5 ตัว',
    SIX_TO_TEN: '6–10 ตัว',
    OVER_TEN: 'มากกว่า 10 ตัว',
    UNKNOWN: 'ไม่แน่ใจ'
  };

const numericField = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform(Number)
    .refine(Number.isFinite, 'Must be a finite number')
    .refine((value) => value >= min && value <= max, `Must be between ${min} and ${max}`);

const observedAtField = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid date')
  .transform((value) => new Date(value))
  .refine((value) => value.getTime() <= Date.now() + 5 * 60 * 1000, 'Cannot be in the future');

export const reportMetadataSchema = z
  .object({
    latitude: numericField(-90, 90),
    longitude: numericField(-180, 180),
    province: z.enum(REPORT_PROVINCES),
    district: z.string().trim().max(120).nullable(),
    subdistrict: z.string().trim().max(120).nullable(),
    locationDescription: z.string().trim().max(500).nullable(),
    observedAt: observedAtField,
    quantityRange: z.enum(REPORT_QUANTITY_RANGES),
    note: z.string().trim().max(1000).nullable(),
    consent: z.literal(true)
  })
  .strict();

export type ValidatedReportMetadata = z.output<typeof reportMetadataSchema>;

function formText(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === 'string' ? value : null;
}

function optionalFormText(form: FormData, name: string): string | null {
  const value = formText(form, name);
  return value === null || value.trim() === '' ? null : value;
}

export async function parseReportFormData(form: FormData): Promise<{
  metadata: ValidatedReportMetadata;
  image: { data: Uint8Array; contentType: string };
}> {
  const ownershipFields = ['reporterId', 'clerkUserId'] as const;
  const suppliedOwnershipFields = ownershipFields.filter((field) => form.has(field));
  if (suppliedOwnershipFields.length > 0) {
    throw new z.ZodError(
      suppliedOwnershipFields.map((field) => ({
        code: 'custom' as const,
        path: [field],
        message: 'Ownership fields are not accepted'
      }))
    );
  }

  const image = form.get('image');
  if (!image || typeof image !== 'object' || typeof image.arrayBuffer !== 'function') {
    throw new z.ZodError([{ code: 'custom', path: ['image'], message: 'Image is required' }]);
  }

  const metadata = reportMetadataSchema.parse({
    latitude: formText(form, 'latitude'),
    longitude: formText(form, 'longitude'),
    province: formText(form, 'province'),
    district: optionalFormText(form, 'district'),
    subdistrict: optionalFormText(form, 'subdistrict'),
    locationDescription: optionalFormText(form, 'locationDescription'),
    observedAt: formText(form, 'observedAt'),
    quantityRange: formText(form, 'quantityRange'),
    note: optionalFormText(form, 'note'),
    consent: formText(form, 'consent') === 'true'
  });

  return {
    metadata,
    image: { data: new Uint8Array(await image.arrayBuffer()), contentType: image.type }
  };
}
