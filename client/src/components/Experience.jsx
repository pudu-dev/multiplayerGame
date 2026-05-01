// -------------------------------------- IMPORTS PRINCIPALES --------------------------------------------------------
import { ContactShadows, OrbitControls, useCursor, Environment, Text} from "@react-three/drei";
import { useState, useRef , useEffect } from "react";
import { useAtom } from "jotai";
import { useFrame, useThree } from "@react-three/fiber";
import { characterAtom, myIdAtom, mapAtom, wallsAtom} from "../conection/SocketConnection.js";

// -------------------------------------- IMPORTS SECUNDARIOS --------------------------------------------------------
/* mapas y objetos de mapa */
import Map1 from "./terrain/Map1.jsx";
import Map2 from "./terrain/Map2.jsx";
import Map3 from "./terrain/Map3.jsx";
import Map4 from "./terrain/Map4.jsx";
import Map5 from "./terrain/Map5.jsx";
import Item from "./items/items.jsx";
import Teleport from "./terrain/Teleport.jsx";

/* personajes locales y remotos */
import { Model } from "./character/Model.jsx";
import { usePlayerInput } from "./character/CharacterController.jsx";
import { Camera } from "./character/CameraControl";
import Crosshair from "../components/ui/CrossHair";
import { RigidBody } from "@react-three/rapier";
import CharacterHud from "./ui/CharacterHUD.jsx";
import Attacks from "./character/Attacks.jsx";
import RemotePlayer from "./character/RemotePlayers.jsx";


// ----------------------------------------------------------------------------------------------

//componente principal de la escena
export const Experience = () => {
  const { camera } = useThree(); // obtener cámara del contexto R3F
  const [characters] = useAtom(characterAtom); 
  const [myId] = useAtom(myIdAtom);
  const [map] = useAtom(mapAtom);  //map para colocar elementos en el ground
  const [attackWalls]= useAtom(wallsAtom)

  const myCharacter = characters.find((c) => c.id === myId);
  const currentMapId = myCharacter?.mapId ?? map?.id ?? null;

  const terrainRef = useRef(null); // referencia para el terreno (collider)
  
  const [onFloor, _setOnFloor] = useState(false);
  useCursor(onFloor);

  const playerRef = useRef(null); //referencia del jugador local para el movimiento de camara y personaje
  const camTargetRef = useRef(null); // anchor invisible para la cámara (separado del player mesh)
  const { updateLocalPosition, input } = usePlayerInput(playerRef, camera, map) // pasar la cámara al hook

  useFrame((state, delta) => {updateLocalPosition(delta);}); //mover jugador local cada frame

  useEffect(() => {
    console.log('Conectado con el id:', myId);
  }, [myId]);

  return (
    <>
      {/* camara que sigue al jugador local */}
      <Camera playerRef={playerRef} mouseSensitivity={0.002} input={input}/> 
      {/* punto centro de mira de la camara */}
      <Crosshair size={0.3} color="red" />

{/* para usar orbitcontrol comentar camera y apretar window key para usar el mouse*/}
{/* <OrbitControls enableZoom={true} /> */}
      
      {/* mapa y luces */}
      <color attach="background" args={["#8b8b8b"]} />
      <directionalLight intensity={1} position={[25, 18, -25]} castShadow />
      <ambientLight intensity={1} />

      {/* Entorno HDR ["sunset", "dawn", "night", "warehouse", "forest", "apartment", "studio", "city", "park", "lobby"]*/}
      {/* <Environment preset="night" background={false} /> */}
      {/* para usar un HDR personalizado, colocar el archivo en public/env.hdr y descomentar */}
      {/* <Environment files="../public/models/maps/sky.hdr" background={true} environmentIntensity={0} />  */}

      {/* <Sky/> */}

      {map?.sky && (
        map.sky.type === "preset" ? (
          <Environment preset={map.sky.preset} background={true} />
        ) : (
          <Environment files={map.sky.src} background={true} />
        )
      )}

      
      {/* recorro el array de item */}
      {map?.items?.map((item, idx) => (
          <Item key={`${item.name}-${idx}`} item={item} /> // Usar índice para evitar keys duplicadas (mismo item varias veces)
        ))
      }

      {/* elegimos el mapa */}
      {map?.id === "map_1" && <Map1 map={map} terrainRef={terrainRef} />}
      {map?.id === "map_2" && <Map2 map={map} terrainRef={terrainRef} />}
      {map?.id === "map_3" && <Map3 map={map} terrainRef={terrainRef} model={map.model} />}
      {map?.id === "map_4" && <Map4 map={map} terrainRef={terrainRef} />}
      {map?.id === "map_5" && <Map5 map={map} terrainRef={terrainRef} />}


      {/* render paredes dinámicas (abilities) */}
      {attackWalls?.filter(w => w.mapId === currentMapId).map((w,i) => <Wall key={w.id ?? i} w={w} />)}

      {/* teleports */}
      {(map?.teleports ?? []).map((tp) => (
        <Teleport key={tp.id} tp={tp} />
      ))}

      <Attacks playerRef={playerRef} camTargetRef={camTargetRef} camera={camera} input={input} />



      {/* personajes (local y remotos) */}
      {characters.map((char) => { 
        const isPlayer = char.id === myId;
        const sameMap = !currentMapId || !char.mapId || char.mapId === currentMapId;
        if (!isPlayer && !sameMap) return null;
        if (isPlayer) {
          return ( // renderiza el jugador local: group con ref; su posición la actualizamos en useFrame (client-authority)
            <group key={char.id} ref={playerRef}>

              <group ref={camTargetRef} position={[0, 1.6, 0]} /> {/* anchor invisible para que la cámara siga establemente */}
                
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
                />

            </group>
          );
        } else {
          // renderiza a otros jugadores usando RemotePlayer (interpolación suave)
          return ( 
            <RemotePlayer key={char.id} char={char} /> 
          );

        }
        
      })}
    </>
  );
};



