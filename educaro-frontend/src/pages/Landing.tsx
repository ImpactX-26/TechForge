import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="container">
      <div className="hero">
        <h1>Your pathway to Germany, guided by AI</h1>
        <p className="muted" style={{ maxWidth: 560, margin: '0 auto 1.5rem' }}>
          Tell our assistant your goal, upload your documents, record a short intro video, and get a clear
          eligibility outcome, a professional CV and your next step with Educaro.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn" to="/register">Get started</Link>
          <Link className="btn secondary" to="/login">Sign in</Link>
        </div>
      </div>
      <div className="grid">
        <div className="card"><h3>1. Chat</h3><p className="muted">An agent asks only what is missing and saves only what you say.</p></div>
        <div className="card"><h3>2. Upload</h3><p className="muted">Degrees, certificates and CV are read automatically. You confirm the result.</p></div>
        <div className="card"><h3>3. Verify</h3><p className="muted">A short video captures your motivation and checks it is really you.</p></div>
        <div className="card"><h3>4. Move</h3><p className="muted">Get your outcome, CV, visa steps and accommodation guide.</p></div>
      </div>
    </div>
  );
}
