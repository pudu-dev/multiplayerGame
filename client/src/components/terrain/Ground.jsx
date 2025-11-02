import { RigidBody } from "@react-three/rapier";
import { useState, useEffect } from "react";
import { Socket} from "../conection/SocketConnection";


export const Ground = ({map, position=[0,-1,0]}) => {
 /*  const [map] = useAtom(mapAtom); Obtener el mapa desde el átomo Jotai, pero tambien podemos pasarlo como prop desde experience, ya que renderiza ground */
  
  const [onFloor, setOnFloor] = useState(false);//Estado para el hover visual
  const [_cameraFollow, setCameraFollow] = useState(() => window.__cameraIsFollowing ?? true); // Estado que refleja si la cámara sigue al jugador o no

  useEffect(() => {
    const handler = (e) => {
      setCameraFollow(Boolean(e.detail?.isFollowing));
    };
    window.addEventListener("cameraModeChanged", handler);
    return () => window.removeEventListener("cameraModeChanged", handler);
  }, []);

  const handleClick = (e) => {
    // 🔹 Si la cámara está en modo libre, no permitimos movimiento por click
    if (window.__cameraIsFollowing === false) return;

    const { x, z } = e.point;
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
