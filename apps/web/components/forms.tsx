'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { handleSchema } from '@folyo/core';
import type { Dictionary } from '../lib/i18n';
import { apiResponseSchema } from '../lib/schemas';

async function requestApi(path: string, method: string, body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = apiResponseSchema.parse(await response.json());
  return { ok: response.ok, data };
}
function errorMessage(
  d: Dictionary,
  data: {
    error?: keyof Dictionary['errors'] | undefined;
    nextAllowedAt?: string | undefined;
  },
  locale: string,
) {
  const message = d.errors[data.error ?? 'unavailable'];
  return data.nextAllowedAt
    ? message.replace(
        '{date}',
        new Date(data.nextAllowedAt).toLocaleString(locale),
      )
    : message;
}
export function TermsForm({ d, locale }: { d: Dictionary; locale: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await requestApi('/api/account/accept-terms', 'POST', {
        accepted: true,
      });
      if (!result.ok) setError(errorMessage(d, result.data, locale));
      else {
        router.replace(
          result.data.redirect === '/dashboard' ? '/dashboard' : '/onboarding',
        );
        router.refresh();
      }
    } catch {
      setError(d.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <button disabled={busy}>{busy ? d.busy : d.accept}</button>
      <p role="alert">{error}</p>
    </form>
  );
}
function useHandleCheck(handle: string, initial = '') {
  const [state, setState] = useState<
    | 'checking'
    | 'available'
    | 'invalid'
    | 'reserved'
    | 'taken'
    | 'unavailable'
    | ''
  >('');
  // Tag the result with the input to disable submit immediately after any edit,
  // including the render before an effect or delayed response has completed.
  const [checkedHandle, setCheckedHandle] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setCheckedHandle('');
    if (handle === initial && initial) {
      setState('available');
      setCheckedHandle(handle);
      return;
    }
    if (!handle) {
      setState('');
      return;
    }
    if (!handleSchema.safeParse(handle).success) {
      setState('invalid');
      return;
    }
    setState('checking');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/handle/check?handle=${encodeURIComponent(handle)}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        const data = apiResponseSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setState(
          response.ok
            ? data.available
              ? 'available'
              : (data.reason ?? 'invalid')
            : 'unavailable',
        );
        setCheckedHandle(handle);
      } catch {
        if (!controller.signal.aborted) setState('unavailable');
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [handle, initial]);
  return {
    state,
    available: state === 'available' && checkedHandle === handle,
  };
}
export function HandleForm({
  d,
  locale,
  initial = '',
  nextAllowedAt,
}: {
  d: Dictionary;
  locale: string;
  initial?: string;
  nextAllowedAt?: string | undefined;
}) {
  const [handle, setHandle] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const check = useHandleCheck(handle, initial);
  const blocked =
    nextAllowedAt !== undefined &&
    new Date(nextAllowedAt).getTime() > Date.now();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await requestApi(
        initial ? '/api/site' : '/api/onboarding',
        initial ? 'PATCH' : 'POST',
        { handle },
      );
      if (!result.ok) setError(errorMessage(d, result.data, locale));
      else {
        router.replace(initial ? '/settings' : '/dashboard');
        router.refresh();
      }
    } catch {
      setError(d.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }
  const label =
    check.state === 'unavailable'
      ? d.errors.unavailable
      : check.state
        ? d[check.state]
        : '';
  return (
    <form onSubmit={submit}>
      <label htmlFor="handle">{d.handleLabel}</label>
      <input
        id="handle"
        value={handle}
        placeholder={d.handlePlaceholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setHandle(event.target.value)}
        disabled={busy || blocked}
        aria-describedby="handle-hint handle-result"
      />
      <p id="handle-hint">{d.handleHint}</p>
      <p id="handle-result" aria-live="polite">
        {label}
      </p>
      {blocked && (
        <p>
          {d.cooldown.replace(
            '{date}',
            new Date(nextAllowedAt).toLocaleString(locale),
          )}
        </p>
      )}
      <button
        disabled={
          busy ||
          blocked ||
          !check.available ||
          (Boolean(initial) && handle.trim().toLowerCase() === initial)
        }
      >
        {busy ? d.busy : initial ? d.changeHandle : d.createSite}
      </button>
      <p role="alert">{error}</p>
    </form>
  );
}
export function MetadataForm({
  d,
  locale,
  title,
  description,
}: {
  d: Dictionary;
  locale: string;
  title: string;
  description: string;
}) {
  const [values, setValues] = useState({ title, description });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await requestApi('/api/site', 'PATCH', values);
      setMessage(result.ok ? d.saved : errorMessage(d, result.data, locale));
      if (result.ok) router.refresh();
    } catch {
      setMessage(d.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="title">{d.title}</label>
      <input
        id="title"
        maxLength={120}
        value={values.title}
        onChange={(event) =>
          setValues({ ...values, title: event.target.value })
        }
      />
      <label htmlFor="description">{d.description}</label>
      <textarea
        id="description"
        maxLength={300}
        value={values.description}
        onChange={(event) =>
          setValues({ ...values, description: event.target.value })
        }
      />
      <button disabled={busy}>{busy ? d.busy : d.save}</button>
      <p role="status">{message}</p>
    </form>
  );
}
export function DeleteAccountForm({
  d,
  locale,
  handle,
}: {
  d: Dictionary;
  locale: string;
  handle: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!deleted) {
        const result = await requestApi('/api/account', 'DELETE', {
          handle: confirmation,
        });
        if (!result.ok) {
          setError(errorMessage(d, result.data, locale));
          return;
        }
        setDeleted(true);
      }
      await signOut({ redirectTo: '/' });
    } catch {
      setError(d.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>{d.deleteHeading}</h2>
      <p>{d.deleteSummary}</p>
      <button
        className="danger"
        onClick={() => {
          setConfirmation('');
          setError('');
          dialog.current?.showModal();
        }}
      >
        {d.deleteButton}
      </button>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        aria-labelledby="delete-heading"
      >
        <form onSubmit={submit}>
          <h2 id="delete-heading">{d.confirmHeading}</h2>
          <label htmlFor="confirmation">
            {d.confirmLabel.replace('{handle}', handle)}
          </label>
          <input
            id="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={busy || deleted}
          />
          <button
            className="danger"
            disabled={busy || (!deleted && confirmation !== handle)}
          >
            {busy ? d.busy : deleted ? d.signOut : d.confirmDelete}
          </button>
          <button
            type="button"
            disabled={busy || deleted}
            onClick={() => dialog.current?.close()}
          >
            {d.cancel}
          </button>
          <p role="alert">{error}</p>
        </form>
      </dialog>
    </section>
  );
}
export function CopyLink({ url, d }: { url: string; d: Dictionary }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage(d.copied);
          } catch {
            setMessage(d.copyError);
          }
        }}
      >
        {d.copy}
      </button>
      <p role="status">{message}</p>
    </>
  );
}
