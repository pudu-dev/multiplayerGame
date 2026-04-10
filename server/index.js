/* ===========================================================
 SERVIDOR DE JUEGO - SERVER AUTHORITY + CLIENT PREDICTION
============================================================

Estructura:
- El servidor mantiene el estado autoritativo de todos los jugadores.
- Los clientes envían sus inputs (posición, dirección, salto, etc).
- El servidor simula física simple (gravedad, límites, velocidad).
- Cada tick (≈30 FPS) se envía el estado actualizado a todos los clientes.
- El cliente realiza reconciliación local e interpolación remota.

------------------------------------------------------------
 ARCHIVO: server.js
------------------------------------------------------------ */

import { Server } from "socket.io";

const io = new Server({
  cors: { origin: "http://localhost:5173" },
});

io.listen(3001);
console.log("Servidor corriendo en puerto 3001");

// ------------------------------ CONSTANTES DEL JUEGO -------------------------------------
const characters = [];

const WALK_SPEED = 4;      // unidades/seg
const RUN_SPEED = 8;       // unidades/seg
const JUMP_VELOCITY = 5;  // fuerza del salto
const GRAVITY = -10;      // aceleración vertical
const TICK_MS = 33;        // ms por tick (~30 ticks/s)
const TICK_SEC = TICK_MS / 1000; // en segundos

// ------------------------------ OBJETOS Y MAPA -------------------------------------------
const MAPSIZE = [500,500];
const MAP_LIMIT = 1000;      // límites del mapa

const items = {
  table: { name: "table", size: [4, 4] },
  chair: { name: "chair", size: [1, 1] },
};

const map = {
  size: MAPSIZE,
  gridDivision: 5,
  items: [
    { ...items.chair, gridPosition: [0, 0], rotation: 0 },
    { ...items.chair, gridPosition: [5, 5], rotation: 0 },
    { ...items.table, gridPosition: [10, 10], rotation: 0 },
  ],
};

// ------------------------------ FUNCIONES AUXILIARES -------------------------------------
function generateRandomPosition() {
  return [Math.random() * map.size[0], 80, Math.random() * map.size[1]]; // 50 para altura de spawn inicial
}

function generateRandomHexColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

// ------------------------------ LOOP DEL SERVIDOR ----------------------------------------
setInterval(() => {
  const delta = TICK_SEC;
  let updated = false;

  for (const char of characters) {
    const input = char.input;
    const SPEED = input.run ? RUN_SPEED : WALK_SPEED;

    // ------------------ Movimiento horizontal ------------------
    // Si el cliente envía moveX/moveZ (en world-space), usar esos valores
    if (typeof input.moveX === "number" || typeof input.moveZ === "number") {
      const mvx = input.moveX || 0;
      const mvz = input.moveZ || 0;
      char.position[0] += mvx * delta;
      char.position[2] += mvz * delta;

      // Actualizar rotación si viene del cliente
      if (typeof input.rotation === "number") char.rotation = input.rotation;
    } else {
      // Fallback: interpretar los booleanos forward/backward/left/right
      const moveDir = { x: 0, z: 0 };
      if (input.forward) moveDir.z += 1;
      if (input.backward) moveDir.z -= 1;
      if (input.left) moveDir.x += 1;
      if (input.right) moveDir.x -= 1;

      if (moveDir.x !== 0 || moveDir.z !== 0) {
        const len = Math.hypot(moveDir.x, moveDir.z);
        moveDir.x /= len;
        moveDir.z /= len;
        char.position[0] += moveDir.x * SPEED * delta;
        char.position[2] += moveDir.z * SPEED * delta;
        char.rotation = Math.atan2(moveDir.x, moveDir.z);
      }
    }

    // ------------------ Gravedad y salto ------------------
    if (input.jump && char.isGrounded) {
      char.velocityY = JUMP_VELOCITY;
      char.isGrounded = false;
      input.jump = false; // evita salto continuo
    }

    char.velocityY += GRAVITY * delta;
    char.position[1] += char.velocityY * delta;

    if (char.position[1] <= 0) {
      char.position[1] = 0;
      char.velocityY = 0;
      char.isGrounded = true;
    }

    // ------------------ Límites del mapa ------------------
    char.position[0] = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, char.position[0]));
    char.position[2] = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, char.position[2]));

    // ------------------ Animaciones ------------------
    if (!char.isGrounded) {
      char.animation = "CharacterArmature|Jump";
    } else {
      const moving = (typeof char.input.moveX === "number" && Math.abs(char.input.moveX) > 0) ||
                     (typeof char.input.moveZ === "number" && Math.abs(char.input.moveZ) > 0);
      if (!moving) {
        // fallback check con booleanos
        const boMoving = char.input.forward || char.input.backward || char.input.left || char.input.right;
        char.animation = boMoving ? "CharacterArmature|Run" : "CharacterArmature|Idle";
      } else {
        char.animation = "CharacterArmature|Run";
      }
    }

    updated = true;
  }

  // ------------------ Emitir estado actualizado ------------------
  if (updated) {
    io.emit("characters", characters);
  }
}, TICK_MS);

// ------------------------------ CONEXIONES -----------------------------------------------
io.on("connection", (socket) => {
  console.log("🟢 Usuario conectado:", socket.id);

  const newChar = {
    id: socket.id,
    position: generateRandomPosition(),
    rotation: 0,
    hairColor: generateRandomHexColor(),
    topColor: generateRandomHexColor(),
    bottomColor: generateRandomHexColor(),
    shoeColor: generateRandomHexColor(),
    animation: "CharacterArmature|Idle",
    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false,
      jump: false,
      moveX: 0,
      moveZ: 0,
      rotation: 0,
    },
    velocityY: 0,
    isGrounded: true,
    lastProcessedInput: -1, //  usado para reconciliación
  };

  characters.push(newChar);

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
    const character = characters.find((c) => c.id === socket.id);
    if (!character) return;

    // Actualizar inputs
    character.input = { ...character.input, ...input };

    // Registrar último input procesado
    if (typeof input.seq === "number") {
      character.lastProcessedInput = input.seq;
    }
  });

  // ------------------ Desconexión ------------------
  socket.on("disconnect", () => {
    console.log("🔴 Usuario desconectado:", socket.id);
    const index = characters.findIndex((c) => c.id === socket.id);
    if (index !== -1) characters.splice(index, 1);
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