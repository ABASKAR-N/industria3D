This directory holds GLB/GLTF 3D models for the Digital Twin viewer.

Expected files:
  pump.glb        — PUMP-001 component model
  compressor.glb  — COMP-002 component model

How to add a model:
1. Export from KIRI Engine, Blender, or any 3D software as GLB
2. Place the file here
3. Update the component's model_path in PostgreSQL:
   UPDATE components SET model_path = '/3d_models/pump.glb' WHERE name = 'PUMP-001';
   
OR upload via the API:
   POST /api/upload  (multipart: component_id, model_file)

If no GLB is found, a placeholder pump model is rendered in the 3D viewer.
