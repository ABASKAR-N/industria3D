// ComponentSidebar.jsx - Right-side panel: component info + defect details + bounding box viewer
import { severityBadge, badgeClass, riskLevel, healthColor, formatDate, relativeTime } from '../utils';
import DefectBBoxViewer from './DefectBBoxViewer';

function HealthRing({ health }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, health));
  const offset = circ - (pct / 100) * circ;
  const color = healthColor(health);

  return (
    <div className="flex items-center gap-3">
      <svg width="72" height="72" className="health-ring" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{Math.round(pct)}%</div>
        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>Health Score</div>
      </div>
    </div>
  );
}

function StatRow({ label, value, valueColor }) {
  return (
    <div className="flex justify-between items-center" style={{ padding: '6px 0', borderBottom: '1px solid rgba(99,130,190,0.1)' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: valueColor || '#1f2937' }}>{value}</span>
    </div>
  );
}

export default function ComponentSidebar({ component, latestInspection, selectedDefect, onSelectDefect }) {
  const health = component?.health_score ?? 0;
  const rl = riskLevel(health);
  const defects = latestInspection?.defects || [];
  const criticalCount = defects.filter(d => d.severity === 'high' || d.severity === 'critical').length;

  const riskColors = { LOW: '#22c55e', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' };
  const rlColor = riskColors[rl] || '#4b5563';

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto" style={{ paddingRight: 4 }}>

      {/* Component Overview */}
      <div className="panel" style={{ padding: 16 }}>
        <div className="sidebar-label">Component Overview</div>
        {component ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>{component.name}</div>
            <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 14 }}>{component.type}</div>
            <HealthRing health={health} />
            <div className="sep" />
            <StatRow label="Risk Level" value={rl} valueColor={rlColor} />
            <StatRow label="Status" value={component.status?.toUpperCase() || '—'} valueColor={
              component.status === 'operational' ? '#22c55e' : component.status === 'critical' ? '#ef4444' : '#f97316'
            } />
            <StatRow label="Total Defects" value={defects.length} valueColor="#f97316" />
            <StatRow label="Critical/High" value={criticalCount} valueColor={criticalCount > 0 ? '#ef4444' : '#22c55e'} />
            <StatRow label="Last Inspection" value={relativeTime(latestInspection?.timestamp)} />
          </>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>
            Select a component to view details.
          </div>
        )}
      </div>

      {/* Demo notice */}
      {latestInspection?.is_demo && (
        <div className="demo-banner">
          ⚠️ Demo Historical Data — Not real AI output
        </div>
      )}

      {/* Visual Damage / Bounding Box Photo */}
      {latestInspection?.image_path && (
        <div className="panel" style={{ padding: 14 }}>
          <div className="sidebar-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Visual Damage Inspection</span>
            <span style={{ fontSize: 10, color: '#d4af37', fontFamily: 'JetBrains Mono, monospace' }}>
              {defects.length} DEFECT{defects.length !== 1 ? 'S' : ''}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <DefectBBoxViewer
              imageSrc={latestInspection.image_path}
              defects={defects}
              filename={latestInspection.image_path.split('/').pop()}
            />
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
            Hover over bounding boxes to inspect damage details
          </div>
        </div>
      )}

      {/* Critical Alerts */}
      {criticalCount > 0 && (
        <div className="panel glow-red" style={{ padding: 14, border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="sidebar-label" style={{ color: '#ef4444' }}>⚠️ Critical Alerts</div>
          {defects
            .filter(d => d.severity === 'high' || d.severity === 'critical')
            .map(d => (
              <div
                key={d.id}
                onClick={() => onSelectDefect?.(d)}
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  marginBottom: 6,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
                    ⚠️ {d.type.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={severityBadge(d.severity)}>{d.severity}</span>
                </div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>
                  {Math.round(d.confidence * 100)}% confidence • {d.defect_size?.toFixed(1)} mm
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Selected Defect Detail */}
      {selectedDefect ? (
        <div className="panel slide-up" style={{ padding: 14, border: '1px solid rgba(212,175,55,0.25)' }}>
          <div className="sidebar-label" style={{ color: '#d4af37' }}>Selected Defect</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', textTransform: 'capitalize' }}>
                {selectedDefect.type.replace('_', ' ')}
              </div>
              {selectedDefect.is_demo && (
                <span style={{ fontSize: 10, color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '1px 5px', borderRadius: 3, marginTop: 2, display: 'inline-block' }}>
                  DEMO
                </span>
              )}
            </div>
            <span className={severityBadge(selectedDefect.severity)}>{selectedDefect.severity}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              ['Confidence', `${Math.round(selectedDefect.confidence * 100)}%`],
              ['Size', `${selectedDefect.defect_size?.toFixed(1) ?? '?'} mm`],
              ['X pos', selectedDefect.x?.toFixed(3) ?? '—'],
              ['Y pos', selectedDefect.y?.toFixed(3) ?? '—'],
              ['Z pos', selectedDefect.z?.toFixed(3) ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="panel-card" style={{ padding: '6px 8px' }}>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
              </div>
            ))}
          </div>

          {selectedDefect.description && (
            <div style={{
              background: 'rgba(255,255,255,0.6)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 12,
              color: '#4b5563',
              lineHeight: 1.6,
            }}>
              {selectedDefect.description}
            </div>
          )}

          <button
            onClick={() => onSelectDefect?.(null)}
            style={{
              marginTop: 10, width: '100%', padding: '6px',
              background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 6, color: '#6b7280', fontSize: 12, cursor: 'pointer',
            }}
          >
            ✕ Clear selection
          </button>
        </div>
      ) : (
        /* Defect List */
        defects.length > 0 && (
          <div className="panel" style={{ padding: 14 }}>
            <div className="sidebar-label">Defects — Click to locate on twin</div>
            <div className="flex flex-col gap-2">
              {defects.map(d => (
                <div
                  key={d.id}
                  onClick={() => onSelectDefect?.(d)}
                  className="panel-card"
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>
                      {d.type.replace('_', ' ')}
                    </span>
                    <span className={severityBadge(d.severity)}>{d.severity}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                    {Math.round(d.confidence * 100)}% conf • {d.defect_size?.toFixed(1)} mm
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
