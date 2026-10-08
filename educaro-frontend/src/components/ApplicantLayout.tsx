import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const links: [string, string][] = [
  ['/app', 'Overview'],
  ['/app/chat', 'Assistant'],
  ['/app/documents', 'Documents'],
  ['/app/video', 'Intro video'],
  ['/app/profile', 'Profile'],
  ['/app/cv', 'CV'],
  ['/app/result', 'Result'],
  ['/app/guide', 'Germany guide'],
];

export default function ApplicantLayout() {
  const { session, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <div className="topbar">
        <div className="inner">
          <span className="brand">Educaro Pathway</span>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/app'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}
            </NavLink>
          ))}
          <span style={{ fontSize: '.85rem' }}>{session?.user.fullName}</span>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              signOut();
              nav('/login');
            }}
          >
            Sign out
          </a>
        </div>
      </div>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}
