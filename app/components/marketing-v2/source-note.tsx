'use client';

/**
 * Kildenoten <SourceNote/> — §5.1 i masterdirektivet.
 * Hevet gull-dagger (†) etter et avkastnings-/kapitaltall. Klikk/hover
 * åpner en popover med kilde, modus, tidsstempel og forbehold — som
 * noter i en årsrapport. Compliance som troverdighetssignal.
 */

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Lang } from '../marketing/types';
import { SOURCE_NOTE } from '@/lib/legal-copy';
import { fmtSyncTime } from '@/lib/marketing-format';

export function SourceNote({
  lang,
  asOfIso,
}: {
  lang: Lang;
  asOfIso?: string | null;
}) {
  const t = SOURCE_NOTE[lang];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popId = useId();

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  return (
    <span
      ref={rootRef}
      className="aq-srcnote"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        className="aq-srcnote-dagger"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={t.ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        †
      </button>
      <span
        id={popId}
        role="note"
        className="aq-srcnote-pop"
        data-open={open || undefined}
        hidden={!open}
      >
        <span className="aq-srcnote-line">{t.source}</span>
        <span className="aq-srcnote-line">{t.mode}</span>
        <span className="aq-srcnote-line">
          {t.fetchedPrefix} {fmtSyncTime(asOfIso)}
        </span>
        <span className="aq-srcnote-caveat">{t.caveat}</span>
        <span className="aq-srcnote-links">
          <Link href="/risikofaktorer">{t.riskLink}</Link>
          <Link href="/innsyn">{t.methodLink}</Link>
        </span>
      </span>
    </span>
  );
}
