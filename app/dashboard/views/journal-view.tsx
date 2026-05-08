'use client';

import { useEffect, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';

type JournalAction = 'BUY' | 'SELL' | 'HOLD' | 'WATCH' | 'NOTE';

interface JournalEntry {
  id: string;
  ticker: string | null;
  action: JournalAction | null;
  thesis: string | null;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const COPY = {
  no: {
    eye: 'MIN JOURNAL',
    title: 'Investerings-journal',
    sub: 'Logg hver beslutning: tese, hva du forventer, hva som vil få deg til å selge. Etter noen måneder ser du dine egne mønstre — og lærer mer av journalen enn av noe kurs.',
    newCta: 'Ny journal-oppføring',
    cancel: 'Avbryt',
    save: 'Lagre',
    saving: 'Lagrer…',
    delete: 'Slett',
    deleteConfirm: 'Er du sikker?',
    edit: 'Rediger',
    fieldTicker: 'Ticker (valgfri)',
    fieldAction: 'Handling',
    fieldThesis: 'Tese',
    fieldThesisPh: 'Hvorfor er denne aksjen interessant? Hva er kjernen i argumentet?',
    fieldOutcome: 'Forventet utfall / exit',
    fieldOutcomePh: 'Hva får deg til å selge? Stop-loss, target, eller endring i tese?',
    fieldNotes: 'Notater',
    fieldNotesPh: 'Frie tanker, observasjoner, lærdom.',
    actions: { BUY: 'KJØP', SELL: 'SELG', HOLD: 'HOLD', WATCH: 'OBSERVÉR', NOTE: 'NOTAT' },
    none: 'Ingen handling',
    empty: 'Ingen oppføringer ennå. Klikk «Ny journal-oppføring» for å starte.',
    loading: 'Laster journal…',
    error: 'Kunne ikke laste journal',
  },
  en: {
    eye: 'MY JOURNAL',
    title: 'Investment journal',
    sub: 'Log every decision: thesis, what you expect, what would make you sell. After a few months you see your own patterns — and learn more from the journal than any course.',
    newCta: 'New journal entry',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    delete: 'Delete',
    deleteConfirm: 'Are you sure?',
    edit: 'Edit',
    fieldTicker: 'Ticker (optional)',
    fieldAction: 'Action',
    fieldThesis: 'Thesis',
    fieldThesisPh: 'Why is this stock interesting? What is the core of the argument?',
    fieldOutcome: 'Expected outcome / exit',
    fieldOutcomePh: 'What would make you sell? Stop-loss, target, or change in thesis?',
    fieldNotes: 'Notes',
    fieldNotesPh: 'Free thoughts, observations, lessons.',
    actions: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', WATCH: 'WATCH', NOTE: 'NOTE' },
    none: 'No action',
    empty: 'No entries yet. Click "New journal entry" to start.',
    loading: 'Loading journal…',
    error: 'Could not load journal',
  },
  de: {
    eye: 'MEIN JOURNAL',
    title: 'Investment-Journal',
    sub: 'Jede Entscheidung protokollieren: These, Erwartung, was zum Verkauf führen würde. Nach einigen Monaten erkennen Sie Muster und lernen mehr als aus jedem Kurs.',
    newCta: 'Neuer Eintrag',
    cancel: 'Abbrechen',
    save: 'Speichern',
    saving: 'Speichere…',
    delete: 'Löschen',
    deleteConfirm: 'Sind Sie sicher?',
    edit: 'Bearbeiten',
    fieldTicker: 'Ticker (optional)',
    fieldAction: 'Aktion',
    fieldThesis: 'These',
    fieldThesisPh: 'Warum ist diese Aktie interessant? Was ist der Kern des Arguments?',
    fieldOutcome: 'Erwartetes Ergebnis / Exit',
    fieldOutcomePh: 'Was würde Sie zum Verkauf bewegen? Stop-Loss, Ziel, oder These-Änderung?',
    fieldNotes: 'Notizen',
    fieldNotesPh: 'Freie Gedanken, Beobachtungen, Lehren.',
    actions: { BUY: 'KAUFEN', SELL: 'VERKAUFEN', HOLD: 'HALTEN', WATCH: 'BEOBACHTEN', NOTE: 'NOTIZ' },
    none: 'Keine Aktion',
    empty: 'Noch keine Einträge. „Neuer Eintrag" klicken, um zu starten.',
    loading: 'Lade Journal…',
    error: 'Konnte Journal nicht laden',
  },
  es: {
    eye: 'MI DIARIO',
    title: 'Diario de inversión',
    sub: 'Registra cada decisión: tesis, expectativa, qué te haría vender. Tras unos meses verás patrones propios y aprenderás más que con cualquier curso.',
    newCta: 'Nueva entrada',
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando…',
    delete: 'Eliminar',
    deleteConfirm: '¿Estás seguro?',
    edit: 'Editar',
    fieldTicker: 'Ticker (opcional)',
    fieldAction: 'Acción',
    fieldThesis: 'Tesis',
    fieldThesisPh: '¿Por qué te interesa esta acción? ¿Cuál es el núcleo del argumento?',
    fieldOutcome: 'Resultado esperado / salida',
    fieldOutcomePh: '¿Qué te haría vender? Stop-loss, objetivo, o cambio de tesis?',
    fieldNotes: 'Notas',
    fieldNotesPh: 'Pensamientos libres, observaciones, lecciones.',
    actions: { BUY: 'COMPRAR', SELL: 'VENDER', HOLD: 'MANTENER', WATCH: 'OBSERVAR', NOTE: 'NOTA' },
    none: 'Sin acción',
    empty: 'Aún no hay entradas. Haz clic en "Nueva entrada" para empezar.',
    loading: 'Cargando diario…',
    error: 'No se pudo cargar el diario',
  },
  zh: {
    eye: '我的日志',
    title: '投资日志',
    sub: '记录每一个决定：论点、预期、卖出条件。几个月后你会看到自己的模式，比任何课程都学得多。',
    newCta: '新建日志',
    cancel: '取消',
    save: '保存',
    saving: '保存中…',
    delete: '删除',
    deleteConfirm: '确定吗？',
    edit: '编辑',
    fieldTicker: '代码（可选）',
    fieldAction: '操作',
    fieldThesis: '论点',
    fieldThesisPh: '为什么这只股票值得关注？核心论点是什么？',
    fieldOutcome: '预期结果 / 退出',
    fieldOutcomePh: '什么情况下你会卖出？止损、目标价或论点变化？',
    fieldNotes: '笔记',
    fieldNotesPh: '自由想法、观察、心得。',
    actions: { BUY: '买入', SELL: '卖出', HOLD: '持有', WATCH: '观察', NOTE: '笔记' },
    none: '无操作',
    empty: '暂无记录。点击"新建日志"开始。',
    loading: '加载中…',
    error: '加载日志失败',
  },
} as const;

interface FormState {
  ticker: string;
  action: JournalAction | '';
  thesis: string;
  outcome: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  ticker: '',
  action: '',
  thesis: '',
  outcome: '',
  notes: '',
};

export function JournalView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadEntries = async () => {
    try {
      const res = await fetch('/api/plus/journal', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setEntries(data.entries as JournalEntry[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'unknown');
      setEntries([]);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (e: JournalEntry) => {
    setEditingId(e.id);
    setForm({
      ticker: e.ticker ?? '',
      action: (e.action as JournalAction | null) ?? '',
      thesis: e.thesis ?? '',
      outcome: e.outcome ?? '',
      notes: e.notes ?? '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const body = {
        ticker: form.ticker.trim() || null,
        action: form.action || null,
        thesis: form.thesis.trim() || null,
        outcome: form.outcome.trim() || null,
        notes: form.notes.trim() || null,
      };
      const url = editingId ? `/api/plus/journal/${editingId}` : '/api/plus/journal';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await loadEntries();
      closeForm();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'unknown');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/plus/journal/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadEntries();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'unknown');
    }
  };

  return (
    <div className="aqp-content">
      <div className="aqp-page-head">
        <div className="m-eyebrow">
          <span className="m-badge-dot" />
          {t.eye}
        </div>
        <h1 className="aqp-page-title">{t.title}</h1>
        <p className="aqp-page-sub">{t.sub}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button type="button" className="btn-primary-v8 btn-sm" onClick={openNew}>
          + {t.newCta}
        </button>
      </div>

      {formOpen && (
        <form className="aqp-journal-form" onSubmit={handleSubmit}>
          <div className="aqp-journal-row">
            <label className="aqp-field" style={{ flex: 1 }}>
              <span className="aqp-field-label">{t.fieldTicker}</span>
              <input
                type="text"
                className="aqp-input"
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                maxLength={32}
                placeholder="NVDA, EQNR.OL, ..."
              />
            </label>
            <label className="aqp-field" style={{ width: 200 }}>
              <span className="aqp-field-label">{t.fieldAction}</span>
              <select
                className="aqp-input"
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as JournalAction | '' }))}
              >
                <option value="">{t.none}</option>
                {(['BUY', 'SELL', 'HOLD', 'WATCH', 'NOTE'] as JournalAction[]).map((a) => (
                  <option key={a} value={a}>
                    {t.actions[a]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="aqp-field">
            <span className="aqp-field-label">{t.fieldThesis}</span>
            <textarea
              className="aqp-textarea"
              value={form.thesis}
              onChange={(e) => setForm((f) => ({ ...f, thesis: e.target.value }))}
              placeholder={t.fieldThesisPh}
              rows={4}
              maxLength={4000}
            />
          </label>

          <label className="aqp-field">
            <span className="aqp-field-label">{t.fieldOutcome}</span>
            <textarea
              className="aqp-textarea"
              value={form.outcome}
              onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
              placeholder={t.fieldOutcomePh}
              rows={3}
              maxLength={4000}
            />
          </label>

          <label className="aqp-field">
            <span className="aqp-field-label">{t.fieldNotes}</span>
            <textarea
              className="aqp-textarea"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder={t.fieldNotesPh}
              rows={4}
              maxLength={8000}
            />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn-primary-v8 btn-sm" disabled={saving}>
              {saving ? t.saving : t.save}
            </button>
            <button type="button" className="btn-ghost-v8 btn-sm" onClick={closeForm}>
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      {loadError ? (
        <div className="aqp-empty">{t.error}: {loadError}</div>
      ) : entries === null ? (
        <div className="aqp-empty">{t.loading}</div>
      ) : entries.length === 0 ? (
        <div className="aqp-empty-card">
          <div className="aqp-empty-title">{t.empty}</div>
        </div>
      ) : (
        <div className="aqp-journal-stack">
          {entries.map((e) => (
            <article key={e.id} className="aqp-journal-card">
              <header className="aqp-journal-head">
                <div className="aqp-journal-meta">
                  {e.ticker && <span className="aqp-journal-ticker">{e.ticker}</span>}
                  {e.action && (
                    <span className={`aqp-action-pill aqp-action-pill--${e.action.toLowerCase() === 'note' ? 'watch' : e.action.toLowerCase()}`}>
                      {t.actions[e.action]}
                    </span>
                  )}
                  <span className="aqp-journal-date">
                    {new Date(e.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="aqp-owned-toggle" onClick={() => openEdit(e)}>
                    {t.edit}
                  </button>
                  <button type="button" className="aqp-owned-toggle" onClick={() => handleDelete(e.id)}>
                    {t.delete}
                  </button>
                </div>
              </header>

              {e.thesis && (
                <div className="aqp-journal-section">
                  <div className="aqp-journal-label">{t.fieldThesis}</div>
                  <p className="aqp-journal-body">{e.thesis}</p>
                </div>
              )}
              {e.outcome && (
                <div className="aqp-journal-section">
                  <div className="aqp-journal-label">{t.fieldOutcome}</div>
                  <p className="aqp-journal-body">{e.outcome}</p>
                </div>
              )}
              {e.notes && (
                <div className="aqp-journal-section">
                  <div className="aqp-journal-label">{t.fieldNotes}</div>
                  <p className="aqp-journal-body">{e.notes}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
