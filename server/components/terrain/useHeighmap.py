import os
from PIL import Image

# ------------------------- Configuración --------------------------
TERRAIN_CONFIG = {
    "src": "/models/maps/highmp.png",
    "scale": 1,
    "baseSize": 2,
    "baseHeight": 0,
    "terrainSize": 2,
    "terrainHeight": -10,
    "terrainHeightScale": 40,
    "step": 2,
    "position": [0, 0, 0],
}

# ------------------------- Resolver ruta --------------------------
def resolve_heightmap_absolute_path(src: str):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(base_dir, f"../../../client/public{src}"))

# ------------------------- Cargar heightmap --------------------------
def load_heightmap_from_png(src: str, scale: float = 1, flip_y: bool = True):
    file_path = resolve_heightmap_absolute_path(src)
    with Image.open(file_path) as img:
        w, h = img.size
        mode = img.mode

        # Paletted -> convert a RGBA
        if mode == "P":
            img = img.convert("RGBA")
            mode = "RGBA"

        # Prepare pixels list (will be ints or tuples depending on mode)
        pixels = list(img.getdata())

    heights = [0.0] * (w * h)

    if mode.startswith("I;") or mode == "I":  # integer / 16-bit
        maxv = max(pixels) if pixels else 65535
        for y in range(h):
            for x in range(w):
                v = pixels[y * w + x]
                dst = (h - 1 - y) * w + x if flip_y else y * w + x
                heights[dst] = (v / maxv) * scale
    elif mode == "F":
        maxv = max(pixels) if pixels else 1.0
        for y in range(h):
            for x in range(w):
                v = pixels[y * w + x]
                dst = (h - 1 - y) * w + x if flip_y else y * w + x
                heights[dst] = (v / maxv) * scale
    elif mode in ("L", "LA"):
        for y in range(h):
            for x in range(w):
                p = pixels[y * w + x]
                v = p[0] if isinstance(p, tuple) else p
                dst = (h - 1 - y) * w + x if flip_y else y * w + x
                heights[dst] = (v / 255.0) * scale
    elif mode in ("RGB", "RGBA"):
        for y in range(h):
            for x in range(w):
                r, g, b = pixels[y * w + x][:3]
                luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
                dst = (h - 1 - y) * w + x if flip_y else y * w + x
                heights[dst] = (luminance / 255.0) * scale
    else:
        # fallback: convert to L and re-run simple path
        with Image.open(file_path) as img2:
            img2 = img2.convert("L")
            px2 = list(img2.getdata())
            for y in range(h):
                for x in range(w):
                    v = px2[y * w + x]
                    dst = (h - 1 - y) * w + x if flip_y else y * w + x
                    heights[dst] = (v / 255.0) * scale

    return {
        "width": w,
        "height": h,
        "heights": heights,
        "filePath": file_path,
    }
# ------------------------- Clase TerrainAuthority --------------------------
class TerrainAuthority:
    def __init__(self, map_size, config=None):
        if config is None:
            config = TERRAIN_CONFIG
        self.config = config
        self.map_size = map_size
        self.hm = None
        self.terrainForClient = None

        try:
            self.hm = load_heightmap_from_png(config["src"], config["scale"])
        except Exception as err:
            print("No se pudo cargar el heightmap. Fallback a base y=0:", str(err))

        if self.hm:
            self.terrainForClient = {
                **config,
                "width": self.hm["width"],
                "height": self.hm["height"],
                "heights": self.hm["heights"],
            }
        else:
            self.terrainForClient = {
                **config,
                "width": 0,
                "height": 0,
                "heights": [],
            }

    def sampleGroundY(self, x, z):
        cfg = self.config
        base_y = cfg["baseHeight"]
        if not self.hm:
            return base_y

        world_w = self.map_size[0] * cfg["terrainSize"]
        world_h = self.map_size[1] * cfg["terrainSize"]
        if world_w <= 0 or world_h <= 0:
            return base_y

        local_x = x - cfg["position"][0]
        local_z = z - cfg["position"][2]

        u = local_x / world_w + 0.5
        v = local_z / world_h + 0.5
        if u < 0 or u > 1 or v < 0 or v > 1:
            return base_y

        step = max(1, int(cfg.get("step", 1)))
        max_grid_x = (self.hm["width"] - 1) // step
        max_grid_y = (self.hm["height"] - 1) // step
        if max_grid_x <= 0 or max_grid_y <= 0:
            return base_y

        fx = u * max_grid_x
        fy = v * max_grid_y

        gx0 = int(fx)
        gy0 = int(fy)
        gx1 = min(gx0 + 1, max_grid_x)
        gy1 = min(gy0 + 1, max_grid_y)

        tx = fx - gx0
        ty = fy - gy0

        x0 = min(gx0 * step, self.hm["width"] - 1)
        y0 = min(gy0 * step, self.hm["height"] - 1)
        x1 = min(gx1 * step, self.hm["width"] - 1)
        y1 = min(gy1 * step, self.hm["height"] - 1)

        def idx(ix, iy):
            return iy * self.hm["width"] + ix

        h00 = self.hm["heights"][idx(x0, y0)] if idx(x0, y0) < len(self.hm["heights"]) else 0
        h10 = self.hm["heights"][idx(x1, y0)] if idx(x1, y0) < len(self.hm["heights"]) else 0
        h01 = self.hm["heights"][idx(x0, y1)] if idx(x0, y1) < len(self.hm["heights"]) else 0
        h11 = self.hm["heights"][idx(x1, y1)] if idx(x1, y1) < len(self.hm["heights"]) else 0

        hx0 = h00 * (1 - tx) + h10 * tx
        hx1 = h01 * (1 - tx) + h11 * tx
        h = hx0 * (1 - ty) + hx1 * ty

        terrain_y = (
            cfg["position"][1]
            + cfg["terrainHeight"]
            + h * cfg["terrainHeightScale"]
        )

        return max(base_y, terrain_y)

# ------------------------- Factory --------------------------
def create_terrain_authority(map_size, config=None):
    return TerrainAuthority(map_size, config)