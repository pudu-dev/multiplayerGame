import { useEffect, useRef, useState } from "react";
import { Socket } from "../conection/SocketConnection";

// --- utilidades de interpolación ---
const lerpScalar = (a, b, t) => a + (b - a) * t;

const adaptedLerp = (baseLerp, delta, fps = 60) => {
  const k = Math.max(0, Math.min(1, baseLerp));
  return 1 - Math.pow(1 - k, delta * fps);
};

export const usePlayerInput = () => {
  const input = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    target: null,
  });

  const [animation, setAnimation] = useState("CharacterArmature|Idle");
  const [rotationY, setRotationY] = useState(0);

  const WALK_SPEED = 2; // debe coincidir con el servidor
  const RUN_SPEED = 4; //UNIDADES POR SEGUNDO
  const JUMP_SPEED = 5;
  const GRAVITY = -5;

  // --- Estado de posición y rotación ---
  const positionRef = useRef([0, 0, 0]);
  const rotationRef = useRef(0);

  // --- Estado de salto ---
  const velocityY = useRef(0);
  const isGrounded = useRef(true);

  // --- Movimiento hacia click ---
  const targetRef = useRef(null);
  const movingToTarget = useRef(false);

  // --- Utilidad: convención consistente con el servidor ---
  // rotation = Math.atan2(dx, dz)  (0 -> +Z)
  const forwardFromYaw = (yaw) => [Math.sin(yaw), Math.cos(yaw)]; // [x,z]
  const rightFromYaw = (yaw) => [Math.cos(yaw), -Math.sin(yaw)]; // [x,z]

  // --- Captura de teclas ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      let changed = false;
      switch (e.key.toLowerCase()) {
        case "w": input.current.forward = true; changed = true; break;
        case "s": input.current.backward = true; changed = true; break;
        case "a": input.current.left = true; changed = true; break;
        case "d": input.current.right = true; changed = true; break;
        case "shift": input.current.run = true; changed = true; break;
        case " ":
          if (isGrounded.current) {
            input.current.jump = true;
            changed = true;
          }
          break;
      }

      if (changed) {
        // al presionar teclas, cancelamos target (movimiento por click)
        targetRef.current = null;
        input.current.target = null;

        // calculamos nueva rotación según el input local
        const localX = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
        const localZ = (input.current.backward ? 1 : 0) - (input.current.forward ? 1 : 0);

        if (localX !== 0 || localZ !== 0) {
          const rot = Math.atan2(localX, localZ); // misma convención que servidor
          rotationRef.current = rot;
          setRotationY(rot);
          Socket.emit("move", { ...input.current, target: null, rotation: rot });
          movingToTarget.current = false;
        } else {
          // si no hay direccional, enviamos solo input sin rot
          Socket.emit("move", { ...input.current, target: null, rotation: rotationRef.current });
        }
      }
    };

    const handleKeyUp = (e) => {
      let changed = false;
      switch (e.key.toLowerCase()) {
        case "w": input.current.forward = false; changed = true; break;
        case "s": input.current.backward = false; changed = true; break;
        case "a": input.current.left = false; changed = true; break;
        case "d": input.current.right = false; changed = true; break;
        case "shift": input.current.run = false; changed = true; break;
        case " ": input.current.jump = false; changed = true; break;
      }
      if (changed) {
        // recalculamos rot si queda nuevo input direccional
        const localX = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
        const localZ = (input.current.backward ? 1 : 0) - (input.current.forward ? 1 : 0);
        if (localX !== 0 || localZ !== 0) {
          const rot = Math.atan2(localX, localZ);
          rotationRef.current = rot;
          setRotationY(rot);
          Socket.emit("move", { ...input.current, target: null, rotation: rot });
        } else {
          Socket.emit("move", { ...input.current, target: null, rotation: rotationRef.current });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // --- Animación ---
  useEffect(() => {
    const updateAnimation = () => {
      if (!isGrounded.current) {
        setAnimation("CharacterArmature|Jump");
        return;
      }
      const moving =
        input.current.forward ||
        input.current.backward ||
        input.current.left ||
        input.current.right ||
        movingToTarget.current;
      setAnimation(moving ? "CharacterArmature|Run" : "CharacterArmature|Idle");
    };
    const interval = setInterval(updateAnimation, 50);
    return () => clearInterval(interval);
  }, []);

  // --- updateLocalPosition: ahora rota el vector local por rotationRef (yaw) ---
  // deltaTime en segundos (por ejemplo, ms*0.001)
  const updateLocalPosition = (deltaTime) => {
    const SPEED = input.current.run ? RUN_SPEED : WALK_SPEED;

    // 1) vector local (forward = -Z local convention used earlier)
    let localX = 0;
    let localZ = 0;
    if (input.current.forward) localZ -= 1;
    if (input.current.backward) localZ += 1;
    if (input.current.left) localX -= 1;
    if (input.current.right) localX += 1;

    // 2) movimiento resultante en mundo
    let moveX = 0;
    let moveZ = 0;

    // Si hay input de teclas => rotar el vector local por rotationRef
    if (localX !== 0 || localZ !== 0) {
      const len = Math.sqrt(localX * localX + localZ * localZ);
      const nx = localX / len;
      const nz = localZ / len;

      const yaw = rotationRef.current; // yaw en radianes, convención: 0 -> +Z
      // forward vector (x,z) = [sin(yaw), cos(yaw)]
      // right vector (x,z)   = [cos(yaw), -sin(yaw)]
      const forward = forwardFromYaw(yaw);
      const right = rightFromYaw(yaw);

      // combina localZ * forward + localX * right
      moveX += (nz * forward[0] + nx * right[0]) * SPEED * deltaTime;
      moveZ += (nz * forward[1] + nx * right[1]) * SPEED * deltaTime;

      // actualizar rotación para mirar hacia la dirección del movimiento local
      const desiredRot = Math.atan2(nx, nz);
      rotationRef.current = desiredRot;
      setRotationY(desiredRot);
      Socket.emit("move", { ...input.current, target: null, rotation: desiredRot });
      movingToTarget.current = false;
    }

    // 3) Movimiento hacia target (click) — world-space
    if (targetRef.current) {
      const pos = positionRef.current;
      const dirX = targetRef.current[0] - pos[0];
      const dirZ = targetRef.current[2] - pos[2];
      const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
      if (dist > 0.05) {
        const nx = dirX / dist;
        const nz = dirZ / dist;
        moveX += nx * SPEED * deltaTime;
        moveZ += nz * SPEED * deltaTime;
        movingToTarget.current = true;

        const rot = Math.atan2(dirX, dirZ);
        rotationRef.current = rot;
        setRotationY(rot);
        Socket.emit("move", { ...input.current, target: targetRef.current, rotation: rot });
      } else {
        movingToTarget.current = false;
        targetRef.current = null;
        input.current.target = null;
      }
    }

    // 4) aplicar movimiento al world position
    positionRef.current[0] += moveX;
    positionRef.current[2] += moveZ;

    // --- salto y gravedad (corrección: integrar velocity por deltaTime) ---
    if (input.current.jump && isGrounded.current) {
      velocityY.current = JUMP_SPEED;
      isGrounded.current = false;
      input.current.jump = false;
    }
    velocityY.current += GRAVITY * deltaTime;
    // integrar velocity por deltaTime (antes se sumaba sin escalar -> jitter / discrepancias)
    positionRef.current[1] += velocityY.current * deltaTime;
    
    if (positionRef.current[1] <= 0) {
      positionRef.current[1] = 0;
      velocityY.current = 0;
      isGrounded.current = true;
    }

    // mantener state rotationY sincronizado
    setRotationY(rotationRef.current);

    return positionRef.current;
  };

  // --- reconciliación con servidor: lerp suave o snap si la discrepancia es grande ---
  const reconcilePosition = (serverPos, delta = 1 / 60, snapThreshold = 0.5, baseLerp = 0.12) => {
    const local = positionRef.current;
    const dx = serverPos[0] - local[0];
    const dy = serverPos[1] - local[1];
    const dz = serverPos[2] - local[2];
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq > snapThreshold * snapThreshold) {
      // discrepancia grande -> snap inmediato
      positionRef.current[0] = serverPos[0];
      positionRef.current[1] = serverPos[1];
      positionRef.current[2] = serverPos[2];
      return;
    }

    const t = adaptedLerp(baseLerp, delta);
    positionRef.current[0] = lerpScalar(local[0], serverPos[0], t);
    positionRef.current[1] = lerpScalar(local[1], serverPos[1], t);
    positionRef.current[2] = lerpScalar(local[2], serverPos[2], t);
  };

  const moveTo = (x, z) => {
    targetRef.current = [x, 0, z];
    input.current.target = targetRef.current;
    movingToTarget.current = true;
    const rot = Math.atan2(x - positionRef.current[0], z - positionRef.current[2]); // same conv
    rotationRef.current = rot;
    setRotationY(rot);
    Socket.emit("move", { ...input.current, target: targetRef.current, rotation: rot });
  };

  return { input, animation, rotationY, updateLocalPosition, positionRef, moveTo, reconcilePosition };
};
