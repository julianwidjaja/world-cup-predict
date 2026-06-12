import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/predictions/group', label: 'Group Stage' },
  { to: '/predictions/knockout', label: 'Knockout' },
  { to: '/predictions/winner', label: 'Winner' },
  { to: '/groups', label: 'My Groups' },
]

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="text-lg font-bold text-white flex items-center gap-2">
            <span>WC 2026</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/admin'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-400 hover:bg-slate-700'
                }`}
              >
                Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm text-slate-400">{profile?.display_name}</span>
            <button
              onClick={signOut}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-slate-300 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-3 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  location.pathname === link.to
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {profile?.is_admin && (
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  location.pathname === '/admin'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-400 hover:bg-slate-700'
                }`}
              >
                Admin
              </Link>
            )}
            <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between px-3">
              <span className="text-sm text-slate-400">{profile?.display_name}</span>
              <button
                onClick={signOut}
                className="text-sm text-slate-400 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
