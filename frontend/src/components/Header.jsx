// Header.jsx — Dashboard top navigation bar
import { useState, useEffect } from 'react';
import { fetchHealth, fetchKiriBalance } from '../api';

export default function Header({ onNavigate, currentPage }) {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [kiri, setKiri] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  useEffect(() => {
    const check = async () => {
      try {
        const [h, k] = await Promise.allSettled([
          fetchHealth(),
          fetchKiriBalance(),
        ]);
        if (h.status === 'fulfilled') setHealth(h.value);
        else setHealth(null);

        if (k.status === 'fulfilled' && k.value?.success) setKiri(k.value);
        else setKiri(null);
      } catch {
        setHealth(null);
      } finally {
        setChecking(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const apiOnline = health?.status === 'ok';
  const dbOk = health?.database === 'ok';
  const aiMode = health?.demo_mode ? 'DEMO' : 'AI LIVE';

  return (
    <header style={{
      background: 'rgba(253,251,247,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(212,175,55,0.2)',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #d4af37, #0369a1)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 0 12px rgba(212,175,55,0.3)',
        }}>
          ⬡
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', letterSpacing: '-0.02em', lineHeight: 1 }}>
            INDUSTRIA <span style={{ color: '#d4af37' }}>3D</span>
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            AI-Powered Industrial Digital Twin
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: 4 }}>
        {[
          { id: 'dashboard', label: '⬡ Dashboard' },
          { id: 'mobile', label: '📱 Mobile Inspect' },
          { id: 'damage', label: '🔍 Damage Detection' },
          { id: 'predictive', label: '🔮 Predictive Maintenance' },
        ].map(item => {
          const isActive = currentPage === item.id || (item.id === 'predictive' && currentPage === 'hydraulic');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate?.(item.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                border: isActive ? '1px solid rgba(212,175,55,0.4)' : '1px solid transparent',
                background: isActive ? 'rgba(212,175,55,0.1)' : 'transparent',
                color: isActive ? '#d4af37' : '#4b5563',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#1f2937'; e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#4b5563'; e.currentTarget.style.background = 'transparent'; } }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* API status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: checking ? '#eab308' : apiOnline ? '#22c55e' : '#ef4444',
            boxShadow: `0 0 6px ${checking ? '#eab308' : apiOnline ? '#22c55e' : '#ef4444'}`,
            animation: 'pulse-slow 2s infinite',
          }} />
          <span style={{ color: '#6b7280' }}>API</span>
        </div>

        {/* DB status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: dbOk ? '#22c55e' : '#ef4444',
            boxShadow: `0 0 6px ${dbOk ? '#22c55e' : '#ef4444'}`,
          }} />
          <span style={{ color: '#6b7280' }}>DB</span>
        </div>

        {/* KIRI Engine 3D Photogrammetry status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 9px',
          borderRadius: 4,
          background: kiri?.api_key_valid ? 'rgba(212,175,55,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${kiri?.api_key_valid ? 'rgba(212,175,55,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
          color: kiri?.api_key_valid ? '#d4af37' : '#ef4444',
          cursor: 'pointer',
        }}
        title={`KIRI Engine Photogrammetry: ${kiri?.balance ?? 0} reconstruction credits remaining`}
        onClick={() => onNavigate?.('mobile')}
        >
          <span style={{ fontSize: 9 }}>⚡</span>
          <span>KIRI 3D</span>
          {kiri?.api_key_valid && (
            <span style={{
              background: 'rgba(212,175,55,0.2)',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: 9,
              color: '#7dd3fc',
            }}>
              {kiri.balance} CR
            </span>
          )}
        </div>

        {/* AI mode */}
        {health && (
          <div style={{
            padding: '3px 8px',
            borderRadius: 4,
            background: health.demo_mode ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)',
            border: `1px solid ${health.demo_mode ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}`,
            color: health.demo_mode ? '#eab308' : '#22c55e',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}>
            {aiMode}
          </div>
        )}
        
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            background: 'rgba(212,175,55,0.12)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#d4af37',
            cursor: 'pointer',
            fontSize: 12,
          }}
          title="Toggle Theme"
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
