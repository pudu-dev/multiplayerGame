import { RigidBody } from "@react-three/rapier";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export const Ground = ({ map, position = [0, -1, 0] }) => {

    // HEIGHTMAP para colinas / montañas
  const heightmap = useTexture("/models/maps/highmp.png");
  heightmap.wrapS = heightmap.wrapT = THREE.ClampToEdgeWrapping;
  // HEIGHMAP para Pasto 
  const heightmapGrass = useTexture("/models/maps/grass.jpg");
  heightmapGrass.wrapS = heightmapGrass.wrapT = THREE.ClampToEdgeWrapping;


  // Textura para montañas
  const rock = useTexture("/models/maps/rock.jpg");
  rock.wrapS = rock.wrapT = THREE.RepeatWrapping;
  rock.repeat.set(map.size[0] / 20, map.size[1] / 20);
  //TEXTURA DE PASTO (el pasto va sobre )
  const grass = useTexture("/models/maps/grass.jpg");
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(map.size[0] / 10, map.size[1] / 10);

  return (
    <> 
      {/* plane geometry base suelo de referencia. */}
      <mesh position={[position[0], position[1] - 0.5, position[2]]}
            rotation-x={-Math.PI / 2}>
        <planeGeometry args={[map.size[0], map.size[1], 1, 1]} />  {/* subdivisión 1x1 para plano base (solo referencia / colisión visual simple) */}
        <meshStandardMaterial
          color={"#5C3211"}
          roughness={1}
          metalness={0} />
      </mesh>

      {/* MONTAÑAS (CAPA MAS ALTA)*/}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          position={position}
          rotation-x={-Math.PI / 2}>
          <planeGeometry args={[map.size[0], map.size[1], 254, 254]} />

          <meshStandardMaterial
            map={rock}               // textura de montañas
            displacementMap={heightmap} // mapa de alturas
            displacementScale={100}   // altura de montañas
            displacementBias={-20}
            roughness={1}
            metalness={0}
          />
        </mesh>
      </RigidBody>

      {/* PASTO (CAPA MAS BAJA*/}
      <mesh
        position={[position[0], position[1], position[2]]}
        rotation-x={-Math.PI / 2}>
        <planeGeometry args={[map.size[0], map.size[1], 512 ,512]} />

        <meshStandardMaterial
          map={grass}
          displacementMap={heightmapGrass}          
          displacementScale={10}   // altura del pasto
          displacementBias={0}   // ajustar base del pasto
          roughness={0}
          metalness={0}/>
      </mesh>
    </>
  );
};

export default Ground; 
