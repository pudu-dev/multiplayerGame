import './App.css'
import { Suspense, useState } from "react";
import { Canvas} from "@react-three/fiber";
import { Experience } from "./components/Experience";
import { SocketManager } from "./conection/SocketManager.jsx";
import { Stats, Html} from "@react-three/drei";
import HUD from "./components/ui/HUD";
/* import RAPIER from '@dimforge/rapier3d-compat'; */
import { Physics } from "@react-three/rapier";
import MusicPlayer from "./components/utilitycomponents/MusicPlayer";
/* import Sky from "./components/terrain/Sky.jsx"; */

export default function App() {

  const [gameState, setGameState] = useState("intro");
  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("blue"); /* valor por defecto */

  const [menuOpen, setMenuOpen] = useState(false); 
  const [menuConfig, setMenuConfig] = useState(false); 

  const [musicPlaying, setMusicPlaying] = useState(false); /* true para activar musica desde un inicio */
  const [musicVolume, setMusicVolume] = useState(0.1);

  return (
    <>
      <div className="contenedor_principal" id="contenedor_principal" >

        <div className="marco">

          {/* ---------- PANTALLA DE INTRO ---------- */}
          {gameState === "intro" && (
          
            <div className="contenedor_intro">
              <img src="../../models/intro/huella_pudu.png" alt="Intro" />
              <button className="boton_inicio" onClick={() => setGameState("start")}>
                Entrar
              </button>
            </div>
          )}

          {/* ---------- PANTALLA DE INICIO ---------- */}
          {gameState === "start" && (
            <div className="pantalla_inicio">

              {/* fondo */}
              <img className="background_inicio" src="../../models/start/bg.png" />

              <div className="marco_inicio">

                {/* titulo */}
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

                      <input type="radio" className="team_selector" id= "blueteam" name="team" value="blue"
                        checked={playerTeam === "blue"}
                        onChange={(e) => setPlayerTeam(e.target.value)}
                      />
                      <label htmlFor="blueteam" className="blue_team_selector_label">
                        Equipo Azul
                      </label>


                      <input type="radio" className="team_selector" id= "redteam" name="team" value="red"
                        checked={playerTeam === "red"}
                        onChange={(e) => setPlayerTeam(e.target.value)}
                      />
                      <label htmlFor="redteam" className="red_team_selector_label">
                        Equipo Rojo
                      </label>


                    </div>

                  </div>

                </div>

                <button onClick={() => setGameState("playing")} className="boton_inicio">
                  Play
                </button>

              </div>

              <button onClick={() => setGameState("intro")} className='boton_salir'>
                Exit
              </button>

            </div>
          )}


          {/* ---------- PANTALLA DE JUEGO ---------- */}
          {gameState === "playing" && (
            <>

              <MusicPlayer isPlaying={musicPlaying} volume={musicVolume}/>


              { !menuOpen && !menuConfig &&
              <button className="menu_game" onClick={() => setMenuOpen(true)}>
                Menu
              </button>
              }

              { !menuOpen && <HUD /> }

              <Canvas
                id= "canvas"
                shadows={false} // reducir costo de sombras
                dpr={[1, 1.5]} // limitar pixelRatio
                gl={{ antialias: true, powerPreference: 'high-performance' }} // favorecer perf
                camera={{ position: [8, 8, 8], fov: 60 }}
                style={{ touchAction: "none" }}         
                >

                <Suspense fallback={<Html><div>Cargando juego...</div></Html>}> {/* puede ser null */}
                  <Physics gravity={[0, -9.81, 0]} debug={false}> {/* debug true es caro */}
                    <Stats /> 
                    <Experience />
                  </Physics>

                </Suspense >

              </Canvas>

              <SocketManager name={playerName} team={playerTeam} />

              {/* Overlay del menú: aparece encima del Canvas sin desmontarlo */}
              {menuOpen && (
                <div className="marco_menu">

                  <div className="overlay_menu">

                    <h2>Menú</h2>

                    <button onClick={() => setMenuOpen(false)}>Reanudar</button>

                    <button onClick={() => { setMenuConfig(true); setMenuOpen(false); }}>
                      Configuraciones
                    </button>

                    <button onClick={() => { setGameState("start"); setMenuOpen(false); }}>
                      Salir
                    </button>

                  </div>
                </div>
              )}
              
              {menuConfig && (
                <div className="pantalla_config">

                  <h1>Configuraciones</h1>

                  <div className='menu_config'>

                    <div className='config_volume'>

                      <label htmlFor="musicVolume">Volumen:</label>

                      <input
                        id="musicVolume"
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(musicVolume * 100)}
                        onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                      />

                      <span>{Math.round(musicVolume * 100)}%</span>

                    </div>
              
                    <div className='config_playmusic'>

                      <label htmlFor="musicPlaying">Reproducir:</label>

                      <button onClick={() => setMusicPlaying(p => !p)}>
                        {musicPlaying ? 'ON' : 'OFF'}
                      </button>
                      
                    </div>

                    <div className='config_return'>

                      <button onClick={() => { setMenuConfig(false); setMenuOpen(true); }} style={{ marginLeft: 8 }}>
                        Volver
                      </button>
                      
                    </div>

                  </div>

                </div>
              )}




            </>
          )}

        </div>
        
      </div>
    </>
  );
}