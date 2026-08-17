'use client';

import { Icons } from '@/components/icons';
import Image from 'next/image';
import * as React from 'react';
import Dropzone, { type DropzoneProps, type FileRejection } from 'react-dropzone';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useControllableState } from '@/hooks/use-controllable-state';
import { cn, formatBytes } from '@/lib/utils';

export interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Value of the uploader.
   * @type File[]
   * @default undefined
   * @example value={files}
   */
  value?: File[];

  /**
   * Function to be called when the value changes.
   * @type React.Dispatch<React.SetStateAction<File[]>>
   * @default undefined
   * @example onValueChange={(files) => setFiles(files)}
   */
  onValueChange?: React.Dispatch<React.SetStateAction<File[]>>;

  /**
   * Function to be called when files are uploaded.
   * @type (files: File[]) => Promise<void>
   * @default undefined
   * @example onUpload={(files) => uploadFiles(files)}
   */
  onUpload?: (files: File[]) => Promise<void>;

  /**
   * Progress of the uploaded files.
   * @type Record<string, number> | undefined
   * @default undefined
   * @example progresses={{ "file1.png": 50 }}
   */
  progresses?: Record<string, number>;

  /**
   * Accepted file types for the uploader.
   * @type { [key: string]: string[]}
   * @default
   * ```ts
   * { "image/*": [] }
   * ```
   * @example accept={["image/png", "image/jpeg"]}
   */
  accept?: DropzoneProps['accept'];

  /**
   * Maximum file size for the uploader.
   * @type number | undefined
   * @default 1024 * 1024 * 2 // 2MB
   * @example maxSize={1024 * 1024 * 2} // 2MB
   */
  maxSize?: DropzoneProps['maxSize'];

  /**
   * Maximum number of files for the uploader.
   * @type number | undefined
   * @default 1
   * @example maxFiles={5}
   */
  maxFiles?: DropzoneProps['maxFiles'];

  /**
   * Whether the uploader should accept multiple files.
   * @type boolean
   * @default false
   * @example multiple
   */
  multiple?: boolean;

  /**
   * Whether the uploader is disabled.
   * @type boolean
   * @default false
   * @example disabled
   */
  disabled?: boolean;

  /**
   * Show a prominent "ถ่ายรูป" (take photo) action alongside the drop zone,
   * using the platform camera-capture file input. Off by default — most
   * callers (e.g. document uploads) have no reason to prefer a camera.
   * @type boolean
   * @default false
   */
  enableCameraCapture?: boolean;
}

function isAcceptedFileType(file: File, accept: DropzoneProps['accept']): boolean {
  const types = accept ? Object.keys(accept) : [];
  if (types.length === 0) return true;
  return types.some((type) =>
    type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type
  );
}

