'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { z } from 'zod';

import { FileUploader } from '@/components/file-uploader';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { useAppForm } from '@/lib/form';
import { LocationPicker, type PickedLocation } from '@/features/map/components/location-picker';
import { createReport } from '@/features/reports/api/service';
import { reportKeys } from '@/features/reports/api/queries';
import {
  EEC_PILOT_PROVINCES,
  LOCATION_PRECISION_DESCRIPTIONS,
  LOCATION_PRECISION_LABELS,
  LOCATION_PRECISIONS,
  PHOTO_LOCATION_RELATIONS,
  PHOTO_LOCATION_RELATION_LABELS,
  PHOTO_LOCATION_RELATION_DESCRIPTIONS,
  REPORT_PROVINCES,
  REPORT_QUANTITY_RANGES,
  REPORT_QUANTITY_RANGE_LABELS,
  type CreatedReport,
  type LocationPrecision,
  type PhotoLocationRelation
} from '@/features/reports/api/types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// EEC provinces carry a visible pilot marker in the selector; everything else
// is nationwide surveillance intake.
const PROVINCE_OPTIONS = REPORT_PROVINCES.map((province) => ({
  value: province,
  label: (EEC_PILOT_PROVINCES as readonly string[]).includes(province)
    ? `${province} (พื้นที่นำร่อง EEC)`
    : province
}));

const PRECISION_OPTIONS = LOCATION_PRECISIONS.map((value) => ({
  value,
  label: LOCATION_PRECISION_LABELS[value]
}));

// UNKNOWN exists only to preserve legacy reports that never declared this
// relationship — a new report must explicitly say SAME or DIFFERENT.
const NEW_REPORT_PHOTO_LOCATION_RELATIONS = PHOTO_LOCATION_RELATIONS.filter(
  (value) => value !== 'UNKNOWN'
);

const reportFormSchema = z.object({
  image: z
    .custom<File>((value) => value instanceof File, 'กรุณาแนบรูปภาพประกอบ')
    .refine((file) => file.size <= MAX_IMAGE_BYTES, 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB')
    .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type), 'รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP'),
  location: z
    .custom<PickedLocation>(
      (value) => value !== null && typeof value === 'object',
      'กรุณาเลือกตำแหน่งที่พบบนแผนที่'
    )
    .refine(
      (value) => Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180,
      'พิกัดไม่ถูกต้อง'
    ),
  province: z.enum(REPORT_PROVINCES, { error: 'กรุณาเลือกจังหวัด' }),
  locationPrecision: z.enum(LOCATION_PRECISIONS, {
    error: 'กรุณาระบุความแม่นยำของตำแหน่ง'
  }),
  photoLocationRelation: z.enum(PHOTO_LOCATION_RELATIONS, {
    error: 'กรุณาระบุความสัมพันธ์ระหว่างรูปภาพและตำแหน่งที่พบ'
  }),
  observedAt: z
    .date({ error: 'กรุณาเลือกวันที่พบ' })
    .refine((date) => date.getTime() <= Date.now(), 'วันที่พบต้องไม่เป็นวันในอนาคต'),
  quantityRange: z.enum(REPORT_QUANTITY_RANGES, { error: 'กรุณาเลือกจำนวนโดยประมาณ' }),
  locationDescription: z.string().trim().max(500, 'ข้อความยาวเกินไป').optional(),
  note: z.string().trim().max(1000, 'ข้อความยาวเกินไป').optional(),
  consent: z.literal(true, { error: 'กรุณายืนยันความยินยอมก่อนส่งรายงาน' })
});

type ReportFormValues = z.input<typeof reportFormSchema>;

