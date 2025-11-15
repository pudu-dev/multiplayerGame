import { RigidBody } from "@react-three/rapier";
import { useState, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export const Ground = ({ map, position = [0, -1, 0] }) => {

  const [_cameraFollow, setCameraFollow] = useState(() => window.__cameraIsFollowing ?? true);

  useEffect(() => {
    const handler = (e) => {
      setCameraFollow(Boolean(e.detail.isFollowing));
    };
    window.addEventListener("cameraModeChanged", handler);
    return () => window.removeEventListener("cameraModeChanged", handler);
  }, []);

  // TEXTURA DE PASTO (2D, no se deforma)
  const grass = useTexture("/models/maps/grass.jpg");
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(map.size[0] / 10, map.size[1] / 10);

  // HEIGHTMAP para colinas / montañas
  const heightmap = useTexture("/models/maps/highmp.png");
  heightmap.wrapS = heightmap.wrapT = THREE.ClampToEdgeWrapping;

  // Textura para montañas
  const rock = useTexture("/models/maps/rock.jpg");
  rock.wrapS = rock.wrapT = THREE.RepeatWrapping;
  rock.repeat.set(map.size[0] / 20, map.size[1] / 20);

  return (
    <>
      {/* MONTAÑAS */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          position={position}
          rotation-x={-Math.PI / 2}
          receiveShadow
          castShadow
        >
          <planeGeometry args={[map.size[0], map.size[1], 254, 254]} />

          <meshStandardMaterial
            map={rock}               // textura de montañas
            displacementMap={heightmap} // mapa de alturas
            displacementScale={12}   // altura de montañas
            displacementBias={-4}
            roughness={1}
            metalness={0}
          />
        </mesh>
      </RigidBody>

      {/* PASTO */}
      <mesh
        position={[position[0], position[1], position[2]]}
        rotation-x={-Math.PI / 2}
        receiveShadow>
        <planeGeometry args={[map.size[0], map.size[1]]} />

        <meshStandardMaterial
          map={grass}
          displacementMap={heightmap}          
          displacementScale={1}   // altura del pasto
          displacementBias={0}   // ajustar base del pasto
          roughness={1}
          metalness={0}/>
      </mesh>
    </>
  );
};

export default Ground; 
