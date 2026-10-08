// PredictionChart.jsx — 7-day health/risk chart + history + recommendations + What-If overlay
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend, LineChart, Line,
} from 'recharts';
import { riskColor, riskLevel, formatDate } from '../utils';
import { simulateWhatIf } from '../api';

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(212,175,55,0.2)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      minWidth: 180,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: '#4b5563', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {d?.is_forecast && (
        <div style={{ color: '#eab308', fontSize: 10, marginBottom: 4 }}>📡 7-DAY FORECAST</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{p.name.includes('Health') ? '%' : ''}</strong>
        </div>
      ))}
      {d?.whatIfHealth !== undefined && (
        <div style={{ color: '#ef4444', marginTop: 2 }}>
          What-If Health: <strong>{d.whatIfHealth?.toFixed(1)}%</strong>
        </div>
      )}
      {d?.risk_level && (
        <div style={{ marginTop: 6, color: riskColor(d.risk_level), fontWeight: 700 }}>
          Risk: {d.risk_level}
        </div>
      )}
    </div>
  );
}

export default function PredictionChart({ prediction, history, onNavigate }) {
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfData, setWhatIfData] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('heatwave');
  const [loadFactor, setLoadFactor] = useState(1.2);

  const presets = [
    { id: 'heatwave', name: '🔥 Summer Heat', temp: 18.0, load: 1.15, vibe: 1.25, delay: 0 },
    { id: 'overload', name: '⚙️ Heavy Overload', temp: 10.0, load: 1.35, vibe: 1.7, delay: 0 },
    { id: 'delay', name: '⏳ Delayed Overhaul', temp: 5.0, load: 1.05, vibe: 1.3, delay: 14 },
    { id: 'eco', name: '🌿 Eco Optimized', temp: -5.0, load: 0.85, vibe: 0.8, delay: 0 },
  ];

  useEffect(() => {
    if (!whatIfOpen || !prediction?.component_id) return;
    const curP = presets.find(p => p.id === selectedPreset) || presets[0];
    simulateWhatIf(prediction.component_id, {
      load_factor: curP.load,
      temperature_offset_c: curP.temp,
      vibration_factor: curP.vibe,
      maintenance_delay_days: curP.delay,
      scenario_name: curP.name,
    }).then(res => {
      setWhatIfData(res);
    }).catch(err => {
      console.error('Failed to load what-if on dashboard:', err);
    });
  }, [whatIfOpen, selectedPreset, prediction?.component_id]);

  if (!prediction) {
    return (
      <div className="panel" style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 14, marginBottom: 6 }}>No prediction data available.</div>
        <div style={{ fontSize: 12 }}>Run an inspection to generate a 7-day forecast.</div>
      </div>
    );
  }

  const forecast = prediction.forecast || [];
  const today = new Date().toISOString().slice(0, 10);

  // Merge What-If trajectory if active
  const chartData = forecast.map((p, idx) => {
    let whatIfHealth = undefined;
    if (whatIfOpen && whatIfData?.trajectory) {
      const match = whatIfData.trajectory.find(t => t.date === p.date);
      if (match && match.is_forecast) {
        whatIfHealth = match.simulated_health;
      }
    }
    return {
      ...p,
      healthDisplay: p.health_score,
      riskDisplay: p.risk_score,
      whatIfHealth: whatIfHealth,
    };
  });

  // Get current risk level for styling
  const currentRisk = prediction.current_risk_level || riskLevel(prediction.current_health);

  const riskColors = {
    LOW: '#22c55e',
    MEDIUM: '#eab308',
    HIGH: '#f97316',
    CRITICAL: '#ef4444',
  };
  const currentRiskColor = riskColors[currentRisk] || '#4b5563';

  return (
    <div className="flex flex-col gap-4">

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1f2937' }}>
            7-Day Health & Risk Forecast
          </h3>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Trend: <span style={{ color: prediction.trend === 'degrading' ? '#f97316' : '#22c55e', fontWeight: 600 }}>
              {prediction.trend || '—'}
            </span>
            {' · '}
            Component: <span style={{ color: '#d4af37' }}>{prediction.component_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* What-If quick toggle */}
          <button
            onClick={() => setWhatIfOpen(!whatIfOpen)}
            style={{
              background: whatIfOpen ? 'rgba(239,68,68,0.15)' : 'rgba(212,175,55,0.12)',
              border: whatIfOpen ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(212,175,55,0.3)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: whatIfOpen ? '#ef4444' : '#d4af37',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s',
            }}
          >
            <span>⚡</span>
            <span>{whatIfOpen ? 'Close What-If Overlay' : 'What-If Forecast Simulator'}</span>
          </button>

          {prediction.is_demo_data && (
            <div className="demo-banner">📊 Demo historical data</div>
          )}
          <div style={{
            background: `${currentRiskColor}18`,
            border: `1px solid ${currentRiskColor}40`,
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            color: currentRiskColor,
          }}>
            Current: {currentRisk}
          </div>
        </div>
      </div>

      {/* What-If Scenario Selection Ribbon (when active) */}
      {whatIfOpen && (
        <div className="panel" style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.03)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
              ⚡ What-If Scenarios:
            </span>
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: selectedPreset === p.id ? '1px solid #ef4444' : '1px solid rgba(156,163,175,0.3)',
                  background: selectedPreset === p.id ? '#ef4444' : 'rgba(255,255,255,0.8)',
                  color: selectedPreset === p.id ? '#ffffff' : '#4b5563',
                  fontSize: 11,
                  fontWeight: selectedPreset === p.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>

          {whatIfData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
              <span style={{ color: '#6b7280' }}>
                Simulated RUL: <strong style={{ color: '#ef4444' }}>{whatIfData.simulated_rul_days}d</strong>
                {' '}({whatIfData.rul_delta_days > 0 ? `+${whatIfData.rul_delta_days}` : whatIfData.rul_delta_days}d)
              </span>
              <span style={{ color: '#6b7280' }}>
                14d Failure Prob: <strong style={{ color: '#ef4444' }}>{whatIfData.simulated_failure_prob_pct}%</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Health Chart */}
      <div className="panel" style={{ padding: '16px 12px' }}>
        <div className="sidebar-label" style={{ marginBottom: 12 }}>Health Score Trajectory</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#d4af37" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,190,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickFormatter={v => v.slice(5)}
              axisLine={{ stroke: 'rgba(212,175,55,0.2)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={today} stroke="#d4af37" strokeDasharray="4 4" opacity={0.6} label={{ value: 'TODAY', fill: '#d4af37', fontSize: 9 }} />
            <ReferenceLine y={60} stroke="#eab308" strokeDasharray="3 3" opacity={0.4} />
            <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 3" opacity={0.4} />
            <Area
              type="monotone"
              dataKey="healthDisplay"
              name="Health Score"
              stroke="#d4af37"
              fill="url(#healthGrad)"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!payload.is_forecast) return null;
                return <circle key={cx} cx={cx} cy={cy} r={3} fill="#eab308" stroke="none" />;
              }}
            />
            {whatIfOpen && (
              <Area
                type="monotone"
                dataKey="whatIfHealth"
                name="What-If Health"
                stroke="#ef4444"
                strokeWidth={2.5}
                strokeDasharray="4 3"
                fill="none"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!payload.whatIfHealth) return null;
                  return <circle key={cx} cx={cx} cy={cy} r={3.5} fill="#ef4444" stroke="#ffffff" strokeWidth={1} />;
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Score Chart */}
      <div className="panel" style={{ padding: '16px 12px' }}>
        <div className="sidebar-label" style={{ marginBottom: 12 }}>Risk Score Projection</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,190,0.1)" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={today} stroke="#d4af37" strokeDasharray="4 4" opacity={0.6} />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" opacity={0.4} />
            <ReferenceLine y={40} stroke="#eab308" strokeDasharray="3 3" opacity={0.4} />
            <Line
              type="monotone"
              dataKey="riskDisplay"
              name="Risk Score"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 2, fill: '#f97316' }}
              activeDot={{ r: 5 }}
              strokeDasharray={(d) => d?.is_forecast ? '5 3' : '0'}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendation */}
      <div className="panel" style={{
        padding: 16,
        border: `1px solid ${currentRiskColor}30`,
        background: `${currentRiskColor}08`,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 22 }}>
            {currentRisk === 'LOW' ? '✅' : currentRisk === 'MEDIUM' ? '⚠️' : currentRisk === 'HIGH' ? '🔴' : '🚨'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: currentRiskColor, marginBottom: 4 }}>
              Maintenance Recommendation
            </div>
            <div style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.6 }}>
              {prediction.recommendation}
            </div>
          </div>
        </div>
      </div>

      {/* Inspection History Table */}
      {history && history.length > 0 && (
        <div className="panel" style={{ padding: 16 }}>
          <div className="sidebar-label" style={{ marginBottom: 10 }}>Inspection History</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
                  {['Date', 'Health', 'Defects', 'Risk', 'Type'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', color: '#9ca3af', fontWeight: 600, textAlign: 'left', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((insp) => {
                  const rl = riskLevel(insp.health_score);
                  const rc = riskColors[rl];
                  return (
                    <tr key={insp.id} style={{ borderBottom: '1px solid rgba(99,130,190,0.07)' }}>
                      <td style={{ padding: '7px 8px', color: '#4b5563' }}>{formatDate(insp.timestamp)}</td>
                      <td style={{ padding: '7px 8px', color: rc, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                        {insp.health_score?.toFixed(1)}%
                      </td>
                      <td style={{ padding: '7px 8px', color: '#f97316' }}>{insp.defects?.length ?? 0}</td>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{ color: rc, fontWeight: 700, fontSize: 10 }}>{rl}</span>
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        {insp.is_demo ? (
                          <span style={{ fontSize: 10, color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '1px 5px', borderRadius: 3 }}>DEMO</span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '1px 5px', borderRadius: 3 }}>REAL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
