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
import { map, items, terrainAuthority, generateSpawnPosition, Terrain } from "./components/groundConfig.js"; 
/* podemos cambiar a generateRandomPosition si queremos un todos contra todos (cambiar spawn en groundconfig)*/
import { createProjectile, tickProjectiles, getProjectiles } from "./components/attacks.js";
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

  const updated = tickCharacters(TICK_SEC, { terrain: Terrain ? terrainAuthority : null });

  const projectileUpdated = tickProjectiles(TICK_SEC);

  // ------------------ Emitir estado actualizado ------------------
  if (updated) {
    io.emit("characters", characters);
  }

  if (projectileUpdated) {
    io.emit("projectiles", getProjectiles());
  }

}, TICK_MS);


// ------------------------------ CONEXIONES -----------------------------------------------
io.on("connection", (socket) => {
  console.log("🟢 Usuario conectado:", socket.id);

  // ------------------ Inicialización del personaje ------------------

  const playerName = socket.handshake?.auth?.name || `Player_${socket.id.slice(0,4)}`;
  // obtener equipo preferido del handshake (enviado por el cliente antes de conectar)
  const preferredTeam = socket.handshake?.auth?.team;
  // determinar equipo asignado (puedes implementar lógica más compleja aquí, como balancear equipos)
  const teamName = preferredTeam === "red" ? "red" : "blue"; // default a blue si no se especifica o es inválido
  // generar posición de spawn basada en el equipo
  const spawnPosition = generateSpawnPosition(teamName);

  const newChar = newCharacter(socket.id, spawnPosition, teamName, undefined, playerName);
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

  //input de movimiento
  socket.on("move", (input) => {
    // controlado por character.js - aplica input al personaje correspondiente
    applyInput(socket.id, input);
  });

  //input de ataque
  socket.on("attack", (data) => {
  // data: { position: [x,y,z], direction: [x,y,z], speed?, maxDistance? }
  createProjectile(socket.id, data.position || [0,1.6,0], data.direction || [0,0,-1], data.speed ?? 20, data.maxDistance ?? 30);
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
 NOTAS: HIDRID SERVER AUTHORITY + CLIENT PREDICTION
------------------------------------------------------------
* Este servidor usa "server authority" — los clientes no deciden posiciones finales.  
* Envía "lastProcessedInput" → permite al cliente aplicar reconciliación.  
* No necesita interpolación aquí (solo en el cliente).  
* En el cliente:  
   - Jugador local → Client Prediction + Reconciliación.  
   - Jugadores remotos → Interpolación de snapshots.
 */