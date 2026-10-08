import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api';
import type { DocItem } from '../../types';

const TYPES: [string, string][] = [
  ['ID_DOCUMENT', 'Passport / ID (upload a clear JPG or PNG photo for face matching)'],
  ['DEGREE', 'Degree certificate'],
  ['TRANSCRIPT', 'Marksheet / transcript'],
  ['CERTIFICATE', 'Other certificate'],
  ['EXPERIENCE_LETTER', 'Experience letter'],
  ['LANGUAGE_CERTIFICATE', 'Language certificate (IELTS, Goethe, TestDaF…)'],
  ['CV', 'Existing CV'],
];

const STATUS_CLASS: Record<string, string> = {
  CONFIRMED: 'ok',
  EXTRACTED: 'warn',
  FAILED: 'bad',
  UPLOADED: '',
};

export default function Documents() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [type, setType] = useState('DEGREE');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<DocItem[]>('/documents')
      .then(setDocs)
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  const replace = (d: DocItem) => setDocs((list) => list.map((x) => (x.id === d.id ? d : x)));

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('type', type);
      form.append('file', file);
      const d = await api.upload<DocItem>('/documents/upload', form);
      setDocs((list) => [d, ...list]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: 'confirm' | 'retry') {
    setErr('');
    try {
      replace(await api.post<DocItem>(`/documents/${id}/${action}`));
    } catch (ex) {
      setErr(errorMessage(ex));
    }
  }

  return (
    <>
      <h1>Documents</h1>
      <p className="muted">
        We read each document and add the details to your profile. Please check them and press
        <strong> Confirm</strong> so they are marked as verified.
      </p>

      <form className="card" onSubmit={upload}>
        <label>Document type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label>File (PDF, JPG, PNG or WEBP, max 10 MB)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {err && <div className="error">{err}</div>}
        <button className="btn" style={{ marginTop: '1rem' }} disabled={!file || busy}>
          {busy ? 'Uploading and reading…' : 'Upload'}
        </button>
      </form>

      {docs.length === 0 && <p className="muted">No documents uploaded yet.</p>}
      {docs.map((d) => (
        <div className="card" key={d.id}>
          <div className="row spread">
            <strong>{d.originalName}</strong>
            <span className={`badge ${STATUS_CLASS[d.status]}`}>{d.status}</span>
          </div>
          <p className="muted">
            {TYPES.find(([v]) => v === d.type)?.[1] ?? d.type} · {new Date(d.createdAt).toLocaleString()}
          </p>
          {d.errorMessage && <div className="error">{d.errorMessage}</div>}
          {d.warnings?.map((w, i) => <div className="warn" key={i}>{w}</div>)}
          {d.extracted && (
            <p className="muted">
              Found: {d.extracted.education?.length ?? 0} education, {d.extracted.employment?.length ?? 0} employment,{' '}
              {d.extracted.skills?.length ?? 0} skills, {d.extracted.languages?.length ?? 0} languages
              {typeof d.extracted.confidence === 'number' && ` · AI confidence ${Math.round(d.extracted.confidence * 100)}%`}
            </p>
          )}
          <div className="row">
            {d.status === 'EXTRACTED' && (
              <button className="btn small" onClick={() => act(d.id, 'confirm')}>Confirm extracted data is correct</button>
            )}
            {(d.status === 'FAILED' || d.status === 'EXTRACTED') && (
              <button className="btn secondary small" onClick={() => act(d.id, 'retry')}>Retry extraction</button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
