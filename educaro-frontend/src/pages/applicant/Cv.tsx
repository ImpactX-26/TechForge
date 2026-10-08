import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api';
import type { Profile } from '../../types';

export default function Cv() {
  const [p, setP] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<Profile>('/applicant/me')
      .then((x) => {
        setP(x);
        setSummary(x.cvSummary);
      })
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  async function regenerate() {
    setErr('');
    setBusy('summary');
    try {
      const r = await api.post<{ cvSummary: string | null }>('/cv/summary');
      setSummary(r.cvSummary);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  async function download() {
    setErr('');
    setBusy('pdf');
    try {
      await api.download('/cv/download', 'cv.pdf');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  const empty = p && p.education.length + p.employment.length + p.skills.length === 0;

  return (
    <>
      <h1>Your CV</h1>
      <p className="muted">
        The CV is generated only from your stored profile. Each entry is tagged Verified, Self-reported, From
        document or From video. Only the short summary is AI-written, and it is labelled as such.
      </p>
      {err && <div className="error">{err}</div>}
      {empty && <div className="warn">Add education, experience or skills first. Your CV would be empty.</div>}

      <div className="card">
        <div className="row spread">
          <h2>Profile summary</h2>
          <span className="badge ai">AI-generated</span>
        </div>
        <p>{summary || <span className="muted">No summary yet.</span>}</p>
        <button className="btn secondary small" onClick={regenerate} disabled={busy !== '' || !!empty}>
          {busy === 'summary' ? 'Writing…' : summary ? 'Regenerate summary' : 'Generate summary'}
        </button>
      </div>

      <button className="btn" onClick={download} disabled={busy !== ''}>
        {busy === 'pdf' ? 'Preparing…' : 'Download CV (PDF)'}
      </button>
    </>
  );
}
