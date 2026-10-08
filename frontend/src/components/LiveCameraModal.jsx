// LiveCameraModal.jsx — Real-time live camera footage & snapshot capture
// Supports: Direct USB Mobile / Webcam (WebRTC) and Backend OpenCV / IP Streams
import { useState, useRef, useEffect, useCallback } from 'react';

export default function LiveCameraModal({ isOpen, onClose, onCapture, targetLabel = '3D Scan' }) {
  if (!isOpen) return null;

  // Stream source mode: 'browser' (WebRTC / USB Direct) or 'ip' (IP/WiFi/DroidCam) or 'backend' (OpenCV)
  const [sourceMode, setSourceMode] = useState('browser');
  const [browserDevices, setBrowserDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [backendDevices, setBackendDevices] = useState([]);
  const [backendSource, setBackendSource] = useState('0');
  const [customStreamUrl, setCustomStreamUrl] = useState('');
  const [ipTestStatus, setIpTestStatus] = useState(null); // null | 'testing' | 'ok' | 'fail'
  const [phoneIp, setPhoneIp] = useState('192.168.1.');

  // Live stream state
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [capturedCount, setCapturedCount] = useState(0);
  const [flashEffect, setFlashEffect] = useState(false);

  // USB Mobile detection state
  const [usbStatus, setUsbStatus] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Auto interval capture
  const [autoCaptureActive, setAutoCaptureActive] = useState(false);
  const [intervalSec, setIntervalSec] = useState(2);
  const [countdown, setCountdown] = useState(2);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const activeStreamRef = useRef(null);
  const autoIntervalRef = useRef(null);

  // Helper to categorize device labels
  const formatDeviceLabel = (label = '', idx = 0) => {
    const l = label.toLowerCase();
    if (l.includes('android') || l.includes('realme') || l.includes('droid') || l.includes('iriun') || l.includes('camo') || l.includes('phone')) {
      return `📱 Mobile Camera: ${label}`;
    }
    if (l.includes('integrated') || l.includes('uvc webcam') || l.includes('chicony') || l.includes('sunplus') || l.includes('hd camera') || l.includes('laptop')) {
      return `💻 Laptop Camera: ${label || `Internal Webcam #${idx + 1}`}`;
    }
    return `📷 Camera #${idx + 1}: ${label || 'USB Video Device'}`;
  };

  // 1. Rescan devices & query USB mobile status
  const scanDevices = useCallback(async () => {
    setScanning(true);
    try {
      // Check backend USB PnP status (e.g. realme P1 5G detection)
      try {
        const uRes = await fetch('/api/camera/usb-status');
        if (uRes.ok) {
          const uData = await uRes.json();
          setUsbStatus(uData);
        }
      } catch (e) {
        console.warn('USB status fetch error:', e);
      }

      // Check browser WebRTC camera devices
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(t => t.stop());
        } catch (e) {
          console.warn('Initial permission notice:', e);
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setBrowserDevices(videoInputs);

        if (videoInputs.length > 0) {
          // Look for phone or external camera first
          const mobileCam = videoInputs.find(d => {
            const l = (d.label || '').toLowerCase();
            return l.includes('android') || l.includes('realme') || l.includes('droid') || l.includes('iriun') || l.includes('camo') || l.includes('phone') || l.includes('back') || l.includes('rear');
          });

          if (mobileCam) {
            setSelectedDeviceId(mobileCam.deviceId);
          } else if (!selectedDeviceId || !videoInputs.some(v => v.deviceId === selectedDeviceId)) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        }
      }

      // Check backend OpenCV devices
      try {
        const bRes = await fetch('/api/camera/devices');
        if (bRes.ok) {
          const bData = await bRes.json();
          setBackendDevices(bData.devices || []);
        }
      } catch (e) {
        console.warn('Backend camera devices error:', e);
      }
    } catch (err) {
      console.error('Error scanning devices:', err);
    } finally {
      setScanning(false);
    }
  }, [selectedDeviceId]);

  // Initial scan and listener for hardware plug/unplug / webcam mode change
  useEffect(() => {
    scanDevices();

    // Browser event fired when USB webcam is attached or mode toggled
    const handleDeviceChange = () => {
      console.log('Media device change detected — rescanning...');
      scanDevices();
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    const pollInterval = setInterval(scanDevices, 4000);

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
      clearInterval(pollInterval);
    };
  }, [scanDevices]);

  // 2. Start or switch Browser video stream
  useEffect(() => {
    if (sourceMode !== 'browser') {
      stopBrowserStream();
      return;
    }

    let isMounted = true;

    async function startStream() {
      stopBrowserStream();
      setStreamError(null);
      try {
        const constraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        activeStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn('Play error:', e));
        }
        setStreaming(true);
      } catch (err) {
        console.error('Camera access error:', err);
        setStreamError(`Cannot access camera: ${err.message || 'Check USB/permissions'}`);
        setStreaming(false);
      }
    }

    startStream();

    return () => {
      isMounted = false;
      stopBrowserStream();
    };
  }, [selectedDeviceId, sourceMode]);

  const stopBrowserStream = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  // 3. Capture a frame
  const handleCaptureSnapshot = async () => {
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    if (sourceMode === 'browser') {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const filename = `live_usb_${Date.now()}_${capturedCount + 1}.jpg`;
        const file = new File([blob], filename, { type: 'image/jpeg' });
        onCapture(file);
        setCapturedCount(prev => prev + 1);
      }, 'image/jpeg', 0.95);
    } else if (sourceMode === 'ip') {
      // IP / WiFi Camera — backend grabs frame from IP stream URL
      if (!customStreamUrl.trim()) {
        setStreamError('Please enter your phone IP and click a Quick Connect button first.');
        return;
      }
      try {
        const res = await fetch(`/api/camera/snapshot?source=${encodeURIComponent(customStreamUrl.trim())}`);
        if (res.ok) {
          const blob = await res.blob();
          const filename = `ip_cam_${Date.now()}_${capturedCount + 1}.jpg`;
          const file = new File([blob], filename, { type: 'image/jpeg' });
          onCapture(file);
          setCapturedCount(prev => prev + 1);
        } else {
          setStreamError('Failed to capture from IP camera. Make sure IP Webcam / DroidCam is running on your phone.');
        }
      } catch (err) {
        setStreamError('IP capture error: ' + err.message);
      }
    } else {
      // OpenCV / USB index backend capture
      try {
        const src = customStreamUrl.trim() || backendSource;
        const res = await fetch(`/api/camera/snapshot?source=${encodeURIComponent(src)}`);
        if (res.ok) {
          const blob = await res.blob();
          const filename = `backend_usb_${Date.now()}_${capturedCount + 1}.jpg`;
          const file = new File([blob], filename, { type: 'image/jpeg' });
          onCapture(file);
          setCapturedCount(prev => prev + 1);
        } else {
          setStreamError('Failed to capture from backend USB camera.');
        }
      } catch (err) {
        setStreamError('Snapshot capture error: ' + err.message);
      }
    }
  };

  // 4. Auto-Interval Capture
  useEffect(() => {
    if (!autoCaptureActive) {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
      return;
    }

    setCountdown(intervalSec);
    autoIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleCaptureSnapshot();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, [autoCaptureActive, intervalSec, sourceMode, selectedDeviceId, backendSource, customStreamUrl]);

  const handleClose = () => {
    setAutoCaptureActive(false);
    stopBrowserStream();
    onClose();
  };

  const isMobileCamActive = browserDevices.some(
    d => d.deviceId === selectedDeviceId &&
      (d.label?.toLowerCase().includes('android') || d.label?.toLowerCase().includes('realme') || d.label?.toLowerCase().includes('droid'))
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(253, 251, 247, 0.94)',
      backdropFilter: 'blur(16px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflowY: 'auto',
    }}>
      {/* Top Header */}
      <div style={{
        maxWidth: 720,
        width: '100%',
        margin: '0 auto 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: isMobileCamActive ? '#22c55e' : '#ef4444',
            boxShadow: `0 0 10px ${isMobileCamActive ? '#22c55e' : '#ef4444'}`,
            animation: 'pulse-slow 1.5s infinite',
          }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>
              LIVE USB CAMERA FOOTAGE
            </div>
            <div style={{ fontSize: 10, color: '#d4af37', fontFamily: 'JetBrains Mono, monospace' }}>
              {isMobileCamActive ? '🟢 Connected Mobile Camera Active' : 'Real-time Camera Stream & Angle Capture'}
            </div>
          </div>
        </div>

        <button
          onClick={handleClose}
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#1f2937',
            width: 32, height: 32,
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Main Container */}
      <div style={{
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>

        {/* 📱 Real-time USB Phone Detection & Guidance Banner */}
        {usbStatus?.connected && !usbStatus?.is_webcam_mode && !isMobileCamActive && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(245, 158, 11, 0.08))',
            border: '1px solid rgba(234, 179, 8, 0.45)',
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 0 20px rgba(234, 179, 8, 0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>📱</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fde047' }}>
                  USB Phone Connected: {usbStatus.phone_name || 'realme P1 5G'}
                </span>
              </div>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(234, 179, 8, 0.25)',
                color: '#fef08a',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                MTP Storage Mode
              </span>
            </div>

            <p style={{ fontSize: 11, color: '#1f2937', margin: '0 0 8px', lineHeight: 1.5 }}>
              Your phone is currently in <strong>File Transfer mode</strong>. To use its high-resolution camera instead of your laptop webcam:
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.6)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: 11,
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              <div>
                <strong style={{ color: '#d4af37' }}>Step 1:</strong> On your <strong>{usbStatus.phone_name}</strong>, swipe down from the top to open notifications.
              </div>
              <div>
                <strong style={{ color: '#d4af37' }}>Step 2:</strong> Tap the notification: <strong>"Charging this device via USB"</strong> (or "USB Preferences").
              </div>
              <div>
                <strong style={{ color: '#d4af37' }}>Step 3:</strong> Under <em>"Use USB for"</em>, tap <strong style={{ color: '#22c55e' }}>"Webcam"</strong>.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: '#4b5563' }}>
                💡 Or use <strong>DroidCam USB</strong> / <strong>Iriun Webcam</strong> if your Android build prefers an app.
              </span>
              <button
                type="button"
                onClick={scanDevices}
                style={{
                  background: 'rgba(212,175,55,0.15)',
                  border: '1px solid rgba(212,175,55,0.4)',
                  borderRadius: 4,
                  color: '#d4af37',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 8px',
                  cursor: 'pointer',
                }}
              >
                {scanning ? '⏳ Scanning...' : '🔄 Rescan Now'}
              </button>
            </div>
          </div>
        )}

        {/* Source Mode Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
          background: 'rgba(255,255,255,0.6)',
          padding: 4,
          borderRadius: 8,
          border: '1px solid rgba(212,175,55,0.3)',
        }}>
          <button
            type="button"
            onClick={() => setSourceMode('browser')}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: sourceMode === 'browser' ? '1px solid #d4af37' : '1px solid transparent',
              background: sourceMode === 'browser' ? 'rgba(212,175,55,0.15)' : 'transparent',
              color: sourceMode === 'browser' ? '#d4af37' : '#4b5563',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📱 USB Webcam Mode
          </button>
          <button
            type="button"
            onClick={() => { setSourceMode('ip'); setIpTestStatus(null); }}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: sourceMode === 'ip' ? '1px solid #a78bfa' : '1px solid transparent',
              background: sourceMode === 'ip' ? 'rgba(167,139,250,0.15)' : 'transparent',
              color: sourceMode === 'ip' ? '#a78bfa' : '#4b5563',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📶 WiFi / IP Camera
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('backend')}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: sourceMode === 'backend' ? '1px solid #d4af37' : '1px solid transparent',
              background: sourceMode === 'backend' ? 'rgba(212,175,55,0.15)' : 'transparent',
              color: sourceMode === 'backend' ? '#d4af37' : '#4b5563',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚙️ OpenCV / USB Index
          </button>
        </div>

        {/* Device Selectors */}
        {sourceMode === 'browser' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#4b5563', whiteSpace: 'nowrap' }}>Active Camera:</span>
            <select
              className="input-field"
              value={selectedDeviceId}
              onChange={e => setSelectedDeviceId(e.target.value)}
              style={{ fontSize: 11, padding: '5px 8px', flex: 1, minWidth: 200 }}
            >
              {browserDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {formatDeviceLabel(d.label, i)}
                </option>
              ))}
              {browserDevices.length === 0 && (
                <option value="">Default Environment / USB Camera</option>
              )}
            </select>
            <button
              type="button"
              onClick={scanDevices}
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                color: '#1f2937',
                fontSize: 11,
                padding: '6px 10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {scanning ? '⏳ Scanning...' : '🔄 Rescan'}
            </button>
          </div>
        ) : sourceMode === 'ip' ? (
          /* WiFi / IP Camera Panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Setup Guide Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(99,102,241,0.08))',
              border: '1px solid rgba(167,139,250,0.3)',
              borderRadius: 8,
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>
                📶 Use Your Phone Camera via WiFi (Easiest Method)
              </div>
              <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.6 }}>
                <strong style={{ color: '#c4b5fd' }}>Step 1:</strong> Install <strong>"IP Webcam"</strong> (by Pavel Khlebovich) or <strong>"DroidCam"</strong> from Play Store on your realme P1 5G.<br />
                <strong style={{ color: '#c4b5fd' }}>Step 2:</strong> Open the app and tap <strong>"Start Server"</strong>. Note the IP address shown (e.g. 192.168.1.5).<br />
                <strong style={{ color: '#c4b5fd' }}>Step 3:</strong> Make sure both phone and laptop are on the <strong>same WiFi</strong>. Enter the IP below and click ✓ Connect.
              </div>
            </div>

            {/* IP Entry Row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#4b5563', whiteSpace: 'nowrap' }}>Phone IP:</span>
              <input
                className="input-field"
                placeholder="192.168.1.X"
                value={phoneIp}
                onChange={e => { setPhoneIp(e.target.value); setIpTestStatus(null); }}
                style={{ fontSize: 11, padding: '5px 8px', flex: 1 }}
              />
            </div>

            {/* Quick Connect Buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: '#4b5563', alignSelf: 'center' }}>Quick connect:</span>
              {[
                { label: '📱 IP Webcam :8080', url: `http://${phoneIp.trim()}:8080/video` },
                { label: '🎥 DroidCam :4747', url: `http://${phoneIp.trim()}:4747/video` },
                { label: '🔗 IP Cam MJPEG', url: `http://${phoneIp.trim()}:8080/videofeed` },
              ].map(({ label, url }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setCustomStreamUrl(url); setIpTestStatus(null); }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: customStreamUrl === url ? '1px solid #a78bfa' : '1px solid rgba(167,139,250,0.25)',
                    background: customStreamUrl === url ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.7)',
                    color: customStreamUrl === url ? '#c4b5fd' : '#4b5563',
                    fontSize: 10,
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* URL display + test */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input-field"
                placeholder="Full stream URL (auto-filled by buttons above)"
                value={customStreamUrl}
                onChange={e => { setCustomStreamUrl(e.target.value); setIpTestStatus(null); }}
                style={{ fontSize: 11, padding: '5px 8px', flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <button
                type="button"
                onClick={async () => {
                  setIpTestStatus('testing');
                  try {
                    const res = await fetch(`/api/camera/snapshot?source=${encodeURIComponent(customStreamUrl)}`, { signal: AbortSignal.timeout(5000) });
                    setIpTestStatus(res.ok ? 'ok' : 'fail');
                  } catch {
                    setIpTestStatus('fail');
                  }
                }}
                disabled={!customStreamUrl.trim()}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${{ null: 'rgba(167,139,250,0.3)', testing: 'rgba(234,179,8,0.5)', ok: 'rgba(34,197,94,0.5)', fail: 'rgba(239,68,68,0.5)' }[ipTestStatus]}`,
                  background: `${{ null: 'rgba(167,139,250,0.1)', testing: 'rgba(234,179,8,0.1)', ok: 'rgba(34,197,94,0.12)', fail: 'rgba(239,68,68,0.1)' }[ipTestStatus]}`,
                  color: `${{ null: '#a78bfa', testing: '#fde047', ok: '#4ade80', fail: '#f87171' }[ipTestStatus]}`,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {{ null: '✓ Connect', testing: '⏳ Testing...', ok: '✓ Connected!', fail: '✗ Failed' }[ipTestStatus]}
              </button>
            </div>
          </div>
        ) : (
          /* OpenCV / USB Index */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#4b5563', whiteSpace: 'nowrap' }}>OpenCV Device:</span>
              <select
                className="input-field"
                value={backendSource}
                onChange={e => setBackendSource(e.target.value)}
                style={{ fontSize: 11, padding: '5px 8px' }}
              >
                {backendDevices.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="0">USB Video Device #0 (Laptop Webcam)</option>
                <option value="1">USB Video Device #1 (Mobile / External)</option>
              </select>
            </div>
            <input
              className="input-field"
              placeholder="Or enter DroidCam URL (e.g. http://localhost:4747/video)"
              value={customStreamUrl}
              onChange={e => setCustomStreamUrl(e.target.value)}
              style={{ fontSize: 11, padding: '5px 8px' }}
            />
          </div>
        )}

        {/* Live Viewfinder Frame */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          maxHeight: 400,
          background: '#f5f3eb',
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${isMobileCamActive ? 'rgba(34,197,94,0.4)' : sourceMode === 'ip' ? 'rgba(167,139,250,0.4)' : 'rgba(212,175,55,0.3)'}`,
          boxShadow: isMobileCamActive
            ? '0 0 30px rgba(34,197,94,0.15)'
            : sourceMode === 'ip'
            ? '0 0 30px rgba(167,139,250,0.12)'
            : '0 0 30px rgba(212,175,55,0.1)',
        }}>
          {/* Flash animation */}
          {flashEffect && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: '#ffffff',
              opacity: 0.85,
              zIndex: 30,
              transition: 'opacity 0.2s',
            }} />
          )}

          {/* Browser / IP / Backend Video Stream */}
          {sourceMode === 'browser' ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: streaming ? 'block' : 'none',
              }}
            />
          ) : sourceMode === 'ip' ? (
            customStreamUrl.trim() ? (
              <img
                src={customStreamUrl.trim()}
                alt="IP Camera Stream"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setStreamError('Cannot connect to IP camera. Check phone IP, port, and WiFi network.')}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, color: '#4b5563',
              }}>
                <span style={{ fontSize: 32 }}>📶</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>WiFi IP Camera Mode</span>
                <span style={{ fontSize: 10, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
                  Enter your phone's IP address above and click a Quick Connect button to start streaming.
                </span>
              </div>
            )
          ) : (
            <img
              src={`/api/camera/stream?source=${encodeURIComponent(customStreamUrl.trim() || backendSource)}`}
              alt="Backend USB Camera Stream"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={() => setStreamError('Unable to connect to backend camera stream.')}
            />
          )}

          {/* HUD Overlay Reticle */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: 12,
          }}>
            {/* HUD Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                background: 'rgba(255,255,255,0.85)',
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
                color: isMobileCamActive ? '#4ade80' : '#d4af37',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isMobileCamActive ? '#22c55e' : '#d4af37',
                  display: 'inline-block',
                }} />
                {isMobileCamActive ? '📱 REALME MOBILE FEED' : '💻 WEBCAM FEED'}
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.85)',
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
                color: '#d4af37',
              }}>
                📸 {capturedCount} Captured
              </div>
            </div>

            {/* Target Reticle in Center */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 140, height: 140,
              border: `1px dashed ${isMobileCamActive ? 'rgba(34,197,94,0.5)' : 'rgba(212,175,55,0.4)'}`,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 10, height: 1, background: isMobileCamActive ? '#22c55e' : '#d4af37' }} />
              <div style={{ width: 1, height: 10, background: isMobileCamActive ? '#22c55e' : '#d4af37', position: 'absolute' }} />
            </div>

            {/* HUD Bottom Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'JetBrains Mono, monospace',
                background: 'rgba(255,255,255,0.85)',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                TARGET: {targetLabel}
              </span>

              {autoCaptureActive && (
                <div style={{
                  background: 'rgba(239,68,68,0.85)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#ffffff',
                  fontWeight: 700,
                  animation: 'pulse-slow 1s infinite',
                }}>
                  ⏱️ AUTO-CAPTURE IN {countdown}s
                </div>
              )}
            </div>
          </div>

          {/* Hidden Canvas for High-Res Browser Frame Capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Error Notification */}
        {streamError && (
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#ef4444',
            fontSize: 11,
          }}>
            ⚠ {streamError}
          </div>
        )}

        {/* Controls Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 10,
        }}>
          {/* Big Snapshot Capture Button */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleCaptureSnapshot}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: isMobileCamActive
                ? '0 0 20px rgba(34,197,94,0.35)'
                : '0 0 20px rgba(212,175,55,0.3)',
              background: isMobileCamActive
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : undefined,
            }}
          >
            <span style={{ fontSize: 18 }}>📸</span>
            <span>Capture Frame Angle (#{capturedCount + 1})</span>
          </button>

          {/* Auto Interval Capture Toggle */}
          <button
            type="button"
            onClick={() => setAutoCaptureActive(prev => !prev)}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: autoCaptureActive ? '1px solid #ef4444' : '1px solid rgba(212,175,55,0.4)',
              background: autoCaptureActive ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.7)',
              color: autoCaptureActive ? '#ef4444' : '#1f2937',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>{autoCaptureActive ? '⏹️ Stop Auto' : '⏱️ Auto Walk'}</span>
          </button>
        </div>

        {/* Auto Capture Settings & Done */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.5)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid rgba(99,130,190,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#4b5563' }}>Interval:</span>
            {[1, 2, 3, 5].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setIntervalSec(sec)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: intervalSec === sec ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.1)',
                  background: intervalSec === sec ? 'rgba(212,175,55,0.2)' : 'transparent',
                  color: intervalSec === sec ? '#d4af37' : '#6b7280',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                }}
              >
                {sec}s
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleClose}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ✓ Done ({capturedCount} Added)
          </button>
        </div>

      </div>
    </div>
  );
}
