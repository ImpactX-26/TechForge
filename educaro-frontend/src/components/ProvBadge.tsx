import type { Source } from '../types';

export default function ProvBadge({ source, verified }: { source: Source; verified: boolean }) {
  if (verified) return <span className="badge verified">Verified</span>;
  switch (source) {
    case 'DOCUMENT':
      return <span className="badge document">From document (unconfirmed)</span>;
    case 'VIDEO':
      return <span className="badge video">From video</span>;
    case 'AI_GENERATED':
      return <span className="badge ai">AI-generated</span>;
    default:
      return <span className="badge">Self-reported</span>;
  }
}
