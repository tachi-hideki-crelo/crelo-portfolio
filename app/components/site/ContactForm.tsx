'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type TurnstileOptions = {
  sitekey: string;
  action: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

type FormState = 'idle' | 'pending' | 'success' | 'error';
type Fields = { name: string; company: string; email: string; inquiryType: string; message: string; consent: boolean; honeypot: string };
type FieldKey = 'name' | 'company' | 'email' | 'message' | 'consent';
type TurnstileStatus = 'disabled' | 'loading' | 'ready' | 'error';
type ValidationError = { field: FieldKey; message: string };

const initialFields: Fields = { name: '', company: '', email: '', inquiryType: 'ai-workflow', message: '', consent: false, honeypot: '' };

function validate(fields: Fields): ValidationError | null {
  if (!fields.name.trim() || fields.name.trim().length > 80) return { field: 'name', message: 'お名前を入力してください。' };
  if (!fields.company.trim() || fields.company.trim().length > 120) return { field: 'company', message: '会社名を入力してください。' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) return { field: 'email', message: 'メールアドレスをご確認ください。' };
  if (!fields.message.trim() || fields.message.trim().length > 4000) return { field: 'message', message: 'ご相談内容を入力してください（4,000文字以内）。' };
  if (!fields.consent) return { field: 'consent', message: 'Privacy noticeへの同意が必要です。' };
  return null;
}

