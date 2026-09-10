import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CitizenScanner from './pages/CitizenScanner';
import OfficerDashboard from './pages/OfficerDashboard';
import OfficerLogin from './pages/OfficerLogin';
import { isOfficerLoggedIn } from './utils/auth';

// Protected Route Wrapper for Officer
function ProtectedOfficerRoute({ children }) {
  if (!isOfficerLoggedIn()) {
    return <Navigate to="/officer-login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/citizen" element={<CitizenScanner />} />
        <Route path="/officer-login" element={<OfficerLogin />} />
        <Route
          path="/officer"
          element={
            <ProtectedOfficerRoute>
              <OfficerDashboard />
            </ProtectedOfficerRoute>
          }
        />
      </Routes>
    </Router>
  );
}