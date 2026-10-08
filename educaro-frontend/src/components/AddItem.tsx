import { FormEvent, useState } from 'react';

export interface Field {
  key: string;
  label: string;
  options?: string[];
  placeholder?: string;
}

interface Props {
  title: string;
  fields: Field[];
  onAdd: (values: Record<string, string>) => Promise<void>;
}

export default function AddItem({ title, fields, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onAdd(vals);
      setVals({});
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn secondary small" onClick={() => setOpen(true)}>
        + {title}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={{ background: '#f8f9fd' }}>
      <h3>{title}</h3>
      {fields.map((f) => (
        <div key={f.key}>
          <label>{f.label}</label>
          {f.options ? (
            <select value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}>
              <option value="">Select…</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={vals[f.key] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            />
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: '.8rem' }}>
        <button className="btn small" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn secondary small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
