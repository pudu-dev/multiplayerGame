import { ContactShadows, useCursor } from "@react-three/drei";
import { useState, useRef , useEffect } from "react";
import { useAtom } from "jotai";
import { useFrame, Canvas, useThree } from "@react-three/fiber";
import { Ground } from "./terrain/Ground";
import { Map } from "./terrain/Map";
import { Model } from "./character/Model";
import { characterAtom, myIdAtom, mapAtom } from "./conection/SocketConnection";
import { usePlayerInput } from "./character/CharacterController.jsx";
import { Camera } from "./character/CameraControl";
import Item from "./items/items.jsx";
import RemotePlayer from "./character/RemotePlayers.jsx";

export const Experience = () => { //componente principal de la escena

  const { camera } = useThree(); // obtener cámara del contexto R3F
  const [characters] = useAtom(characterAtom);
  const [myId] = useAtom(myIdAtom);
  const [map] = useAtom(mapAtom); 
  
  const [onFloor, _setOnFloor] = useState(false);
  useCursor(onFloor);

  const playerRef = useRef(null); //referencia del jugador local para el movimiento de camara y personaje
  const camTargetRef = useRef(null); // anchor invisible para la cámara (separado del player mesh)
  const { updateLocalPosition } = usePlayerInput(playerRef, camera) // pasar la cámara al hook

  useFrame((state, delta) => {updateLocalPosition(delta);}); //mover jugador local cada frame

  useEffect(() => {
    console.log('Conectado con el id:', myId);
  }, [myId]);

  return (
    <>
      {/* camara que sigue al jugador local */}
      <Camera 
        playerRef={playerRef}
        mouseSensitivity={0.002}/> 
      
      {/* mapa y luces */}
      <color attach="background" args={["#8b8b8b"]} />
      <directionalLight intensity={1} position={[25, 18, -25]} castShadow />
      <ambientLight intensity={1} />
      <Ground map={map} />
      {/*   <Map />  */}
      
      {/* recorro el array de item */}
      {map.items.map((item, idx) => (
          <Item key={`${item.name}-${idx}`} item={item} /> // Usar índice para evitar keys duplicadas (mismo item varias veces)
        ))
      }

      {characters.map((char) => { 
        const isPlayer = char.id === myId;
        if (isPlayer) {

          // renderiza el jugador local: group con ref; su posición la actualizamos en useFrame (client-authority)
          return (
            <group key={char.id} ref={playerRef}>
              {/* anchor invisible para que la cámara siga establemente */}
              <group ref={camTargetRef} position={[0, 1.6, 0]} />
              <Model
                hairColor={char.hairColor}
                topColor={char.topColor}
                bottomColor={char.bottomColor}
                shoeColor={char.shoeColor}
                animation={char.animation}
              />
            </group>
          );
        } else {
          // renderiza a otros jugadores usando RemotePlayer (interpolación suave)
          return <RemotePlayer key={char.id} char={char} />;
        }
      })}
    </>
  );
};



