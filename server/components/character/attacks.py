# server/components/attacks.py
import math
from typing import List, Dict, Any
from components.character import characters as characters_state
from components.terrain.groundConfig import DEFAULT_MAP_ID

projectiles: List[Dict[str, Any]] = []
walls: List[Dict[str, Any]] = []
_next_id = 1
_next_wall_id = 1

CHARACTER_HIT_RADIUS = 0.7
METEOR_HEIGHT = 45.0


def _normalize_dir(direction):
    try:
        lx = math.hypot(*direction)
    except Exception:
        return [0.0, 0.0, -1.0]
    if lx == 0:
        return [0.0, 0.0, -1.0]
    return [float(direction[0]) / lx, float(direction[1]) / lx, float(direction[2]) / lx]


def _sphere_aabb_intersect(cx, cy, cz, r, min_x, max_x, min_y, max_y, min_z, max_z):
    dx = 0.0
    if cx < min_x:
        dx = min_x - cx
    elif cx > max_x:
        dx = cx - max_x

    dy = 0.0
    if cy < min_y:
        dy = min_y - cy
    elif cy > max_y:
        dy = cy - max_y

    dz = 0.0
    if cz < min_z:
        dz = min_z - cz
    elif cz > max_z:
        dz = cz - max_z

    return (dx * dx + dy * dy + dz * dz) <= (r * r)


def create_projectile(
    owner_id,
    position=None,
    direction=None,
    speed: float = 30.0,
    max_distance: float = 50.0,
    radius: float = 0.12,
    color: str = "orange",
    damage: float = 10.0,
    aoe: float = None,
) -> Dict[str, Any]:
    global _next_id
    if position is None:
        position = [0.0, 1.6, 0.0]
    ndir = _normalize_dir(direction or [0.0, 0.0, -1.0])

    owner = next((c for c in characters_state.characters if c["id"] == owner_id), None)
    map_id = owner.get("mapId") if owner else DEFAULT_MAP_ID

    p = {
        "id": _next_id,
        "ownerId": owner_id,
        "position": {"x": float(position[0]), "y": float(position[1]), "z": float(position[2])},
        "direction": {"x": float(ndir[0]), "y": float(ndir[1]), "z": float(ndir[2])},
        "speed": float(speed),
        "traveled": 0.0,
        "maxDistance": float(max_distance),
        "radius": float(radius),
        "color": color,
        "damage": float(damage),
        "mapId": map_id,
    }
    if aoe is not None:
        p["aoe"] = float(aoe)

    _next_id += 1
    projectiles.append(p)
    return p


# -------------------- WALLS (temporal, con TTL) --------------------

def create_wall(owner_id, position=None, size=None, lifetime: float = 3.0, rotation=None) -> Dict[str, Any]:
    global _next_wall_id
    owner = next((c for c in characters_state.characters if c["id"] == owner_id), None)
    map_id = owner.get("mapId") if owner else DEFAULT_MAP_ID

    if position is None:
        position = owner["position"] if owner else [0.0, 0.0, 0.0]
    if size is None:
        size = [4.0, 3.0, 0.5]
    if rotation is None:
        rotation = [0.0, 0.0, 0.0]

    w = {
        "id": _next_wall_id,
        "ownerId": owner_id,
        "position": {"x": float(position[0]), "y": float(position[1]), "z": float(position[2])},
        "size": {"x": float(size[0]), "y": float(size[1]), "z": float(size[2])},
        "rotation": {"x": float(rotation[0]), "y": float(rotation[1]), "z": float(rotation[2])},
        "ttl": float(lifetime),
        "mapId": map_id,
    }
    _next_wall_id += 1
    walls.append(w)
    return w


def get_walls() -> List[Dict[str, Any]]:
    out = []
    for w in walls:
        out.append(
            {
                "id": w["id"],
                "ownerId": w["ownerId"],
                "position": [w["position"]["x"], w["position"]["y"], w["position"]["z"]],
                "size": [w["size"]["x"], w["size"]["y"], w["size"]["z"]],
                "rotation": [w["rotation"]["x"], w["rotation"]["y"], w["rotation"]["z"]],
                "ttl": w["ttl"],
                "mapId": w.get("mapId", DEFAULT_MAP_ID),
            }
        )
    return out


def get_walls_for_sim() -> List[Dict[str, Any]]:
    out = []
    for w in walls:
        out.append(
            {
                "id": w["id"],
                "position": [w["position"]["x"], w["position"]["y"], w["position"]["z"]],
                "size": [w["size"]["x"], w["size"]["y"], w["size"]["z"]],
                "mapId": w.get("mapId", DEFAULT_MAP_ID),
            }
        )
    return out


