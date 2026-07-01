'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

/**
 * /kontakt — article-tone uten kart og illustrasjoner (§9): venstre
 * kontaktinfo med kopier-knapp («KOPIERT» i 1,5 s, ingen toast), høyre
 * et enkelt skjema med ink-deep-felt, 1px hairline og fokusring.
 * Skjemaet komponerer en mailto — ingen ny backend.
 */

const EMAIL = 'post@apex-quantum.com';

const COPY = {
  no: {
    eye: 'Kontakt',
    titlePre: 'Skriv til oss. ',
    titleEm: 'Vi svarer selv',
    titlePost: '.',
    lede: 'Vi svarer typisk innen 24 timer på hverdager. Tydelig emnefelt hjelper oss å kanalisere tekniske spørsmål, fakturering og presse riktig.',
    emailKey: 'E-post',
    copy: 'Kopier',
    copied: 'KOPIERT',
    orgKey: 'Selskap',
    orgVal: 'Apex Quantum AS · Org.nr 921 269 962 · Norge',
    pressKey: 'Presse og partnerskap',
    pressVal: 'Merk emnefeltet med «Presse» eller «Partnerskap», så setter vi opp en samtale innen kort tid.',
    formKey: 'Send en melding',
    fName: 'Navn',
    fEmail: 'Din e-post',
    fSubject: 'Emne',
    fBody: 'Melding',
    submit: 'Åpne i e-postklient',
    formNote: 'Knappen åpner e-postklienten din med meldingen ferdig utfylt — vi lagrer ingenting fra dette skjemaet.',
  },
  en: {
    eye: 'Contact',
    titlePre: 'Write to us. ',
    titleEm: 'We answer ourselves',
    titlePost: '.',
    lede: 'We typically respond within 24 hours on weekdays. A clear subject line helps us route technical questions, billing and press correctly.',
    emailKey: 'Email',
    copy: 'Copy',
    copied: 'COPIED',
    orgKey: 'Company',
    orgVal: 'Apex Quantum AS · Org. no 921 269 962 · Norway',
    pressKey: 'Press and partnerships',
    pressVal: 'Mark the subject with "Press" or "Partnership" and we will set up a call shortly.',
    formKey: 'Send a message',
    fName: 'Name',
    fEmail: 'Your email',
    fSubject: 'Subject',
    fBody: 'Message',
    submit: 'Open in email client',
    formNote: 'The button opens your email client with the message pre-filled — nothing from this form is stored by us.',
  },
} as const;

function CopyEmail({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard utilgjengelig — mailto-lenken står ved siden av */
    }
  };

  return (
    <div className="pg-email-row">
      <a href={`mailto:${EMAIL}`} className="pg-email">{EMAIL}</a>
      <button
        type="button"
        className="pg-copybtn"
        onClick={() => void onCopy()}
        data-copied={copied || undefined}
        aria-live="polite"
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}

function ContactForm({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const fullBody = `${body}\n\n— ${name}${from ? ` (${from})` : ''}`;
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
    window.location.href = href;
  };

  return (
    <form className="pg-form" onSubmit={onSubmit}>
      <div className="pg-field">
        <label htmlFor="k-name">{t.fName}</label>
        <input
          id="k-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="pg-field">
        <label htmlFor="k-email">{t.fEmail}</label>
        <input
          id="k-email"
          type="email"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="pg-field">
        <label htmlFor="k-subject">{t.fSubject}</label>
        <input
          id="k-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div className="pg-field">
        <label htmlFor="k-body">{t.fBody}</label>
        <textarea
          id="k-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
      </div>
      <div>
        <button type="submit" className="btn btn-gold">{t.submit}</button>
      </div>
      <p className="pg-mononote" style={{ letterSpacing: '0.08em', textTransform: 'none' }}>
        {t.formNote}
      </p>
    </form>
  );
}

export default function KontaktPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        return (
          <>
            <section className="pg-hero">
              <div className="container">
                <span className="eyebrow"><span className="rule" />{t.eye}</span>
                <h1>
                  {t.titlePre}<em>{t.titleEm}</em>{t.titlePost}
                </h1>
                <p className="pg-sub" style={{ fontSize: 16.5 }}>{t.lede}</p>
              </div>
            </section>

            <section className="pg-section" style={{ paddingTop: 0 }}>
              <div className="container">
                <div className="pg-contact-grid">
                  <div>
                    <div className="pg-contact-block">
                      <span className="pg-contact-key">{t.emailKey}</span>
                      <CopyEmail lang={lang} />
                    </div>
                    <div className="pg-contact-block">
                      <span className="pg-contact-key">{t.orgKey}</span>
                      <p className="pg-contact-val">{t.orgVal}</p>
                    </div>
                    <div className="pg-contact-block">
                      <span className="pg-contact-key">{t.pressKey}</span>
                      <p className="pg-contact-val">{t.pressVal}</p>
                    </div>
                  </div>
                  <div>
                    <span className="pg-contact-key">{t.formKey}</span>
                    <div style={{ marginTop: 16 }}>
                      <ContactForm lang={lang} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        );
      }}
    </PageShell>
  );
}