export default function ContactForm({ publicBuild }: { publicBuild: boolean }) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [fields, setFields] = useState(initialFields);
  const [formState, setFormState] = useState<FormState>('idle');
  const [notice, setNotice] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>(publicBuild && turnstileSiteKey ? 'loading' : 'disabled');
  const [invalidField, setInvalidField] = useState<FieldKey | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const requestIdRef = useRef('');

  useEffect(() => {
    if (!publicBuild || !turnstileSiteKey || !turnstileRef.current) return;
    let active = true;
    const fail = () => {
      if (!active) return;
      setTurnstileStatus('error');
      setTurnstileToken('');
      setNotice('認証サービスを読み込めません。時間をおいてもう一度お試しください。');
    };
    const renderWidget = () => {
      if (!active || !turnstileRef.current || !window.turnstile || widgetIdRef.current) return;
      try {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          action: 'contact',
          callback: (token) => {
            if (active) {
              setTurnstileToken(token);
              setTurnstileStatus('ready');
            }
          },
          'expired-callback': () => {
            if (active) setTurnstileToken('');
          },
          'error-callback': fail,
        });
        setTurnstileStatus('ready');
      } catch {
        fail();
      }
    };
    if (window.turnstile) {
      renderWidget();
      return () => {
        active = false;
      };
    }
    const scriptId = 'crelo-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const handleLoad = () => {
      if (!window.turnstile) {
        fail();
        return;
      }
      renderWidget();
      if (!widgetIdRef.current) fail();
    };
    const handleError = () => fail();
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    const timeoutId = window.setTimeout(() => {
      if (!window.turnstile || !widgetIdRef.current) fail();
    }, 10000);
    return () => {
      active = false;
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
      window.clearTimeout(timeoutId);
    };
  }, [publicBuild, turnstileSiteKey]);

  const fieldIds: Record<FieldKey, string> = {
    name: 'contact-name',
    company: 'contact-company',
    email: 'contact-email',
    message: 'contact-message',
    consent: 'contact-consent',
  };
  const focusField = (field: FieldKey) => {
    window.requestAnimationFrame(() => document.getElementById(fieldIds[field])?.focus());
  };
  const update = (key: keyof Fields, value: string | boolean) => {
    setInvalidField(null);
    setFields((current) => ({ ...current, [key]: value }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formState === 'pending') return;
    setNotice('');
    setInvalidField(null);
    const validationError = validate(fields);
    if (validationError) {
      setFormState('error');
      setInvalidField(validationError.field);
      setNotice(validationError.message);
      focusField(validationError.field);
      return;
    }
    if (!publicBuild || !turnstileSiteKey) {
      setFormState('error');
      setNotice('Preview modeでは送信を停止しています。公開用の認証設定後に利用できます。');
      return;
    }
    if (turnstileStatus === 'loading') {
      setFormState('error');
      setNotice('認証サービスを読み込んでいます。少し待ってからお試しください。');
      return;
    }
    if (turnstileStatus === 'error') {
      setFormState('error');
      setNotice('認証サービスを読み込めません。時間をおいてもう一度お試しください。');
      return;
    }
    if (!turnstileToken) {
      setFormState('error');
      setNotice('送信前に認証チェックを完了してください。');
      return;
    }
    if (!requestIdRef.current) requestIdRef.current = window.crypto.randomUUID();
    setFormState('pending');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...fields, requestId: requestIdRef.current, turnstileToken }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; errorCode?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.errorCode || 'REQUEST_FAILED');
      setFormState('success');
      setNotice('お問い合わせを受け付けました。確認のうえご連絡します。');
      setFields(initialFields);
      setTurnstileToken('');
      requestIdRef.current = '';
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
    } catch {
      setFormState('error');
      setNotice('送信に失敗しました。時間をおいてもう一度お試しください。');
      setTurnstileToken('');
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
    }
  };

  return (
    <form className="contact-form" onSubmit={submit} noValidate aria-busy={formState === 'pending'}>
      <div className="contact-form__grid">
        <label><span>NAME <b aria-hidden="true">*</b></span><input id="contact-name" name="name" value={fields.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" required aria-describedby="contact-form-notice" aria-invalid={invalidField === 'name'} /></label>
        <label><span>COMPANY <b aria-hidden="true">*</b></span><input id="contact-company" name="company" value={fields.company} onChange={(event) => update('company', event.target.value)} autoComplete="organization" required aria-describedby="contact-form-notice" aria-invalid={invalidField === 'company'} /></label>
        <label><span>EMAIL <b aria-hidden="true">*</b></span><input id="contact-email" type="email" name="email" value={fields.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" required aria-describedby="contact-form-notice" aria-invalid={invalidField === 'email'} /></label>
        <label><span>相談種別</span><select id="contact-inquiry-type" name="inquiryType" value={fields.inquiryType} onChange={(event) => update('inquiryType', event.target.value)} aria-describedby="contact-form-notice"><option value="ai-workflow">AI活用・業務設計</option><option value="project">プロダクト開発</option><option value="software-delivery">現場導入・連携</option><option value="other">その他</option></select></label>
      </div>
      <label className="contact-form__message"><span>MESSAGE <b aria-hidden="true">*</b></span><textarea id="contact-message" name="message" value={fields.message} onChange={(event) => update('message', event.target.value)} placeholder="いま見えている課題、理想の状態、相談したいことなど。" rows={6} maxLength={4000} required aria-describedby="contact-form-notice" aria-invalid={invalidField === 'message'} /></label>
      <label className="contact-form__honeypot" aria-hidden="true"><span>WEBSITE</span><input tabIndex={-1} autoComplete="off" name="honeypot" value={fields.honeypot} onChange={(event) => update('honeypot', event.target.value)} /></label>
      <label className="contact-form__consent"><input id="contact-consent" type="checkbox" name="consent" checked={fields.consent} onChange={(event) => update('consent', event.target.checked)} aria-describedby="contact-form-notice" aria-invalid={invalidField === 'consent'} /><span><a href="/privacy">Privacy notice</a>を確認し、相談内容の取り扱いに同意します。<b aria-hidden="true">*</b></span></label>
      <div ref={turnstileRef} className="turnstile-widget" aria-label="Turnstile verification" />
      <div className="contact-form__actions"><button className="button button--solid" type="submit" disabled={formState === 'pending'}>{formState === 'pending' ? 'Sending…' : '相談を送る'} <span aria-hidden="true">↗</span></button><span className="contact-form__hint">{!publicBuild || !turnstileSiteKey ? 'PREVIEW GATE / TURNSTILE REQUIRED' : turnstileStatus === 'error' ? 'TURNSTILE / LOAD ERROR' : 'SECURE FORM / TURNSTILE'}</span></div>
      <p id="contact-form-notice" className={`form-notice form-notice--${formState}`} role={formState === 'error' ? 'alert' : 'status'} aria-live="polite">{notice}</p>
    </form>
  );
}