# -------------------- DAÑO / PROYECTILES (mantener) --------------------

def apply_area_damage(position, map_id, radius, damage, source_id=None):
    for ch in characters_state.characters:
        if ch.get("mapId") != map_id:
            continue
        if not ch.get("isAlive", True):
            continue
        dx = ch["position"][0] - position[0]
        dy = ch["position"][1] - position[1]
        dz = ch["position"][2] - position[2]
        dist = math.hypot(dx, dy, dz)
        if dist <= radius + CHARACTER_HIT_RADIUS:
            ch["health"] = ch.get("health", 100) - damage
            if ch["health"] <= 0:
                ch["health"] = 0
                ch["isAlive"] = False
                ch["animation"] = "CharacterArmature|Death"


def tick_projectiles(dt: float) -> bool:
    global projectiles, walls

    removed_ids = []

    # Procesar proyectiles (movimiento + colisiones)
    for p in list(projectiles):
        dx = p["direction"]["x"] * p["speed"] * dt
        dy = p["direction"]["y"] * p["speed"] * dt
        dz = p["direction"]["z"] * p["speed"] * dt

        p["position"]["x"] += dx
        p["position"]["y"] += dy
        p["position"]["z"] += dz

        p["traveled"] += math.hypot(dx, dy, dz)

        # Meteor / impacto suelo
        if p["direction"]["y"] < -0.5 and p["position"]["y"] <= 0:
            aoe_radius = p.get("aoe", max(1.5, p.get("radius", 0.12) * 4))
            apply_area_damage([p["position"]["x"], p["position"]["y"], p["position"]["z"]], p.get("mapId"), aoe_radius, p.get("damage", 20), p.get("ownerId"))
            removed_ids.append(p["id"])
            continue

        # Colisión con walls (sphere vs AABB)
        collided_with_wall = False
        for w in walls:
            if w.get("mapId") != p.get("mapId"):
                continue
            wx = w["position"]["x"]
            wy = w["position"]["y"]
            wz = w["position"]["z"]
            sx = w["size"]["x"]
            sy = w["size"]["y"]
            sz = w["size"]["z"]

            min_x = wx - sx / 2.0
            max_x = wx + sx / 2.0
            min_y = wy - sy / 2.0
            max_y = wy + sy / 2.0
            min_z = wz - sz / 2.0
            max_z = wz + sz / 2.0

            if _sphere_aabb_intersect(p["position"]["x"], p["position"]["y"], p["position"]["z"], p.get("radius", 0.12),
                                      min_x, max_x, min_y, max_y, min_z, max_z):
                # opcional: si el proyectil tiene aoe aplicarlo
                aoe = p.get("aoe")
                if aoe:
                    apply_area_damage([p["position"]["x"], p["position"]["y"], p["position"]["z"]], p.get("mapId"), aoe, p.get("damage", 20), p.get("ownerId"))
                removed_ids.append(p["id"])
                collided_with_wall = True
                break
        if collided_with_wall:
            continue

        # Colisiones con personajes
        for ch in characters_state.characters:
            if ch.get("mapId") != p.get("mapId"):
                continue
            if not ch.get("isAlive", True):
                continue
            dx_c = ch["position"][0] - p["position"]["x"]
            dy_c = ch["position"][1] - p["position"]["y"]
            dz_c = ch["position"][2] - p["position"]["z"]
            dist = math.hypot(dx_c, dy_c, dz_c)
            if dist <= (p.get("radius", 0.12) + CHARACTER_HIT_RADIUS):
                apply_area_damage([p["position"]["x"], p["position"]["y"], p["position"]["z"]], p.get("mapId"), max(p.get("radius", 0.12) * 1.5, 0.5), p.get("damage", 20), p.get("ownerId"))
                removed_ids.append(p["id"])
                break

        # Fin de rango
        if p["traveled"] >= p["maxDistance"]:
            aoe = p.get("aoe")
            if aoe:
                apply_area_damage([p["position"]["x"], p["position"]["y"], p["position"]["z"]], p.get("mapId"), aoe, p.get("damage", 20), p.get("ownerId"))
            removed_ids.append(p["id"])

    if removed_ids:
        ids_set = set(removed_ids)
        projectiles = [p for p in projectiles if p["id"] not in ids_set]

    # ---- gestionar TTL de walls ----
    removed_wall_ids = []
    for w in list(walls):
        w["ttl"] -= dt
        if w["ttl"] <= 0:
            removed_wall_ids.append(w["id"])

    if removed_wall_ids:
        ids_set = set(removed_wall_ids)
        walls[:] = [w for w in walls if w["id"] not in ids_set]

    return bool(projectiles) or bool(removed_ids) or bool(removed_wall_ids)


