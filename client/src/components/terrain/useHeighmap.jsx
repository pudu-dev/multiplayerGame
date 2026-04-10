/*
-----------------------------------------------------------
Convierte la imagen de heighmap (PNG en escala de grises)
En esto Datos numéricos (Float32Array) que Rapier sí puede usar 
DE MANERA LOCAL, pero lo cambiaremos a server authority.
---------------------------------------------------------------
*/

/* import { useEffect, useState } from "react";

export function useHeightmap(src, scale = 100) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

      const heights = new Float32Array(img.width * img.height);

      for (let i = 0; i < heights.length; i++) {
        const stride = i * 4;
        const r = imageData[stride]; // grayscale
        heights[i] = (r / 255) * scale;
      }

      setData({
        heights,
        width: img.width,
        height: img.height,
      });
    };
  }, [src, scale]);

  return data;
} */




/* esto es Ground.jsx antiguo con client authority */

import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useHeightmap } from "./useHeighmap";

export const Ground = ({ map, position = [0, 0, 0], terrainRef= null }) => {

  const hm = useHeightmap("/models/maps/highmp.png", 100);

  const rock = useTexture("/models/maps/rock.jpg");
  rock.wrapS = rock.wrapT = THREE.RepeatWrapping;

  const grass = useTexture("/models/maps/grass.jpg");
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;

  const STEP = 8;
  const HEIGHT_THRESHOLD = 10; /* altura de  mezcla de texturas */

  //  BASE
  const baseSize = 2;
  const baseHeight = 0;

  //  TERRAIN
  const terrainSize = 2;
  const terrainHeight = -40;
  const terrainHeightScale= 2;

  // ajustar tiling correctamente
  rock.repeat.set((map.size[0] * terrainSize) / 20, (map.size[1] * terrainSize) / 20);
  grass.repeat.set((map.size[0] * baseSize) / 10, (map.size[1] * baseSize) / 10);

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

    const pos = geom.attributes.position;
    const colors = [];

    for (let y = 0; y <= heightSegments; y++) {
      for (let x = 0; x <= widthSegments; x++) {

        const i = y * (widthSegments + 1) + x;

        const hx = x * STEP;
        const hy = y * STEP;
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

  }, [hm, map.size, terrainSize, terrainHeight]);

  if (!terrainGeometry) return null;

  return (
    <>
      {/* 🔵 BASE INDEPENDIENTE */}
      <mesh
        position={[position[0], baseHeight, position[2]]}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[
          map.size[0] * baseSize,
          map.size[1] * baseSize
        ]} />
        <meshStandardMaterial map={grass} />
      </mesh>

      {/* 🟤 TERRAIN INDEPENDIENTE */}
      <RigidBody type="fixed" colliders="trimesh" >
        <mesh
          ref={terrainRef}
          position={[position[0], position[1], position[2]]}
          rotation-x={-Math.PI / 2}
          geometry={terrainGeometry}
        >
          <meshStandardMaterial
            map={rock}
            vertexColors
            roughness={1}
            metalness={0}
          />
        </mesh>
      </RigidBody>
    </>
  );
};

export default Ground;