// DigitalTwinViewer.jsx — Hero 3D component for INDUSTRIA 3D
import React, { useRef, useState, useCallback, Suspense, useEffect, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls, useGLTF, Grid, Environment,
  Html, PerspectiveCamera, GizmoHelper, GizmoViewport,
} from '@react-three/drei';
import * as THREE from 'three';
import { severityColor } from '../utils';

// ─── Defect Marker ─────────────────────────────────────────────────────────────
function DefectMarker({ defect, onClick, isSelected, isVisible }) {
  const meshRef = useRef();
  const ringRef = useRef();
  const color = severityColor(defect.severity);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.position.y = defect.y + Math.sin(t * 1.5 + defect.id) * 0.015;
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 2 + defect.id) * 0.12;
      ringRef.current.scale.set(s, s, s);
      ringRef.current.material.opacity = 0.4 - Math.sin(t * 2 + defect.id) * 0.2;
    }
  });

  if (!isVisible) return null;

  return (
    <group position={[defect.x || 0, defect.y || 0.5, defect.z || 0]}>
      {/* Outer pulse ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.06, 0.09, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Vertical stem */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      {/* Main marker sphere */}
      <mesh
        ref={meshRef}
        position={[0, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(defect); }}
        onPointerEnter={() => document.body.style.cursor = 'pointer'}
        onPointerLeave={() => document.body.style.cursor = 'auto'}
      >
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1.2 : 0.6}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Selection halo */}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} wireframe />
        </mesh>
      )}

      {/* Label */}
      <Html
        position={[0.08, 0.08, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        distanceFactor={8}
      >
        <div style={{
          background: `rgba(253,251,247,0.88)`,
          border: `1px solid ${color}`,
          borderRadius: '5px',
          padding: '3px 7px',
          color: color,
          fontSize: '9px',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: '600',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          boxShadow: `0 0 8px ${color}40`,
        }}>
          {defect.type.toUpperCase()}
        </div>
      </Html>
    </group>
  );
}

// ─── Model Error Boundary ──────────────────────────────────────────────────────
class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn("3D GLB load failed, rendering procedural Digital Twin:", err);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ─── GLB Loader ────────────────────────────────────────────────────────────────
function GLBModel({ url, wireframe }) {
  const { scene } = useGLTF(url);
  const meshRef = useRef();

  useEffect(() => {
    if (!scene) return;
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (wireframe) {
          obj.material = new THREE.MeshStandardMaterial({
            color: '#d4af37',
            wireframe: true,
            transparent: true,
            opacity: 0.6,
          });
        } else {
          obj.material = new THREE.MeshStandardMaterial({
            color: '#a8b0b8', // Realistic steel/metal color
            metalness: 0.9,
            roughness: 0.15, // highly reflective
            envMapIntensity: 1.5,
          });
        }
      }
    });
  }, [scene, wireframe]);

  return <primitive ref={meshRef} object={scene} dispose={null} scale={[1.2, 1.2, 1.2]} position={[0, -0.2, 0]} />;
}

