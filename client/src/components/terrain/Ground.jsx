import { RigidBody } from "@react-three/rapier";
import { useState, useEffect } from "react";
import { Socket} from "../conection/SocketConnection";

export const Ground = ({map, position=[0,-1,0]}) => {
  const [onFloor, setOnFloor] = useState(false);
  const [_cameraFollow, setCameraFollow] = useState(() => window.__cameraIsFollowing ?? true);

  // nuevo: posición local del jugador (se actualiza desde eventos "characters")
  const [playerPos, setPlayerPos] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setCameraFollow(Boolean(e.detail?.isFollowing));
    };
    window.addEventListener("cameraModeChanged", handler);
    return () => window.removeEventListener("cameraModeChanged", handler);
  }, []);

  // suscribirnos a characters para conocer la posición local del jugador
  useEffect(() => {
    const handleChars = (chars) => {
      const me = chars.find(c => c.id === Socket.id);
      if (!me) return;
      setPlayerPos(me.position);
    };
    Socket.on("characters", handleChars);
    return () => Socket.off("characters", handleChars);
  }, []);

  const handleClick = (e) => {
    if (window.__cameraIsFollowing === false) return;

    const { x, z } = e.point;

    // si conocemos la posición local del jugador, calcular rotación hacia el target
    if (playerPos) {
      const dx = x - playerPos[0];
      const dz = z - playerPos[2];
      const rotation = Math.atan2(dx, dz);
      // despachamos un evento local para que el cliente rote instantáneamente (predicción)
      window.dispatchEvent(new CustomEvent("localRotate", { detail: { rotation } }));
    }

    Socket.emit("move", {
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false,
      target: [x, 0, z],
    });
  };

  // 🔹 Si la cámara está en modo follow, desactivamos el hover visual
  const handlePointerEnter = () => {
    if (!_cameraFollow) setOnFloor(true);
  };

  const handlePointerLeave = () => {
    if (!_cameraFollow) setOnFloor(false);
  };

  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh
        position={position}
        receiveShadow
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={map.size} />
        <meshStandardMaterial color={onFloor ? "lightgreen" : "green"} />
      </mesh>
    </RigidBody>
  );
};

export default Ground;
