import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import Water from "./Water.jsx";

export const Map2 = ({ map, position = [0, 0, 0], terrainRef = null }) => {
  const terrain = map?.terrain ?? null;

  const hm = useMemo(() => {
    if (!terrain?.width || !terrain?.height || !terrain?.heights?.length) return null;
    return {
      width: terrain.width,
      height: terrain.height,
      heights:
        terrain.heights instanceof Float32Array
          ? terrain.heights
          : Float32Array.from(terrain.heights),
    };
  }, [terrain]);

  const rock = useTexture("/models/maps/rock.jpg");
  rock.wrapS = rock.wrapT = THREE.RepeatWrapping;

  if (!map) return null;

  const STEP = Math.max(1, terrain?.step ?? 8);
  const HEIGHT_THRESHOLD = 5;

  const terrainSize = terrain?.terrainSize ?? 2;
  const terrainHeight = terrain?.terrainHeight ?? -10;
  const terrainHeightScale = terrain?.terrainHeightScale ?? 2;
  const terrainPosition = terrain?.position ?? [0, 0, 0];

  rock.repeat.set((map.size[0] * terrainSize) / 10, (map.size[1] * terrainSize) / 10);

  const terrainGeometry = useMemo(() => {
    if (!hm) return null;

    const widthSegments = Math.floor((hm.width - 1) / STEP);
    const heightSegments = Math.floor((hm.height - 1) / STEP);

    const geom = new THREE.PlaneGeometry(
      map.size[0] * terrainSize,
      map.size[1] * terrainSize,
      widthSegments,
      heightSegments
    );

    const posAttr = geom.attributes.position;
    const posArray = posAttr.array;
    const colors = [];

    for (let y = 0; y <= heightSegments; y++) {
      for (let x = 0; x <= widthSegments; x++) {
        const i = y * (widthSegments + 1) + x;

        const hx = Math.min(x * STEP, hm.width - 1);
        const hy = Math.min(y * STEP, hm.height - 1);
        const hi = hy * hm.width + hx;

        const height = hm.heights[hi] ?? 0;
        const finalHeight = height * terrainHeightScale + terrainHeight;

        posArray[i * 3 + 2] = finalHeight;

        if (finalHeight < HEIGHT_THRESHOLD) {
          colors.push(0, 1, 0);
        } else {
          colors.push(1, 1, 1);
        }
      }
    }

    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }, [hm, map.size, STEP, terrainSize, terrainHeight, terrainHeightScale]);
  

  return (
    <>
      {terrainGeometry && (
        <RigidBody type="fixed" colliders="trimesh">
          <mesh
            ref={terrainRef}
            position={[
              position[0] + terrainPosition[0],
              position[1] + terrainPosition[1],
              position[2] + terrainPosition[2],
            ]}
            rotation-x={-Math.PI / 2}
            geometry={terrainGeometry}
          >
            <meshStandardMaterial map={rock} vertexColors roughness={1} metalness={0} />
          </mesh>
          <Water
            width={map.size[0] * (map.terrain?.terrainSize ?? 2)}
            height={map.size[1] * (map.terrain?.terrainSize ?? 2)}
            position={[0, (map.terrain?.baseHeight ?? 0) + 4, 0]}
            segments={128}
            color={[0.0, 0.45, 0.8]}
            opacity={0.8}
          />
        </RigidBody>
      )}
    </>
  );
};

export default Map2;