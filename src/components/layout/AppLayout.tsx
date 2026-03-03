import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/reports', icon: '📊', label: 'Reports' },
  { to: '/', icon: '🛒', label: 'POS' },
  { to: '/cash', icon: '💰', label: 'Cash' },
  { to: '/products', icon: '📦', label: 'Products' },
  { to: '/inventory', icon: '📋', label: 'Inventory' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
]

export default function AppLayout() {
  const { signOut, user } = useAuth()

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
        <span className="font-bold text-lg">🐾 Grey Store</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:inline">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-red-500 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t shrink-0 safe-area-bottom">
        <div className="flex justify-around">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-1 text-xs transition ${
                  isActive ? 'text-primary font-semibold' : 'text-gray-400'
                }`
              }
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
