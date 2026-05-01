// client/src/components/character/Attacks.jsx
import { useState, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Socket } from "../../conection/SocketConnection.js";

function Projectile({
  id, position = [0, 1.6, 0],
  direction = [0, 0, -1],
  speed = 20, maxDistance = 30,
  radius = 0.12, color = "orange",
  onRemove = () => {}
}) {
  const mesh = useRef();
  const dir = useRef(new THREE.Vector3().fromArray(direction).normalize());
  const traveled = useRef(0);
  const removed = useRef(false);

  useFrame((_, delta) => {
    if (!mesh.current || removed.current) return;
    const move = dir.current.clone().multiplyScalar(speed * delta);
    mesh.current.position.add(move);
    traveled.current += move.length();
    if (traveled.current >= maxDistance) {
      removed.current = true;
      onRemove(id);
    }
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export default function Attacks({ playerRef, camTargetRef, camera, fireRate = 4, input = null }) {
  const [projectiles, setProjectiles] = useState([]);
  const [cooldowns, setCooldowns] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const nextId = useRef(1);

  const lastFireRef = useRef(0);
  const cooldownMs = 1000 / Math.max(1, fireRate);

  const abilityCooldowns = { 1: 600, 2: 400, 3: 800, 4: 8000 };
  const lastAbility = useRef({});

  const spawnLocal = useCallback((data) => {
    const id = nextId.current++;
    setProjectiles((p) => [...p, { id, ...data }]);
  }, []);

  const spawnProjectile = useCallback(() => {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();

    if (camTargetRef?.current) camTargetRef.current.getWorldPosition(origin);
    else if (playerRef?.current) playerRef.current.getWorldPosition(origin);
    else if (camera) camera.getWorldPosition(origin);

    if (camera) camera.getWorldDirection(dir);
    origin.add(dir.clone().multiplyScalar(0.6));

    const id = nextId.current++;
    const data = { id, position: origin.toArray(), direction: dir.toArray(), speed: 25, maxDistance: 30, radius: 0.12, color: "orange" };
    setProjectiles((p) => [...p, data]);

    if (Socket && Socket.connected) {
      Socket.emit("attack", { position: data.position, direction: data.direction, speed: data.speed, maxDistance: data.maxDistance });
    }
  }, [playerRef, camTargetRef, camera]);

  const removeProjectile = useCallback((id) => {
    setProjectiles((p) => p.filter((pr) => pr.id !== id));
  }, []);

  const canUseAbility = useCallback((id) => {
    const last = lastAbility.current[id] || 0;
    return performance.now() - last >= (abilityCooldowns[id] || 0);
  }, []);

  const markUsed = useCallback((id) => {
    lastAbility.current[id] = performance.now();
  }, []);

  const useAbility1 = useCallback(() => {
    if (!canUseAbility(1)) return;
    markUsed(1);

    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    if (camTargetRef?.current) camTargetRef.current.getWorldPosition(origin);
    else if (playerRef?.current) playerRef.current.getWorldPosition(origin);
    else if (camera) camera.getWorldPosition(origin);
    if (camera) camera.getWorldDirection(dir);
    origin.add(dir.clone().multiplyScalar(0.6));

    const data = { position: origin.toArray(), direction: dir.toArray(), speed: 24, maxDistance: 40, radius: 0.8, color: "purple", damage: 35 };
    spawnLocal(data);
    if (Socket && Socket.connected) Socket.emit("ability", { abilityId: 1, position: data.position, direction: data.direction, speed: data.speed, maxDistance: data.maxDistance, radius: data.radius, color: data.color, damage: data.damage });
  }, [playerRef, camTargetRef, camera, spawnLocal, canUseAbility, markUsed]);

  const useAbility2 = useCallback(() => {
    if (!canUseAbility(2)) return;
    markUsed(2);

    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    if (camTargetRef?.current) camTargetRef.current.getWorldPosition(origin);
    else if (playerRef?.current) playerRef.current.getWorldPosition(origin);
    else if (camera) camera.getWorldPosition(origin);
    if (camera) camera.getWorldDirection(dir);

    const distance = 5;
    if (Socket && Socket.connected) {
      Socket.emit("ability", { abilityId: 2, direction: dir.toArray(), distance });
    }
  }, [playerRef, camTargetRef, camera, canUseAbility, markUsed]);

  const useAbility3 = useCallback(() => {
    if (!canUseAbility(3)) return;
    markUsed(3);
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    if (camTargetRef?.current) camTargetRef.current.getWorldPosition(origin);
    else if (playerRef?.current) playerRef.current.getWorldPosition(origin);
    else if (camera) camera.getWorldPosition(origin);
    if (camera) camera.getWorldDirection(dir);

    const distance = 12;
    const target = origin.clone().add(dir.clone().setY(0).normalize().multiplyScalar(distance));
    if (playerRef?.current && playerRef.current.position) {
      playerRef.current.position.copy(target);
    }
    if (Socket && Socket.connected) Socket.emit("ability", { abilityId: 3, target: target.toArray(), maxDistance: 50 });
  }, [playerRef, camTargetRef, camera, canUseAbility, markUsed]);

  const useAbility4 = useCallback(() => {
    if (!canUseAbility(4)) return;
    markUsed(4);
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    if (camTargetRef?.current) camTargetRef.current.getWorldPosition(origin);
    else if (playerRef?.current) playerRef.current.getWorldPosition(origin);
    else if (camera) camera.getWorldPosition(origin);
    if (camera) camera.getWorldDirection(dir);

    const target = origin.clone().add(dir.clone().multiplyScalar(20));
    const meteorStart = target.clone().add(new THREE.Vector3(0, 40, 0));
    const data = { position: meteorStart.toArray(), direction: [0, -1, 0], speed: 50, maxDistance: 60, radius: 2.5, color: "red", damage: 80, aoe: 5 };
    spawnLocal(data);
    if (Socket && Socket.connected) Socket.emit("ability", { abilityId: 4, target: target.toArray() });
  }, [playerRef, camTargetRef, camera, spawnLocal, canUseAbility, markUsed]);

  const prevMouseRef = useRef(false);
  const prevAttackRef = useRef({ attack_1: false, attack_2: false, attack_3: false, attack_4: false });

  useFrame(() => {
    const now = performance.now();

    if (input && input.current) {
      const a1 = !!input.current.attack_1;
      const a2 = !!input.current.attack_2;
      const a3 = !!input.current.attack_3;
      const a4 = !!input.current.attack_4;
      const mouseDown = !!(input.current.mouse?.left || input.current.left);

      if (document.pointerLockElement) {
        if (a1 && !prevAttackRef.current.attack_1) useAbility1();
        if (a2 && !prevAttackRef.current.attack_2) useAbility2();
        if (a3 && !prevAttackRef.current.attack_3) useAbility3();
        if (a4 && !prevAttackRef.current.attack_4) useAbility4();

        if (mouseDown && !prevMouseRef.current && (now - lastFireRef.current) >= cooldownMs) {
          lastFireRef.current = now;
          spawnProjectile();
        }

        // actualizar estados previos sólo mientras pointer está bloqueado
        prevAttackRef.current.attack_1 = a1;
        prevAttackRef.current.attack_2 = a2;
        prevAttackRef.current.attack_3 = a3;
        prevAttackRef.current.attack_4 = a4;
        prevMouseRef.current = mouseDown;
      } else {
        // resetear para evitar estado stale que bloquea el rising-edge al entrar en pointer-lock
        prevAttackRef.current.attack_1 = false;
        prevAttackRef.current.attack_2 = false;
        prevAttackRef.current.attack_3 = false;
        prevAttackRef.current.attack_4 = false;
        prevMouseRef.current = false;
      }

      const updated = {};
      for (let i = 1; i <= 4; i++) {
        const last = lastAbility.current[i] || 0;
        const cd = abilityCooldowns[i] || 0;
        updated[i] = Math.max(0, cd - (now - last));
      }
      setCooldowns(updated);
    } else {
      // sin input -> reset prev y cooldowns
      prevAttackRef.current.attack_1 = false;
      prevAttackRef.current.attack_2 = false;
      prevAttackRef.current.attack_3 = false;
      prevAttackRef.current.attack_4 = false;
      prevMouseRef.current = false;

      const updated = {};
      for (let i = 1; i <= 4; i++) {
        const last = lastAbility.current[i] || 0;
        const cd = abilityCooldowns[i] || 0;
        updated[i] = Math.max(0, cd - (now - last));
      }
      setCooldowns(updated);
    }
  });

  return (
    <>
      {projectiles.map((p) => (
        <Projectile key={p.id} id={p.id} position={p.position} direction={p.direction} speed={p.speed} maxDistance={p.maxDistance} radius={p.radius} color={p.color} onRemove={removeProjectile} />
      ))}
    </>
  );
}