import { RigidBody } from "@react-three/rapier";
import { useState, useEffect } from "react";
import { Socket} from "../conection/SocketConnection";

export const Ground = ({map, position=[0,-1,0]}) => {
  // estado para hover visual
  const [onFloor, setOnFloor] = useState(false);
  // estado para modo cámara follow
  const [_cameraFollow, setCameraFollow] = useState(() => window.__cameraIsFollowing ?? true);
  // posición local del jugador
  const [playerRef, setPlayerRef] = useState(null);
  
  // escuchar cambios en el modo de cámara (follow/free)
  useEffect(() => {
    const handler = (e) => {
      setCameraFollow(Boolean(e.detail.isFollowing));
    };
    window.addEventListener("cameraModeChanged", handler);
    return () => window.removeEventListener("cameraModeChanged", handler);
  }, []);

  // escuchar actualizaciones de posición del jugador desde el servidor
  useEffect(() => {
    const handleChars = (chars) => {
      const me = chars.find(c => c.id === Socket.id);
      if (!me) return;
      setPlayerRef(me.position);
    };
    // suscribirnos a eventos "characters" del servidor
    Socket.on("characters", handleChars);
    return () => Socket.off("characters", handleChars);
  }, []);

  // manejar clicks en el suelo para mover al jugador
  const handleClick = (e) => {
    // si la cámara no está en modo follow, ignorar clicks
    if (window.__cameraIsFollowing === false) return;
    // obtener coordenadas del click en el plano XZ
    const { x, z } = e.point;
    // si conocemos la posición local del jugador, calcular rotación hacia el target
    if (playerRef) {
      const dx = x - playerRef[0];
      const dz = z - playerRef[2];
      const rotation = Math.atan2(dx, dz);
      // despachamos un evento local para que el cliente rote instantáneamente (predicción)
      window.dispatchEvent(new CustomEvent("localRotate", { detail: { rotation } }));
    }
    // enviar comando de movimiento al servidor
    Socket.emit("move", {
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false,
      target: [x, 0, z],
    });
  };

  // Si la cámara está en modo follow, desactivamos el hover visual
  const handlePointerEnter = () => {
    if (!_cameraFollow) setOnFloor(true);
  };
  const handlePointerLeave = () => {
    if (!_cameraFollow) setOnFloor(false);
  };

  // render del suelo
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
