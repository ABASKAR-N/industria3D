// PredictiveMaintenance.jsx — Advanced Industrial Predictive Maintenance & What-If Simulation Studio
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import {
  fetchComponents,
  fetchPredictiveMaintenance,
  simulateWhatIf,
  fetchHydraulicData,
} from '../api';
import { riskLevel, riskColor, healthColor } from '../utils';

// Preset scenarios for rapid What-If simulation
const SCENARIO_PRESETS = [
  {
    id: 'baseline',
    name: '⚡ Baseline Nominal',
    desc: 'Normal factory conditions & scheduled maintenance',
    load_factor: 1.0,
    temperature_offset_c: 0.0,
    vibration_factor: 1.0,
    cooler_efficiency_pct: 100.0,
    valve_lag_pct: 0.0,
    maintenance_delay_days: 0,
    lubrication_quality: 1.0,
    color: '#3b82f6',
  },
  {
    id: 'heatwave',
    name: '🔥 Summer Heatwave',
    desc: '+18°C ambient, 80% cooler efficiency, elevated load',
    load_factor: 1.15,
    temperature_offset_c: 18.0,
    vibration_factor: 1.25,
    cooler_efficiency_pct: 80.0,
    valve_lag_pct: 10.0,
    maintenance_delay_days: 0,
    lubrication_quality: 0.85,
    color: '#f97316',
  },
  {
    id: 'overload',
    name: '⚙️ Peak Heavy Overload',
    desc: '135% mechanical throughput, severe vibration harmonics',
    load_factor: 1.35,
    temperature_offset_c: 10.0,
    vibration_factor: 1.7,
    cooler_efficiency_pct: 85.0,
    valve_lag_pct: 22.0,
    maintenance_delay_days: 0,
    lubrication_quality: 0.75,
    color: '#ef4444',
  },
  {
    id: 'cooler_fail',
    name: '❄️ Cooler Degradation',
    desc: 'Cooling circuit clogged at 25% capacity, severe oil heat',
    load_factor: 1.05,
    temperature_offset_c: 25.0,
    vibration_factor: 1.35,
    cooler_efficiency_pct: 25.0,
    valve_lag_pct: 18.0,
    maintenance_delay_days: 0,
    lubrication_quality: 0.45,
    color: '#ec4899',
  },
  {
    id: 'deferred_maint',
    name: '⏳ Delayed Overhaul (+14d)',
    desc: 'Maintenance postponed by 14 days with contaminated lube',
    load_factor: 1.05,
    temperature_offset_c: 6.0,
    vibration_factor: 1.45,
    cooler_efficiency_pct: 75.0,
    valve_lag_pct: 15.0,
    maintenance_delay_days: 14,
    lubrication_quality: 0.4,
    color: '#a855f7',
  },
  {
    id: 'eco_optimized',
    name: '🌿 Optimized Eco Mode',
    desc: '85% derated load, fresh synthetic lubricant, 100% cooling',
    load_factor: 0.85,
    temperature_offset_c: -5.0,
    vibration_factor: 0.75,
    cooler_efficiency_pct: 100.0,
    valve_lag_pct: 0.0,
    maintenance_delay_days: 0,
    lubrication_quality: 1.0,
    color: '#10b981',
  },
];

