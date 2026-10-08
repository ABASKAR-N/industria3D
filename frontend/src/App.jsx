import { useState } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import MobileInspect from './pages/MobileInspect';
import DamageDetection from './pages/DamageDetection';
import PredictiveMaintenance from './pages/PredictiveMaintenance';

export default function App() {
  // Simple client-side routing
  const getInitialPage = () => {
    const path = window.location.pathname;
    if (path.includes('mobile')) return 'mobile';
    if (path.includes('damage')) return 'damage';
    if (path.includes('predictive') || path.includes('hydraulic')) return 'predictive';
    return 'dashboard';
  };

  const [page, setPage] = useState(getInitialPage);

  const navigate = (target) => {
    const pageId = target === 'hydraulic' ? 'predictive' : target;
    setPage(pageId);
    const url = pageId === 'mobile' ? '/mobile' : pageId === 'damage' ? '/damage' : pageId === 'predictive' ? '/predictive' : '/';
    window.history.pushState({}, '', url);
  };

  // Handle browser back/forward
  window.onpopstate = () => {
    setPage(getInitialPage());
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
      
      <Header onNavigate={navigate} currentPage={page} />
      <main>
        <div style={{ display: page === 'mobile' ? 'block' : 'none', height: '100%' }}>
          <MobileInspect onNavigate={navigate} />
        </div>
        <div style={{ display: page === 'dashboard' ? 'block' : 'none', height: '100%' }}>
          <Dashboard />
        </div>
        <div style={{ display: page === 'damage' ? 'block' : 'none', height: '100%' }}>
          <DamageDetection />
        </div>
        <div style={{ display: (page === 'predictive' || page === 'hydraulic') ? 'block' : 'none', height: '100%' }}>
          <PredictiveMaintenance />
        </div>
      </main>
    </div>
  );
}
