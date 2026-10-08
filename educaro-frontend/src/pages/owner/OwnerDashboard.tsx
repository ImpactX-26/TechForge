import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api';
import type { OwnerRow } from '../../types';

const STATUSES = ['', 'SUBMITTED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'IN_PROGRESS'];
const GOALS = ['', 'STUDY', 'VOCATIONAL', 'EMPLOYMENT'];

const statusClass = (s: string) =>
  s === 'SELECTED' ? 'ok' : s === 'REJECTED' ? 'bad' : s === 'SHORTLISTED' ? 'document' : '';

export default function OwnerDashboard() {
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [status, setStatus] = useState('');
  const [goal, setGoal] = useState('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (goal) params.set('goal', goal);
    if (q.trim()) params.set('q', q.trim());
    const handle = window.setTimeout(() => {
      setLoading(true);
      setErr('');
      api
        .get<OwnerRow[]>(`/owner/applications?${params.toString()}`)
        .then(setRows)
        .catch((e) => setErr(errorMessage(e)))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [status, goal, q]);

  async function exportCsv() {
    try {
      await api.download(`/owner/export.csv${status ? `?status=${status}` : ''}`, 'applications.csv');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  return (
    <>
      <div className="row spread">
        <h1>Applications</h1>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="card">
        <div className="grid">
          <div>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s || 'All submitted'}</option>)}
            </select>
          </div>
          <div>
            <label>Goal</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((g) => <option key={g} value={g}>{g || 'All'}</option>)}
            </select>
          </div>
          <div>
            <label>Search name or email</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {err && <div className="error">{err}</div>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Applicant</th><th>Goal</th><th>Status</th><th>Outcome</th><th>Complete</th><th>Submitted</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}<div className="muted">{r.email}</div></td>
                <td>{r.goal ?? '-'}</td>
                <td><span className={`badge ${statusClass(r.status)}`}>{r.status}</span></td>
                <td>{r.outcome ?? '-'}</td>
                <td>{r.completenessPercent !== null ? `${r.completenessPercent}%` : '-'}</td>
                <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '-'}</td>
                <td><Link className="btn small" to={`/owner/${r.id}`}>Open</Link></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="muted">No applications found.</td></tr>
            )}
          </tbody>
        </table>
        {loading && <p className="muted">Loading…</p>}
      </div>
    </>
  );
}