// Dual-curve forecast tooltip
function DualForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const isForecast = d?.is_forecast;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(212, 175, 55, 0.35)',
      borderRadius: 10,
      padding: '12px 16px',
      fontSize: 12,
      minWidth: 220,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {isForecast && (
          <span style={{ fontSize: 10, color: '#d4af37', background: 'rgba(212,175,55,0.15)', padding: '2px 6px', borderRadius: 4 }}>
            FORECAST
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
          <span>Baseline Health:</span>
          <strong style={{ color: '#d4af37' }}>{d?.baseline_health?.toFixed(1)}%</strong>
        </div>

        {isForecast && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
              <span>Simulated Health:</span>
              <strong style={{ color: d?.simulated_health < 50 ? '#ef4444' : '#f97316' }}>
                {d?.simulated_health?.toFixed(1)}%
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: 4, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Impact Delta:</span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: (d?.simulated_health - d?.baseline_health) >= 0 ? '#10b981' : '#ef4444'
              }}>
                {(d?.simulated_health - d?.baseline_health) > 0 ? '+' : ''}
                {(d?.simulated_health - d?.baseline_health)?.toFixed(1)}%
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Simulated Risk:</span>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: riskColor(d?.simulated_risk_level || 'LOW'),
              }}>
                {d?.simulated_risk_level}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PredictiveMaintenance() {
  const [components, setComponents] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState(null);
  const [baseAnalytics, setBaseAnalytics] = useState(null);
  const [whatIfResult, setWhatIfResult] = useState(null);
  const [hydraulicData, setHydraulicData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState('whatif'); // 'whatif' | 'hydraulic' | 'sections'
  const [activePreset, setActivePreset] = useState('baseline');

  // Interactive What-If simulation parameters state
  const [params, setParams] = useState({
    load_factor: 1.0,
    temperature_offset_c: 0.0,
    vibration_factor: 1.0,
    cooler_efficiency_pct: 100.0,
    valve_lag_pct: 0.0,
    maintenance_delay_days: 0,
    lubrication_quality: 1.0,
    scenario_name: 'Baseline Nominal',
  });

  // Load components and initial baseline
  useEffect(() => {
    Promise.all([
      fetchComponents(),
      fetchHydraulicData().catch(() => ({ data: [] })),
    ])
      .then(([comps, hyd]) => {
        setComponents(comps);
        if (hyd?.data) setHydraulicData(hyd.data);
        if (comps.length > 0) {
          setSelectedCompId(comps[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load initial data:', err);
        setLoading(false);
      });
  }, []);

  // Fetch predictive maintenance analytics for selected component
  useEffect(() => {
    if (!selectedCompId) return;
    setLoading(true);

    fetchPredictiveMaintenance(selectedCompId)
      .then(data => {
        setBaseAnalytics(data);
        // Also trigger initial what-if simulation with current params
        return simulateWhatIf(selectedCompId, params);
      })
      .then(simData => {
        setWhatIfResult(simData);
      })
      .catch(err => {
        console.error('Error fetching predictive maintenance data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedCompId]);

  // Execute What-If simulation
  const runSimulation = useCallback(async (customParams = params) => {
    if (!selectedCompId) return;
    setSimulating(true);
    try {
      const res = await simulateWhatIf(selectedCompId, customParams);
      setWhatIfResult(res);
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setSimulating(false);
    }
  }, [selectedCompId, params]);

  // Handle Preset Selection
  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    const newParams = {
      load_factor: preset.load_factor,
      temperature_offset_c: preset.temperature_offset_c,
      vibration_factor: preset.vibration_factor,
      cooler_efficiency_pct: preset.cooler_efficiency_pct,
      valve_lag_pct: preset.valve_lag_pct,
      maintenance_delay_days: preset.maintenance_delay_days,
      lubrication_quality: preset.lubrication_quality,
      scenario_name: preset.name,
    };
    setParams(newParams);
    runSimulation(newParams);
  };

  // Handle Individual Slider Change
  const handleSliderChange = (field, value) => {
    setActivePreset('custom');
    const newParams = {
      ...params,
      [field]: value,
      scenario_name: 'Custom Parameter Scenario',
    };
    setParams(newParams);
    // Debounce or immediate run
    runSimulation(newParams);
  };

  // Reset to Baseline
  const resetToBaseline = () => {
    const baselinePreset = SCENARIO_PRESETS.find(p => p.id === 'baseline');
    if (baselinePreset) applyPreset(baselinePreset);
  };

  // Export scenario JSON report
  const exportReport = () => {
    if (!whatIfResult) return;
    const reportData = {
      timestamp: new Date().toISOString(),
      component_id: selectedCompId,
      scenario: params,
      simulation_results: whatIfResult,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predictive_maintenance_whatif_${selectedCompId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Selected component details
  const selectedComponent = useMemo(() => {
    return components.find(c => c.id === selectedCompId) || null;
  }, [components, selectedCompId]);

  if (loading && !baseAnalytics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', flexDirection: 'column', gap: 16 }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%',
          border: '3px solid rgba(212,175,55,0.2)',
          borderTop: '3px solid #d4af37',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ color: '#6b7280', fontSize: 14, fontWeight: 500 }}>
          Initializing Predictive Maintenance Intelligence...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const baselineHealth = baseAnalytics?.current_health ?? 85.0;
  const simulatedRul = whatIfResult?.simulated_rul_days ?? baseAnalytics?.rul_days ?? 30;
  const baselineRul = baseAnalytics?.rul_days ?? 30;
  const rulDelta = whatIfResult ? whatIfResult.rul_delta_days : 0;
  const failProb = whatIfResult?.simulated_failure_prob_pct ?? baseAnalytics?.failure_probability_pct ?? 12.0;
  const failProbDelta = whatIfResult ? whatIfResult.failure_prob_delta_pct : 0;
  const stressMultiplier = whatIfResult?.stress_multiplier ?? 1.0;
  const actionPriority = whatIfResult?.simulated_action_priority ?? baseAnalytics?.action_priority ?? 'Standard';

  const chartTrajectory = whatIfResult?.trajectory || [];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto', color: '#1f2937' }}>

      {/* ─── Top Header Ribbon ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🔮</span>
            <h1 style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: 0,
              color: 'var(--color-text-primary, #1f2937)',
            }}>
              Predictive Maintenance Intelligence
            </h1>
            <span style={{
              background: 'rgba(212,175,55,0.15)',
              color: '#d4af37',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}>
              WHAT-IF ENGINE v2.0
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 13 }}>
            Continuous RUL degradation forecasting, stress-scenario simulation, and prescriptive asset intervention.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(212,175,55,0.08)',
          padding: 4,
          borderRadius: 10,
          border: '1px solid rgba(212,175,55,0.2)',
          gap: 4,
        }}>
          <button
            onClick={() => setActiveTab('whatif')}
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              border: 'none',
              background: activeTab === 'whatif' ? '#d4af37' : 'transparent',
              color: activeTab === 'whatif' ? '#ffffff' : '#4b5563',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚡</span> What-If Scenario Studio
          </button>
          <button
            onClick={() => setActiveTab('hydraulic')}
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              border: 'none',
              background: activeTab === 'hydraulic' ? '#d4af37' : 'transparent',
              color: activeTab === 'hydraulic' ? '#ffffff' : '#4b5563',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💧</span> Hydraulic Sensor Telemetry
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              border: 'none',
              background: activeTab === 'sections' ? '#d4af37' : 'transparent',
              color: activeTab === 'sections' ? '#ffffff' : '#4b5563',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📋</span> Subsystem Risk Matrix
          </button>
        </div>
      </div>

      {/* ─── Asset Selector Strip ─── */}
      <div className="panel" style={{
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Monitored Asset:
          </span>
          {components.map(c => {
            const isSel = c.id === selectedCompId;
            const hc = healthColor(c.health_score);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCompId(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: isSel ? `1px solid ${hc}` : '1px solid rgba(212,175,55,0.2)',
                  background: isSel ? `${hc}18` : 'rgba(255,255,255,0.5)',
                  color: isSel ? hc : '#4b5563',
                  fontSize: 12,
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{c.type?.toLowerCase().includes('pump') ? '🌀' : c.type?.toLowerCase().includes('valve') ? '🚰' : '⚙️'}</span>
                <span>{c.name}</span>
                <span style={{
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: `${hc}22`,
                }}>
                  {Math.round(c.health_score)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={resetToBaseline}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(156, 163, 175, 0.4)',
              background: 'transparent',
              color: '#4b5563',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↺ Reset Baseline
          </button>
          <button
            onClick={exportReport}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid rgba(212,175,55,0.4)',
              background: 'rgba(212,175,55,0.12)',
              color: '#d4af37',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📥</span> Export Scenario
          </button>
        </div>
      </div>

      {/* ─── Executive KPI Cards Ribbon ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Health Score */}
        <div className="panel" style={{ padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Current Asset Health
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: healthColor(baselineHealth), fontFamily: 'JetBrains Mono, monospace' }}>
              {baselineHealth.toFixed(1)}%
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: riskColor(baseAnalytics?.current_risk_level || 'LOW'),
            }}>
              [{baseAnalytics?.current_risk_level || 'LOW'}]
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Day-14 Simulated: <strong style={{ color: whatIfResult?.simulated_health_day14 < 50 ? '#ef4444' : '#f97316' }}>
              {whatIfResult?.simulated_health_day14 ?? '—'}%
            </strong>
          </div>
        </div>

        {/* Remaining Useful Life */}
        <div className="panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Remaining Useful Life (RUL)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: simulatedRul <= 7 ? '#ef4444' : simulatedRul <= 20 ? '#f97316' : '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>
              {simulatedRul}
            </span>
            <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 600 }}>Days</span>
            {rulDelta !== 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: rulDelta < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                color: rulDelta < 0 ? '#ef4444' : '#22c55e',
              }}>
                {rulDelta > 0 ? `+${rulDelta}` : rulDelta}d
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Baseline: {baselineRul} days (~{baselineRul * 24} operating hrs)
          </div>
        </div>

        {/* 14-Day Failure Probability */}
        <div className="panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            14-Day Failure Probability
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: failProb >= 60 ? '#ef4444' : failProb >= 30 ? '#f97316' : '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>
              {failProb.toFixed(1)}%
            </span>
            {failProbDelta !== 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: failProbDelta > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                color: failProbDelta > 0 ? '#ef4444' : '#22c55e',
              }}>
                {failProbDelta > 0 ? `+${failProbDelta}%` : `${failProbDelta}%`}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, failProb)}%`,
              height: '100%',
              background: failProb >= 60 ? '#ef4444' : failProb >= 30 ? '#f97316' : '#22c55e',
              transition: 'all 0.3s ease',
            }} />
          </div>
        </div>

        {/* Stress Multiplier */}
        <div className="panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Degradation Velocity Factor
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{
              fontSize: 32,
              fontWeight: 800,
              color: stressMultiplier > 2.0 ? '#ef4444' : stressMultiplier > 1.2 ? '#f97316' : '#10b981',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {stressMultiplier.toFixed(2)}x
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: stressMultiplier > 2.0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: stressMultiplier > 2.0 ? '#ef4444' : '#10b981',
            }}>
              {stressMultiplier > 2.0 ? 'HIGH STRESS' : stressMultiplier > 1.2 ? 'ELEVATED' : 'NOMINAL'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
            Relative to standard baseline operating pace
          </div>
        </div>

        {/* Intervention Priority */}
        <div className="panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Maintenance Intervention
          </div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: actionPriority === 'Urgent' ? '#ef4444' : actionPriority === 'Elevated' ? '#f97316' : '#22c55e' }}>
            {actionPriority} Priority
          </div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6, lineHeight: 1.4 }}>
            {baseAnalytics?.maintenance_window || 'Nominal Routine Inspection'}
          </div>
        </div>
      </div>

      {/* ─── TAB 1: WHAT-IF PREDICTION STUDIO ─── */}
      {activeTab === 'whatif' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Scenario Preset Selection Carousel/Grid */}
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  What-If Scenario Presets
                </h3>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  Select an industrial simulation template to instantly stress-test this component.
                </span>
              </div>
              {simulating && (
                <div style={{ fontSize: 12, color: '#d4af37', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d4af37', animation: 'pulse-slow 1s infinite' }} />
                  Simulating physics model...
                </div>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}>
              {SCENARIO_PRESETS.map(preset => {
                const isSelected = activePreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: isSelected ? `2px solid ${preset.color}` : '1px solid rgba(99,130,190,0.15)',
                      background: isSelected ? `${preset.color}0c` : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSelected ? `0 4px 16px ${preset.color}25` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? preset.color : '#1f2937' }}>
                        {preset.name}
                      </span>
                      {isSelected && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: preset.color, background: `${preset.color}20`, padding: '1px 5px', borderRadius: 4 }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                      {preset.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Parameters Sliders + Realtime Forecast Comparison */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '380px 1fr',
            gap: 20,
          }}>

            {/* Parameter Sliders Panel */}
            <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Operational Stress Knobs
                </h3>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  Fine-tune continuous environmental & hydraulic factors.
                </span>
              </div>

              {/* Knob 1: Load Factor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Mechanical Load</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: params.load_factor > 1.2 ? '#ef4444' : params.load_factor > 1.0 ? '#f97316' : '#10b981'
                  }}>
                    {Math.round(params.load_factor * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.6"
                  step="0.05"
                  value={params.load_factor}
                  onChange={e => handleSliderChange('load_factor', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>50% (Idle)</span>
                  <span>100% (Nominal)</span>
                  <span>160% (Overload)</span>
                </div>
              </div>

              {/* Knob 2: Temperature Offset */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Temperature Offset</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: params.temperature_offset_c > 15 ? '#ef4444' : params.temperature_offset_c > 5 ? '#f97316' : '#10b981'
                  }}>
                    {params.temperature_offset_c > 0 ? `+${params.temperature_offset_c}°C` : `${params.temperature_offset_c}°C`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="45"
                  step="1"
                  value={params.temperature_offset_c}
                  onChange={e => handleSliderChange('temperature_offset_c', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>-15°C (Chilled)</span>
                  <span>0°C (Ambient)</span>
                  <span>+45°C (Thermal Peak)</span>
                </div>
              </div>

              {/* Knob 3: Vibration Factor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Vibration Velocity (ISO)</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: params.vibration_factor > 1.6 ? '#ef4444' : params.vibration_factor > 1.1 ? '#f97316' : '#10b981'
                  }}>
                    {params.vibration_factor.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.8"
                  step="0.05"
                  value={params.vibration_factor}
                  onChange={e => handleSliderChange('vibration_factor', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>0.5x (Smooth)</span>
                  <span>1.0x (Standard)</span>
                  <span>2.8x (Severe Harmonics)</span>
                </div>
              </div>

              {/* Knob 4: Cooler Efficiency */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Hydraulic Cooler Efficiency</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: params.cooler_efficiency_pct < 50 ? '#ef4444' : params.cooler_efficiency_pct < 80 ? '#f97316' : '#10b981'
                  }}>
                    {Math.round(params.cooler_efficiency_pct)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="100"
                  step="5"
                  value={params.cooler_efficiency_pct}
                  onChange={e => handleSliderChange('cooler_efficiency_pct', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>15% (Clogged)</span>
                  <span>60%</span>
                  <span>100% (Pristine)</span>
                </div>
              </div>

              {/* Knob 5: Valve Switching Lag */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Valve Switching Lag</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: params.valve_lag_pct > 25 ? '#ef4444' : params.valve_lag_pct > 10 ? '#f97316' : '#10b981'
                  }}>
                    {Math.round(params.valve_lag_pct)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="2"
                  value={params.valve_lag_pct}
                  onChange={e => handleSliderChange('valve_lag_pct', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>0% (Instant)</span>
                  <span>25% (Delayed)</span>
                  <span>50% (Sticking)</span>
                </div>
              </div>

              {/* Knob 6: Maintenance Postponed Days */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Service Overdue Delay</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: params.maintenance_delay_days > 10 ? '#ef4444' : params.maintenance_delay_days > 0 ? '#f97316' : '#10b981'
                  }}>
                    +{params.maintenance_delay_days} Days
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={params.maintenance_delay_days}
                  onChange={e => handleSliderChange('maintenance_delay_days', parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>0d (On Time)</span>
                  <span>+15d</span>
                  <span>+30d (Critical)</span>
                </div>
              </div>

              {/* Knob 7: Lubrication Quality */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Lubrication Quality</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: params.lubrication_quality < 0.5 ? '#ef4444' : params.lubrication_quality < 0.8 ? '#f97316' : '#10b981'
                  }}>
                    {params.lubrication_quality >= 0.9 ? 'Optimal' : params.lubrication_quality >= 0.7 ? 'Good' : params.lubrication_quality >= 0.4 ? 'Degraded' : 'Severely Contaminated'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.1"
                  value={params.lubrication_quality}
                  onChange={e => handleSliderChange('lubrication_quality', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#d4af37', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>Contaminated</span>
                  <span>Degraded</span>
                  <span>Fresh</span>
                </div>
              </div>

            </div>

            {/* Right: Dual Forecast Curve Comparison Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* The Forecast Chart */}
              <div className="panel" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                      Degradation Trajectory: Baseline vs What-If Simulated
                    </h3>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      Forecast comparison with critical threshold envelopes over 14 operational days.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 14, height: 3, background: '#d4af37', borderRadius: 2 }} />
                      <span style={{ color: '#4b5563' }}>Baseline Trajectory</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 14, height: 3, background: '#ef4444', borderRadius: 2 }} />
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>What-If Simulated</span>
                    </div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartTrajectory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="baseHealthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d4af37" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#d4af37" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="simHealthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,190,0.12)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      tickFormatter={v => v.slice(5)}
                      axisLine={{ stroke: 'rgba(212,175,55,0.2)' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}%`}
                    />
                    <Tooltip content={<DualForecastTooltip />} />

                    {/* Reference Lines */}
                    <ReferenceLine x={todayStr} stroke="#d4af37" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'TODAY', fill: '#d4af37', fontSize: 10, position: 'insideTopLeft' }} />
                    <ReferenceLine y={60} stroke="#eab308" strokeDasharray="3 3" opacity={0.5} label={{ value: 'Elevated Risk (60%)', fill: '#eab308', fontSize: 10 }} />
                    <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} label={{ value: 'Critical Threshold (40%)', fill: '#ef4444', fontSize: 10 }} />

                    {/* Baseline Area */}
                    <Area
                      type="monotone"
                      dataKey="baseline_health"
                      name="Baseline Health"
                      stroke="#d4af37"
                      strokeWidth={2}
                      fill="url(#baseHealthGrad)"
                    />

                    {/* What-If Simulated Line */}
                    <Area
                      type="monotone"
                      dataKey="simulated_health"
                      name="Simulated Health"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      strokeDasharray="5 3"
                      fill="url(#simHealthGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* AI Prescriptive Recommendations & Warnings */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}>
                {/* Warnings */}
                <div className="panel" style={{
                  padding: 16,
                  border: whatIfResult?.operational_warnings?.length ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,130,190,0.15)',
                  background: whatIfResult?.operational_warnings?.length ? 'rgba(239,68,68,0.03)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                      Scenario Stress Warnings
                    </h4>
                  </div>
                  {whatIfResult?.operational_warnings?.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {whatIfResult.operational_warnings.map((w, idx) => (
                        <li key={idx} style={{ lineHeight: 1.4 }}>{w}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✅</span> No critical operational boundary exceedances.
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                <div className="panel" style={{
                  padding: 16,
                  border: '1px solid rgba(212,175,55,0.3)',
                  background: 'rgba(212,175,55,0.03)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>💡</span>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#d4af37' }}>
                      Prescriptive Action Plan
                    </h4>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#4b5563', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {whatIfResult?.recommendations?.map((r, idx) => (
                      <li key={idx} style={{ lineHeight: 1.4 }}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>

          </div>

          {/* Section Wear Impact Heatmap */}
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700 }}>
              Subsystem Section Wear Impact
            </h3>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Comparison of structural degradation across pump and motor assembly zones under this What-If scenario.
            </span>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginTop: 16,
            }}>
              {whatIfResult?.sections_impact?.map((sec, idx) => {
                const isCrit = sec.simulated_wear >= 70;
                const isWarn = sec.simulated_wear >= 45;
                const secColor = isCrit ? '#ef4444' : isWarn ? '#f97316' : '#10b981';

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.6)',
                      border: `1px solid ${secColor}40`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>
                        {sec.section_name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: secColor,
                        background: `${secColor}18`,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        {sec.risk_status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                      <span>Baseline: {sec.baseline_wear}%</span>
                      <span>
                        Simulated: <strong style={{ color: secColor }}>{sec.simulated_wear}%</strong>
                        {sec.wear_delta !== 0 && (
                          <span style={{ marginLeft: 4, color: sec.wear_delta > 0 ? '#ef4444' : '#10b981' }}>
                            ({sec.wear_delta > 0 ? `+${sec.wear_delta}%` : `${sec.wear_delta}%`})
                          </span>
                        )}
                      </span>
                    </div>

                    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, sec.simulated_wear)}%`,
                        height: '100%',
                        background: secColor,
                        transition: 'all 0.3s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ─── TAB 2: HYDRAULIC SENSOR TELEMETRY ─── */}
      {activeTab === 'hydraulic' && (() => {
        // Sensor metadata map — each key matches the chart metric
        const SENSOR_META = {
          cooler_condition: {
            id: 'TS1 · TS2',
            label: 'Cooling Circuit Temperature Sensors',
            location: 'Cooler inlet & outlet manifold',
            type: 'PT100 RTD Thermistor',
            rate: '1 Hz per cycle',
            role: 'Cooler Efficiency Monitoring',
            action: 'Triggers cooler-flush maintenance when efficiency drops below 80%. Feeds the What-If cooler degradation parameter.',
            color: '#3b82f6',
            icon: '❄️',
          },
          valve_condition: {
            id: 'VS1',
            label: 'Valve Switching Sensor',
            location: 'Proportional directional control valve body',
            type: 'Inductive proximity + LVDT position',
            rate: '10 Hz per cycle',
            role: 'Valve Lag & Switch Health',
            action: 'Detects sticky or delayed switching. Drives valve_lag_pct in What-If simulation and flags valve replacement alerts.',
            color: '#10b981',
            icon: '🔧',
          },
          pump_leakage: {
            id: 'Profile Label · EPS1',
            label: 'Pump Internal Leakage Encoder',
            location: 'Hydraulic piston pump housing',
            type: 'Efficiency-derived from motor power (EPS1)',
            rate: 'Per cycle (derived)',
            role: 'Internal Leakage Classification',
            action: 'Classified as Level 0 (no leak), 1 (weak leakage) or 2 (severe). Automatically escalates maintenance priority and triggers wear acceleration in prediction engine.',
            color: '#ef4444',
            icon: '💧',
          },
          accumulator_pressure: {
            id: 'PS4 · AS1',
            label: 'Accumulator Pressure Sensor',
            location: 'Hydraulic bladder accumulator line, port PS4',
            type: 'Piezoresistive pressure transducer',
            rate: '100 Hz per cycle',
            role: 'Pressure Stability & Surge Detection',
            action: 'Monitors pressure buffer health. A drop below 90 bar indicates bladder pre-charge loss. Feeds accumulator wear score in the risk matrix.',
            color: '#f59e0b',
            icon: '🔴',
          },
          avg_pressure_PS1: {
            id: 'PS1',
            label: 'Primary System Pressure Sensor',
            location: 'High-pressure pump outlet, upstream of proportional valve',
            type: 'Ceramic capacitive pressure sensor',
            rate: '100 Hz per cycle',
            role: 'Main Circuit Load Pressure',
            action: 'Primary input for load_factor estimation in What-If scenarios. Sustained values >160 bar trigger overload wear multipliers in the prediction engine.',
            color: '#8b5cf6',
            icon: '📈',
          },
          avg_volume_flow_FS1: {
            id: 'FS1',
            label: 'Volume Flow Rate Sensor',
            location: 'Return line before the tank, downstream of directional valve',
            type: 'Turbine flow meter',
            rate: '10 Hz per cycle',
            role: 'Hydraulic Fluid Flow Integrity',
            action: 'Elevated flow relative to PS1 pressure indicates internal bypass or leakage. Cross-referenced with pump_leakage for dual-sensor fault confirmation.',
            color: '#06b6d4',
            icon: '🌊',
          },
        };

        const TelemetryCard = ({ metricKey, title, value, chartMin, chartMax, chartType = 'monotone', children }) => {
          const meta = SENSOR_META[metricKey];
          const [expanded, setExpanded] = useState(false);
          return (
            <div style={{ background: '#ffffff', borderRadius: 10, border: `1px solid ${meta.color}25`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              {/* Chart header */}
              <div style={{ padding: '14px 16px 0 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>{title}</span>
                  <span style={{ color: meta.color }}>{value}</span>
                </div>
              </div>

              {/* Chart */}
              <div style={{ padding: '0 16px' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={hydraulicData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="cycle" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={chartMin !== undefined ? [chartMin, chartMax] : ['auto', 'auto']} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type={chartType} dataKey={metricKey} stroke={meta.color} fill={`${meta.color}20`} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ── Sensor attribution strip ── */}
              <div style={{
                margin: '0 12px 12px 12px',
                borderRadius: 8,
                background: `${meta.color}08`,
                border: `1px solid ${meta.color}20`,
                overflow: 'hidden',
              }}>
                {/* Always-visible summary row */}
                <button
                  onClick={() => setExpanded(e => !e)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14 }}>{meta.icon}</span>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.04em' }}>
                        {meta.id}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {meta.role}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                      background: `${meta.color}15`, color: meta.color,
                      padding: '2px 6px', borderRadius: 4,
                    }}>
                      {meta.rate}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: 12, transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                  </div>
                </button>

                {/* Expanded detail panel */}
                {expanded && (
                  <div style={{ padding: '0 12px 12px 12px', borderTop: `1px solid ${meta.color}15` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 10 }}>
                      {[
                        ['Sensor Label', meta.label],
                        ['Sensor Type', meta.type],
                        ['Mounting Location', meta.location],
                        ['Sampling Rate', meta.rate],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{k}</div>
                          <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, padding: '8px 10px', background: `${meta.color}08`, borderRadius: 6, borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>⚙ Action / Decision Driven</div>
                      <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.5 }}>{meta.action}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    Hydraulic Test Rig Real-Time Sensor Telemetry
                  </h3>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    Live multi-cycle condition monitoring. Click any sensor badge to see sensor ID, location, and the action it drives.
                  </span>
                </div>
                <span style={{
                  background: 'rgba(34,197,94,0.12)',
                  color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.3)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                  RIG STREAM ACTIVE ({hydraulicData.length} CYCLES)
                </span>
              </div>

              {/* Sensor legend bar */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20,
                padding: '10px 14px',
                background: 'rgba(212,175,55,0.04)',
                border: '1px solid rgba(212,175,55,0.15)',
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, alignSelf: 'center', marginRight: 4 }}>ACTIVE SENSORS:</span>
                {Object.values(SENSOR_META).map(m => (
                  <span key={m.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 10, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 20,
                    background: `${m.color}12`, color: m.color,
                    border: `1px solid ${m.color}30`,
                  }}>
                    {m.icon} {m.id}
                  </span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                <TelemetryCard
                  metricKey="cooler_condition"
                  title="Cooler Efficiency Profile"
                  value={`${hydraulicData[hydraulicData.length - 1]?.cooler_condition ?? 100}%`}
                  chartMin={0} chartMax={100}
                />
                <TelemetryCard
                  metricKey="valve_condition"
                  title="Valve Switching Health"
                  value={`${hydraulicData[hydraulicData.length - 1]?.valve_condition ?? 100}%`}
                  chartMin={0} chartMax={100}
                />
                <TelemetryCard
                  metricKey="pump_leakage"
                  title="Internal Pump Leakage"
                  value={`Level ${hydraulicData[hydraulicData.length - 1]?.pump_leakage ?? 0}`}
                  chartMin={0} chartMax={3}
                  chartType="step"
                />
                <TelemetryCard
                  metricKey="accumulator_pressure"
                  title="Hydraulic Accumulator Pressure"
                  value={`${hydraulicData[hydraulicData.length - 1]?.accumulator_pressure ?? 125} bar`}
                  chartMin={80} chartMax={135}
                />
                <TelemetryCard
                  metricKey="avg_pressure_PS1"
                  title="Average Primary Pressure (PS1)"
                  value={`${hydraulicData[hydraulicData.length - 1]?.avg_pressure_PS1 ?? 155} bar`}
                />
                <TelemetryCard
                  metricKey="avg_volume_flow_FS1"
                  title="Volume Flow Rate (FS1)"
                  value={`${hydraulicData[hydraulicData.length - 1]?.avg_volume_flow_FS1 ?? 9.8} l/min`}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── TAB 3: SUBSYSTEM RISK MATRIX & SCHEDULE ─── */}
      {activeTab === 'sections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700 }}>
              Subsystem Degradation & 3D Bounded Coordinate Schedule
            </h3>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Detailed component breakdown mapped to digital twin coordinate frames and failure risk curves.
            </span>

            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
                    {['Subsystem Section', 'Defects Found', 'Highest Severity', 'Baseline Wear', 'What-If Wear', '3D Coordinate Center', 'Risk Status'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', color: '#9ca3af', fontWeight: 600, textAlign: 'left', fontSize: 11, textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(baseAnalytics?.sections_wear || []).map((sec, idx) => {
                    const matchWhatIf = whatIfResult?.sections_impact?.find(s => s.section_name === sec.section_name);
                    const simWear = matchWhatIf?.simulated_wear ?? sec.wear_level;
                    const rStatus = matchWhatIf?.risk_status ?? (sec.wear_level >= 70 ? 'CRITICAL' : sec.wear_level >= 50 ? 'HIGH' : 'LOW');
                    const color = riskColor(rStatus);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(99,130,190,0.08)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1f2937' }}>
                          {sec.section_name}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                          {sec.defect_count} defect(s)
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: `${color}18`,
                            color: color,
                          }}>
                            {sec.highest_severity?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#d4af37' }}>
                          {sec.wear_level.toFixed(1)}%
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: color }}>
                          {simWear.toFixed(1)}%
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b7280' }}>
                          {sec.bbox_3d?.center ? `[${sec.bbox_3d.center.map(v => v.toFixed(2)).join(', ')}]` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontWeight: 800,
                            fontSize: 11,
                            color: color,
                          }}>
                            {rStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
