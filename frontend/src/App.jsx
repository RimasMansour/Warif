import { Routes, Route, Navigate } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import DashboardPage from '@/pages/DashboardPage'
import SensorsPage from '@/pages/SensorsPage'
import AlertsPage from '@/pages/AlertsPage'
import TraysPage from '@/pages/TraysPage'
import MLPage from '@/pages/MLPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/sensors"   element={<SensorsPage />} />
        <Route path="/alerts"    element={<AlertsPage />} />
        <Route path="/trays"     element={<TraysPage />} />
        <Route path="/ml"        element={<MLPage />} />
        <Route path="/settings"  element={<SettingsPage />} />
      </Routes>
    </PageShell>
  )
}
