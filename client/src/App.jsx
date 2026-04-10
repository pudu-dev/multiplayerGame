import './App.css'
import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import { SocketManager } from "./components/conection/SocketManager";
import { Stats, Html } from "@react-three/drei";
import HUD from "./components/ui/HUD";
/* import RAPIER from '@dimforge/rapier3d-compat'; */
import { Physics } from "@react-three/rapier";
import Crosshair from "./components/ui/CrossHair";

export default function App() {

  const [gameState, setGameState] = useState("start");
  console.log ("juego corriendo")

  return (
    <>
      <div className="contenedor_principal" id="contenedor_principal" >

        <div className="marco" id="marco">

          {/* ---------- PANTALLA DE INICIO ---------- */}
          {gameState === "start" && (
            <div className="pantalla_inicio">
              <button onClick={() => setGameState("playing")} className="boton_inicio">
                Start Game
              </button>
            </div>
          )}

          {/* ---------- PANTALLA DE JUEGO ---------- */}
          {gameState === "playing" && (
            <>
              {/* Botón de salir */}
              <button onClick={() => setGameState("start")} id="exitButton" className="boton_salir">
                Exit game
              </button>

              <HUD/>
              <Canvas
                shadows={false}                             // reducir costo de sombras
                dpr={[1, 1.5]}                              // limitar pixelRatio
                gl={{ antialias: true, powerPreference: 'high-performance' }} // favorecer perf
                camera={{ position: [8, 8, 8], fov: 30 }}
                style={{ touchAction: "none" }}         
                >
                <Suspense fallback={<Html><div>Cargando escena...</div></Html>}> {/* puede ser null */}
                  <Crosshair size={0.3} color="red" />
                  <Physics gravity={[0, -9.81, 0]} debug={false}> {/* debug true es caro */}
                    <Stats /> 
                    <Experience />
                  </Physics>
                </Suspense >
              </Canvas>
              <SocketManager />

            </>
          )}

        </div>
        
      </div>
    </>
  );
}