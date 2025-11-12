import { Server } from "socket.io";

const io = new Server({
  cors: { origin: "http://localhost:5173" },
});

io.listen(3001);
console.log("✅ Servidor corriendo en puerto 3001");

// ------------------------------ CONSTANTES DEL JUEGO -------------------------------------
const characters = [];

const WALK_SPEED = 2;      // unidades por segundo
const RUN_SPEED = 4;       // unidades por segundo
const JUMP_VELOCITY = 10;  // fuerza del salto
const GRAVITY = -9.8;      // aceleración hacia abajo
const MAP_LIMIT = 25;      // límites del mapa
const TICK_MS = 33;        // ms por tick (≈30 ticks/segundo)
const TICK_SEC = TICK_MS / 1000; // en segundos

// ------------------------------ OBJETOS Y MAPA -------------------------------------------
const items = {
  table: { name: "table", size: [4, 4] },
  chair: { name: "chair", size: [1, 1] },
};

const map = {
  size: [50, 50],
  gridDivision: 5,
  items: [
    { ...items.chair, gridPosition: [0, 0], rotation: 0 },
    { ...items.chair, gridPosition: [5, 5], rotation: 0 },
    { ...items.table, gridPosition: [10, 10], rotation: 0 },
  ],
};

// ------------------------------ FUNCIONES AUXILIARES -------------------------------------
function generateRandomPosition() {
  return [Math.random() * map.size[0], 0, Math.random() * map.size[1]];
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
    // Si el cliente envía moveX/moveZ (velocidad en world-space), úsalos
    if (typeof input.moveX === "number" || typeof input.moveZ === "number") {
      const mvx = input.moveX || 0;
      const mvz = input.moveZ || 0;
      char.position[0] += mvx * delta;
      char.position[2] += mvz * delta;
      // actualizar rotación si viene del cliente
      if (typeof input.rotation === "number") char.rotation = input.rotation;
    } else {
      // fallback: interpretar booleans como antes (mantener compatibilidad)
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
        // fallback check with booleans
        const boMoving = char.input.forward || char.input.backward || char.input.left || char.input.right;
        char.animation = boMoving ? "CharacterArmature|Run" : "CharacterArmature|Idle";
      } else {
        char.animation = "CharacterArmature|Run";
      }
    }

    updated = true;
  }

  // ------------------ Emitir estado actualizado ------------------
  if (updated) io.emit("characters", characters);
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
    lastProcessedInput: -1, // para reconciliación
  };

  characters.push(newChar);

  // Enviar estado inicial solo a este cliente
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

    // actualización incremental de input
    // guardamos moveX/moveZ/rotation si vienen para usar en la simulación del servidor
    character.input = { ...character.input, ...input };

    // almacenar último input procesado (para reconciliación en cliente)
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
