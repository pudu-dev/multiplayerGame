import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

export default function CharacterHUD({
  playerName = "Player",
  health = 100,
  maxHealth = 100,
  energy = 100,
  maxEnergy = 100,
  position = [0, 2.2, 0],
  scale = 1,
  lockY = true, 
}) {
  const hp = Math.max(0, Math.min(1, health / (maxHealth || 1)));
  const en = Math.max(0, Math.min(1, energy / (maxEnergy || 1)));

  const barW = 1.2 * scale;
  const barH = 0.12 * scale;
  const bgW = 1.6 * scale;
  const bgH = 0.5 * scale;

  const hpFillW = barW * hp;
  const hpFillX = -barW / 2 + hpFillW / 2;
  const enFillW = barW * en;
  const enFillX = -barW / 2 + enFillW / 2;

  const groupRef = useRef();
  const { camera } = useThree();

  const tmpWorldPos = useRef(new THREE.Vector3());
  const camWorldPos = useRef(new THREE.Vector3());
  const camWorldQuat = useRef(new THREE.Quaternion());
  const parentWorldQuat = useRef(new THREE.Quaternion());
  const desiredWorldQuat = useRef(new THREE.Quaternion());

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    // posición mundial del HUD
    g.getWorldPosition(tmpWorldPos.current);
    camera.getWorldPosition(camWorldPos.current);
    camera.getWorldQuaternion(camWorldQuat.current);

    if (lockY) {
      // solo rotar en Y (mantener vertical)
      const dir = camWorldPos.current.clone().sub(tmpWorldPos.current);
      dir.y = 0;
      if (dir.lengthSq() > 1e-6) {
        dir.normalize();
        const yaw = Math.atan2(dir.x, dir.z);
        desiredWorldQuat.current.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      } else {
        desiredWorldQuat.current.copy(camWorldQuat.current);
      }
    } else {
      // exactamente la orientación de la cámara
      desiredWorldQuat.current.copy(camWorldQuat.current);
    }

    // convertir orientacion mundial deseada a quaternion local (ignorar rotación del padre)
    const parent = g.parent;
    if (parent) {
      parent.getWorldQuaternion(parentWorldQuat.current);
      const local = parentWorldQuat.current.clone().invert().multiply(desiredWorldQuat.current);
      g.quaternion.copy(local);
    } else {
      g.quaternion.copy(desiredWorldQuat.current);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <group>
        <mesh>
          <planeGeometry args={[bgW, bgH]} />
          <meshBasicMaterial color="#000" transparent opacity={0.6} />
        </mesh>

        <Text
          position={[0, bgH / 4, 0.01]}
          fontSize={0.12 * scale}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {playerName}
        </Text>

        <group position={[0, -0.06 * scale, 0.01]}>
          <mesh>
            <planeGeometry args={[barW, barH]} />
            <meshBasicMaterial color="#333" />
          </mesh>

          {hp > 0 && (
            <mesh position={[hpFillX, 0, 0.02]}>
              <planeGeometry args={[hpFillW, barH * 0.9]} />
              <meshBasicMaterial color="red" />
            </mesh>
          )}
        </group>

        <group position={[0, -0.2 * scale, 0.01]}>
          <mesh>
            <planeGeometry args={[barW, barH]} />
            <meshBasicMaterial color="#333" />
          </mesh>

          {en > 0 && (
            <mesh position={[enFillX, 0, 0.02]}>
              <planeGeometry args={[enFillW, barH * 0.9]} />
              <meshBasicMaterial color="#00aaff" />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}