function toFormData(values: z.output<typeof reportFormSchema>): FormData {
  const form = new FormData();
  form.set('image', values.image);
  // The pin is the observation location — the point where the fish was found.
  // It is never replaced by the device's current location or the photo's.
  form.set('latitude', String(values.location.latitude));
  form.set('longitude', String(values.location.longitude));
  form.set('province', values.province);
  form.set('locationPrecision', values.locationPrecision);
  form.set('photoLocationRelation', values.photoLocationRelation);
  form.set('observedAt', values.observedAt.toISOString());
  form.set('quantityRange', values.quantityRange);
  form.set('locationDescription', values.locationDescription ?? '');
  form.set('note', values.note ?? '');
  form.set('consent', 'true');
  return form;
}

function SuccessState({ report }: { report: CreatedReport }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className='bg-card mx-auto max-w-lg rounded-xl border p-6 text-center shadow-sm'
    >
      <div className='bg-accent text-accent-foreground mx-auto flex size-12 items-center justify-center rounded-full'>
        <Icons.circleCheck className='size-6' aria-hidden />
      </div>
      <h2 className='mt-4 text-xl font-semibold'>ได้รับรายงานแล้ว</h2>
      <p className='text-muted-foreground mt-2 text-sm'>
        ทีมงานจะตรวจสอบข้อมูลก่อนนำไปแสดงเป็นข้อมูลที่ยืนยันแล้ว และคุณสามารถติดตามสถานะได้ที่ “รายงานของฉัน”
      </p>

      <div className='bg-muted mt-5 rounded-lg p-3'>
        <p className='text-muted-foreground text-xs'>เลขอ้างอิงรายงาน</p>
        <p className='font-mono text-lg font-semibold'>{report.publicReference}</p>
      </div>

      <div className='mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center'>
        <Button nativeButton={false} render={<Link href='/profile' aria-label='ดูรายงานของฉัน' />}>
          ดูรายงานของฉัน
        </Button>
        <Button
          nativeButton={false}
          variant='outline'
          render={<Link href='/map' aria-label='กลับไปที่แผนที่' />}
        >
          กลับไปที่แผนที่
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * A labelled group of related fields. Grouping is done with a heading and
 * whitespace rather than a card per field — the brief for this form is
 * "simple and trustworthy", and a stack of bordered boxes reads bureaucratic.
 */
function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='flex flex-col gap-5'>
      <div>
        <h2 className='text-[1.0625rem] font-semibold tracking-tight'>{title}</h2>
        {description && (
          <p className='text-muted-foreground mt-1 text-[0.875rem] leading-relaxed'>
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export function ReportForm() {
  const queryClient = useQueryClient();
  const [created, setCreated] = React.useState<CreatedReport | null>(null);

  const mutation = useMutation({
    mutationFn: createReport,
    onSuccess: async (report) => {
      setCreated(report);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reportKeys.mine() }),
        queryClient.invalidateQueries({ queryKey: reportKeys.publicList() })
      ]);
    },
    onError: (error: Error) => toast.error(error.message || 'ส่งรายงานไม่สำเร็จ')
  });

  const form = useAppForm({
    defaultValues: {
      image: undefined,
      location: undefined,
      province: undefined,
      locationPrecision: undefined,
      photoLocationRelation: undefined,
      observedAt: undefined,
      quantityRange: undefined,
      locationDescription: '',
      note: '',
      consent: false
    } as unknown as ReportFormValues,
    validators: { onSubmit: reportFormSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(toFormData(reportFormSchema.parse(value)));
    }
  });

  const province = useStore(form.store, (state) => state.values.province);
  const precision = useStore(
    form.store,
    (state) => state.values.locationPrecision as LocationPrecision | undefined
  );
  const photoRelation = useStore(
    form.store,
    (state) => state.values.photoLocationRelation as PhotoLocationRelation | undefined
  );
  const outsidePilot =
    typeof province === 'string' && !(EEC_PILOT_PROVINCES as readonly string[]).includes(province);

  if (created) return <SuccessState report={created} />;

  return (
    <form
      // Sections are separated by a hairline + generous gap, so the flow reads
      // as four short steps instead of one long undifferentiated column.
      className='mx-auto flex w-full max-w-2xl flex-col gap-8 [&>section+section]:border-border [&>section+section]:border-t [&>section+section]:pt-8'
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormSection title='ภาพถ่ายปลาที่พบ' description='ภาพที่ชัดเจนช่วยให้ทีมตรวจสอบระบุชนิดปลาได้แม่นยำขึ้น'>
        <form.Field
          name='image'
          children={(field) => {
            const errors = field.state.meta.errors;
            const invalid = field.state.meta.isTouched && errors.length > 0;
            return (
              <Field data-invalid={invalid}>
                <FieldLabel>รูปภาพปลาที่พบ *</FieldLabel>
                <FileUploader
                  maxFiles={1}
                  maxSize={MAX_IMAGE_BYTES}
                  accept={{ 'image/jpeg': [], 'image/png': [], 'image/webp': [] }}
                  enableCameraCapture
                  value={field.state.value ? [field.state.value as File] : []}
                  onValueChange={(next) => {
                    const files = typeof next === 'function' ? next([]) : next;
                    field.handleChange(files[0] as never);
                    field.handleBlur();
                  }}
                />
                {invalid && <FieldError errors={errors} />}
              </Field>
            );
          }}
        />
      </FormSection>

      <FormSection
        title='ตำแหน่งที่พบปลาจริง'
        description='ตำแหน่งนี้คือจุดที่พบปลา ไม่ใช่ตำแหน่งที่คุณกำลังส่งรายงานหรือตำแหน่งที่ถ่ายรูป'
      >
        <form.Field
          name='location'
          children={(field) => {
            const errors = field.state.meta.errors;
            const invalid = field.state.meta.isTouched && errors.length > 0;
            return (
              <Field data-invalid={invalid}>
                <FieldLabel>ตำแหน่งที่พบปลา *</FieldLabel>
                <LocationPicker
                  value={(field.state.value as PickedLocation | undefined) ?? null}
                  onChange={(next) => {
                    field.handleChange(next as never);
                    field.handleBlur();
                  }}
                />
                {invalid && <FieldError errors={errors} />}
              </Field>
            );
          }}
        />

        <form.AppField
          name='photoLocationRelation'
          children={(field) => (
            <>
              <field.SelectField
                label='รูปนี้ถ่ายตรงจุดที่พบปลาหรือไม่?'
                required
                placeholder='เลือกคำตอบ'
                description='ช่วยให้เจ้าหน้าที่รู้ว่าพิกัดที่ปักไว้มาจากจุดถ่ายภาพหรือคุณระบุเอง'
                options={NEW_REPORT_PHOTO_LOCATION_RELATIONS.map((value) => ({
                  value,
                  label: PHOTO_LOCATION_RELATION_LABELS[value]
                }))}
              />
              {photoRelation && photoRelation !== 'SAME' && (
                <p className='text-muted-foreground -mt-3 flex items-start gap-2 text-[0.8125rem] leading-relaxed'>
                  <Icons.info className='mt-0.5 size-4 shrink-0' aria-hidden />
                  {PHOTO_LOCATION_RELATION_DESCRIPTIONS[photoRelation]}
                </p>
              )}
            </>
          )}
        />

        <form.AppField
          name='locationPrecision'
          children={(field) => (
            <>
              <field.SelectField
                label='คุณรู้ตำแหน่งที่พบปลาละเอียดแค่ไหน?'
                required
                placeholder='เลือกระดับความละเอียด'
                description='ตำแหน่งที่แม่นยำช่วยให้เจ้าหน้าที่ลงพื้นที่ได้ตรงจุด'
                options={PRECISION_OPTIONS}
              />
              {precision && precision !== 'EXACT' && (
                <p className='text-muted-foreground -mt-3 flex items-start gap-2 text-[0.8125rem] leading-relaxed'>
                  <Icons.info className='mt-0.5 size-4 shrink-0' aria-hidden />
                  {LOCATION_PRECISION_DESCRIPTIONS[precision]}— หมุดจะถูกแสดงเป็นตำแหน่งโดยประมาณเท่านั้น
                </p>
              )}
            </>
          )}
        />

        <div className='grid gap-6 sm:grid-cols-2'>
          <form.AppField
            name='province'
            children={(field) => (
              <field.SelectField
                label='จังหวัด'
                required
                placeholder='เลือกจังหวัด'
                options={PROVINCE_OPTIONS}
              />
            )}
          />

          <form.AppField
            name='observedAt'
            children={(field) => (
              <field.DatePickerField
                label='วันที่พบ'
                required
                placeholder='เลือกวันที่'
                disabledDates={(date) => date.getTime() > Date.now()}
              />
            )}
          />
        </div>

        {outsidePilot && (
          <div
            role='status'
            className='border-status-pending/40 bg-status-pending/10 text-foreground flex items-start gap-3 rounded-xl border p-3'
          >
            <Icons.info className='mt-0.5 size-5 shrink-0' aria-hidden />
            <p className='text-[0.875rem] leading-relaxed'>
              พื้นที่นี้อยู่นอกเขตนำร่อง EEC
              <span className='mt-0.5 block'>
                ระบบจะเก็บข้อมูลเพื่อการเฝ้าระวัง แต่ยังไม่รวมในคิวปฏิบัติการพื้นที่นำร่อง
              </span>
            </p>
          </div>
        )}
      </FormSection>

      <FormSection title='รายละเอียดการพบ'>
        <form.AppField
          name='quantityRange'
          children={(field) => (
            <field.RadioGroupField
              label='จำนวนโดยประมาณ'
              required
              options={REPORT_QUANTITY_RANGES.map((value) => ({
                value,
                label: REPORT_QUANTITY_RANGE_LABELS[value]
              }))}
            />
          )}
        />

        <form.AppField
          name='locationDescription'
          children={(field) => (
            <field.TextareaField
              label='รายละเอียดสถานที่'
              description='เช่น บริเวณคลองหลังบ้าน ใกล้สะพาน…'
              rows={3}
            />
          )}
        />

        <form.AppField
          name='note'
          children={(field) => (
            <field.TextareaField
              label='บันทึกเพิ่มเติม'
              description='ไม่บังคับ — เช่น สภาพน้ำ พฤติกรรมที่สังเกตเห็น'
              rows={3}
            />
          )}
        />
      </FormSection>

      <FormSection title='ยืนยันการส่ง'>
        <form.AppField
          name='consent'
          children={(field) => (
            <field.CheckboxField label='ยินยอมให้ใช้ข้อมูลที่ส่งเพื่อการเฝ้าระวังและตรวจสอบสถานการณ์ โดยไม่เปิดเผยตัวตนผู้แจ้งต่อสาธารณะ' />
          )}
        />

        <AnimatePresence>
          {mutation.isError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role='alert'
              className='border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-xl border p-3'
            >
              <Icons.alertCircle className='mt-0.5 size-5 shrink-0' aria-hidden />
              <p className='text-[0.9375rem] leading-snug'>
                {mutation.error.message || 'ส่งรายงานไม่สำเร็จ กรุณาลองอีกครั้ง'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full-width on mobile (thumb-reachable), intrinsic on desktop.
            The label is wrapped in a grid stack so the pending and idle strings
            occupy the same cell — the button keeps one width and does not
            reflow when submission starts. */}
        <Button
          type='submit'
          disabled={mutation.isPending}
          className='h-12 w-full px-6 text-[0.9375rem] sm:w-auto sm:self-end'
        >
          <span className='grid place-items-center'>
            <span
              aria-hidden={!mutation.isPending}
              className={`col-start-1 row-start-1 flex items-center gap-2 ${mutation.isPending ? '' : 'invisible'}`}
            >
              <Icons.spinner className='animate-spin' />
              กำลังส่งรายงาน…
            </span>
            <span
              aria-hidden={mutation.isPending}
              className={`col-start-1 row-start-1 ${mutation.isPending ? 'invisible' : ''}`}
            >
              ส่งรายงาน
            </span>
          </span>
        </Button>
      </FormSection>
    </form>
  );
}