export function FileUploader(props: FileUploaderProps) {
  const {
    value: valueProp,
    onValueChange,
    onUpload,
    progresses,
    accept = { 'image/*': [] },
    maxSize = 1024 * 1024 * 2,
    maxFiles = 1,
    multiple = false,
    disabled = false,
    enableCameraCapture = false,
    className,
    ...dropzoneProps
  } = props;

  const [files, setFiles] = useControllableState({
    prop: valueProp,
    onChange: onValueChange
  });
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const onDrop = React.useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (!multiple && maxFiles === 1 && acceptedFiles.length > 1) {
        toast.error('อัปโหลดได้ครั้งละ 1 ไฟล์เท่านั้น');
        return;
      }

      if ((files?.length ?? 0) + acceptedFiles.length > maxFiles) {
        toast.error(`อัปโหลดได้ไม่เกิน ${maxFiles} ไฟล์`);
        return;
      }

      const newFiles = acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file)
        })
      );

      const updatedFiles = files ? [...files, ...newFiles] : newFiles;

      setFiles(updatedFiles);

      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file }) => {
          toast.error(`ไฟล์ ${file.name} ไม่ผ่านการตรวจสอบ (ชนิดไฟล์หรือขนาดไม่ถูกต้อง)`);
        });
      }

      if (onUpload && updatedFiles.length > 0 && updatedFiles.length <= maxFiles) {
        const target = updatedFiles.length > 0 ? `${updatedFiles.length} files` : `file`;

        toast.promise(onUpload(updatedFiles), {
          loading: `กำลังอัปโหลด ${target}…`,
          success: () => {
            setFiles([]);
            return `อัปโหลด ${target} สำเร็จ`;
          },
          error: `อัปโหลด ${target} ไม่สำเร็จ`
        });
      }
    },

    [files, maxFiles, multiple, onUpload, setFiles]
  );

  // Camera capture bypasses react-dropzone entirely (it's a plain file
  // input), so it needs the same accept/maxSize validation onDrop gets from
  // the Dropzone wrapper — then hands off to the same onDrop logic so
  // toasts, previews, and onUpload all behave identically either way.
  function onCameraCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = ''; // lets the user retake with the same filename
    if (selected.length === 0) return;

    const accepted: File[] = [];
    const rejected: FileRejection[] = [];
    for (const file of selected) {
      if (file.size > maxSize || !isAcceptedFileType(file, accept)) {
        rejected.push({ file, errors: [] });
      } else {
        accepted.push(file);
      }
    }
    onDrop(accepted, rejected);
  }

  function onRemove(index: number) {
    if (!files) return;
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onValueChange?.(newFiles);
  }

  // Revoke preview url when component unmounts
  React.useEffect(() => {
    return () => {
      if (!files) return;
      files.forEach((file) => {
        if (isFileWithPreview(file)) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDisabled = disabled || (files?.length ?? 0) >= maxFiles;

  return (
    <div className='relative flex flex-col gap-6 overflow-hidden'>
      {enableCameraCapture && (
        <input
          ref={cameraInputRef}
          type='file'
          accept='image/*'
          capture='environment'
          className='hidden'
          tabIndex={-1}
          aria-hidden='true'
          onChange={onCameraCapture}
        />
      )}
      <Dropzone
        onDrop={onDrop}
        accept={accept}
        maxSize={maxSize}
        maxFiles={maxFiles}
        multiple={maxFiles > 1 || multiple}
        disabled={isDisabled}
        noClick={enableCameraCapture}
      >
        {({ getRootProps, getInputProps, isDragActive, open }) => (
          <>
            {enableCameraCapture && !isDisabled && (
              <div className='grid grid-cols-2 gap-3'>
                <Button
                  type='button'
                  variant='outline'
                  className='h-12 gap-2 text-[0.9375rem]'
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Icons.camera className='size-5' aria-hidden />
                  ถ่ายรูป
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  className='h-12 gap-2 text-[0.9375rem]'
                  onClick={open}
                >
                  <Icons.upload className='size-5' aria-hidden />
                  เลือกรูปจากเครื่อง
                </Button>
              </div>
            )}
            <div
              {...getRootProps()}
              className={cn(
                'group border-muted-foreground/25 hover:bg-muted/25 relative grid h-52 w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed px-5 py-2.5 text-center transition',
                'ring-offset-background focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
                isDragActive && 'border-muted-foreground/50',
                isDisabled && 'pointer-events-none opacity-60',
                enableCameraCapture && 'cursor-default',
                className
              )}
              {...dropzoneProps}
            >
              <input {...getInputProps()} aria-label='อัปโหลดรูปภาพ' />
              {isDragActive ? (
                <div className='flex flex-col items-center justify-center gap-4 sm:px-5'>
                  <div className='rounded-full border border-dashed p-3'>
                    <Icons.upload className='text-muted-foreground size-7' aria-hidden='true' />
                  </div>
                  <p className='text-muted-foreground font-medium'>วางไฟล์ที่นี่</p>
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center gap-4 sm:px-5'>
                  <div className='rounded-full border border-dashed p-3'>
                    <Icons.upload className='text-muted-foreground size-7' aria-hidden='true' />
                  </div>
                  <div className='space-y-px'>
                    <p className='text-muted-foreground font-medium'>
                      {enableCameraCapture
                        ? 'หรือลากรูปภาพมาวางที่นี่'
                        : 'ลากรูปภาพมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                    </p>
                    <p className='text-muted-foreground/70 text-sm'>
                      {maxFiles > 1
                        ? `เลือกได้สูงสุด ${maxFiles} ไฟล์ (ไฟล์ละไม่เกิน ${formatBytes(maxSize)})`
                        : `ไฟล์ละไม่เกิน ${formatBytes(maxSize)}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Dropzone>
      {files?.length ? (
        <ScrollArea className='h-fit w-full px-3'>
          <div className='max-h-48 space-y-4'>
            {files?.map((file, index) => (
              <FileCard
                key={index}
                file={file}
                onRemove={() => onRemove(index)}
                progress={progresses?.[file.name]}
              />
            ))}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}

interface FileCardProps {
  file: File;
  onRemove: () => void;
  progress?: number;
}

function FileCard({ file, progress, onRemove }: FileCardProps) {
  return (
    <div className='relative flex items-center space-x-4'>
      <div className='flex flex-1 space-x-4'>
        {isFileWithPreview(file) ? (
          <Image
            src={file.preview}
            alt={file.name}
            width={48}
            height={48}
            loading='lazy'
            className='aspect-square shrink-0 rounded-md object-cover'
          />
        ) : null}
        <div className='flex w-full flex-col gap-2'>
          <div className='space-y-px'>
            <p className='text-foreground/80 line-clamp-1 text-sm font-medium'>{file.name}</p>
            <p className='text-muted-foreground text-xs'>{formatBytes(file.size)}</p>
          </div>
          {progress ? <Progress value={progress} /> : null}
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onRemove}
          disabled={progress !== undefined && progress < 100}
          className='size-8 rounded-full'
        >
          <Icons.close className='text-muted-foreground' />
          <span className='sr-only'>Remove file</span>
        </Button>
      </div>
    </div>
  );
}

function isFileWithPreview(file: File): file is File & { preview: string } {
  return 'preview' in file && typeof file.preview === 'string';
}
