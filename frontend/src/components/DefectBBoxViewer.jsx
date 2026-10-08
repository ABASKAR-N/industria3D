// DefectBBoxViewer.jsx - Renders defect bounding boxes over an inspection image
import { useRef, useEffect, useState } from 'react';

const DEFECT_COLORS = {
  crack:          '#f59e0b', // Yellow/Orange
  lack_of_fusion: '#22c55e', // Green
  pore:           '#ef4444', // Red
  // Fallbacks for other types
  corrosion:      '#ef4444',
  scratch:        '#f59e0b',
  surface_damage: '#a855f7',
};

// Map backend types to the legend labels
const TYPE_LABELS = {
  crack: 'Crack',
  lack_of_fusion: 'Lack of fusion',
  pore: 'Pore',
  corrosion: 'Corrosion',
  scratch: 'Scratch',
  surface_damage: 'Surface damage',
};

export default function DefectBBoxViewer({ imageSrc, defects = [], filename = '' }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalW, setNaturalW] = useState(1);
  const [naturalH, setNaturalH] = useState(1);

  // Extract unique defect types to show in legend
  const uniqueTypes = [...new Set(defects.map(d => d.type || 'crack'))];

  const draw = (img, canvas) => {
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    defects.forEach((defect) => {
      const bb = defect.bounding_box;
      if (!bb || bb.length < 4) return;

      const srcW = defect.image_width  || img.naturalWidth  || naturalW;
      const srcH = defect.image_height || img.naturalHeight || naturalH;
      const sx = img.clientWidth  / srcW;
      const sy = img.clientHeight / srcH;

      const x1 = bb[0] * sx;
      const y1 = bb[1] * sy;
      const x2 = bb[2] * sx;
      const y2 = bb[3] * sy;
      const bw = x2 - x1;
      const bh = y2 - y1;

      const type = defect.type || 'crack';
      const col = DEFECT_COLORS[type] || '#22c55e';

      // Draw simple solid thin border matching the reference image
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(x1, y1, bw, bh);
    });
  };

  useEffect(() => {
    if (!imageLoaded) return;
    draw(imgRef.current, canvasRef.current);
  }, [imageLoaded, defects, naturalW, naturalH]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Legend matching the reference image */}
      {uniqueTypes.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: 16, 
          paddingBottom: 8,
          flexWrap: 'wrap'
        }}>
          {uniqueTypes.map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 16,
                height: 16,
                border: `1.5px solid ${DEFECT_COLORS[type] || '#22c55e'}`,
              }} />
              <span style={{ 
                fontSize: 13, 
                color: DEFECT_COLORS[type] || '#22c55e',
                fontWeight: 500
              }}>
                {TYPE_LABELS[type] || type}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', background: '#000' }}>
        <img
          ref={imgRef}
          src={imageSrc}
          alt={filename}
          style={{ width: '100%', display: 'block' }}
          onLoad={(e) => {
            setNaturalW(e.target.naturalWidth);
            setNaturalH(e.target.naturalHeight);
            setImageLoaded(true);
          }}
          onError={() => setImageLoaded(false)}
        />

        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
