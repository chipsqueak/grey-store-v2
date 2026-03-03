import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { InventorySettingsProvider, useInventorySettings } from './hooks/useInventorySettings'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import POSPage from './pages/POSPage'
import ProductsPage from './pages/ProductsPage'
import InventoryPage from './pages/InventoryPage'
import CashPage from './pages/CashPage'
import ReportsPage from './pages/ReportsPage'
import CheckoutPage from './pages/CheckoutPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  const { inventoryEnabled } = useInventorySettings()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<POSPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="inventory" element={inventoryEnabled ? <InventoryPage /> : <Navigate to="/" replace />} />
        <Route path="cash" element={<CashPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InventorySettingsProvider>
          <AppRoutes />
        </InventorySettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
