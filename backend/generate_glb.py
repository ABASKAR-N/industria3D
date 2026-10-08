import json
import struct
import math
from pathlib import Path

def create_glb(output_path: Path):
    """
    Generate a valid binary glTF 2.0 (.glb) representing an industrial pump assembly.
    """
    vertices = []
    normals = []
    indices = []

    def add_cylinder(r1, r2, height, segments=24, offset=(0, 0, 0), rot_x=False):
        base_idx = len(vertices) // 3
        ox, oy, oz = offset

        # Generate circles at bottom (y = -height/2) and top (y = height/2)
        y_bot = -height / 2
        y_top = height / 2

        for i in range(segments):
            angle = (2 * math.pi * i) / segments
            c = math.cos(angle)
            s = math.sin(angle)

            # Bottom ring
            bx, by, bz = ox + r1 * c, oy + y_bot, oz + r1 * s
            # Top ring
            tx, ty, tz = ox + r2 * c, oy + y_top, oz + r2 * s

            if rot_x: # rotate 90 deg around z/x
                bx, by, bz = ox + y_bot, oy + r1 * c, oz + r1 * s
                tx, ty, tz = ox + y_top, oy + r2 * c, oz + r2 * s

            vertices.extend([bx, by, bz])
            normals.extend([c, 0.0, s] if not rot_x else [0.0, c, s])
            vertices.extend([tx, ty, tz])
            normals.extend([c, 0.0, s] if not rot_x else [0.0, c, s])

        # Indices
        for i in range(segments):
            next_i = (i + 1) % segments
            b1 = base_idx + 2 * i
            t1 = base_idx + 2 * i + 1
            b2 = base_idx + 2 * next_i
            t2 = base_idx + 2 * next_i + 1

            indices.extend([b1, t1, b2])
            indices.extend([b2, t1, t2])

    def add_box(sx, sy, sz, offset=(0, 0, 0)):
        ox, oy, oz = offset
        hx, hy, hz = sx / 2, sy / 2, sz / 2
        base_idx = len(vertices) // 3

        corners = [
            # Front face
            (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz),
            # Back face
            (hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz),
            # Top face
            (-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz), (-hx, hy, -hz),
            # Bottom face
            (-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz),
            # Right face
            (hx, -hy, hz), (hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz),
            # Left face
            (-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)
        ]
        face_normals = [
            (0, 0, 1), (0, 0, -1), (0, 1, 0), (0, -1, 0), (1, 0, 0), (-1, 0, 0)
        ]

        for f in range(6):
            fn = face_normals[f]
            for c in range(4):
                cx, cy, cz = corners[f * 4 + c]
                vertices.extend([ox + cx, oy + cy, oz + cz])
                normals.extend(fn)
            b = base_idx + f * 4
            indices.extend([b, b + 1, b + 2, b, b + 2, b + 3])

    # Construct Pump components:
    # 1. Baseplate
    add_box(1.8, 0.15, 0.9, (0, -0.85, 0))
    # 2. Pump Casing (main cylinder)
    add_cylinder(0.48, 0.48, 0.9, segments=24, offset=(-0.35, 0, 0))
    # 3. Flange inlet (horizontal pipe)
    add_cylinder(0.18, 0.18, 0.7, segments=20, offset=(-0.85, 0, 0), rot_x=True)
    # 4. Flange outlet (vertical pipe)
    add_cylinder(0.16, 0.16, 0.65, segments=20, offset=(-0.35, 0.65, 0))
    # 5. Electric Motor Housing
    add_cylinder(0.42, 0.42, 1.0, segments=24, offset=(0.55, 0, 0), rot_x=True)
    # 6. Motor Terminal Box
    add_box(0.28, 0.22, 0.28, (0.55, 0.45, 0))
    # 7. Coupling Guard (between pump and motor)
    add_cylinder(0.26, 0.26, 0.35, segments=16, offset=(0.02, 0, 0), rot_x=True)

    # Convert to binary buffers
    v_bytes = struct.pack(f"<{len(vertices)}f", *vertices)
    n_bytes = struct.pack(f"<{len(normals)}f", *normals)
    i_bytes = struct.pack(f"<{len(indices)}H", *indices)

    # Align each buffer to 4 bytes
    def pad4(b):
        pad = (4 - (len(b) % 4)) % 4
        return b + b'\x00' * pad

    v_padded = pad4(v_bytes)
    n_padded = pad4(n_bytes)
    i_padded = pad4(i_bytes)

    bin_data = v_padded + n_padded + i_padded

    v_offset = 0
    v_length = len(v_bytes)
    n_offset = len(v_padded)
    n_length = len(n_bytes)
    i_offset = len(v_padded) + len(n_padded)
    i_length = len(i_bytes)

    min_pos = [min(vertices[i::3]) for i in range(3)]
    max_pos = [max(vertices[i::3]) for i in range(3)]

    count_v = len(vertices) // 3
    count_i = len(indices)

    gltf_dict = {
        "asset": {"version": "2.0", "generator": "INDUSTRIA 3D Model Builder"},
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Industrial_Pump"}],
        "meshes": [{
            "name": "Pump_Mesh",
            "primitives": [{
                "attributes": {
                    "POSITION": 0,
                    "NORMAL": 1
                },
                "indices": 2,
                "material": 0
            }]
        }],
        "materials": [{
            "name": "IndustrialSteel",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.22, 0.48, 0.72, 1.0],
                "metallicFactor": 0.85,
                "roughnessFactor": 0.25
            }
        }],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126, # FLOAT
                "count": count_v,
                "type": "VEC3",
                "min": min_pos,
                "max": max_pos
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5126, # FLOAT
                "count": count_v,
                "type": "VEC3"
            },
            {
                "bufferView": 2,
                "byteOffset": 0,
                "componentType": 5123, # UNSIGNED_SHORT
                "count": count_i,
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": v_offset, "byteLength": v_length, "target": 34962},
            {"buffer": 0, "byteOffset": n_offset, "byteLength": n_length, "target": 34962},
            {"buffer": 0, "byteOffset": i_offset, "byteLength": i_length, "target": 34963}
        ],
        "buffers": [{
            "byteLength": len(bin_data)
        }]
    }

    json_str = json.dumps(gltf_dict, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    pad_len = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b' ' * pad_len

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    header = struct.pack("<4sII", b"glTF", 2, total_len)
    chunk0 = struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    chunk1 = struct.pack("<II", len(bin_data), 0x004E4942) + bin_data

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(header + chunk0 + chunk1)

    print(f"[OK] Generated GLB at: {output_path} ({total_len} bytes)")

if __name__ == "__main__":
    p1 = Path(r"c:\Users\Akash\Downloads\Digital Twin for Industrial Intelligence\3d_models\pump.glb")
    p2 = Path(r"c:\Users\Akash\Downloads\Digital Twin for Industrial Intelligence\3d_models\compressor.glb")
    create_glb(p1)
    create_glb(p2)
