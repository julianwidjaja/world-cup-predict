import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import GroupStagePredictions from './pages/GroupStagePredictions'
import KnockoutPredictions from './pages/KnockoutPredictions'
import WinnerPrediction from './pages/WinnerPrediction'
import Groups from './pages/Groups'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      {children}
    </div>
  )
}

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={session ? <Navigate to="/" replace /> : <Signup />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/predictions/group" element={<ProtectedRoute><AppLayout><GroupStagePredictions /></AppLayout></ProtectedRoute>} />
      <Route path="/predictions/knockout" element={<ProtectedRoute><AppLayout><KnockoutPredictions /></AppLayout></ProtectedRoute>} />
      <Route path="/predictions/winner" element={<ProtectedRoute><AppLayout><WinnerPrediction /></AppLayout></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><AppLayout><Groups /></AppLayout></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><AppLayout><Leaderboard /></AppLayout></ProtectedRoute>} />
      <Route path="/leaderboard/:groupId" element={<ProtectedRoute><AppLayout><Leaderboard /></AppLayout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AppLayout><Admin /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
