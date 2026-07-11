import { useState, useEffect } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TransactionsPage } from './components/Transactions';
import { UploadPage } from './components/Upload';
import { TrendsPage } from './components/Trends';
import { CashFlowPage } from './components/CashFlow';
import { SettingsPage } from './components/Settings';
import { BudgetPage } from './components/Budget';
import { PortfolioPage } from './components/Portfolio';
import { useStore } from './store';
import { MobileMenuContext } from './context/MobileMenu';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const loadAll = useStore(s => s.loadAll);
  const isLoading = useStore(s => s.isLoading);
  const theme = useStore(s => s.theme);

  useEffect(() => {
    loadAll().then(() => {
      import('./services/driveSync').then(m => m.initAutoSync());
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
  }, [theme]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading Finance Dashboard...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'cashflow': return <CashFlowPage />;
      case 'transactions': return <TransactionsPage />;
      case 'upload': return <UploadPage />;
      case 'trends': return <TrendsPage />;
      case 'budget': return <BudgetPage />;
      case 'portfolio': return <PortfolioPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  const handleNavigate = (p: string) => {
    setPage(p);
    setMobileDrawerOpen(false);
  };

  return (
    <MobileMenuContext.Provider value={{ open: mobileDrawerOpen, setOpen: setMobileDrawerOpen }}>
      <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Mobile overlay */}
        {mobileDrawerOpen && (
          <div className="sidebar-overlay" onClick={() => setMobileDrawerOpen(false)} />
        )}

        <Sidebar
          currentPage={page}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileDrawerOpen}
        />
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {renderPage()}
        </main>
      </div>
    </MobileMenuContext.Provider>
  );
}
