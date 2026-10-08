import type { Profile } from '../types';
import ProvBadge from './ProvBadge';

export type Section = 'education' | 'employment' | 'skills' | 'languages';

const LABELS: Record<string, string> = {
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  dateOfBirth: 'Date of birth',
  currentCity: 'Current city',
  availability: 'Availability',
  reason: 'Reason for Germany',
  preferredPathway: 'Preferred pathway',
  longTermGoals: 'Long-term goals',
  preferredCity: 'Preferred city',
  fieldOfInterest: 'Field of interest',
};

type Props = {
  p: Pick<Profile, 'personal' | 'education' | 'employment' | 'skills' | 'languages' | 'motivation'>;
  onDelete?: (section: Section, id: string) => void;
};

export default function ProfileSections({ p, onDelete }: Props) {
  const del = (s: Section, id: string) =>
    onDelete ? (
      <button className="btn danger small" onClick={() => onDelete(s, id)}>
        Remove
      </button>
    ) : null;

  const tracked = (title: string, data: Record<string, { value: string; source: any; verified: boolean }>) => {
    const entries = Object.entries(data ?? {});
    return (
      <div className="card">
        <h2>{title}</h2>
        {entries.length === 0 && <p className="muted">Nothing recorded yet.</p>}
        {entries.map(([k, v]) => (
          <div className="item row spread" key={k}>
            <span>
              <strong>{LABELS[k] ?? k}:</strong> {v.value}
            </span>
            <ProvBadge source={v.source} verified={v.verified} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {tracked('Personal details', p.personal)}

      <div className="card">
        <h2>Education</h2>
        {p.education.length === 0 && <p className="muted">No education recorded yet.</p>}
        {p.education.map((e) => (
          <div className="item row spread" key={e.id}>
            <span>
              <strong>{e.qualification || e.institution}</strong>
              <br />
              <span className="muted">
                {[e.qualification ? e.institution : null, e.level, e.field, e.graduationDate, e.grade && `Grade ${e.grade}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="row">
              <ProvBadge source={e.source} verified={e.verified} />
              {del('education', e.id)}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Work experience</h2>
        {p.employment.length === 0 && <p className="muted">No experience recorded yet.</p>}
        {p.employment.map((e) => (
          <div className="item row spread" key={e.id}>
            <span>
              <strong>{[e.role, e.employer].filter(Boolean).join(' at ')}</strong>
              <br />
              <span className="muted">
                {e.startDate || '?'} to {e.endDate || 'present'}
                {e.responsibilities ? ` · ${e.responsibilities}` : ''}
              </span>
            </span>
            <span className="row">
              <ProvBadge source={e.source} verified={e.verified} />
              {del('employment', e.id)}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Skills</h2>
        {p.skills.length === 0 && <p className="muted">No skills recorded yet.</p>}
        {p.skills.map((s) => (
          <div className="item row spread" key={s.id}>
            <span>{s.name}</span>
            <span className="row">
              <ProvBadge source={s.source} verified={s.verified} />
              {del('skills', s.id)}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Languages</h2>
        {p.languages.length === 0 && <p className="muted">No languages recorded yet.</p>}
        {p.languages.map((l) => (
          <div className="item row spread" key={l.id}>
            <span>
              <strong>{l.language}</strong>: {l.level === 'UNKNOWN' ? 'level not stated' : l.level}
              {l.certificate ? ` (${l.certificate}${l.score ? `, ${l.score}` : ''})` : ''}
            </span>
            <span className="row">
              <ProvBadge source={l.source} verified={l.verified} />
              {del('languages', l.id)}
            </span>
          </div>
        ))}
      </div>

      {tracked('Motivation and goals', p.motivation)}
    </>
  );
}
