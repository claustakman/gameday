import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import TabBar from './components/TabBar';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import GamesPage from './pages/GamesPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import GameDetailPage from './pages/GameDetailPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SquadPage from './pages/SquadPage';
import ProfilePage from './pages/ProfilePage';
import StandingPage from './pages/StandingPage';

function AppShell() {
  const { token } = useAuth();

  // Invite and password-reset pages are always public — no auth required
  if (window.location.pathname.startsWith('/invite/')) {
    return <Routes><Route path="/invite/:token" element={<AcceptInvitePage />} /></Routes>;
  }
  if (window.location.pathname === '/forgot-password' || window.location.pathname.startsWith('/reset-password/')) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  if (!token) return <LoginPage />;
  return (
    <div className="flex flex-col min-h-screen bg-bg2">
      <main className="flex-1 overflow-y-auto pb-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:id" element={<GameDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/standing" element={<StandingPage />} />
          <Route path="/squad" element={<SquadPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
