import { useAuth } from '../lib/auth';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-text1 mb-4">Indstillinger</h2>
      {user && (
        <p className="text-text2 text-sm mb-6">Logget ind som <strong>{user.name}</strong> ({user.role})</p>
      )}
      <button
        onClick={logout}
        className="w-full border border-red text-red rounded-lg py-3 font-semibold"
      >
        Log ud
      </button>
    </div>
  );
}
