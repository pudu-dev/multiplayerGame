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
import MusicPlayer from "./components/utilitycomponents/MusicPlayer";

export default function App() {

  const [gameState, setGameState] = useState("start");
  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");

  console.log ("juego corriendo")

  return (
    <>
      <div className="contenedor_principal" id="contenedor_principal" >

        <div className="marco">

          {/* ---------- PANTALLA DE INICIO ---------- */}
          {gameState === "start" && (
            <div className="pantalla_inicio">

              <h1 className="titulo_juego">Multiplayer Game</h1>

              <div className="contenedor_formulario_inicio">


                <div className="contenedor_nombre">

                  <label className="titulo_nombre"> 
                    Ingresa tu nombre: 
                  </label>
                  
                  <input type="text" placeholder="Nombre" className="input_nombre"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                  
                </div>


                <div className="contenedor_seleccion_team">

                  <label className="titulo_team"> Elige tu equipo: </label>

                  <div className="team_selection">

                    <input type="radio" className="team_selector" id= "redteam" name="team" value="red"
                      checked={playerTeam === "red"}
                      onChange={(e) => setPlayerTeam(e.target.value)}
                    />
                    <label htmlFor="redteam" className="red_team_selector_label">
                      Equipo Rojo
                    </label>

                    <input type="radio" className="team_selector" id= "blueteam" name="team" value="blue"
                      checked={playerTeam === "blue"}
                      onChange={(e) => setPlayerTeam(e.target.value)}
                    />
                    <label htmlFor="blueteam" className="blue_team_selector_label">
                      Equipo Azul
                    </label>

                  </div>

                </div>

              </div>


              <button onClick={() => setGameState("playing")} className="boton_inicio">
                Start Game
              </button>
            </div>
          )}

          {/* ---------- PANTALLA DE JUEGO ---------- */}
          {gameState === "playing" && (
            <>
              <MusicPlayer />
              {/* Botón de salir */}
              <button onClick={() => setGameState("start")} id="exitButton" className="boton_salir">
                Exit game
              </button>

              <HUD/>

              <Canvas
                id= "canvas"
                shadows={false} // reducir costo de sombras
                dpr={[1, 1.5]} // limitar pixelRatio
                gl={{ antialias: true, powerPreference: 'high-performance' }} // favorecer perf
                camera={{ position: [8, 8, 8], fov: 60 }}
                style={{ touchAction: "none" }}         
                >
                <Suspense fallback={<Html><div>Cargando juego...</div></Html>}> {/* puede ser null */}
                  <Crosshair size={0.3} color="red" />
                  <Physics gravity={[0, -9.81, 0]} debug={false}> {/* debug true es caro */}
                    <Stats /> 
                    <Experience />
                  </Physics>
                </Suspense >
              </Canvas>
              <SocketManager name={playerName} team={playerTeam} />

            </>
          )}

        </div>
        
      </div>
    </>
  );
}