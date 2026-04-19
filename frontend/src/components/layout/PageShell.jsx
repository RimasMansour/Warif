/**
 * components/layout/PageShell.jsx
 * Wraps every page with the sidebar + top navbar.
 */
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function PageShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
