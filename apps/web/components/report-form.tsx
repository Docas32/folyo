'use client';
import { useState } from 'react';
import type { Dictionary } from '../lib/i18n';
import { REPORT_REASONS, reportSchema } from '../lib/report-service';
import { Button } from './ui/button';
import { Select } from './ui/select';
export function ReportForm({
  d,
  initialHandle = '',
}: {
  d: Dictionary;
  initialHandle?: string;
}) {
  const r = d.public.report;
  const [handle, setHandle] = useState(initialHandle),
    [reason, setReason] = useState('spam');
  const [details, setDetails] = useState(''),
    [website, setWebsite] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [done, setDone] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const input = { handle, reason, details, website };
        if (!reportSchema.safeParse(input).success) {
          setMessage(r.error);
          return;
        }
        setBusy(true);
        setMessage('');
        try {
          const response = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          if (!response.ok) {
            setMessage(response.status === 429 ? r.rate : r.error);
            return;
          }
          setDone(true);
          setMessage(r.success);
        } catch {
          setMessage(r.error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || done}>
        <label>
          {r.handle}
          <input
            name="handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            minLength={3}
            maxLength={30}
            required
          />
        </label>
        <label>
          {r.reason}
          <Select
            aria-label={r.reason}
            value={reason}
            onValueChange={setReason}
            options={REPORT_REASONS.map((value) => ({
              value,
              label: r.reasons[value],
            }))}
          />
        </label>
        <label>
          {r.details}
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={2000}
            aria-describedby="report-hint"
          />
        </label>
        <p id="report-hint" className="muted">
          {r.hint}
        </p>
        <label className="report-honeypot" aria-hidden="true">
          Website
          <input
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
        <Button type="submit">{busy ? d.busy : r.submit}</Button>
      </fieldset>
      {message && <p role={done ? 'status' : 'alert'}>{message}</p>}
    </form>
  );
}
