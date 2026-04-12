import { characterController } from "./characterController.js";


// ------------------------- Controlador de personajes para el servidor --------------------------

// inicializa un array global para almacenar el estado de todos los personajes conectados
export const characters = [];


/* --------------------------------------------------------------------------------------- */

// función para crear un nuevo personaje con estado inicial
export function newCharacter(id , position, team, spawnByTeam, name = `Player_${String(id).slice(0,4)}` ) {

  const health = 100;
  const energy = 100;
  const maxHealth = 100;
  const maxEnergy = 100;

  return {
    id,
    name,
    team,
    spawnByTeam,
    position,
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
    lastProcessedInput: -1,
    velocityY: 0,
    isGrounded: true,
    health,
    maxHealth,
    energy,
    maxEnergy,
    isAlive: true,
  };
}


/* --------------------------------------------------------------------------------------- */

// función para generar un color hexadecimal aleatorio (para personalización de personajes)
export function generateRandomHexColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}


/* --------------------------------------------------------------------------------------- */

// función para agregar un nuevo personaje al array global (ej. al conectarse un nuevo cliente)
export function addCharacter(char) {
  characters.push(char);
}


/* --------------------------------------------------------------------------------------- */

// función para eliminar un personaje por su ID (ej. al desconectarse)
export function removeCharacter(id) {
  const idx = characters.findIndex((c) => c.id === id);
  if (idx !== -1) characters.splice(idx, 1);
}


/* --------------------------------------------------------------------------------------- */

// función para aplicar un input recibido del cliente a su personaje correspondiente
export function applyInput(id, input) {
  const char = characters.find((c) => c.id === id);
  if (!char) return false;
  // Guardamos el input para que characterController lo use en el siguiente tick
  char.input = { ...char.input, ...input };
  // Guardar la última seq recibida para ACK posterior (no sobrescribimos lastProcessedInput aquí)
  if (typeof input.seq === "number") {
    char._lastReceivedSeq = Math.max(char._lastReceivedSeq ?? -1, input.seq);
  }
  return true;
}


/* --------------------------------------------------------------------------------------- */

// función para actualizar el estado de todos los personajes cada tick del servidor
export function tickCharacters(delta, config = {}) {
  let updated = false;

  for (const character of characters) {
    const wasUpdated = characterController(character, delta, config);
    if (wasUpdated) updated = true;

    // Después de aplicar la simulación autoritativa, confirmar el último seq recibido
    if (typeof character._lastReceivedSeq === "number") {
      character.lastProcessedInput = character._lastReceivedSeq;
      delete character._lastReceivedSeq;
    }
  }

  return updated;
}

/* --------------------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------------------- */
