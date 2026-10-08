import { useEffect, useState } from 'react';
import { api, ApiError, errorMessage } from '../../api';
import type { Guide as GuideType } from '../../types';

export default function Guide() {
  const [g, setG] = useState<GuideType | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api
      .get<GuideType>('/guide')
      .then(setG)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 404)) setErr(errorMessage(e));
      });
  }, []);

  async function generate() {
    setErr('');
    setBusy(true);
    try {
      setG(await api.post<GuideType>('/guide/generate'));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Your move to Germany</h1>
      <p className="muted">
        Unlocked when you are eligible or have been selected by Educaro. Run your assessment first if this is locked.
      </p>
      {err && <div className="error">{err}</div>}
      <button className="btn" onClick={generate} disabled={busy}>
        {busy ? 'Preparing…' : g ? 'Refresh guide' : 'Generate my guide'}
      </button>

      {g && (
        <div style={{ marginTop: '1rem' }}>
          <div className="warn">{g.disclaimer}</div>

          <div className="card">
            <h2>{g.pathwayTitle}</h2>
            <h3>{g.visa.name}</h3>
            <p>{g.visa.summary}</p>
          </div>

          {g.personalNotes.length > 0 && (
            <div className="card">
              <div className="row spread">
                <h2>Notes for you</h2>
                <span className="badge ai">AI-generated</span>
              </div>
              <ul>{g.personalNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}

          <div className="card">
            <h2>Step-by-step timeline</h2>
            <ol>
              {g.steps.map((s) => (
                <li key={s.title} style={{ marginBottom: '.5rem' }}>
                  <strong>{s.title}</strong>
                  <div className="muted">{s.detail}</div>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid">
            <div className="card">
              <h2>Document checklist</h2>
              <ul>{g.documents.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
            <div className="card">
              <h2>Approximate costs</h2>
              <ul>{g.costs.map((c) => <li key={c.item}><strong>{c.item}:</strong> {c.approx}</li>)}</ul>
            </div>
          </div>

          <div className="card">
            <h2>Where to live</h2>
            <table>
              <thead><tr><th>Type</th><th>Approx. cost</th><th>Tip</th></tr></thead>
              <tbody>
                {g.accommodation.options.map((o) => (
                  <tr key={o.type}><td>{o.type}</td><td>{o.approx}</td><td>{o.tip}</td></tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ marginTop: '1rem' }}>Shared-room rent by city (approx.)</h3>
            <div className="row">
              {g.accommodation.citiesWgRoomApprox.map((c) => (
                <span className="badge" key={c.city}>{c.city}: {c.approx}</span>
              ))}
            </div>
            <h3 style={{ marginTop: '1rem' }}>Where to search</h3>
            <p>{g.accommodation.platforms.join(' · ')}</p>
            <h3>Avoid scams</h3>
            <ul>{g.accommodation.scamWarnings.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="muted">{g.accommodation.note}</p>
          </div>

          <div className="card">
            <h2>After you arrive</h2>
            <ul>{g.afterArrival.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>

          <div className="card">
            <h2>Official sources</h2>
            <ul>
              {g.officialLinks.map((l) => (
                <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer noopener">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
