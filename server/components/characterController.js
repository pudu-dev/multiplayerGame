// ------------------------- Función de control de personajes (idéntica al cliente) --------------------------
export function characterController(char, delta, config = {}) {

  // constantes de nuestro jugador
  const {
    walkSpeed = 4,
    runSpeed = 16,
    jumpVelocity = 5,
    playerGravity = -10,
    playerMapLimit = 500,
    terrain = null, // para que el jugador tenga acceso al terreno y pueda hacer colisiones
  } = config;

  const input = char.input || {};
  const SPEED = input.run ? runSpeed : walkSpeed;

  // Movimiento horizontal (world-space moveX/moveZ o booleanos)
  if (typeof input.moveX === "number" || typeof input.moveZ === "number") {
    const mvx = input.moveX || 0;
    const mvz = input.moveZ || 0;
    char.position[0] += mvx * delta;
    char.position[2] += mvz * delta;
    if (typeof input.rotation === "number") char.rotation = input.rotation;
  } else {
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

  // Salto
  if (input.jump && char.isGrounded) {
    char.velocityY = jumpVelocity;
    char.isGrounded = false;
    input.jump = false;
  }

  // Gravedad
  char.velocityY = typeof char.velocityY === "number" ? char.velocityY : 0;
  char.velocityY += playerGravity * delta;
  char.position[1] += char.velocityY * delta;

  // Colisión con terreno (si no hay terrain, usar y=0)
  const groundY =
    terrain && typeof terrain.sampleGroundY === "function"
      ? terrain.sampleGroundY(char.position[0], char.position[2])
      : 0;
  if (char.position[1] <= groundY) {
    char.position[1] = groundY;
    char.velocityY = 0;
    char.isGrounded = true;
  } else {
    char.isGrounded = false;
  }

  // Límites del mapa
  char.position[0] = Math.max(-playerMapLimit, Math.min(playerMapLimit, char.position[0]));
  char.position[2] = Math.max(-playerMapLimit, Math.min(playerMapLimit, char.position[2]));

  // Animaciones
  if (!char.isGrounded) {
    char.animation = "CharacterArmature|Jump";
  } else {
    const moving =
      (typeof input.moveX === "number" && Math.abs(input.moveX) > 0) ||
      (typeof input.moveZ === "number" && Math.abs(input.moveZ) > 0);
    if (!moving) {
      const boMoving = input.forward || input.backward || input.left || input.right;
      char.animation = boMoving ? "CharacterArmature|Run" : "CharacterArmature|Idle";
    } else {
      char.animation = "CharacterArmature|Run";
    }
  }

  return true;
}
