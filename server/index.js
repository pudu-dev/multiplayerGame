import { Server } from "socket.io";

const io = new Server({
  cors: { origin: "http://localhost:5173" },
});

io.listen(3001);

const characters = [];

const WALK_SPEED = 2; // unidades por segundo
const RUN_SPEED = 4;  // unidades por segundo
const JUMP_VELOCITY = 5;
const GRAVITY = -9.8;

const MAP_LIMIT= 20;

const TICK_MS = 60; // ms por tick (autoritaty tick loop)
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
// Generar una posición aleatoria dentro de los límites del mapa
function generateRandomPosition() {
  return [Math.random() * map.size[0], 0, Math.random() * map.size[1]];
}

// Generar un color hexadecimal aleatorio
function generateRandomHexColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

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


setInterval(() => {
  const delta = TICK_SEC;
  let updated = false;

  for (const char of characters) {
    const input = char.input;
    const SPEED = input.run ? RUN_SPEED : WALK_SPEED;
    const moveAmount = SPEED * delta; // unidades por tick

    if (input.forward)  char.position[2] -= moveAmount;
    if (input.backward) char.position[2] += moveAmount;
    if (input.left)     char.position[0] -= moveAmount;
    if (input.right)    char.position[0] += moveAmount;

    // Movimiento hacia target (click)
    if (input.target) {
      char.position = moveTowards(char.position, input.target, moveAmount);
      const dx = char.position[0] - input.target[0];
      const dz = char.position[2] - input.target[2];
      if (Math.sqrt(dx*dx + dz*dz) < moveAmount) input.target = null;
    }

    // Rotación: preferimos rotación enviada por cliente(si la hay), sino calculamos hacia target o dirección de movimiento
    if (input.target) {
      const dx = input.target[0] - char.position[0];
      const dz = input.target[2] - char.position[2];
      if (dx !== 0 || dz !== 0) {
        char.rotation = Math.atan2(dx, dz); // servidor calcula hacia target
        updated = true;
      }
    } else if (typeof input.rotation === "number") {
      // aceptar rotación enviada por el cliente (simple)
      char.rotation = input.rotation;
      updated = true;
    } else {
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const mz = (input.backward ? 1 : 0) - (input.forward ? 1 : 0);
      if (mx !== 0 || mz !== 0) {
        char.rotation = Math.atan2(mx, mz);
        updated = true;
      }
    }
    // Salto y gravedad escalada por delta
    if (input.jump && char.isGrounded) {
      char.velocityY = JUMP_VELOCITY;
      char.isGrounded = false;
      input.jump = false;
    }
    char.velocityY += GRAVITY * delta;
    char.position[1] += char.velocityY * delta;

    if (char.position[1] <= 0) {
      char.position[1] = 0;
      char.velocityY = 0;
      char.isGrounded = true;
    }

    // Límites
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

// --- Conexión de clientes ---
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
    input: { forward: false, backward: false, left: false, right: false, run: false, target: null, jump: false },
    velocityY: 0,
    isGrounded: true,
  };
  characters.push(newChar);

  socket.emit("welcome", { id: socket.id,
                           map,
                           characters,
                           items,}); 

  io.emit("characters", characters);

  socket.on("move", (input) => {
    const character = characters.find(c => c.id === socket.id);
    if (!character) return;

    // Guardamos input y target/jump/rotation en character.input
    character.input = { ...character.input, ...input };
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado con ID:", socket.id);
    const index = characters.findIndex(c => c.id === socket.id);
    if (index !== -1) characters.splice(index, 1);
    io.emit("characters", characters);
  });
});
