import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export const Ground = ({ map, position = [0, 0, 0], terrainRef = null }) => {
  const terrain = map?.terrain;

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

  const grass = useTexture("/models/maps/grass.jpg");
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;

  if (!map || !terrain || !hm) return null;

  const STEP = terrain.step ?? 1; // cada cuántos pixeles del heightmap se muestrea para generar el terreno (reduce cantidad de vértices y mejora performance), cambiar en useHeighmap server al cambiar aqui y en charactercontroller client
  const HEIGHT_THRESHOLD = 10;

  const baseSize = terrain.baseSize ?? 2;
  const baseHeight = terrain.baseHeight ?? 0;

  const terrainSize = terrain.terrainSize ?? 2;
  const terrainHeight = terrain.terrainHeight ?? -40;
  const terrainHeightScale = terrain.terrainHeightScale ?? 2;
  const terrainPosition = terrain.position ?? [0, 0, 0];

  rock.repeat.set((map.size[0] * terrainSize) / 20, (map.size[1] * terrainSize) / 20);
  grass.repeat.set((map.size[0] * baseSize) / 10, (map.size[1] * baseSize) / 10);

  const terrainGeometry = useMemo(() => {
    const widthSegments = Math.floor((hm.width - 1) / STEP);
    const heightSegments = Math.floor((hm.height - 1) / STEP);

    const geom = new THREE.PlaneGeometry(
      map.size[0] * terrainSize,
      map.size[1] * terrainSize,
      widthSegments,
      heightSegments
    );

    const pos = geom.attributes.position;
    const colors = [];

    for (let y = 0; y <= heightSegments; y++) {
      for (let x = 0; x <= widthSegments; x++) {
        const i = y * (widthSegments + 1) + x;

        const hx = Math.min(x * STEP, hm.width - 1);
        const hy = Math.min(y * STEP, hm.height - 1);
        const hi = hy * hm.width + hx;

        const height = hm.heights[hi] ?? 0;
        const finalHeight = height * terrainHeightScale + terrainHeight;

        pos.setZ(i, finalHeight);

        if (finalHeight < HEIGHT_THRESHOLD) {
          colors.push(0, 1, 0);
        } else {
          colors.push(1, 1, 1);
        }
      }
    }

    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
  }, [hm, map.size, STEP, terrainSize, terrainHeight, terrainHeightScale]);

  return (
    <>
      <mesh position={[position[0], baseHeight, position[2]]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[map.size[0] * baseSize, map.size[1] * baseSize]} />
        <meshStandardMaterial map={grass} />
      </mesh>

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
      </RigidBody>
    </>
  );
};

export default Ground;