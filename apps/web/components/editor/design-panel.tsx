'use client';
import { useEffect, useRef, useState } from 'react';
import {
  TEMPLATE_IDS,
  hexColorSchema,
  themeColors,
  themeSchema,
  type Theme,
  type ThemePatch,
} from '@folyo/core';
import type { Dictionary } from '../../lib/i18n';
import { buildTemplate } from '../../lib/templates';
import { Button } from '../ui/button';
import { Select } from '../ui/select';

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = hexColorSchema.safeParse(draft).success;
  return (
    <label className="design-color-control">
      <span>{label}</span>
      <div>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          aria-label={`${label} HEX`}
          value={draft}
          maxLength={7}
          spellCheck={false}
          aria-invalid={!valid}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (hexColorSchema.safeParse(next).success) onChange(next);
          }}
          onBlur={() => {
            if (!valid) setDraft(value);
          }}
        />
      </div>
    </label>
  );
}
export function DesignPanel({
  d,
  locale,
  theme,
  status,
  onChange,
  onRetry,
  onClose,
}: {
  d: Dictionary;
  locale: string;
  theme: Theme;
  status: 'saved' | 'saving' | 'error';
  onChange: (theme: Theme) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const c = d.templates.design;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const colors = themeColors(theme);
  const patch = (value: ThemePatch) =>
    onChange(themeSchema.parse({ ...theme, ...value }));
  const options = <T extends string>(
    values: readonly T[],
    labels: Record<T, string>,
  ) => values.map((value) => ({ value, label: labels[value] }));
  return (
    <aside
      className="editor-design-panel"
      id="editor-design-panel"
      aria-labelledby="design-heading"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="design-panel-header">
        <div>
          <p className="page-eyebrow">Folyo / Design</p>
          <h2 id="design-heading" ref={heading} tabIndex={-1}>
            {c.title}
          </h2>
        </div>
        <Button variant="ghost" aria-label={c.close} onClick={onClose}>
          ×
        </Button>
      </header>
      <p className="design-panel-intro">{c.intro}</p>
      <div
        className="design-save-status"
        role="status"
        aria-live="polite"
        data-status={status}
      >
        {status === 'saved'
          ? c.saved
          : status === 'saving'
            ? c.saving
            : c.error}
        {status === 'error' && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            {d.editor.retry}
          </Button>
        )}
      </div>
      <fieldset className="design-control-group">
        <legend>{c.base}</legend>
        <Select
          aria-label={c.base}
          value={theme.preset}
          options={TEMPLATE_IDS.map((value) => ({
            value,
            label: d.templates.names[value],
          }))}
          onValueChange={(value) => {
            if (TEMPLATE_IDS.some((id) => id === value))
              onChange(buildTemplate(value as Theme['preset'], locale).theme);
          }}
        />
        <small>{c.baseHint}</small>
      </fieldset>
      <fieldset className="design-control-group">
        <legend>{c.colors}</legend>
        <ColorControl
          label={c.background}
          value={colors.background}
          onChange={(backgroundColor) => patch({ backgroundColor })}
        />
        <ColorControl
          label={d.templates.accent}
          value={theme.accent}
          onChange={(accent) => patch({ accent })}
        />
        <ColorControl
          label={c.text}
          value={colors.text}
          onChange={(textColor) => patch({ textColor })}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => patch({ backgroundColor: null, textColor: null })}
        >
          {c.resetColors}
        </Button>
      </fieldset>
      <fieldset className="design-control-group">
        <legend>{d.templates.typography}</legend>
        <label className="design-select-control">
          <span>{c.headings}</span>
          <Select
            aria-label={c.headings}
            value={theme.headingFont}
            options={[
              { value: 'inter', label: 'Inter' },
              { value: 'playfair', label: 'Playfair Display' },
              { value: 'space-grotesk', label: 'Space Grotesk' },
              { value: 'lora', label: 'Lora' },
            ]}
            onValueChange={(value) => {
              const parsed = themeSchema.shape.headingFont.safeParse(value);
              if (parsed.success) patch({ headingFont: parsed.data });
            }}
          />
        </label>
        <label className="design-select-control">
          <span>{c.body}</span>
          <Select
            aria-label={c.body}
            value={theme.bodyFont}
            options={[
              { value: 'inter', label: 'Inter' },
              { value: 'source-sans', label: 'Source Sans 3' },
            ]}
            onValueChange={(value) => {
              const parsed = themeSchema.shape.bodyFont.safeParse(value);
              if (parsed.success) patch({ bodyFont: parsed.data });
            }}
          />
        </label>
      </fieldset>
      <fieldset className="design-control-group">
        <legend>{c.layout}</legend>
        {(
          [
            [
              'heroStyle',
              c.hero,
              options(['auto', 'plain', 'panel', 'editorial'], c.heroOptions),
            ],
            [
              'heroLayout',
              d.templates.heroLayout,
              [
                { value: 'center', label: d.templates.center },
                { value: 'left', label: d.templates.left },
              ],
            ],
            [
              'contentWidth',
              c.width,
              options(['auto', 'narrow', 'balanced', 'wide'], c.widthOptions),
            ],
            [
              'sectionSpacing',
              c.spacing,
              options(
                ['auto', 'compact', 'comfortable', 'spacious'],
                c.spacingOptions,
              ),
            ],
            [
              'galleryLayout',
              c.gallery,
              options(
                ['auto', 'grid', 'two', 'editorial', 'featured'],
                c.galleryOptions,
              ),
            ],
            [
              'cornerStyle',
              c.corners,
              options(['auto', 'square', 'soft', 'rounded'], c.cornerOptions),
            ],
          ] as const
        ).map(([key, label, choices]) => (
          <label className="design-select-control" key={key}>
            <span>{label}</span>
            <Select
              aria-label={label}
              value={theme[key]}
              options={[...choices]}
              onValueChange={(value) => {
                const parsed = themeSchema.shape[key].safeParse(value);
                if (parsed.success) patch({ [key]: parsed.data });
              }}
            />
          </label>
        ))}
      </fieldset>
    </aside>
  );
}
