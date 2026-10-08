import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api';
import ProfileSections from '../../components/ProfileSections';
import type { OwnerDetailData } from '../../types';

const SETTABLE = ['SUBMITTED', 'SHORTLISTED', 'SELECTED', 'REJECTED'];

export default function OwnerDetail() {
  const { id = '' } = useParams();
  const [d, setD] = useState<OwnerDetailData | null>(null);
  const [status, setStatus] = useState('SUBMITTED');
  const [notes, setNotes] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .get<OwnerDetailData>(`/owner/applications/${id}`)
      .then((x) => {
        setD(x);
        setStatus(SETTABLE.includes(x.applicant.status) ? x.applicant.status : 'SUBMITTED');
        setNotes(x.applicant.ownerNotes ?? '');
      })
      .catch((e) => setErr(errorMessage(e)));
    return () => {
      setVideoUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    };
  }, [id]);

  async function saveStatus() {
    setErr('');
    setMsg('');
    try {
      await api.patch(`/owner/applications/${id}/status`, { status, notes });
      setMsg(
        status === 'SELECTED'
          ? 'Saved. The applicant can now generate their Germany guide.'
          : 'Status saved.',
      );
      setD((x) => (x ? { ...x, applicant: { ...x.applicant, status: status as any, ownerNotes: notes } } : x));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function dl(path: string, name: string) {
    setErr('');
    try {
      await api.download(path, name);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function loadVideo() {
    setErr('');
    try {
      setVideoUrl(await api.blobUrl(`/owner/applications/${id}/video/file`));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  if (!d) return <div>{err ? <div className="error">{err}</div> : 'Loading…'}</div>;
  const a = d.applicant;
  const q = a.qualification;
  const face = d.video?.faceMatch;

  return (
    <>
      <p><Link to="/owner">← All applications</Link></p>
      <div className="row spread">
        <h1>{a.personal.fullName?.value ?? a.accountName}</h1>
        <span className="badge">{a.status}</span>
      </div>
      <p className="muted">{a.accountEmail} · goal: {a.goal ?? 'not set'} · profile {d.completeness.percent}% complete</p>
      {err && <div className="error">{err}</div>}
      {msg && <div className="notice">{msg}</div>}

      <div className="card">
        <h2>Extract</h2>
        <div className="row">
          <button className="btn small" onClick={() => dl(`/owner/applications/${id}/export`, `application-${id}.json`)}>Download JSON</button>
          <button className="btn small" onClick={() => dl(`/owner/applications/${id}/cv`, `cv-${id}.pdf`)}>Download CV (PDF)</button>
        </div>
      </div>

      <div className="card">
        <h2>Decision</h2>
        <label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {SETTABLE.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label>Internal notes (not visible to the applicant)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        <button className="btn" style={{ marginTop: '.75rem' }} onClick={saveStatus}>Save</button>
      </div>

      <div className="card">
        <h2>Identity and video</h2>
        {d.reviewFlags.needsHumanReview && (
          <div className="warn">Needs human review: identity is not confirmed as matched.</div>
        )}
        {!d.video && <p className="muted">No video uploaded.</p>}
        {d.video && (
          <>
            <p>
              Face check:{' '}
              <span className={`badge ${face?.status === 'MATCHED' ? 'ok' : 'warn'}`}>{face?.status ?? 'UNKNOWN'}</span>{' '}
              {face?.similarity !== undefined && <span className="muted">similarity {face.similarity}% (threshold {face.threshold}%)</span>}
            </p>
            {face && <p className="muted">{face.message}</p>}
            {d.video.consentAt && <p className="muted">Biometric consent given {new Date(d.video.consentAt).toLocaleString()}</p>}
            {videoUrl ? (
              <video src={videoUrl} controls style={{ width: '100%', maxWidth: 520 }} />
            ) : (
              <button className="btn secondary small" onClick={loadVideo}>Load video</button>
            )}
            {(d.video.analysis?.discrepanciesWithProfile?.length ?? 0) > 0 && (
              <div className="warn">
                <strong>Discrepancies (video vs profile):</strong>
                <ul>{d.video.analysis?.discrepanciesWithProfile?.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {d.video.transcript && (
              <details>
                <summary>Transcript</summary>
                <p style={{ whiteSpace: 'pre-wrap' }}>{d.video.transcript}</p>
              </details>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Qualification</h2>
        {!q && <p className="muted">Not assessed yet.</p>}
        {q && (
          <>
            <p><strong>{q.outcome}</strong>: {q.summary}</p>
            {q.requirements.map((r) => (
              <div className="req" key={r.code}>
                <span style={{ color: r.met ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{r.met ? '✓' : '✗'}</span>
                <div>{r.label}{r.detail && <div className="muted">{r.detail}</div>}</div>
              </div>
            ))}
            {q.issues.map((i, n) => <div className="warn" key={n}>{i.message}</div>)}
          </>
        )}
        {a.recommendation && (
          <p className="muted">Recommended: {a.recommendation.title}{a.recommendation.consultantReferral ? ' (consultant referral)' : ''}</p>
        )}
      </div>

      <h2>Profile (with provenance)</h2>
      <ProfileSections p={a} />

      <div className="card">
        <h2>Documents</h2>
        {d.documents.length === 0 && <p className="muted">No documents.</p>}
        {d.documents.map((doc) => (
          <div className="item row spread" key={doc.id}>
            <span>
              <strong>{doc.originalName}</strong> <span className="badge">{doc.type}</span>{' '}
              <span className="badge">{doc.status}</span>
              {doc.warnings?.map((w, i) => <div className="warn" key={i}>{w}</div>)}
            </span>
            <button
              className="btn secondary small"
              onClick={() => dl(`/owner/applications/${id}/documents/${doc.id}/file`, doc.originalName)}
            >
              Download
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
