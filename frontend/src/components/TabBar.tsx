import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const mainTabs = [
  { to: '/',       label: 'Hjem',   icon: HomeIcon },
  { to: '/games',  label: 'Kampe',  icon: CalendarIcon },
  { to: '/stats',  label: 'Stats',  icon: ChartIcon },
];

const menuItems = [
  { to: '/squad',    label: 'Trup',         icon: PeopleIcon },
  { to: '/profile',  label: 'Profil',        icon: PersonIcon },
  { to: '/settings', label: 'Indstillinger', icon: GearIcon },
];

export default function TabBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuActive = menuItems.some(m => location.pathname.startsWith(m.to));

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-up menu */}
      {open && (
        <div className="fixed left-0 right-0 z-50 bg-bg border-t border-border shadow-xl rounded-t-2xl"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))', paddingBottom: '0.25rem' }}
        >
          <div className="flex justify-center pt-2.5 pb-2">
            <div className="w-8 h-1 bg-border rounded-full" />
          </div>
          {menuItems.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => go(to)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors active:bg-bg2 ${
                location.pathname.startsWith(to) ? 'text-green' : 'text-text1'
              }`}
            >
              <Icon active={location.pathname.startsWith(to)} />
              <span className="text-base font-medium">{label}</span>
              <svg className="ml-auto text-text3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border flex z-50">
        {mainTabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center flex-1 pt-2 gap-0.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-green' : 'text-text3'
              }`
            }
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Hamburger */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex flex-col items-center flex-1 pt-2 gap-0.5 text-[11px] font-medium transition-colors ${
            menuActive || open ? 'text-green' : 'text-text3'
          }`}
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        >
          <MenuIcon active={menuActive || open} />
          <span>Mere</span>
        </button>
      </nav>
    </>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────── */
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function MenuIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