// ─── Placeholder component (when no GLB) ───────────────────────────────────────
function PlaceholderModel({ wireframe }) {
  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
    }
  });

  const matProps = wireframe
    ? { color: '#d4af37', wireframe: true, transparent: true, opacity: 0.5 }
    : { color: '#a8b0b8', metalness: 0.9, roughness: 0.15, envMapIntensity: 1.5 };

  return (
    <group ref={groupRef}>
      {/* Main body (pump cylinder) */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.6, 32]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Top cap */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.5, 0.2, 32]} />
        <meshStandardMaterial {...matProps} color={wireframe ? '#d4af37' : '#9ca3af'} />
      </mesh>
      {/* Inlet pipe */}
      <mesh position={[0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.8, 16]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Outlet pipe */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 16]} />
        <meshStandardMaterial {...matProps} color={wireframe ? '#d4af37' : '#d1d5db'} />
      </mesh>
      {/* Base flange */}
      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 32]} />
        <meshStandardMaterial {...matProps} color={wireframe ? '#d4af37' : '#9ca3af'} />
      </mesh>
      {/* Bolts */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <mesh key={i} position={[
          0.58 * Math.cos((angle * Math.PI) / 180),
          -0.9,
          0.58 * Math.sin((angle * Math.PI) / 180),
        ]}>
          <cylinderGeometry args={[0.04, 0.04, 0.15, 8]} />
          <meshStandardMaterial color={wireframe ? '#d4af37' : '#cbd5e1'} metalness={0.9} roughness={0.1} />
        </mesh>
      ))}

      {/* Placeholder label */}
      <Html position={[0, 2.2, 0]} center distanceFactor={10}>
        <div style={{
          background: 'rgba(253,251,247,0.85)',
          border: '1px solid rgba(234,179,8,0.4)',
          borderRadius: '6px',
          padding: '5px 10px',
          color: '#eab308',
          fontSize: '10px',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}>
          ⚠ No GLB loaded — Placeholder Model<br/>
          <span style={{ opacity: 0.7 }}>Upload via /mobile or API</span>
        </div>
      </Html>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ modelUrl, defects, selectedDefect, onSelectDefect, showDefects, wireframe }) {
  const controlsRef = useRef();
  const { camera } = useThree();

  return (
    <>
      <PerspectiveCamera makeDefault position={[3.5, 2.5, 3.5]} fov={45} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.5}
        maxDistance={12}
        makeDefault
      />

      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#ffffff"
      />
      <pointLight position={[-4, 3, -4]} intensity={0.6} color="#fef08a" />
      <pointLight position={[0, -2, 0]} intensity={0.4} color="#ffffff" />
      <spotLight position={[0, 6, 0]} intensity={0.8} angle={0.4} color="#fdfbf7" castShadow />

      {/* Environment */}
      <Environment preset="warehouse" environmentIntensity={0.4} />

      {/* Grid */}
      <Grid
        position={[0, -1.05, 0]}
        args={[10, 10]}
        cellColor="rgba(212,175,55,0.3)"
        sectionColor="rgba(212,175,55,0.5)"
        cellSize={0.5}
        sectionSize={2}
        fadeDistance={8}
        infiniteGrid={false}
      />

      {/* 3D Model */}
      <ModelErrorBoundary fallback={<PlaceholderModel wireframe={wireframe} />}>
        <Suspense fallback={<PlaceholderModel wireframe={wireframe} />}>
          {modelUrl ? (
            <GLBModel url={modelUrl} wireframe={wireframe} />
          ) : (
            <PlaceholderModel wireframe={wireframe} />
          )}
        </Suspense>
      </ModelErrorBoundary>

      {/* Defect Markers */}
      {defects.map((defect) => (
        <DefectMarker
          key={defect.id}
          defect={defect}
          onClick={onSelectDefect}
          isSelected={selectedDefect?.id === defect.id}
          isVisible={showDefects}
        />
      ))}

      {/* Gizmo helper */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#d4af37']} labelColor="#1f2937" />
      </GizmoHelper>
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DigitalTwinViewer({
  component,
  defects = [],
  selectedDefect,
  onSelectDefect,
}) {
  const [showDefects, setShowDefects] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [key, setKey] = useState(0);

  const modelUrl = component?.model_path
    ? `${import.meta.env.VITE_API_URL || ''}${component.model_path}`
    : null;

  // Try to load actual GLB, if it fails gracefully fall to placeholder
  const [glbError, setGlbError] = useState(false);

  const resetCamera = () => setKey(k => k + 1);

  // Health display
  const health = component?.health_score ?? 0;
  const healthColor = health >= 80 ? '#22c55e' : health >= 60 ? '#eab308' : health >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden panel glow-cyan" style={{ minHeight: 480 }}>
      {/* 3D Canvas */}
      <Canvas
        key={key}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fdfbf7 100%)' }}
        className="twin-canvas"
      >
        <Scene
          modelUrl={glbError ? null : modelUrl}
          defects={defects}
          selectedDefect={selectedDefect}
          onSelectDefect={onSelectDefect}
          showDefects={showDefects}
          wireframe={wireframe}
        />
      </Canvas>

      {/* Top-left: Component info overlay */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <div style={{
          background: 'rgba(253,251,247,0.80)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: '8px',
          padding: '8px 12px',
        }}>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            Digital Twin
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>
            {component?.name || 'No Component Selected'}
          </div>
          <div style={{ fontSize: 11, color: '#4b5563' }}>
            {component?.type || '—'}
          </div>
        </div>
      </div>

      {/* Top-right: Health */}
      <div className="absolute top-3 right-3 pointer-events-none">
        <div style={{
          background: 'rgba(253,251,247,0.80)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${healthColor}40`,
          borderRadius: '8px',
          padding: '8px 12px',
          textAlign: 'right',
        }}>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Health Score
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: healthColor, lineHeight: 1.2 }}>
            {Math.round(health)}%
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        <button
          className="btn-primary"
          onClick={() => setShowDefects(v => !v)}
          style={{ fontSize: 11, padding: '5px 10px' }}
        >
          {showDefects ? '🔴 Hide Defects' : '🟢 Show Defects'}
        </button>
        <button
          className="btn-primary"
          onClick={() => setWireframe(v => !v)}
          style={{ fontSize: 11, padding: '5px 10px' }}
        >
          {wireframe ? '◼ Solid' : '⬡ Wireframe'}
        </button>
        <button
          className="btn-primary"
          onClick={resetCamera}
          style={{ fontSize: 11, padding: '5px 10px' }}
        >
          ↺ Reset Camera
        </button>
        <button
          className="btn-primary"
          onClick={() => window.location.href = '/mobile'}
          style={{ fontSize: 11, padding: '5px 10px', borderColor: 'rgba(212,175,55,0.4)', color: '#d4af37' }}
        >
          ⚡ KIRI 3D Scan
        </button>
      </div>

      {/* Defect count badge */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <div style={{
          background: 'rgba(253,251,247,0.80)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: '6px',
          padding: '5px 10px',
          fontSize: 11,
          color: '#f97316',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
        }}>
          {defects.length} DEFECT{defects.length !== 1 ? 'S' : ''} DETECTED
        </div>
      </div>
    </div>
  );
}
