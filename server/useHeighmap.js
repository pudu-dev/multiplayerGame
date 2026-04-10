/* npm install pngjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

export const TERRAIN_CONFIG = Object.freeze({
  src: "/models/maps/highmp.png",
  scale: 100,
  baseSize: 2,
  baseHeight: 0,
  terrainSize: 2,
  terrainHeight: -40,
  terrainHeightScale: 2,
  step: 1, // STEP
  position: [0, 0, 0],
});

function resolveHeightmapAbsolutePath(src) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, `../client/public${src}`);
}

function loadHeightmapFromPng(src, scale = 100) {
  const filePath = resolveHeightmapAbsolutePath(src);
  const pngBuffer = fs.readFileSync(filePath);
  const png = PNG.sync.read(pngBuffer);

  const heights = new Float32Array(png.width * png.height);
  for (let i = 0; i < heights.length; i++) {
    const stride = i * 4;
    const r = png.data[stride];
    heights[i] = (r / 255) * scale;
  }

  return { width: png.width, height: png.height, heights, filePath };
}

export function createTerrainAuthority({ mapSize, config = TERRAIN_CONFIG }) {
  let hm = null;

  try {
    hm = loadHeightmapFromPng(config.src, config.scale);
    console.log(
      "Heightmap cargado:",
      hm.width,
      "x",
      hm.height,
      "desde",
      hm.filePath
    );
  } catch (err) {
    console.error(
      "No se pudo cargar el heightmap. Fallback a base y=0:",
      err.message
    );
  }

  const terrainForClient = hm
    ? {
        ...config,
        width: hm.width,
        height: hm.height,
        heights: Array.from(hm.heights),
      }
    : {
        ...config,
        width: 0,
        height: 0,
        heights: [],
      };

function sampleGroundY(x, z) {
  const baseY = config.baseHeight;
  if (!hm) return baseY;

  const worldW = mapSize[0] * config.terrainSize;
  const worldH = mapSize[1] * config.terrainSize;
  if (worldW <= 0 || worldH <= 0) return baseY;

  const localX = x - config.position[0];
  const localZ = z - config.position[2];

  const u = localX / worldW + 0.5;
  const v = localZ / worldH + 0.5;

  if (u < 0 || u > 1 || v < 0 || v > 1) return baseY;

  const step = Math.max(1, Number(config.step ?? 1));
  const maxGridX = Math.floor((hm.width - 1) / step);
  const maxGridY = Math.floor((hm.height - 1) / step);
  if (maxGridX <= 0 || maxGridY <= 0) return baseY;

  const fx = u * maxGridX;
  const fy = v * maxGridY;

  const gx0 = Math.floor(fx);
  const gy0 = Math.floor(fy);
  const gx1 = Math.min(gx0 + 1, maxGridX);
  const gy1 = Math.min(gy0 + 1, maxGridY);

  const tx = fx - gx0;
  const ty = fy - gy0;

  const x0 = Math.min(gx0 * step, hm.width - 1);
  const y0 = Math.min(gy0 * step, hm.height - 1);
  const x1 = Math.min(gx1 * step, hm.width - 1);
  const y1 = Math.min(gy1 * step, hm.height - 1);

  const idx = (ix, iy) => iy * hm.width + ix;

  const h00 = hm.heights[idx(x0, y0)] ?? 0;
  const h10 = hm.heights[idx(x1, y0)] ?? 0;
  const h01 = hm.heights[idx(x0, y1)] ?? 0;
  const h11 = hm.heights[idx(x1, y1)] ?? 0;

  const hx0 = h00 * (1 - tx) + h10 * tx;
  const hx1 = h01 * (1 - tx) + h11 * tx;
  const h = hx0 * (1 - ty) + hx1 * ty;

  const terrainY =
    config.position[1] +
    config.terrainHeight +
    h * config.terrainHeightScale;

  return Math.max(baseY, terrainY);
}

return { terrainForClient, sampleGroundY };
}