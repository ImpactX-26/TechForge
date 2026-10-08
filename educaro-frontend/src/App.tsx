import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ApplicantLayout from './components/ApplicantLayout';
import OwnerLayout from './components/OwnerLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Overview from './pages/applicant/Overview';
import Chat from './pages/applicant/Chat';
import Documents from './pages/applicant/Documents';
import Video from './pages/applicant/Video';
import Profile from './pages/applicant/Profile';
import Cv from './pages/applicant/Cv';
import Result from './pages/applicant/Result';
import Guide from './pages/applicant/Guide';
import OwnerLogin from './pages/owner/OwnerLogin';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerDetail from './pages/owner/OwnerDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute role="APPLICANT">
            <ApplicantLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="chat" element={<Chat />} />
        <Route path="documents" element={<Documents />} />
        <Route path="video" element={<Video />} />
        <Route path="profile" element={<Profile />} />
        <Route path="cv" element={<Cv />} />
        <Route path="result" element={<Result />} />
        <Route path="guide" element={<Guide />} />
      </Route>

      <Route path="/owner/login" element={<OwnerLogin />} />
      <Route
        path="/owner"
        element={
          <ProtectedRoute role="OWNER">
            <OwnerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OwnerDashboard />} />
        <Route path=":id" element={<OwnerDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
