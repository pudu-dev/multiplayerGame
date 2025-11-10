import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import { SocketManager } from "./components/conection/SocketManager";
import { KeyboardControls , Stats } from "@react-three/drei";
import HUD from "./components/ui/HUD";
/* import RAPIER from '@dimforge/rapier3d-compat'; */
import { Physics } from "@react-three/rapier";
// ...existing code...

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "jump", keys: ["Space"],  },
];

export default function App() {
  const [gameState, setGameState] = useState("start");

  return (
    <>
      <div id="bodydiv" className="w-full h-screen">
        <div id="marco" className="w-full h-full relative">
          {/* ---------- PANTALLA DE INICIO ---------- */}
          {gameState === "start" && (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white z-50">
              <button onClick={() => setGameState("playing")}
                      className="px-6 py-3 bg-green-500 rounded-lg hover:bg-green-700 transition">
                Start Game
              </button>
            </div>
          )}

          {/* ---------- PANTALLA DE JUEGO ---------- */}
          {gameState === "playing" && (
            <>
              {/* Botón de salir */}
              <button onClick={() => setGameState("start")}
                      className="fixed top-2 right-2 z-1000 rounded-full bg-teal-500 border-none shadow-md font-bold text-white cursor-pointer" >
                Exit game
              </button>

              <HUD />
              
              <KeyboardControls map={keyboardMap}>
                <SocketManager />
                <Canvas shadows camera={{ position: [8, 8, 8], fov: 30 }} style={{ touchAction: "none" }}>
                <Suspense fallback={null}>
                  <Physics gravity={[0, -9.81, 0]} debug={true}>
                    <Stats />
                    <Experience />
                  </Physics>
                </Suspense >
                </Canvas>
              </KeyboardControls>
            </>
          )}
        </div>
      </div>
    </>
  );
}