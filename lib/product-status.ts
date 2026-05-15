// Product availability flags for Apex Quantum.
//
// Apex Quantum + is fully built and usable, but NEW sales are paused until
// the regulatory licence is in place — see LEGAL_REVIEW.md (Finanstilsynet-
// konsesjon and MAR are still unresolved). Existing subscribers are NOT
// affected: their access is gated by hasPlusAccess() in lib/access.ts and
// keeps working regardless of this flag.
//
// To re-open Plus sales once the licence is granted, flip PLUS_FOR_SALE to
// true. That single change re-enables the /api/plus/checkout route and
// restores every marketing CTA — no other edits required.
export const PLUS_FOR_SALE: boolean = false;

/** Bilingual labels shown on Plus marketing surfaces while sales are paused. */
export const PLUS_DEV_LABELS = {
  no: { tag: 'UNDER UTVIKLING', cta: 'Kommer snart' },
  en: { tag: 'IN DEVELOPMENT', cta: 'Coming soon' },
} as const;
