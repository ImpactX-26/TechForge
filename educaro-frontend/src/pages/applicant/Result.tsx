import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api';
import type { Outcome, Profile, Qualification, Recommendation } from '../../types';

const OUTCOME: Record<Outcome, { cls: string; label: string }> = {
  ELIGIBLE: { cls: 'ok', label: 'Eligible' },
  CONDITIONALLY_ELIGIBLE: { cls: 'warn', label: 'Conditionally eligible' },
  NOT_YET_ELIGIBLE: { cls: 'bad', label: 'Not yet eligible' },
  INSUFFICIENT_INFO: { cls: '', label: 'More information needed' },
};

export default function Result() {
  const [q, setQ] = useState<Qualification | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<Profile>('/applicant/me')
      .then((p) => {
        setQ(p.qualification);
        setRec(p.recommendation);
        setStatus(p.status);
      })
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  async function run() {
    setErr('');
    setBusy(true);
    try {
      const r = await api.post<{ qualification: Qualification; recommendation: Recommendation }>('/qualification/run');
      setQ(r.qualification);
      setRec(r.recommendation);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const unlocked = status === 'SELECTED' || q?.outcome === 'ELIGIBLE' || q?.outcome === 'CONDITIONALLY_ELIGIBLE';

  return (
    <>
      <h1>Qualification result</h1>
      {err && <div className="error">{err}</div>}
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? 'Assessing…' : q ? 'Re-run assessment' : 'Run assessment'}
      </button>

      {!q && <p className="muted" style={{ marginTop: '1rem' }}>No assessment yet.</p>}

      {q && (
        <>
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="row spread">
              <h2>{q.pathwayLabel ?? 'Assessment'}</h2>
              <span className={`badge ${OUTCOME[q.outcome].cls}`}>{OUTCOME[q.outcome].label}</span>
            </div>
            <p>{q.summary}</p>
            <div className="progress"><div style={{ width: `${q.completenessPercent}%` }} /></div>
            <p className="muted">
              Profile {q.completenessPercent}% complete · rules {q.rulesVersion} · assessed {new Date(q.assessedAt).toLocaleString()}
            </p>
            <p className="muted">
              This is an automated pre-check using Educaro's current criteria. It is not an official decision.
            </p>
          </div>

          {q.requirements.length > 0 && (
            <div className="card">
              <h2>Requirements</h2>
              {q.requirements.map((r) => (
                <div className="req" key={r.code}>
                  <span style={{ color: r.met ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{r.met ? '✓' : '✗'}</span>
                  <div>
                    <strong>{r.label}</strong> <span className="badge">{r.kind === 'HARD' ? 'core' : 'verification'}</span>
                    {r.detail && <div className="muted">{r.detail}</div>}
                    {!r.met && r.action && <div className="muted">To do: {r.action}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {q.issues.length > 0 && (
            <div className="card">
              <h2>Please clarify</h2>
              {q.issues.map((i, n) => (
                <div className={i.severity === 'ERROR' ? 'error' : 'warn'} key={n}>{i.message}</div>
              ))}
            </div>
          )}
        </>
      )}

      {rec && (
        <div className="card">
          <div className="row spread">
            <h2>Recommended next step</h2>
            {rec.consultantReferral && <span className="badge document">Consultant referral</span>}
          </div>
          <h3>{rec.title}</h3>
          <p>{rec.reason}</p>
          {rec.actions.length > 0 && <ul>{rec.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
        </div>
      )}

      {unlocked && (
        <div className="notice">
          Your Germany guide is available. <Link to="/app/guide">Open it</Link>.
        </div>
      )}
    </>
  );
}
