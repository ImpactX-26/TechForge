import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api';
import type { Goal, Profile } from '../../types';

const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: 'STUDY', label: 'Study', desc: "Bachelor's or Master's at a German university" },
  { value: 'VOCATIONAL', label: 'Vocational training', desc: 'Ausbildung with a German employer' },
  { value: 'EMPLOYMENT', label: 'Employment', desc: 'Skilled work in Germany' },
];

const STATUS_TEXT: Record<string, string> = {
  IN_PROGRESS: 'In progress (not submitted)',
  SUBMITTED: 'Submitted, awaiting review',
  SHORTLISTED: 'Shortlisted',
  SELECTED: 'Selected',
  REJECTED: 'Not selected',
};

export default function Overview() {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get<Profile>('/applicant/me')
      .then(setP)
      .catch((e) => setErr(errorMessage(e)));

  useEffect(() => {
    load();
  }, []);

  async function chooseGoal(goal: Goal) {
    setErr('');
    try {
      setP(await api.put<Profile>('/applicant/me/goal', { goal }));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function submit() {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      await api.post('/qualification/submit');
      await load();
      setMsg('Your application has been submitted. See the Result page for your outcome.');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!p) return <div className="container">{err ? <div className="error">{err}</div> : 'Loading…'}</div>;
  const percent = p.completeness?.percent ?? 0;

  return (
    <>
      <h1>Your journey</h1>
      {err && <div className="error">{err}</div>}
      {msg && <div className="notice">{msg}</div>}

      <div className="card">
        <h2>1. What is your goal?</h2>
        <div className="grid">
          {GOALS.map((g) => (
            <button
              key={g.value}
              className={p.goal === g.value ? 'btn' : 'btn secondary'}
              style={{ textAlign: 'left' }}
              onClick={() => chooseGoal(g.value)}
            >
              <strong>{g.label}</strong>
              <br />
              <span style={{ fontSize: '.8rem', opacity: 0.85 }}>{g.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row spread">
          <h2>2. Profile completeness</h2>
          <span className="badge">{STATUS_TEXT[p.status]}</span>
        </div>
        <div className="progress"><div style={{ width: `${percent}%` }} /></div>
        <p className="muted">{percent}% complete</p>
        {p.completeness && p.completeness.missing.length > 0 && (
          <>
            <p className="muted">Still missing:</p>
            <ul>{p.completeness.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </>
        )}
      </div>

      <div className="grid">
        <div className="card"><h3>Chat with the assistant</h3><p className="muted">Answer a few questions.</p><Link className="btn small" to="/app/chat">Open</Link></div>
        <div className="card"><h3>Upload documents</h3><p className="muted">Degrees, certificates, ID photo.</p><Link className="btn small" to="/app/documents">Open</Link></div>
        <div className="card"><h3>Intro video</h3><p className="muted">Motivation plus identity check.</p><Link className="btn small" to="/app/video">Open</Link></div>
        <div className="card"><h3>Review profile</h3><p className="muted">Check what we stored.</p><Link className="btn small" to="/app/profile">Open</Link></div>
      </div>

      <div className="card">
        <h2>3. Submit for assessment</h2>
        <p className="muted">
          Submitting runs the eligibility check and makes your application visible to the Educaro team. You can
          keep improving your profile and re-run the check afterwards.
        </p>
        <button className="btn" onClick={submit} disabled={busy || !p.goal}>
          {busy ? 'Assessing…' : p.status === 'IN_PROGRESS' ? 'Submit application' : 'Re-run assessment'}
        </button>
        {!p.goal && <p className="muted">Choose a goal first.</p>}
      </div>
    </>
  );
}
