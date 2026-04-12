import React from "react";
import { Billboard, Text } from "@react-three/drei";

export default function onlineCharacterHUD({
  playerName = "Player",
  health = 100,
  maxHealth = 100,
  energy = 100,
  maxEnergy = 100,
  position = [0, 2.2, 0],
  scale = 1,
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

  return (
    <Billboard position={position} follow={true} lockY={true}>
      <group>
        {/* fondo semitransparente */}
        <mesh>
          <planeGeometry args={[bgW, bgH]} />
          <meshBasicMaterial color="#000" transparent opacity={0.6} />
        </mesh>

        {/* nombre */}
        <Text
          position={[0, bgH / 4, 0.01]}
          fontSize={0.12 * scale}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {playerName}
        </Text>

        {/* barra de vida */}
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

        {/* barra de energía */}
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
    </Billboard>
  );
}