import { createTerrainAuthority } from "./useHeighmap.js";

export const MAPSIZE = [50, 50];
export const Terrain = true // poner false para desactivar el terreno y usar solo la base

const terrainAuthority = createTerrainAuthority({ mapSize: MAPSIZE });


export const items = {
  table: { name: "table", size: [4, 4] },
  chair: { name: "chair", size: [1, 1] },
};


export const map = {
  size: MAPSIZE,
  gridDivision: 5,
  terrain: Terrain && terrainAuthority ? terrainAuthority.terrainForClient : null,
  items: [
    { ...items.chair, gridPosition: [0, 0], rotation: 0 },
    { ...items.chair, gridPosition: [5, 5], rotation: 0 },
    { ...items.table, gridPosition: [10, 10], rotation: 0 },
  ],
};

//-------------------------------- FUNCIONES DE SPAWN ----------------------------------------------

export function generateRandomPosition() {
  return [Math.random() * map.size[0],  50, Math.random() * map.size[1]]; // ancho, alto, largo
}

export function generateSpawnPosition(teamName, playerSpawnPosition = 0) {

  const borderOffset = 10; // distancia desde el borde del mapa para evitar spawnear demasiado cerca de la esquina
  const spawnHeight = 50; // altura a la que spawnean los personajes
  const spawnPlayerDistance = 1; // distancia entre jugadores que spawnean en el mismo equipo

  const team = {
    red: [map.size[0] + borderOffset, spawnHeight,  map.size[1] + borderOffset], // agregar signo - al principio de map.size para que spawneen en el lado opuesto del mapa
    blue: [map.size[0] - borderOffset, spawnHeight, map.size[1] - borderOffset],
  };

  // area de inicio para cada equipo, obtenemos el equipo dinamicamente con team[teamName](teamName es una variable dinamica que creamos, que puede ser "red" o "blue")
  const start = team[teamName]

  const spawnTeam= playerSpawnPosition * spawnPlayerDistance; // desplazamiento para cada jugador dentro del mismo equipo

  
  return [
    start[0] + spawnTeam , // x
    spawnHeight, // y
    start[2] - spawnTeam , // z
  ];
}


export { terrainAuthority };