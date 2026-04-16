// client/src/components/character/Attacks.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Socket } from "../conection/SocketConnection";

function Projectile({ 
    id, 
    position = [0, 1.6, 0],
    direction = [0, 0, -1], 
    speed = 20, 
    maxDistance = 30, 
    radius = 0.12, 
    color = "orange", 
    onRemove = () => {} }) {

    const mesh = useRef();
    const dir = useRef(new THREE.Vector3().fromArray(direction).normalize());
    const traveled = useRef(0);
    const removed = useRef(false);
        
    useEffect(() => {
      if (mesh.current) mesh.current.position.fromArray(position);
    }, [position]);

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

export default function Attacks({ playerRef, camTargetRef, camera, fireRate = 4 }) {
    const [projectiles, setProjectiles] = useState([]);
    const nextId = useRef(1);

      // --- rate limit ---
    const lastFireRef = useRef(0);               // time of last shot (ms)
    const cooldownMs = 1000 / Math.max(1, fireRate);

    const spawnProjectile = useCallback(() => {
      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();

      if (camTargetRef?.current) camTargetRef.current.getWorldPosition(origin);
      else if (playerRef?.current) playerRef.current.getWorldPosition(origin);
      else camera.getWorldPosition(origin);

      camera.getWorldDirection(dir);

      // alejar un poco del jugador/cámara para no solaparse
      origin.add(dir.clone().multiplyScalar(0.6));

      const id = nextId.current++;
      const data = { id, position: origin.toArray(), direction: dir.toArray(), speed: 25, maxDistance: 30 };
      setProjectiles((p) => [...p, data]);

      // opcional: avisar al servidor si está conectado (server-authority)
      if (Socket && Socket.connected) {
        Socket.emit("attack", { position: data.position, direction: data.direction, speed: data.speed, maxDistance: data.maxDistance });
      }
    }, [playerRef, camTargetRef, camera]);

    const removeProjectile = useCallback((id) => {
      setProjectiles((p) => p.filter((pr) => pr.id !== id));
    }, []);

    useEffect(() => {
      const onDown = () => {
        if (!document.pointerLockElement) return;
        const now = performance.now();
        if (now - lastFireRef.current < cooldownMs) return; // todavía en cooldown
        lastFireRef.current = now;
        spawnProjectile();
      };
      window.addEventListener("mousedown", onDown);
      return () => window.removeEventListener("mousedown", onDown);
    }, [spawnProjectile, cooldownMs]);

    return (
      <>
        {projectiles.map((p) => (
          <Projectile key={p.id} id={p.id} position={p.position} direction={p.direction} speed={p.speed} maxDistance={p.maxDistance} onRemove={removeProjectile} />
        ))}
      </>
    );
}