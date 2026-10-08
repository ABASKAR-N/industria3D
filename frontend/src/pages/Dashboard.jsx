// Dashboard.jsx — Main command-center dashboard
import { useState, useEffect, useCallback } from 'react';
import DigitalTwinViewer from '../components/DigitalTwinViewer';
import ComponentSidebar from '../components/ComponentSidebar';
import PredictionChart from '../components/PredictionChart';
import { fetchComponents, fetchComponent, fetchHistory, fetchPrediction } from '../api';
import { riskLevel, healthColor } from '../utils';

function ComponentSelector({ components, selectedId, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      padding: '8px 0',
      overflowX: 'auto',
      flexWrap: 'wrap',
    }}>
      {components.map(c => {
        const rl = riskLevel(c.health_score);
        const hc = healthColor(c.health_score);
        const isSelected = c.id === selectedId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: isSelected ? `1px solid ${hc}60` : '1px solid rgba(212,175,55,0.2)',
              background: isSelected ? `${hc}12` : 'rgba(255,255,255,0.5)',
              color: isSelected ? hc : '#4b5563',
              fontSize: 12,
              fontWeight: isSelected ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ marginRight: 6 }}>
              {c.status === 'critical' ? '🔴' : c.status === 'warning' ? '🟡' : '🟢'}
            </span>
            {c.name}
            <span style={{
              marginLeft: 8, fontSize: 10, color: hc, fontFamily: 'JetBrains Mono, monospace',
            }}>
              {Math.round(c.health_score)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [components, setComponents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [component, setComponent] = useState(null);
  const [history, setHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load component list
  useEffect(() => {
    fetchComponents()
      .then(data => {
        setComponents(data);
        if (data.length > 0) setSelectedId(data[0].id);
        setLoading(false);
      })
      .catch(e => {
        setError('Cannot connect to backend. Make sure the FastAPI server is running on port 8000.');
        setLoading(false);
      });
  }, []);

  // Load selected component data
  useEffect(() => {
    if (!selectedId) return;
    setSelectedDefect(null);

    Promise.all([
      fetchComponent(selectedId),
      fetchHistory(selectedId),
      fetchPrediction(selectedId),
    ]).then(([comp, hist, pred]) => {
      setComponent(comp);
      setHistory(hist);
      setPrediction(pred);
    }).catch(e => {
      console.error('Failed to load component data:', e);
    });
  }, [selectedId]);

  // Latest inspection defects for the twin
  const latestInspection = history?.[0] ?? null;
  const twinDefects = latestInspection?.defects ?? [];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', flexDirection: 'column', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(212,175,55,0.2)',
          borderTop: '3px solid #d4af37',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ color: '#6b7280', fontSize: 13 }}>Loading INDUSTRIA 3D...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="panel glow-red" style={{ padding: 32, maxWidth: 480, textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Backend Unreachable</div>
          <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>{error}</div>
          <div style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>
            cd backend<br />
            python main.py
          </div>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
            ↺ Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1800, margin: '0 auto' }}>

      {/* Component Selector */}
      <div className="panel" style={{ padding: '8px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            Components
          </div>
          {components.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>No components found. Run a mobile inspection first.</div>
          ) : (
            <ComponentSelector
              components={components}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>

      {/* Main grid: 3D Twin (70%) + Sidebar (30%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 16,
        marginBottom: 16,
      }}>
        {/* 3D Viewer */}
        <div style={{ height: 520 }}>
          <DigitalTwinViewer
            component={component}
            defects={twinDefects}
            selectedDefect={selectedDefect}
            onSelectDefect={setSelectedDefect}
          />
        </div>

        {/* Sidebar */}
        <div style={{ height: 520, overflowY: 'auto' }}>
          <ComponentSidebar
            component={component}
            latestInspection={latestInspection}
            selectedDefect={selectedDefect}
            onSelectDefect={setSelectedDefect}
          />
        </div>
      </div>

      {/* Bottom: Charts + History */}
      <div>
        <PredictionChart prediction={prediction} history={history} />
      </div>
    </div>
  );
}
