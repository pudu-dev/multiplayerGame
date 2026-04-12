import { createTerrainAuthority } from "./useHeighmap.js";

export const MAPSIZE = [500, 500];

export const items = {
  table: { name: "table", size: [4, 4] },
  chair: { name: "chair", size: [1, 1] },
};

const terrainAuthority = createTerrainAuthority({ mapSize: MAPSIZE });

export const map = {
  size: MAPSIZE,
  gridDivision: 5,
  terrain: terrainAuthority.terrainForClient,
  items: [
    { ...items.chair, gridPosition: [0, 0], rotation: 0 },
    { ...items.chair, gridPosition: [5, 5], rotation: 0 },
    { ...items.table, gridPosition: [10, 10], rotation: 0 },
  ],
};

export function generateRandomPosition() {
  return [Math.random() * map.size[0],  50, Math.random() * map.size[1]]; // ancho, alto, largo
}

export function generateSpawnPosition(teamName, playerSpawnPosition = 0) {

  const spawnMargin = 10; // distancia desde el borde del mapa para spawnear
  const spawnHeight = 50; // altura a la que spawnean los personajes
  const spawnPlayerDistance = 1; // distancia entre jugadores que spawnean en el mismo equipo

  const team = {
    red: [spawnMargin, spawnHeight, spawnMargin],
    blue: [map.size[0] - spawnMargin, spawnHeight, map.size[1] - spawnMargin],
  };

  // area de inicio para cada equipo, obtenemos el equipo dinamicamente con team[teamName](teamName es una variable dinamica que creamos, que puede ser "red" o "blue")
  const start = team[teamName]

  const spawnTeam= playerSpawnPosition * spawnPlayerDistance; // desplazamiento para cada jugador dentro del mismo equipo

  // direccion segun equipo
  const direction = teamName === "red" ? 1 : -1; // -1 para blue porque spawnean desde el borde opuesto

  return [
    start[0] + spawnTeam * direction, // x
    spawnHeight, // y
    start[2] + spawnTeam * direction, // z
  ];
}


export { terrainAuthority };