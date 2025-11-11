import { RigidBody } from "@react-three/rapier";
import { useState, useEffect } from "react";
import { Socket} from "../conection/SocketConnection";

export const Ground = ({map, position=[0,-1,0]}) => {
  // estado para hover visual
  const [onFloor, setOnFloor] = useState(false);
  // estado para modo cámara follow
  const [_cameraFollow, setCameraFollow] = useState(() => window.__cameraIsFollowing ?? true);

  // escuchar cambios en el modo de cámara (follow/free)
  useEffect(() => {
    const handler = (e) => {
      setCameraFollow(Boolean(e.detail.isFollowing));
    };
    window.addEventListener("cameraModeChanged", handler);
    return () => window.removeEventListener("cameraModeChanged", handler);
  }, []);

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
