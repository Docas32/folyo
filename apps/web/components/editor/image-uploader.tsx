'use client';
import { Button } from '../ui/button';

import { FileTrigger } from '../ui/file-trigger';
import { useEffect, useRef, useState } from 'react';
import {
  imageMimeSchema,
  MAX_UPLOAD_BYTES,
  uploadResultSchema,
} from '@folyo/core';
import { compressImage, type CompressedImage } from '../../lib/compress-image';
import type { EditorDictionary } from './block-menu';
export function ImageUploader({
  d,
  onUpload,
  onBusyChange,
}: {
  d: EditorDictionary;
  onUpload: (url: string, alt: string) => void;
  onBusyChange?: ((busy: boolean) => void) | undefined;
}) {
  const [status, setStatus] = useState<
    'selecting' | 'compressing' | 'uploading' | 'ok' | 'error'
  >('selecting');
  const [fileInfo, setFileInfo] = useState('');
  const [error, setError] = useState('');
  const original = useRef<File | null>(null);
  const prepared = useRef<CompressedImage | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const callback = useRef(onUpload);
  callback.current = onUpload;
  useEffect(
    () => () => {
      sequence.current++;
      request.current?.abort();
    },
    [],
  );
  async function send(file: File, retry = false) {
    const attempt = ++sequence.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError('');
    setFileInfo(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
    try {
      if (!imageMimeSchema.safeParse(file.type).success)
        throw new Error(d.upload.mimeError);
      if (!retry || !prepared.current) {
        setStatus('compressing');
        prepared.current = await compressImage(file);
      }
      if (attempt !== sequence.current) return;
      const compressed = prepared.current;
      if (!compressed || compressed.file.size > MAX_UPLOAD_BYTES)
        throw new Error(d.upload.sizeError);
      setStatus('uploading');
      setFileInfo(
        `${compressed.file.name} · ${(compressed.file.size / 1024).toFixed(0)} KB`,
      );
      const form = new FormData();
      form.set('file', compressed.file);
      form.set('width', String(compressed.width));
      form.set('height', String(compressed.height));
      form.set('alt', compressed.alt || d.upload.defaultAlt);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 413
            ? d.upload.sizeError
            : response.status === 415
              ? d.upload.mimeError
              : d.upload.error,
        );
      const result = uploadResultSchema.parse(await response.json());
      if (attempt !== sequence.current) return;
      callback.current(result.url, compressed.alt || d.upload.defaultAlt);
      setStatus('ok');
    } catch (cause) {
      if (attempt !== sequence.current) return;
      setError(
        cause instanceof Error &&
          [d.upload.mimeError, d.upload.sizeError].includes(cause.message)
          ? cause.message
          : d.upload.error,
      );
      setStatus('error');
    }
  }
  const busy = status === 'compressing' || status === 'uploading';
  useEffect(() => {
    if (!busy) return;
    onBusyChange?.(true);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  return (
    <div className="image-uploader">
      <FileTrigger
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!file) return;
          original.current = file;
          prepared.current = null;
          void send(file);
        }}
      >
        {d.upload.select}
      </FileTrigger>
      <p role="status">
        {d.upload[status]}
        {fileInfo && ` · ${fileInfo}`}
      </p>
      {status === 'error' && (
        <>
          <p role="alert">{error}</p>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              if (original.current) void send(original.current, true);
            }}
          >
            {d.upload.retry}
          </Button>
        </>
      )}
    </div>
  );
}
