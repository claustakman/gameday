import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import TabBar from './components/TabBar';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import GamesPage from './pages/GamesPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import GameDetailPage from './pages/GameDetailPage';

function AppShell() {
  const { token } = useAuth();
  if (!token) return <LoginPage />;
  return (
    <div className="flex flex-col min-h-screen bg-bg2">
      <main className="flex-1 overflow-y-auto pb-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:id" element={<GameDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
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