def get_projectiles() -> List[Dict[str, Any]]:
    out = []
    for p in projectiles:
        out.append(
            {
                "id": p["id"],
                "ownerId": p["ownerId"],
                "position": [p["position"]["x"], p["position"]["y"], p["position"]["z"]],
                "direction": [p["direction"]["x"], p["direction"]["y"], p["direction"]["z"]],
                "speed": p["speed"],
                "traveled": p["traveled"],
                "maxDistance": p["maxDistance"],
                "radius": p.get("radius", 0.12),
                "color": p.get("color", "orange"),
                "damage": p.get("damage", 10),
                "mapId": p.get("mapId", DEFAULT_MAP_ID),
            }
        )
    return out


def remove_projectile(pid: int):
    global projectiles
    projectiles = [p for p in projectiles if p["id"] != pid]


def remove_wall(wid: int):
    global walls
    walls = [w for w in walls if w["id"] != wid]


def handle_ability(owner_id: str, payload: Dict[str, Any]):
    ability_id = int(payload.get("abilityId", 0))
    owner = next((c for c in characters_state.characters if c["id"] == owner_id), None)
    if not owner:
        return None

    if ability_id == 1:
        pos = payload.get("position") or owner["position"]
        direction = payload.get("direction") or [0, 0, -1]
        return create_projectile(owner_id, position=pos, direction=direction, speed=24.0, max_distance=40.0, radius=0.8, color="purple", damage=35.0)

    if ability_id == 2:
        # crear una muralla temporal delante del jugador
        dirvec = payload.get("direction")
        if not dirvec:
            angle = owner.get("rotation", 0.0)
            dirvec = [math.sin(angle), 0.0, math.cos(angle)]
        ndir = _normalize_dir(dirvec)
        dist = float(payload.get("distance", 5.0))

        default_height = 3.0
        wall_length = float(payload.get("length", 4.0))
        wall_thickness = float(payload.get("thickness", 0.5))

        # orientacion simple: alineada a eje X o Z según componente dominante
        if abs(ndir[0]) > abs(ndir[2]):
            # mirando en X -> muro largo en Z
            size = [wall_thickness, default_height, wall_length]
            rotation = [0.0, 0.0, 0.0]
        else:
            # mirando en Z -> muro largo en X
            size = [wall_length, default_height, wall_thickness]
            rotation = [0.0, 0.0, 0.0]

        pos_center = [owner["position"][0] + ndir[0] * dist, size[1] / 2.0, owner["position"][2] + ndir[2] * dist]
        w = create_wall(owner_id, position=pos_center, size=size, lifetime=float(payload.get("lifetime", 3.0)), rotation=rotation)
        return {"type": "create_wall", "wallId": w["id"]}

    if ability_id == 3:
        target = payload.get("target")
        if not target:
            dirvec = payload.get("direction") or [math.sin(owner.get("rotation", 0)), 0, math.cos(owner.get("rotation", 0))]
            ndir = _normalize_dir(dirvec)
            dist = float(payload.get("distance", 10.0))
            target = [owner["position"][0] + ndir[0] * dist, owner["position"][1], owner["position"][2] + ndir[2] * dist]
        max_teleport = float(payload.get("maxDistance", 50.0))
        dx = target[0] - owner["position"][0]
        dz = target[2] - owner["position"][2]
        if math.hypot(dx, dz) <= max_teleport:
            owner["position"] = [float(target[0]), float(target[1]) if len(target) > 1 else owner["position"][1], float(target[2])]
            owner["velocityY"] = 0
            owner["input"].update({"forward": False, "backward": False, "left": False, "right": False, "moveX": 0.0, "moveZ": 0.0})
            owner["_inputQueue"] = []
            return {"type": "teleport", "target": owner["position"]}
        return None

    if ability_id == 4:
        target = payload.get("target") or owner["position"]
        meteor_start = [float(target[0]), float(target[1]) + METEOR_HEIGHT, float(target[2])]
        return create_projectile(owner_id, position=meteor_start, direction=[0.0, -1.0, 0.0], speed=60.0, max_distance=METEOR_HEIGHT + 10.0, radius=2.5, color="red", damage=80.0, aoe=5.0)

    return None