import { FormEvent, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api';
import AddItem from '../../components/AddItem';
import ProfileSections, { Section } from '../../components/ProfileSections';
import type { Profile as ProfileType } from '../../types';

const PERSONAL: [string, string][] = [
  ['fullName', 'Full name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['dateOfBirth', 'Date of birth (YYYY-MM-DD)'],
  ['currentCity', 'Current city'],
  ['availability', 'Availability (e.g. from October 2026)'],
];
const MOTIVATION: [string, string][] = [
  ['reason', 'Why Germany?'],
  ['longTermGoals', 'Long-term goals'],
  ['preferredCity', 'Preferred city'],
  ['fieldOfInterest', 'Field of interest'],
  ['preferredPathway', 'Preferred pathway (e.g. Master)'],
];
const EDU_LEVELS = ['SECONDARY', 'HIGHER_SECONDARY', 'DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER'];
const LANG_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE', 'UNKNOWN'];

export default function Profile() {
  const [p, setP] = useState<ProfileType | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  function hydrate(profile: ProfileType) {
    setP(profile);
    const v: Record<string, string> = {};
    [...PERSONAL, ...MOTIVATION].forEach(([k]) => {
      v[k] = profile.personal[k]?.value ?? profile.motivation[k]?.value ?? '';
    });
    setVals(v);
  }

  useEffect(() => {
    api
      .get<ProfileType>('/applicant/me')
      .then(hydrate)
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  async function patch(body: Record<string, unknown>) {
    setErr('');
    setNote('');
    try {
      const r = await api.patch<{ result: { skipped: string[] }; profile: ProfileType }>('/applicant/me/profile', body);
      hydrate(r.profile);
      if (r.result.skipped.length) {
        setNote(`Not changed (already verified from a document): ${r.result.skipped.join(', ')}`);
      }
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    const personal: Record<string, string> = {};
    const motivation: Record<string, string> = {};
    PERSONAL.forEach(([k]) => vals[k]?.trim() && (personal[k] = vals[k].trim()));
    MOTIVATION.forEach(([k]) => vals[k]?.trim() && (motivation[k] = vals[k].trim()));
    await patch({ personal, motivation });
  }

  async function remove(section: Section, id: string) {
    setErr('');
    try {
      hydrate(await api.del<ProfileType>(`/applicant/me/${section}/${id}`));
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  if (!p) return <div>{err ? <div className="error">{err}</div> : 'Loading…'}</div>;

  return (
    <>
      <h1>Your profile</h1>
      <p className="muted">
        Every entry shows where it came from. <em>Verified</em> means it was extracted from a document and you
        confirmed it. Nothing is invented by the AI.
      </p>
      {err && <div className="error">{err}</div>}
      {note && <div className="notice">{note}</div>}

      <form className="card" onSubmit={saveDetails}>
        <h2>Edit details</h2>
        <div className="grid">
          {[...PERSONAL, ...MOTIVATION].map(([k, label]) => (
            <div key={k}>
              <label>{label}</label>
              <input value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <button className="btn" style={{ marginTop: '1rem' }}>Save details</button>
      </form>

      <ProfileSections p={p} onDelete={remove} />

      <div className="card">
        <h2>Add entries manually</h2>
        <div className="row">
          <AddItem
            title="Education"
            fields={[
              { key: 'qualification', label: 'Qualification / degree' },
              { key: 'institution', label: 'Institution' },
              { key: 'level', label: 'Level', options: EDU_LEVELS },
              { key: 'field', label: 'Field of study' },
              { key: 'graduationDate', label: 'Graduation date', placeholder: 'YYYY-MM' },
              { key: 'grade', label: 'Grade' },
            ]}
            onAdd={(v) => patch({ education: [v] })}
          />
          <AddItem
            title="Work experience"
            fields={[
              { key: 'role', label: 'Role' },
              { key: 'employer', label: 'Employer' },
              { key: 'responsibilities', label: 'Responsibilities' },
              { key: 'startDate', label: 'Start date', placeholder: 'YYYY-MM' },
              { key: 'endDate', label: 'End date (blank if current)', placeholder: 'YYYY-MM' },
            ]}
            onAdd={(v) => patch({ employment: [v] })}
          />
          <AddItem
            title="Skill"
            fields={[{ key: 'name', label: 'Skill' }]}
            onAdd={(v) => patch({ skills: [v.name ?? ''] })}
          />
          <AddItem
            title="Language"
            fields={[
              { key: 'language', label: 'Language (e.g. German)' },
              { key: 'level', label: 'Level', options: LANG_LEVELS },
              { key: 'certificate', label: 'Certificate (e.g. Goethe)' },
              { key: 'score', label: 'Score' },
            ]}
            onAdd={(v) => patch({ languages: [v] })}
          />
        </div>
      </div>
    </>
  );
}
