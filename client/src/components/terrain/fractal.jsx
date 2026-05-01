// client/src/components/terrain/fractal.jsx
import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";

const directions = [
  [0, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function generateVicsek(level, size, position = [0, 0, 0], out = []) {
  if (level === 0) {
    out.push(position);
    return out;
  }
  const newSize = size / 3;
  directions.forEach(([dx, dy, dz]) => {
    generateVicsek(
      level - 1,
      newSize,
      [
        position[0] + dx * newSize,
        position[1] + dy * newSize,
        position[2] + dz * newSize,
      ],
      out
    );
  });
  return out;
}

export default function Fractal({
  level = 3,
  size = 100,
  position = [0, 20, 0],
  color = "hotpink",
  withColliders = true,
  onReady,
}) {
  const meshRef = useRef();
  const positions = useMemo(() => {
    const pts = generateVicsek(level, size, [0, 0, 0], []);
    return pts.map((p) => [p[0] + position[0], p[1] + position[1], p[2] + position[2]]);
  }, [level, size, position]);

  const cubeSize = useMemo(() => size / Math.pow(3, level), [size, level]);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.set(cubeSize, cubeSize, cubeSize);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, cubeSize]);

  useEffect(() => {
    if (typeof onReady === "function") onReady(positions, cubeSize);
  }, [positions, cubeSize, onReady]);

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
      </instancedMesh>

      {withColliders &&
        positions.map((p, i) => (
          <RigidBody key={i} type="fixed" colliders="cuboid" position={p}>
            <mesh visible={false}>
              <boxGeometry args={[cubeSize, cubeSize, cubeSize]} />
            </mesh>
          </RigidBody>
        ))}
    </>
  );
}