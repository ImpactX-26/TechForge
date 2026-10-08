import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function OwnerLayout() {
  const { session, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <div className="topbar owner">
        <div className="inner">
          <span className="brand">Educaro Owner Console</span>
          <Link to="/owner">Applications</Link>
          <span style={{ fontSize: '.85rem' }}>{session?.user.email}</span>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              signOut();
              nav('/owner/login');
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
