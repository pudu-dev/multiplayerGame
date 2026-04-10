import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './src/App.jsx'
import '/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)



/* 
------------------------------------------------------------------------------------------------------------------
-------------------------------------------------- Librerias -----------------------------------------------------
------------------------------------------------------------------------------------------------------------------

Nota: ignoramos librerias con X, son de referencia para evitar incompatibilidades de versiones.


------------------------------------------------------------------------------------------------------------------
------------------------------------------------- #Three.js Stack ------------------------------------------------
------------------------------------------------------------------------------------------------------------------

X npm install three (libreria 3D BASE para renderizar gráficos en el navegador, con react utilizamos fiber.) X

npm install @react-three/fiber  (motor de renderizado 3D dentro de React, necesario para integrar Three.js con React.)

npm install @react-three/drei  (helpers y utilidades: loaders GLTF, luces, cámaras, geometrías, efectos visuales).

X npm install three-stdlib (drei ya trae la libreria de utilidades y extensiones para Three.js, como orbitcontrols, gltfloader, helper, etc, asi que mantén las versiones sincronizadas para evitar incompatibilidades) X


X npm install @react-three/cannon (fisicas simples, usa JS). X

npm install @react-three/rapier (fisicas modernas, usa Rust (WASM(WebAssembly)) )

x nota: para versionar usar @lastest o @0.15.0 (version number) x
x npm install @react-three/rapier@latest x
x npm install @react-three/rapier@0.15.0 --save x

npm install @dimforge/rapier3d-compat (libreria de compatibilidad para usar Rapier en entornos donde WebAssembly no es compatible, como algunos navegadores o plataformas. Proporciona una versión de Rapier que se ejecuta en JavaScript puro, aunque con un rendimiento reducido en comparación con la versión WebAssembly. Es útil para garantizar que tu aplicación pueda funcionar en una amplia gama de entornos, incluso aquellos que no admiten WebAssembly.)

npm install vite-plugin-wasm --save-dev (libreria para cargar archivos WASM en proyectos Vite, necesario para integrar Rapier con Vite, ya que Vite no maneja archivos WASM de forma nativa. Permite importar y usar módulos WebAssembly en tu proyecto de manera sencilla.)


-------------------------------------------------------------------------------------------------------------------
--------------------------------------------- Camera control -----------------------------------------------------
-------------------------------------------------------------------------------------------------------------------

nota: si bien podemos usar los controles de cámara básicos que vienen con drei (OrbitControls, PointerLockControls, etc), para un juego en tercera persona es recomendable usar una librería de control de cámara más avanzada como camera-controls, que ofrece características específicas para juegos como seguimiento suave, colisiones de cámara, control de ángulos, etc.
npm install camera-controls (libreria de control de cámara avanzada para Three.js)


-------------------------------------------------------------------------------------------------------------------
------------------------------------------------- #Theatre.js -----------------------------------------------------
-------------------------------------------------------------------------------------------------------------------

npm install @theatre/core (gestión de timelines y estados de animación)

npm install @theatre/studio (editor visual para animaciones' TheatreStudio.init() ' )

npm install @theatre/react (integración directa con React, para animaciones en tus componentes.)


------------------------------------------------------------------------------------------------------------------
----------------------------------------------- 3D Models --------------------------------------------------------
------------------------------------------------------------------------------------------------------------------


npm install leva (libreria GUI de react que crea un panel de control interactivo para ajustar parámetros en tiempo real, ideal para desarrollo y depuración.)

x npm install gltfjsx x
npx gltfjsx public/models/model.glb -o src/components/models/Model.jsx -r public (gltfjsx es una herramienta CLI del ecosistema de React Three Fiber que convierte modelos GLTF/GLB en componentes React optimizados, facilitando su integración en aplicaciones 3D.)
nota: no es necesaria la instalacion con npm, se puede usar directamente con npx, que ejecuta paquetes sin necesidad de instalarlos globalmente.



------------------------------------------------------------------------------------------------------------------
---------------------------------------- Coneccion al servidor ---------------------------------------------------
------------------------------------------------------------------------------------------------------------------

# para enlazar el servidor con el cliente y permitir la comunicación en tiempo real entre ellos
# usaremos Socket.IO, que es una biblioteca de JavaScript que facilita la comunicación bidireccional entre 
# el cliente y el servidor a través de WebSockets. 

npm install socket.io-client
npm install jotai (libreria para gestion de estados para react)


-------------------------------------------------------------------------------------------------------------------
------------------------------------ desarrollo y depuración ------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------

npm dedupe (evita duplicados en las dependencias)

------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------
*/
