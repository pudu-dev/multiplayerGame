/* ===========================================================
 SERVIDOR DE JUEGO - SERVER AUTHORITY + CLIENT PREDICTION
============================================================

Estructura:
- El servidor mantiene el estado autoritativo de todos los jugadores.
- Los clientes envían sus inputs (posición, dirección, salto, etc).
- El servidor simula física simple (gravedad, límites, velocidad).
- Cada tick (≈30 FPS) se envía el estado actualizado a todos los clientes.
- El cliente realiza reconciliación local e interpolación remota.
*/


// ------------------------------ IMPORTACIONES ---------------------------------------------
import { characters, newCharacter, addCharacter, applyInput, removeCharacter, tickCharacters } from "./components/characters.js";
import { map, items, terrainAuthority, generateSpawnPosition } from "./components/groundConfig.js"; 
/* podemos cambiar a generateRandomPosition si queremos un todos contra todos (cambiar spawn en groundconfig)*/

// ------------------------------ CONFIGURACIÓN DEL SERVIDOR --------------------------------
import { Server } from "socket.io";

const io = new Server({
  cors: { origin: "http://localhost:5173" },
});

io.listen(3001);
console.log("Servidor corriendo en puerto 3001");


// ------------------------------ CONSTANTES DEL JUEGO -------------------------------------

const TICK_MS = 16;        // fps = 1 / 0.033 ≈ 30 - 1/ 0.016 ≈ 60 (ajustable según necesidad)
const TICK_SEC = TICK_MS / 1000; // en segundos


// ------------------------------ LOOP DEL SERVIDOR ----------------------------------------
setInterval(() => {

  const updated = tickCharacters(TICK_SEC, { terrain: terrainAuthority });

  // ------------------ Emitir estado actualizado ------------------
  if (updated) {
    io.emit("characters", characters);
  }
}, TICK_MS);

//------------------------------ HELPER FUNCTIONS ----------------------------------------







// ------------------------------ CONEXIONES -----------------------------------------------
io.on("connection", (socket) => {
  console.log("🟢 Usuario conectado:", socket.id);

  // ------------------ Inicialización del personaje ------------------

  // obtener equipo preferido del handshake (enviado por el cliente antes de conectar)
  const preferredTeam = socket.handshake?.auth?.team;
  // determinar equipo asignado (puedes implementar lógica más compleja aquí, como balancear equipos)
  const teamName = preferredTeam === "red" ? "red" : "blue"; // default a blue si no se especifica o es inválido
  
  const spawnPosition = generateSpawnPosition(teamName);
  
  const newChar = newCharacter(socket.id, spawnPosition, teamName);
  addCharacter(newChar);

  // Enviar estado inicial solo al nuevo jugador
  socket.emit("welcome", {
    id: socket.id,
    map,
    characters,
    items,
  });

  // Notificar a todos los jugadores
  io.emit("characters", characters);

  // ------------------ Manejar inputs ------------------
  socket.on("move", (input) => {

    // controlado por character.js - aplica input al personaje correspondiente
    applyInput(socket.id, input);
  });

  // ------------------ Desconexión ------------------
  socket.on("disconnect", () => {

    console.log("🔴 Usuario desconectado:", socket.id);
    // Eliminar personaje del jugador desconectado- controlado por character.js
    removeCharacter(socket.id);
    io.emit("characters", characters);
  });

});

/* ------------------------------------------------------------
 NOTAS:
------------------------------------------------------------
* Este servidor usa "server authority" — los clientes no deciden posiciones finales.  
* Envía "lastProcessedInput" → permite al cliente aplicar reconciliación.  
* No necesita interpolación aquí (solo en el cliente).  
* En el cliente:  
   - Jugador local → Client Prediction + Reconciliación.  
   - Jugadores remotos → Interpolación de snapshots.
 */