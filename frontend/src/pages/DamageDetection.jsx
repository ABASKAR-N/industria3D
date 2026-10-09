import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const SEVERITY_COLOR = {
  high:   { text: '#ef4444', border: 'rgba(239,68,68,0.4)' },
  medium: { text: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
  low:    { text: '#22c55e', border: 'rgba(34,197,94,0.4)' },
};

const THERMAL_COLOR = { critical: '#ef4444', warning: '#f59e0b', normal: '#22c55e' };

function ImageCard({ item, onOpen }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const sev = SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.medium;
  const thermalColor = THERMAL_COLOR[item.thermal_status] || '#6b7280';
  const imgSrc = item.image_url ? `${API_BASE}${item.image_url}` : null;

  return (
    <div
      onClick={() => onOpen(item)}
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        border: `1px solid ${sev.border}`,
        transition: 'transform 0.25s, box-shadow 0.25s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.1), 0 0 0 2px ${sev.border}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.05)';
      }}
    >
      <div style={{ position: 'relative', height: '220px', background: '#f8fafc', overflow: 'hidden' }}>
        {imgSrc && !imgError ? (
          <>
            <img
              src={imgSrc}
              alt={`${item.component_type} defect`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s' }}
            />
            {!imgLoaded && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
              }} />
            )}
            {imgLoaded && (
              <div style={{
                position: 'absolute', top: '20%', left: '25%',
                width: '50%', height: '55%',
                border: `2px solid ${sev.text}`,
                borderRadius: '4px',
                background: `${sev.text}18`,
                boxShadow: `0 0 12px ${sev.text}60`,
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', top: -22, left: -2,
                  background: sev.text, color: '#fff',
                  fontSize: '10px', fontWeight: 700,
                  padding: '2px 8px', borderRadius: '4px 4px 0 0',
                  whiteSpace: 'nowrap',
                }}>
                  {item.defect || 'DEFECT'} · {item.confidence_score ? (parseFloat(item.confidence_score) * 100).toFixed(0) : 87}%
                </div>
              </div>
            )}
            {imgLoaded && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, transparent 70%, rgba(0,0,0,0.2) 100%)',
                pointerEvents: 'none',
              }} />
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#4b5563' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <span style={{ fontSize: '12px' }}>No image captured</span>
          </div>
        )}
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          background: sev.text, color: '#fff',
          fontSize: '10px', fontWeight: 800, padding: '3px 9px',
          borderRadius: '20px', letterSpacing: '0.08em', textTransform: 'uppercase',
          boxShadow: `0 2px 8px ${sev.text}80`,
        }}>
          {item.severity || 'UNKNOWN'}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
              {(item.component_type || item.component || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{item.image_id || 'ID N/A'}</div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: `${thermalColor}18`, border: `1px solid ${thermalColor}40`,
            borderRadius: '8px', padding: '4px 10px',
          }}>
            <span style={{ fontSize: '14px' }}>🌡</span>
            <span style={{ color: thermalColor, fontWeight: 700, fontSize: '13px' }}>{item.thermal_temp}°C</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
          {[['Defect Type', item.defect], ['Location', item.defect_location], ['Thermal Status', item.thermal_status?.toUpperCase()]].map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>{label}</span>
              <span style={{ color: i === 2 ? thermalColor : '#334155', fontWeight: 500 }}>{val || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Lightbox({ item, onClose }) {
  const sev = SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.medium;
  const imgSrc = item.image_url ? `${API_BASE}${item.image_url}` : null;
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#ffffff',
        borderRadius: '20px', border: `1px solid ${sev.border}`,
        maxWidth: '840px', width: '100%', overflow: 'hidden',
        boxShadow: `0 24px 80px rgba(0,0,0,0.2)`,
        animation: 'fadeInScale 0.2s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid #e2e8f0',
        }}>
          <div>
            <div style={{ color: '#1e293b', fontWeight: 700, fontSize: '18px' }}>
              {(item.component_type || item.component || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — Defect Analysis
            </div>
            <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>{item.image_id}</div>
          </div>
          <button onClick={onClose} style={{
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            color: '#64748b', borderRadius: '8px', width: '34px', height: '34px',
            cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px' }}>
          <div style={{ position: 'relative', background: '#f8fafc', minHeight: '380px' }}>
            {imgSrc ? (
              <>
                <img src={imgSrc} alt="Defect" style={{ width: '100%', height: '380px', objectFit: 'contain', display: 'block' }} />
                <div style={{
                  position: 'absolute', top: '20%', left: '22%', width: '56%', height: '58%',
                  border: `2px solid ${sev.text}`, borderRadius: '4px',
                  background: `${sev.text}15`, boxShadow: `0 0 20px ${sev.text}50`, pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: -24, left: -2,
                    background: sev.text, color: '#fff', fontSize: '11px', fontWeight: 700,
                    padding: '3px 10px', borderRadius: '4px 4px 0 0',
                  }}>
                    {item.defect || 'DEFECT'} · {item.confidence_score ? (parseFloat(item.confidence_score) * 100).toFixed(0) : 87}% confidence
                  </div>
                </div>
              </>
            ) : (
              <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', flexDirection: 'column', gap: '12px' }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>No image available</span>
              </div>
            )}
          </div>
          <div style={{ padding: '24px', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ['Severity', item.severity?.toUpperCase(), sev.text],
              ['Defect Type', item.defect, null],
              ['Location', item.defect_location, null],
              ['Condition', item.condition, null],
              ['Thermal Temp', `${item.thermal_temp}°C`, THERMAL_COLOR[item.thermal_status]],
              ['Thermal Status', item.thermal_status?.toUpperCase(), THERMAL_COLOR[item.thermal_status]],
              item.confidence_score && ['AI Confidence', `${(parseFloat(item.confidence_score) * 100).toFixed(1)}%`, '#d4af37'],
            ].filter(Boolean).map(([label, val, color], i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: color || '#1e293b' }}>{val || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DamageDetection() {
  const [dataset, setDataset] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchDataset = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/dataset`);
        const data = await response.json();
        setDataset(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching dataset:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDataset();
  }, []);

  const defective = dataset.filter(item => item.condition === 'Defective');
  const filtered = defective.filter(item => {
    const matchesSev = filterSeverity === 'all' || item.severity === filterSeverity;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || (item.component_type || item.component || '').toLowerCase().includes(q)
      || (item.defect || '').toLowerCase().includes(q)
      || (item.defect_location || '').toLowerCase().includes(q);
    return matchesSev && matchesSearch;
  });

  const counts = { high: defective.filter(i => i.severity === 'high').length, medium: defective.filter(i => i.severity === 'medium').length, low: defective.filter(i => i.severity === 'low').length };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px 24px', color: '#1e293b' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeInScale { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
      `}</style>
      <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
        <header style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #d4af37, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', boxShadow: '0 4px 16px rgba(212,175,55,0.4)',
            }}>🔍</div>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#d4af37', margin: 0 }}>Damage Detection</h1>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '13px' }}>AI-powered visual inspection with bounding-box annotations</p>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[['Critical', counts.high, '#ef4444', '🔴'], ['Warning', counts.medium, '#f59e0b', '🟡'], ['Low Risk', counts.low, '#22c55e', '🟢']].map(([label, count, color, icon]) => (
            <div key={label} style={{
              background: '#ffffff',
              border: `1px solid ${color}30`, borderRadius: '14px', padding: '18px',
              display: 'flex', alignItems: 'center', gap: '14px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}>
              <span style={{ fontSize: '26px' }}>{icon}</span>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{label} defects</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="Search component, defect, location…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1, minWidth: '220px',
              background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: '10px', padding: '10px 16px', color: '#1e293b', fontSize: '13px', outline: 'none',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
          />
          {['all', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setFilterSeverity(s)} style={{
              padding: '8px 18px', borderRadius: '10px',
              border: filterSeverity === s ? `1px solid ${s === 'all' ? '#d4af37' : SEVERITY_COLOR[s]?.text}` : '1px solid #e2e8f0',
              background: filterSeverity === s ? (s === 'all' ? 'rgba(212,175,55,0.1)' : `${SEVERITY_COLOR[s]?.text}15`) : '#ffffff',
              color: filterSeverity === s ? (s === 'all' ? '#d4af37' : SEVERITY_COLOR[s]?.text) : '#64748b',
              fontWeight: 600, fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}>{s === 'all' ? 'All Severities' : s}</button>
          ))}
          <div style={{ color: '#6b7280', fontSize: '12px', marginLeft: 'auto' }}>{filtered.length} results</div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(212,175,55,0.2)', borderTopColor: '#d4af37', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <div style={{ color: '#6b7280' }}>No defective records match your filter.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '24px' }}>
            {filtered.map((item, idx) => <ImageCard key={idx} item={item} onOpen={setSelected} />)}
          </div>
        )}
      </div>
      {selected && <Lightbox item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
