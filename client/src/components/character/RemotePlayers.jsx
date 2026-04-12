import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Model } from "./Model";
// importar la gravedad desde CharacterController
import { GRAVITY } from "./CharacterController.jsx";
/* const GRAVITY = -9.8; */
import CharacterHud from "../ui/CharacterHUD.jsx";

export default function RemotePlayer({ char, smooth = 0.12, snapThreshold = 1.0 }) {
  const groupRef = useRef();

  // reusar vectores / quaternion para evitar allocations por frame
  const targetVec = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());

  // estado vertical local para simular salto/caida (inspirado en CharacterController)
  const vertVelRef = useRef(0);
  const lastServerYRef = useRef(0);
  const lastServerGroundedRef = useRef(true);
  // ref para asegurarnos de inicializar solo una vez por id (satisface eslint)
  const initializedIdRef = useRef(null);

  // para detectar si la convención de yaw del servidor está invertida
  const prevServerPosRef = useRef(new THREE.Vector3());
  const needsFlipRef = useRef(false);

  // init position once (cuando cambia el id) — incluimos deps pero solo ejecutamos
  // la inicialización la primera vez que veamos este id.
  useEffect(() => {
    if (initializedIdRef.current === char.id) return;
    initializedIdRef.current = char.id;
    if (!groupRef.current) return;
    const px = (char.position && char.position[0]) || 0;
    const py = (char.position && char.position[1]) || 0;
    const pz = (char.position && char.position[2]) || 0;
    groupRef.current.position.set(px, py, pz);
    targetQuat.current.setFromEuler(new THREE.Euler(0, char.rotation || 0, 0));
    groupRef.current.quaternion.copy(targetQuat.current);

    // inicializar estado vertical desde el servidor
    lastServerYRef.current = py;
    vertVelRef.current = char.velocityY ?? 0;
    lastServerGroundedRef.current = !!char.isGrounded;
    // inicializar prevServerPos para la detección de flip
    prevServerPosRef.current.set(px, py, pz);
  }, [char.id, char.position, char.rotation, char.velocityY, char.isGrounded]);

  // actualizar refs cuando llega un nuevo snapshot del server (char cambia)
  useEffect(() => {
    // actualizar velocidad y referencia de Y del servidor
    if (char.position) lastServerYRef.current = char.position[1] ?? lastServerYRef.current;
    if (typeof char.velocityY === "number") vertVelRef.current = char.velocityY;
    if (typeof char.isGrounded !== "undefined") lastServerGroundedRef.current = !!char.isGrounded;
  }, [char.position, char.velocityY, char.isGrounded]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // defenderse contra datos faltantes
    const px = (char.position && char.position[0]) || 0;
    const py = (char.position && char.position[1]) || 0;
    const pz = (char.position && char.position[2]) || 0;
    const target = targetVec.current;
    target.set(px, py, pz);

    const pos = groupRef.current.position;

    // XZ: comparar con squared distance solo en XZ -> más preciso para snap horizontal
    const dx = pos.x - target.x;
    const dz = pos.z - target.z;
    const sqDistXZ = dx * dx + dz * dz;
    const snapSq = snapThreshold * snapThreshold;
    const alpha = 1 - Math.pow(1 - smooth, delta * 60);

    if (sqDistXZ > snapSq) {
      pos.x = target.x;
      pos.z = target.z;
    } else {
      // lerp por componente (evita construir vectores temporales)
      pos.x = THREE.MathUtils.lerp(pos.x, target.x, alpha);
      pos.z = THREE.MathUtils.lerp(pos.z, target.z, alpha);
    }

    // detectar si la convención de forward del servidor está invertida:
    // comparamos la dirección de movimiento del servidor con el forward construido desde char.rotation.
    // si están opuestos (dot < 0) asumimos que hay un desfase de PI y flippeamos.
    const prev = prevServerPosRef.current;
    const mvx = target.x - prev.x;
    const mvz = target.z - prev.z;
    const mvLenSq = mvx * mvx + mvz * mvz;
    if (mvLenSq > 1e-6 && typeof char.rotation === "number") {
      // forward a partir del yaw del servidor
      const rawYaw = char.rotation;
      const fx = Math.sin(rawYaw);
      const fz = Math.cos(rawYaw);
      const invLen = 1 / Math.sqrt(mvLenSq);
      const mvnx = mvx * invLen;
      const mvnz = mvz * invLen;
      const dot = fx * mvnx + fz * mvnz;
      // si dot < 0, la convención está invertida -> flip
      needsFlipRef.current = dot < 0;
    }
    // actualizar prevServerPos para la siguiente iteración
    prevServerPosRef.current.set(target.x, target.y, target.z);

    // --- Lógica vertical con integración física (más fiel al CharacterController) ---
    // Si la discrepancia vertical con el servidor es grande -> snap inmediato
    const ySnapThreshold = Math.max(0.6, snapThreshold);
    const serverY = lastServerYRef.current;
    const yDiffServer = Math.abs(pos.y - serverY);
    if (yDiffServer > ySnapThreshold) {
      // corrección fuerte: alinear a la posición del servidor y sincronizar velocidad vertical
      pos.y = serverY;
      vertVelRef.current = char.velocityY ?? vertVelRef.current;
    } else {
      // integrar velocidad vertical usando la velocidad que nos dio el servidor (o la última conocida)
      // aplicar gravedad localmente para la simulación del salto/caída en el remote player
      vertVelRef.current += GRAVITY * delta;
      pos.y += vertVelRef.current * delta;

      // si el servidor dice grounded o estamos por debajo del suelo, corregimos al suelo
      const serverGrounded = !!lastServerGroundedRef.current;
      if (serverGrounded && pos.y <= serverY + 0.001) {
        pos.y = serverY; // normalmente 0 u otra altura del terreno enviada por el server
        vertVelRef.current = 0;
      }

      // evita que se quede ligeramente por debajo del suelo (seguro)
      if (pos.y < 0) {
        pos.y = 0;
        vertVelRef.current = 0;
      }
    }

    // rotacion: detectar flip + interpolación suave por quaternion.slerp
    const rawTargetY = typeof char.rotation === "number" ? char.rotation : groupRef.current.rotation.y;
    const adjTargetY = rawTargetY + (needsFlipRef.current ? Math.PI : 0);
    targetQuat.current.setFromEuler(new THREE.Euler(0, adjTargetY, 0));
    const rotAlpha = 1 - Math.pow(1 - smooth, delta * 60);

    if (sqDistXZ > snapSq) {
      // si snap horizontal, snapear rotación también por coherencia
      groupRef.current.quaternion.copy(targetQuat.current);
    } else {
      groupRef.current.quaternion.slerp(targetQuat.current, rotAlpha);
    }
  });

  return (
    <group ref={groupRef}>
      <Model
        hairColor={char.hairColor}
        topColor={char.topColor}
        bottomColor={char.bottomColor}
        shoeColor={char.shoeColor}
        animation={char.animation}
      />
      <CharacterHud
      playerName={char.name}
      health={char.health}
      maxHealth={char.maxHealth}
      energy={char.energy}
      maxEnergy={char.maxEnergy}
      position={[0, 2.2, 0]} // ajustar si hace falta
      scale={1}
    />
    </group>
  );
}