import { createAdminClient } from '@/utils/supabase/admin';
import type { PlusRegion } from './blueprints/plus';

export type PlusAction = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
export type PlusHorizon = 'short' | 'medium' | 'long';
export type ScanStatus = 'running' | 'success' | 'failed';
export type JournalAction = 'BUY' | 'SELL' | 'HOLD' | 'WATCH' | 'NOTE';

export interface PlusScanRow {
  id: string;
  generated_at: string;
  status: ScanStatus;
  scan_summary: string | null;
  scan_summary_en: string | null;
  signal_count: number;
  duration_ms: number | null;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  num_sources_used: number | null;
}

export interface PlusSignalRow {
  id: string;
  scan_id: string;
  ticker: string;
  region: PlusRegion;
  action: PlusAction;
  confidence: number;
  time_horizon: PlusHorizon;
  reasoning: string;
  reasoning_en: string | null;
  catalysts: string[];
  catalysts_en: string[] | null;
  risks: string[];
  risks_en: string[] | null;
  peer_comparison: string | null;
  peer_comparison_en: string | null;
  insider_signal: string | null;
  insider_signal_en: string | null;
  price_at_signal: number | null;
  price_currency: string | null;
  created_at: string;
}

export interface PlusReportRow {
  id: string;
  report_date: string;
  title: string;
  title_en: string | null;
  body: string;
  body_en: string | null;
  published_at: string;
}

export interface PlusJournalRow {
  id: string;
  clerk_user_id: string;
  ticker: string | null;
  action: JournalAction | null;
  thesis: string | null;
  outcome: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Insert a new scan row in `running` state and return its ID. */
export async function startScan(): Promise<string> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('plus_scans')
    .insert({ status: 'running' })
    .select('id')
    .single();
  if (error) throw new Error(`startScan: ${error.message}`);
  return (data as { id: string }).id;
}

export interface SignalInsert {
  ticker: string;
  region: PlusRegion;
  action: PlusAction;
  confidence: number;
  time_horizon: PlusHorizon;
  reasoning: string;
  reasoning_en?: string | null;
  catalysts: string[];
  catalysts_en?: string[] | null;
  risks: string[];
  risks_en?: string[] | null;
  peer_comparison?: string | null;
  peer_comparison_en?: string | null;
  insider_signal?: string | null;
  insider_signal_en?: string | null;
  price_at_signal?: number | null;
  price_currency?: string | null;
}

export async function finishScanSuccess(
  scanId: string,
  args: {
    scanSummary: string;
    scanSummaryEn?: string | null;
    signals: SignalInsert[];
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
    numSourcesUsed?: number;
  },
): Promise<void> {
  const sb = createAdminClient();

  if (args.signals.length > 0) {
    const rows = args.signals.map((s) => ({ ...s, scan_id: scanId }));
    const { error: insertErr } = await sb.from('plus_signals').insert(rows);
    if (insertErr) throw new Error(`insert signals: ${insertErr.message}`);
  }

  const { error } = await sb
    .from('plus_scans')
    .update({
      status: 'success',
      scan_summary: args.scanSummary,
      scan_summary_en: args.scanSummaryEn ?? null,
      signal_count: args.signals.length,
      duration_ms: args.durationMs,
      prompt_tokens: args.promptTokens ?? null,
      completion_tokens: args.completionTokens ?? null,
      num_sources_used: args.numSourcesUsed ?? null,
    })
    .eq('id', scanId);
  if (error) throw new Error(`finishScanSuccess: ${error.message}`);
}

export async function finishScanFailed(scanId: string, errorMessage: string, durationMs: number): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from('plus_scans')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 1000),
      duration_ms: durationMs,
    })
    .eq('id', scanId);
  if (error) throw new Error(`finishScanFailed: ${error.message}`);
}

/**
 * Latest successful scan + its signals. Used by /api/plus/signals/today.
 * Returns null when no successful scan exists yet — UI falls back to seed data.
 */
export async function getLatestScan(): Promise<{ scan: PlusScanRow; signals: PlusSignalRow[] } | null> {
  const sb = createAdminClient();
  const { data: scan, error: scanErr } = await sb
    .from('plus_scans')
    .select('*')
    .eq('status', 'success')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (scanErr) throw new Error(`getLatestScan: ${scanErr.message}`);
  if (!scan) return null;

  const { data: signals, error: sigErr } = await sb
    .from('plus_signals')
    .select('*')
    .eq('scan_id', (scan as PlusScanRow).id)
    .order('confidence', { ascending: false });
  if (sigErr) throw new Error(`getLatestSignals: ${sigErr.message}`);

  return {
    scan: scan as PlusScanRow,
    signals: ((signals ?? []) as PlusSignalRow[]),
  };
}

/**
 * Returns recent priced signals (those with `price_at_signal` populated)
 * for track-record computation. Used by `/api/plus/track-record`.
 */
export async function listPricedSignalsSince(daysBack = 30): Promise<PlusSignalRow[]> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('plus_signals')
    .select('*')
    .not('price_at_signal', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listPricedSignalsSince: ${error.message}`);
  return ((data ?? []) as PlusSignalRow[]);
}

/** Most recent published report. */
export async function getLatestReport(): Promise<PlusReportRow | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('plus_reports')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestReport: ${error.message}`);
  return (data as PlusReportRow) ?? null;
}

export async function listReports(limit = 8): Promise<PlusReportRow[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('plus_reports')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listReports: ${error.message}`);
  return (data ?? []) as PlusReportRow[];
}

export async function insertReport(report: {
  reportDate: string;
  title: string;
  titleEn?: string | null;
  body: string;
  bodyEn?: string | null;
  promptTokens?: number;
  completionTokens?: number;
}): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from('plus_reports').upsert(
    {
      report_date: report.reportDate,
      title: report.title,
      title_en: report.titleEn ?? null,
      body: report.body,
      body_en: report.bodyEn ?? null,
      prompt_tokens: report.promptTokens ?? null,
      completion_tokens: report.completionTokens ?? null,
    },
    { onConflict: 'report_date' },
  );
  if (error) throw new Error(`insertReport: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function listJournalEntries(clerkUserId: string): Promise<PlusJournalRow[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('plus_journal_entries')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listJournalEntries: ${error.message}`);
  return (data ?? []) as PlusJournalRow[];
}

export interface JournalEntryInput {
  ticker?: string | null;
  action?: JournalAction | null;
  thesis?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

export async function insertJournalEntry(
  clerkUserId: string,
  entry: JournalEntryInput,
): Promise<PlusJournalRow> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('plus_journal_entries')
    .insert({
      clerk_user_id: clerkUserId,
      ticker: entry.ticker ?? null,
      action: entry.action ?? null,
      thesis: entry.thesis ?? null,
      outcome: entry.outcome ?? null,
      notes: entry.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(`insertJournalEntry: ${error.message}`);
  return data as PlusJournalRow;
}

export async function updateJournalEntry(
  clerkUserId: string,
  id: string,
  patch: JournalEntryInput,
): Promise<PlusJournalRow> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('plus_journal_entries')
    .update(patch)
    .eq('id', id)
    .eq('clerk_user_id', clerkUserId) // ownership check
    .select('*')
    .single();
  if (error) throw new Error(`updateJournalEntry: ${error.message}`);
  return data as PlusJournalRow;
}

export async function deleteJournalEntry(clerkUserId: string, id: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from('plus_journal_entries')
    .delete()
    .eq('id', id)
    .eq('clerk_user_id', clerkUserId); // ownership check
  if (error) throw new Error(`deleteJournalEntry: ${error.message}`);
}
