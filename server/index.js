import { Server } from "socket.io";

const io = new Server({
  cors: { origin: "http://localhost:5173" },
});

io.listen(3001);

// ------------------------------ CONSTANTES DEL JUEGO-------------------------------------
const characters = [];
//velodidad de movimiento
const WALK_SPEED = 2; // unidades por segundo
const RUN_SPEED = 4;  // unidades por segundo
//salto y gravedad
const JUMP_VELOCITY = 10;
const GRAVITY = -9.8;
//limite de mapa
const MAP_LIMIT= 25;
const TICK_MS = 33; // ms por tick (autoritaty tick loop)
const TICK_SEC = TICK_MS / 1000;


const items= {
  table: {
    name: "table",
    size: [4,4]
  },
  chair: {
    name: "chair",
    size: [1,1]
  }
}
const map = {
  size: [50, 50],
  gridDivision: 5,
  items: [
    {
      ...items.chair,
      gridPosition: [0,0],
      rotation: 0,
    },
    {
      ...items.chair,
      gridPosition: [5,5],
      rotation: 0,
    },
    {
      ...items.table,
      gridPosition: [10,10],
      rotation: 0,
    }
  ]
}
// -------------------------------------------------------------------
// Generar una posición aleatoria dentro de los límites del mapa
function generateRandomPosition() {
  return [Math.random() * map.size[0], 0, Math.random() * map.size[1]];
}
// -------------------------------------------------------------------
// Generar un color hexadecimal aleatorio
function generateRandomHexColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}
// ------------------------------------------------------------------------------
// ------- Función para mover hacia un target con una velocidad dada -------------
function moveTowards(position, target, speed) {
  if (!target) return position;

  const dx = target[0] - position[0];
  const dz = target[2] - position[2];
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance < speed) return [target[0], position[1], target[2]];

  const nx = dx / distance;
  const nz = dz / distance;

  return [
    position[0] + nx * speed,
    position[1],
    position[2] + nz * speed
  ];
}
// -------------------------------------------------------------------
// --- Lógica del servidor: Autoridad del mundo ----------------------
setInterval(() => {
  const delta = TICK_SEC; // tiempo fijo por tick
  let updated = false; // bandera para saber si enviamos actualización a clientes
  // --- Actualizar cada personaje --------
  for (const char of characters) {
    const input = char.input; // { forward, backward, left, right, run, target, jump, rotation }
    const SPEED = input.run ? RUN_SPEED : WALK_SPEED; // unidades por segundo
    const moveAmount = SPEED * delta; // distancia a mover este tick
    // ----- Movimiento del personaje ---
    // Si el cliente envía moveX/moveZ usamos ese vector (world-space) para mover; si no, fallback a flags previas
    if (typeof input.moveX === "number" && typeof input.moveZ === "number") {
      char.position[0] += input.moveX * SPEED * delta;
      char.position[2] += input.moveZ * SPEED * delta;
    } else {
      // compatibilidad antigua: flags por ejes
      if (input.forward)  char.position[2] += moveAmount;
      if (input.backward) char.position[2] -= moveAmount;
      if (input.left)     char.position[0] += moveAmount;
      if (input.right)    char.position[0] -= moveAmount;
    }
    // -------------------------------------------------------------------
    // Rotación: preferimos rotación enviada por cliente(si la hay), sino calculamos hacia target o dirección de movimiento
    if (input.target) {
      const dx = input.target[0] - char.position[0];
      const dz = input.target[2] - char.position[2];
      if (dx !== 0 || dz !== 0) {
        char.rotation = Math.atan2(dx, dz); // servidor calcula hacia target
        updated = true;
      }
    } else if (typeof input.rotation === "number") { 
      char.rotation = input.rotation;
      updated = true;
    } else {
      const mx = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const mz = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
      if (mx !== 0 || mz !== 0) {
        char.rotation = Math.atan2(mx, mz);
        updated = true;
      }
    }
    //----------------- Salto y gravedad escalada por delta----------------------
    if (input.jump && char.isGrounded) {
      char.velocityY = JUMP_VELOCITY;
      char.isGrounded = false;
      input.jump = false;
    }
    char.velocityY += GRAVITY * delta;
    char.position[1] += char.velocityY * delta;

    // usar epsilon y comprobar velocidad al aterrizar
    const EPS = 0.01;
    if (char.position[1] <= EPS && char.velocityY <= 0) {
      char.position[1] = 0;
      char.velocityY = 0;
      char.isGrounded = true;
    }
    // -------------------------------------------------------------------
    // Límites del mapa
    char.position[0] = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, char.position[0]));
    char.position[2] = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, char.position[2]));

    // Animación
    if (!char.isGrounded) {
      char.animation = "CharacterArmature|Jump";
    } else {
      const moving = input.forward || input.backward || input.left || input.right || input.target;
      char.animation = moving ? "CharacterArmature|Run" : "CharacterArmature|Idle";
    }

    updated = true;
  }

  if (updated) io.emit("characters", characters);
}, TICK_MS);

// -----------------------------------------------------------------------------------------
// ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// ----------------------------- Conexión de clientes ---------------------------------------
io.on("connection", (socket) => {
  console.log("Usuario conectado con ID:", socket.id);

  const newChar = {
    id: socket.id,
    position: generateRandomPosition(),
    rotation: 0,
    hairColor: generateRandomHexColor(),
    topColor: generateRandomHexColor(),
    bottomColor: generateRandomHexColor(),
    shoeColor: generateRandomHexColor(),
    animation: "CharacterArmature|Idle",
    // añadimos moveX/moveZ para coherencia con el cliente (world-space movement)
    input: { forward: false, backward: false, left: false, right: false, run: false, target: null, jump: false, moveX: 0, moveZ: 0 },
    velocityY: 0,
    isGrounded: true,
    lastProcessedInput: -1, // para reconciliation del cliente
  };
  characters.push(newChar);

  // enviar estado inicial al cliente
  socket.emit("welcome", { id: socket.id,
                           map,
                           characters,
                           items,}); 

  // emitimos a todos los clientes del nuevo personaje
  io.emit("characters", characters);

  // manejar inputs de movimiento desde el cliente
  socket.on("move", (input) => {
    const character = characters.find(c => c.id === socket.id);
    if (!character) return;
      // Guardamos input y target/jump/rotation en character.input
    character.input = { ...character.input, ...input };
      // Registrar seq si viene (para reconciliation del cliente)
    if (typeof input.seq === "number") {
      character.lastProcessedInput = input.seq;
    }
  });
  // manejar desconexiones
  socket.on("disconnect", () => {
    console.log("Usuario desconectado con ID:", socket.id);
    const index = characters.findIndex(c => c.id === socket.id);
    if (index !== -1) characters.splice(index, 1);
    io.emit("characters", characters);
  });
});
