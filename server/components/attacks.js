// server/components/attacks.js
const projectiles = [];
let nextId = 1;

export function createProjectile(ownerId, position = [0, 1.6, 0], direction = [0, 0, -1], speed = 20, maxDistance = 30) {
  const len = Math.hypot(...direction) || 1;
  const ndir = direction.map((c) => c / len);
  const p = {
    id: nextId++,
    ownerId,
    position: { x: position[0], y: position[1], z: position[2] },
    direction: { x: ndir[0], y: ndir[1], z: ndir[2] },
    speed,
    traveled: 0,
    maxDistance,
  };
  projectiles.push(p);
  return p;
}

export function tickProjectiles(dt) {
  if (projectiles.length === 0) return false;
  const removedIds = [];
  for (const p of projectiles) {
    const dx = p.direction.x * p.speed * dt;
    const dy = p.direction.y * p.speed * dt;
    const dz = p.direction.z * p.speed * dt;
    p.position.x += dx;
    p.position.y += dy;
    p.position.z += dz;
    p.traveled += Math.hypot(dx, dy, dz);
    if (p.traveled >= p.maxDistance) removedIds.push(p.id);
  }
  if (removedIds.length) {
    for (const id of removedIds) {
      const idx = projectiles.findIndex((x) => x.id === id);
      if (idx !== -1) projectiles.splice(idx, 1);
    }
  }
  return projectiles.length > 0 || removedIds.length > 0;
}

export function getProjectiles() {
  return projectiles;
}