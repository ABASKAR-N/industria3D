// MobileInspect.jsx — Responsive mobile inspection & KIRI Engine 3D reconstruction page
import { useState, useRef, useEffect } from 'react';
import {
  uploadInspection,
  fetchKiriBalance,
  reconstructKiri3D,
  fetchKiriStatus,
  syncKiriModel,
} from '../api';
import { severityBadge, healthColor, riskLevel } from '../utils';

import LiveCameraModal from '../components/LiveCameraModal';
import DefectBBoxViewer from '../components/DefectBBoxViewer';

function ConnectionDot({ online }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: online ? '#22c55e' : '#ef4444',
        boxShadow: `0 0 8px ${online ? '#22c55e' : '#ef4444'}`,
        animation: 'pulse-slow 2s infinite',
      }} />
      <span style={{ fontSize: 11, color: online ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
        {online ? 'Server Online' : 'Server Offline'}
      </span>
    </div>
  );
}

export default function MobileInspect({ onNavigate }) {
  // Inspection mode: 'defect' (YOLO) or 'kiri3d' (KIRI Engine Photogrammetry)
  const [activeTab, setActiveTab] = useState('kiri3d');

  // Shared state
  const [componentId, setComponentId] = useState('PUMP-001');
  const [serverOnline, setServerOnline] = useState(false);
  const [kiriBalance, setKiriBalance] = useState(null);

  // Live USB Camera Modal State
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [liveCameraTarget, setLiveCameraTarget] = useState('kiri3d'); // 'kiri3d' or 'defect'

  const handleLiveCameraCapture = (file) => {
    if (liveCameraTarget === 'kiri3d') {
      handleAddKiriFiles([file]);
    } else {
      handleAddDefectFiles([file]);
    }
  };

  // Mode A (Defect Detection) State
  const [notes, setNotes] = useState('');
  const [defectFiles, setDefectFiles] = useState([]);
  const [defectPreviews, setDefectPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [defectError, setDefectError] = useState(null);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  // Mode B (KIRI 3D Photogrammetry) State
  const [kiriFiles, setKiriFiles] = useState([]);
  const [kiriPreviews, setKiriPreviews] = useState([]);
  const [modelQuality, setModelQuality] = useState(1); // 0: High, 1: Medium, 2: Low
  const [textureQuality, setTextureQuality] = useState(1); // 0: 4K, 1: 2K
  const [kiriLoading, setKiriLoading] = useState(false);
  const [kiriProgress, setKiriProgress] = useState(0);
  const [kiriTask, setKiriTask] = useState(null);
  const [kiriStatus, setKiriStatus] = useState(null);
  const [kiriError, setKiriError] = useState(null);
  const [kiriComplete, setKiriComplete] = useState(null);
  const kiriMultiInputRef = useRef();
  const kiriCameraInputRef = useRef();

  // Check server connectivity & KIRI balance
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/api/health');
        setServerOnline(r.ok);
      } catch {
        setServerOnline(false);
      }

      try {
        const bal = await fetchKiriBalance();
        if (bal.success) setKiriBalance(bal.balance);
      } catch {
        setKiriBalance(null);
      }
    };

    check();
    const iv = setInterval(check, 8000);
    return () => clearInterval(iv);
  }, []);

  // Poll active KIRI reconstruction task
  useEffect(() => {
    if (!kiriTask?.serialize || kiriComplete) return;

    const poll = async () => {
      try {
        const res = await fetchKiriStatus(kiriTask.serialize);
        if (res.status?.success) {
          setKiriStatus(res.status);
          const code = res.status.status_code;

          if (code === 2) {
            // Task completed! Download/sync GLB
            const syncRes = await syncKiriModel(kiriTask.serialize);
            setKiriComplete({
              serialize: kiriTask.serialize,
              webPath: syncRes?.download?.web_path || `/3d_models/${componentId.toLowerCase().replace('-', '_')}.glb`,
            });
            setKiriLoading(false);
          } else if (code === 1 || code === 4) {
            setKiriError(`3D Reconstruction failed: ${res.status.status_text}`);
            setKiriLoading(false);
          }
        }
      } catch (err) {
        console.warn('KIRI task polling error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [kiriTask, kiriComplete, componentId]);

  // ─── Mode A: Defect Handlers ────────────────────────────────────────────────
  const handleAddDefectFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const newFiles = Array.from(filesList);
    setDefectFiles(prev => [...prev, ...newFiles]);
    setResult(null);
    setDefectError(null);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setDefectPreviews(prev => [...prev, { name: file.name, size: file.size, url: e.target.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveDefectFile = (idx) => {
    setDefectFiles(prev => prev.filter((_, i) => i !== idx));
    setDefectPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDefectUpload = async () => {
    if (defectFiles.length === 0) {
      setDefectError('Please select or capture at least one image first.');
      return;
    }
    if (!componentId.trim()) {
      setDefectError('Please enter a Component ID.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setDefectError(null);
    setResult(null);

    try {
      const data = await uploadInspection(
        componentId.trim(),
        defectFiles,
        notes,
        setProgress,
      );
      setResult(data);
    } catch (e) {
      setDefectError(e.response?.data?.detail || e.message || 'Upload failed. Check server connection.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const resetDefect = () => {
    setDefectFiles([]);
    setDefectPreviews([]);
    setResult(null);
    setDefectError(null);
    setProgress(0);
  };

  // ─── Mode B: KIRI 3D Handlers ───────────────────────────────────────────────
  const handleAddKiriFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const newFiles = Array.from(filesList);
    setKiriFiles(prev => [...prev, ...newFiles]);
    setKiriError(null);

    // Generate previews
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setKiriPreviews(prev => [...prev, { name: file.name, url: e.target.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveKiriFile = (idx) => {
    setKiriFiles(prev => prev.filter((_, i) => i !== idx));
    setKiriPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const resetKiri = () => {
    setKiriFiles([]);
    setKiriPreviews([]);
    setKiriTask(null);
    setKiriStatus(null);
    setKiriError(null);
    setKiriComplete(null);
    setKiriLoading(false);
  };

  const handleKiriSubmit = async () => {
    if (kiriFiles.length === 0) {
      setKiriError('Please capture or upload at least 1-3 photos of the component.');
      return;
    }
    if (!componentId.trim()) {
      setKiriError('Please specify a Component ID.');
      return;
    }

    setKiriLoading(true);
    setKiriError(null);
    setKiriTask(null);
    setKiriStatus(null);
    setKiriComplete(null);
    setKiriProgress(0);

    try {
      const resp = await reconstructKiri3D(
        componentId.trim(),
        kiriFiles,
        { modelQuality, textureQuality },
        setKiriProgress,
      );

      if (resp.success) {
        setKiriTask(resp.task);
        setKiriStatus({ status_code: 3, status_text: 'Queuing in KIRI Photogrammetry Pipeline' });
      } else {
        setKiriError(resp.error || 'Failed to submit 3D reconstruction task.');
        setKiriLoading(false);
      }
    } catch (e) {
      setKiriError(e.response?.data?.detail || e.message || 'KIRI submission failed.');
      setKiriLoading(false);
    }
  };

  const health = result?.health_score ?? 0;
  const rl = riskLevel(health);
  const hc = healthColor(health);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-primary)',
      padding: '24px',
      maxWidth: 1200,
      margin: '0 auto',
    }}>
      <h2 style={{ color: '#1f2937', marginBottom: '8px', fontSize: '24px', fontWeight: 'bold' }}>Field Inspection & 3D Scanning</h2>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>Run surface defect analysis or generate a new 3D Digital Twin.</p>

      <div style={{ padding: '0' }}>

        {/* Mode Selector Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 10,
          padding: 4,
          marginBottom: 18,
        }}>
          <button
            onClick={() => setActiveTab('kiri3d')}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              border: activeTab === 'kiri3d' ? '1px solid rgba(212,175,55,0.4)' : '1px solid transparent',
              background: activeTab === 'kiri3d' ? 'rgba(212,175,55,0.12)' : 'transparent',
              color: activeTab === 'kiri3d' ? '#d4af37' : '#4b5563',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>📸</span>
            <span>3D Twin Scan (KIRI)</span>
          </button>

          <button
            onClick={() => setActiveTab('defect')}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              border: activeTab === 'defect' ? '1px solid rgba(212,175,55,0.4)' : '1px solid transparent',
              background: activeTab === 'defect' ? 'rgba(212,175,55,0.12)' : 'transparent',
              color: activeTab === 'defect' ? '#d4af37' : '#4b5563',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <span>🔍</span>
            <span>Defect Inspection</span>
          </button>
        </div>

        {/* Component Selector Bar */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Target Industrial Asset
          </label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {['PUMP-001', 'COMP-002', 'VALVE-003', 'MOTOR-004'].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setComponentId(name)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: componentId === name ? '1px solid #d4af37' : '1px solid rgba(212,175,55,0.3)',
                  background: componentId === name ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.5)',
                  color: componentId === name ? '#d4af37' : '#4b5563',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <input
            className="input-field"
            value={componentId}
            onChange={e => setComponentId(e.target.value)}
            placeholder="e.g. PUMP-001"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: KIRI ENGINE 3D PHOTOGRAMMETRY SCAN
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'kiri3d' && (
          <div>
            {/* Banner */}
            <div className="panel glow-cyan" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#d4af37' }}>
                    KIRI Engine Photogrammetry
                  </span>
                </div>
                <span style={{
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  fontWeight: 700,
                }}>
                  ACTIVE API
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                Capture real-time photos around <strong style={{ color: '#1f2937' }}>{componentId}</strong> from multiple orbital angles. KIRI Engine reconstructs depth maps and compiles a production-ready <strong>.GLB 3D Digital Twin</strong>.
              </p>
            </div>

            {/* Error Banner */}
            {kiriError && (
              <div style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#ef4444',
                fontSize: 12,
                marginBottom: 14,
              }}>
                ⚠ {kiriError}
              </div>
            )}

            {/* Completed Success Banner */}
            {kiriComplete && (
              <div className="panel glow-green" style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.4)',
                padding: 16,
                borderRadius: 10,
                marginBottom: 16,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>
                  3D Digital Twin Generated!
                </div>
                <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 12 }}>
                  Model downloaded and attached to <strong>{componentId}</strong>.
                </div>
                <div style={{
                  fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#6b7280',
                  background: 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: 4, marginBottom: 14,
                  wordBreak: 'break-all',
                }}>
                  {kiriComplete.webPath}
                </div>
                <button
                  className="btn-primary"
                  onClick={() => onNavigate?.('dashboard')}
                  style={{ width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 700 }}
                >
                  ⬡ View Live in 3D Twin Viewer →
                </button>
              </div>
            )}

            {/* Active Task Progress Banner */}
            {kiriTask && !kiriComplete && (
              <div className="panel glow-cyan" style={{
                padding: 16,
                borderRadius: 10,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#d4af37' }}>
                    Generating 3D Digital Twin...
                  </div>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(212,175,55,0.2)',
                    borderTop: '2px solid #d4af37',
                    animation: 'spin 1s linear infinite',
                  }} />
                </div>

                <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 6 }}>
                  Status: <strong style={{ color: '#1f2937' }}>{kiriStatus?.status_text || 'Queuing...'}</strong>
                </div>

                <div style={{
                  fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#6b7280',
                  marginBottom: 10,
                }}>
                  Task ID: {kiriTask.serialize}
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.8)',
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 12,
                }}>
                  <div style={{
                    height: '100%',
                    width: kiriStatus?.status_code === 2 ? '100%' : kiriStatus?.status_code === 0 ? '60%' : '25%',
                    background: 'linear-gradient(90deg, #d4af37, #b8860b)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>
                    Auto-polling KIRI cloud every 4s
                  </span>
                  <button
                    onClick={() => syncKiriModel(kiriTask.serialize)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(212,175,55,0.3)',
                      borderRadius: 4,
                      color: '#d4af37',
                      fontSize: 10,
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    ↺ Sync Now
                  </button>
                </div>
              </div>
            )}

            {/* Photos Tray / Grid */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Real-time Photos ({kiriFiles.length} Captured)
                </label>
                {kiriFiles.length > 0 && (
                  <button
                    onClick={resetKiri}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {kiriPreviews.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 12,
                }}>
                  {kiriPreviews.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid rgba(212,175,55,0.25)',
                        background: '#fdfbf7',
                      }}
                    >
                      <img
                        src={p.url}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute', bottom: 2, left: 2,
                        background: 'rgba(255,255,255,0.85)',
                        padding: '1px 4px', borderRadius: 3,
                        fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#d4af37',
                      }}>
                        #{idx + 1}
                      </div>
                      <button
                        onClick={() => handleRemoveKiriFile(idx)}
                        style={{
                          position: 'absolute', top: 3, right: 3,
                          background: 'rgba(239,68,68,0.85)',
                          border: 'none', borderRadius: 12,
                          color: '#1f2937', width: 18, height: 18,
                          fontSize: 10, cursor: 'pointer', lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  border: '2px dashed rgba(212,175,55,0.25)',
                  borderRadius: 10,
                  padding: 24,
                  textAlign: 'center',
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>📸</div>
                  <div style={{ fontSize: 13, color: '#1f2937', fontWeight: 600, marginBottom: 4 }}>
                    Multi-Angle Realtime Capture
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                    Snap photos around {componentId} (Front, Sides, Top, Rear).
                  </div>
                </div>
              )}

              {/* Primary USB Live Footage Button */}
              <button
                type="button"
                className="btn-primary glow-cyan"
                onClick={() => {
                  setLiveCameraTarget('kiri3d');
                  setLiveCameraOpen(true);
                }}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.22), rgba(2,132,199,0.22))',
                  border: '1px solid rgba(212,175,55,0.5)',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                <span style={{ fontSize: 16 }}>📹</span>
                <span>Open USB Mobile Live Camera Stream</span>
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}>
                  LIVE
                </span>
              </button>

              {/* Action Buttons to Add Photos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => kiriCameraInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>📷</span>
                  <span>Capture Angle</span>
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => kiriMultiInputRef.current?.click()}
                  style={{
                    borderColor: 'rgba(212,175,55,0.4)',
                    color: '#4b5563',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <span>📁</span>
                  <span>Add Photo Set</span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={kiriCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files) handleAddKiriFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={kiriMultiInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files) handleAddKiriFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Quality Settings Accordion */}
            <div style={{
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Reconstruction Settings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 10, color: '#4b5563', display: 'block', marginBottom: 4 }}>Model Mesh:</span>
                  <select
                    className="input-field"
                    value={modelQuality}
                    onChange={e => setModelQuality(Number(e.target.value))}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    <option value={1}>Medium (Fast)</option>
                    <option value={0}>High (Detailed)</option>
                    <option value={3}>Ultra HD</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: '#4b5563', display: 'block', marginBottom: 4 }}>Texture:</span>
                  <select
                    className="input-field"
                    value={textureQuality}
                    onChange={e => setTextureQuality(Number(e.target.value))}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    <option value={1}>2K Textures</option>
                    <option value={0}>4K Textures</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              className="btn-primary"
              disabled={kiriLoading || kiriFiles.length === 0}
              onClick={handleKiriSubmit}
              style={{
                width: '100%',
                padding: '12px 0',
                fontSize: 13,
                fontWeight: 700,
                opacity: kiriLoading || kiriFiles.length === 0 ? 0.5 : 1,
                cursor: kiriLoading || kiriFiles.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {kiriLoading
                ? '⏳ Reconstructing 3D Model with KIRI...'
                : `🚀 Generate 3D Digital Twin (${kiriFiles.length} Photos)`}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: DEFECT INSPECTION (YOLO)
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'defect' && (
          <div>
            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Inspection Notes (optional)
              </label>
              <textarea
                className="input-field"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Unusual pump vibration detected at bearing housing..."
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Multi-Image capture / upload */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Component Photos ({defectFiles.length} Selected)
                </label>
                {defectFiles.length > 0 && (
                  <button
                    onClick={resetDefect}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {defectPreviews.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 12,
                }}>
                  {defectPreviews.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid rgba(212,175,55,0.25)',
                        background: '#fdfbf7',
                      }}
                    >
                      <img
                        src={p.url}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute', bottom: 2, left: 2,
                        background: 'rgba(255,255,255,0.85)',
                        padding: '1px 4px', borderRadius: 3,
                        fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#d4af37',
                      }}>
                        #{idx + 1}
                      </div>
                      <button
                        onClick={() => handleRemoveDefectFile(idx)}
                        style={{
                          position: 'absolute', top: 3, right: 3,
                          background: 'rgba(239,68,68,0.85)',
                          border: 'none', borderRadius: 12,
                          color: '#1f2937', width: 18, height: 18,
                          fontSize: 10, cursor: 'pointer', lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  border: '2px dashed rgba(212,175,55,0.25)',
                  borderRadius: 10,
                  padding: 28,
                  textAlign: 'center',
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, color: '#1f2937', fontWeight: 600, marginBottom: 4 }}>
                    Multi-Angle Surface Inspection
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                    Select single or multiple photos to scan for cracks, corrosion, and wear simultaneously.
                  </div>
                </div>
              )}

              {/* Primary USB Live Footage Button */}
              <button
                type="button"
                className="btn-primary glow-cyan"
                onClick={() => {
                  setLiveCameraTarget('defect');
                  setLiveCameraOpen(true);
                }}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.22), rgba(2,132,199,0.22))',
                  border: '1px solid rgba(212,175,55,0.5)',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                <span style={{ fontSize: 16 }}>📹</span>
                <span>Open USB Mobile Live Camera Stream</span>
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}>
                  LIVE
                </span>
              </button>

              {/* Action Buttons to Add Photos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => cameraInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>📷</span>
                  <span>Capture Photo</span>
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    borderColor: 'rgba(212,175,55,0.4)',
                    color: '#4b5563',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <span>📁</span>
                  <span>Add Photos (Batch)</span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files) handleAddDefectFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files) handleAddDefectFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Error banner */}
            {defectError && (
              <div style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#ef4444',
                fontSize: 12,
                marginBottom: 16,
              }}>
                ⚠ {defectError}
              </div>
            )}

            {/* Upload Button */}
            <button
              className="btn-primary"
              disabled={uploading || defectFiles.length === 0}
              onClick={handleDefectUpload}
              style={{
                width: '100%',
                padding: '12px 0',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 20,
                opacity: uploading || defectFiles.length === 0 ? 0.5 : 1,
                cursor: uploading || defectFiles.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading
                ? `Analyzing Defects... ${progress > 0 ? `${progress}%` : ''}`
                : `🔬 Run YOLO Surface Defect Analysis (${defectFiles.length} Photos)`}
            </button>

            {/* Defect Result Card */}
            {result && (
              <div className="panel glow-cyan" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>Inspection Result</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>{result.component_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: hc }}>{Math.round(health)}%</div>
                    <div style={{ fontSize: 10, color: hc, fontWeight: 700 }}>{rl} RISK</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 14 }}>
                  {result.message}
                </div>

                {/* Per-Image Breakdown — shows annotated images with bboxes */}
                {result.images?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>
                      {result.images.length > 1 ? `Analyzed Images (${result.images.length})` : 'Annotated Inspection Image'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {result.images.map((imgItem, i) => {
                        const imgHc = healthColor(imgItem.health_score);
                        return (
                          <div
                            key={i}
                            style={{
                              borderRadius: 10,
                              border: '1px solid rgba(212,175,55,0.3)',
                              overflow: 'hidden',
                              background: 'rgba(255,255,255,0.5)',
                            }}
                          >
                            {/* Image header row */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 10px',
                              background: 'rgba(255,255,255,0.6)',
                              borderBottom: '1px solid rgba(99,130,190,0.12)',
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#1f2937' }}>
                                #{i + 1} {imgItem.filename}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, color: '#4b5563' }}>
                                  {imgItem.defects_detected} defect(s)
                                </span>
                                <span style={{
                                  fontSize: 12, fontWeight: 800,
                                  color: imgHc, fontFamily: 'JetBrains Mono, monospace',
                                }}>
                                  {Math.round(imgItem.health_score)}%
                                </span>
                              </div>
                            </div>

                            {/* Annotated image with bounding boxes */}
                            <DefectBBoxViewer
                              imageSrc={imgItem.image_path}
                              defects={imgItem.defects || []}
                              filename={imgItem.filename}
                            />

                            {/* Per-image defect list */}
                            {imgItem.defects?.length > 0 && (
                              <div style={{
                                padding: '8px 10px',
                                display: 'flex', flexWrap: 'wrap', gap: 5,
                                borderTop: '1px solid rgba(99,130,190,0.1)',
                              }}>
                                {imgItem.defects.map((d, di) => {
                                  const sColors = {
                                    high: '#ef4444', medium: '#f59e0b',
                                    low: '#22c55e', critical: '#a855f7',
                                  };
                                  const sc = sColors[d.severity] || '#4b5563';
                                  return (
                                    <div key={di} style={{
                                      display: 'flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 20,
                                      border: `1px solid ${sc}40`,
                                      background: `${sc}12`,
                                      fontSize: 10,
                                    }}>
                                      <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: sc, display: 'inline-block', flexShrink: 0,
                                      }} />
                                      <span style={{ color: '#1f2937', textTransform: 'capitalize' }}>
                                        {(d.type || '').replace('_', ' ')}
                                      </span>
                                      <span style={{ color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {((d.confidence||0)*100).toFixed(0)}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {result.defects?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
                      Total Detected Anomalies ({result.defects.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {result.defects.map((d, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'rgba(255,255,255,0.5)',
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: '#1f2937', textTransform: 'capitalize' }}>
                            {d.type.replace('_', ' ')}
                          </span>
                          <span style={{ color: '#4b5563', fontSize: 11 }}>
                            {(d.confidence * 100).toFixed(0)}% conf
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={() => onNavigate?.('dashboard')}
                  style={{ width: '100%', marginTop: 14, fontSize: 12 }}
                >
                  View Defect Markers on 3D Twin →
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Real-time USB / Mobile Live Camera Viewfinder Modal */}
      <LiveCameraModal
        isOpen={liveCameraOpen}
        onClose={() => setLiveCameraOpen(false)}
        onCapture={handleLiveCameraCapture}
        targetLabel={liveCameraTarget === 'kiri3d' ? `${componentId} 3D Scan` : `${componentId} Defect Scan`}
      />
    </div>
  );
}
