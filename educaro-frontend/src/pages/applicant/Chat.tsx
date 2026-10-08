import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api';
import type { ChatMsg } from '../../types';

export default function Chat() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState<{ percent: number; missing: string[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<ChatMsg[]>('/agent/messages')
      .then(setMsgs)
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    setErr('');
    setBusy(true);
    setMsgs((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: t, createdAt: new Date().toISOString() }]);
    try {
      const r = await api.post<{ reply: string; completenessPercent: number; stillMissing: string[] }>(
        '/agent/chat',
        { message: t },
      );
      setMsgs((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: 'assistant', content: r.reply, createdAt: new Date().toISOString() },
      ]);
      setProgress({ percent: r.completenessPercent, missing: r.stillMissing });
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Assistant</h1>
      <p className="muted">
        The assistant saves only what you explicitly tell it. You can review and edit everything on the Profile page.
      </p>
      {progress && (
        <div className="card">
          <div className="progress"><div style={{ width: `${progress.percent}%` }} /></div>
          <p className="muted">Profile {progress.percent}% complete</p>
        </div>
      )}
      <div className="chat">
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
        {busy && <div className="bubble assistant muted">Thinking…</div>}
        <div ref={endRef} />
      </div>
      {err && <div className="error">{err}</div>}
      <form className="row" style={{ marginTop: '.75rem' }} onSubmit={send}>
        <input
          style={{ flex: 1 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your answer…"
          maxLength={2000}
        />
        <button className="btn" disabled={busy || !text.trim()}>Send</button>
      </form>
    </>
  );
}
