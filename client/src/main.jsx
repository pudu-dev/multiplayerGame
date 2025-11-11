import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)



/* Librerias */
/* 
------------------------------------------------------------------------------------------------------------------
                     #TAILWIND
------------------------------------------------------------------------------------------------------------------
npm install tailwindcss @tailwindcss/vite


------------------------------------------------------------------------------------------------------------------
                     #Three.js + React Three Fiber
------------------------------------------------------------------------------------------------------------------
npm install @react-three/fiber  (motor de renderizado 3D dentro de React.)
 
npm install @react-three/drei  (helpers y utilidades: loaders GLTF, luces, cámaras, geometrías, efectos visuales).


npm install @react-three/cannon (fisicas simples).

npm install @react-three/rapier (fisicas modernas)
npm install @react-three/rapier@latest

npm install @dimforge/rapier3d-compat
npm install @dimforge/rapier3d-compat@0.15.0 --save

npm dedupe(evita duplicados en las dependencias)

-------------------------------------------------------------------------------------------------------------------
                    #Theatre.js
-------------------------------------------------------------------------------------------------------------------
npm install @theatre/core (gestión de timelines y estados de animación)

npm install @theatre/studio (editor visual para animaciones' TheatreStudio.init() ' )

npm install @theatre/react (integración directa con React, para animaciones en tus componentes.)
------------------------------------------------------------------------------------------------------------------

npm install leva 


npx gltfjsx public/models/model.glb -o src/components/models/Model.jsx -r public

crear carpeta server
npm init -y
npm install socket.io
npm install nodemon --save-dev
npm install bufferutil --save-dev
npm install utf-8-validate --save-dev
npm dedupe (evita duplicados en las dependencias)

y en cliente:
npm install socket.io-client


npm install jotai


-->


*/
