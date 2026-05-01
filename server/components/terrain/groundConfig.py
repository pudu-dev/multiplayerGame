from .useHeighmap import create_terrain_authority


# ------------------------- CONFIGURACIÓN --------------------------

MAPSIZE = [50, 50]

# poner False para desactivar el terreno
TERRAIN_ENABLED = True

def terrain_if_enabled(size, config=None):
    if not TERRAIN_ENABLED:
        return None
    try:
        return create_terrain_authority(size, config).terrainForClient
    except Exception as e:
        print("groundConfig: error creando terrain:", e)
        return None

DEFAULT_MAP_ID = "map_1"

# ------------------------- ITEMS --------------------------

items = {
    "table": {
        "name": "table",
        "size": [4, 4],
    },
    "chair": {
        "name": "chair",
        "size": [1, 1],
    },
}


# ------------------------- MAPA --------------------------

MAPS = {
    "map_1": {
        "id": "map_1",
        "size": [50, 50],
        "gridDivision": 5,
        "groundbase": None,
        "terrain":None,
        "model" : None,
        "sky" : {"type": "image", "src": "/models/maps/sky.hdr"},
        "items": [],
        "teleports": [
            {
                "id": "to_map_2",
                "position": [0, 0, 0],
                "rotation": [0, 0, 0],
                "scale": 1,
                "model": "/models/items/tp.glb",
                "position_model": [0, 0, 0],
                "rotation_model": [0, -1, 0],
                "scale_model": 1,
                "targetMapId": "map_2",
                "targetSpawn": [0, 0, 0],
            },
            {
                "id": "to_map_3",
                "position": [20 , 0 , 0],
                "rotation": [0, 0, 0],
                "scale": 1,
                "model": "/models/items/tp.glb",
                "position_model": [20, 0, 0],
                "rotation_model": [0, -1, 0],
                "scale_model": 1,
                "targetMapId": "map_3",
                "targetSpawn": [0, 0, 0],
            },
            {
                "id": "to_map_4",
                "position": [40 , 0 , 0],
                "rotation": [0, 0, 0],
                "scale": 1,
                "model": "/models/items/tp.glb",
                "position_model": [40, 0, 0],
                "rotation_model": [0, -1, 0],
                "scale_model": 1,
                "targetMapId": "map_4",
                "targetSpawn": [0, 0, 0],
            },
            {
                "id": "to_map_5",
                "position": [60 , 0 , 0],
                "rotation": [0, 0, 0],
                "scale": 1,
                "model": "/models/items/tp.glb",
                "position_model": [60, 0, 0],
                "rotation_model": [0, -1, 0],
                "scale_model": 1,
                "targetMapId": "map_5",
                "targetSpawn": [0, 0, 0],
            },
        ],
    },
    "map_2": {
        "id": "map_2",
        "size": [60, 60],
        "gridDivision": 5,
        "groundbase": None,
        "terrain": terrain_if_enabled(["size"]),
        "model" : None,
        "sky" : None,
        "items": [
            {"name": "chair", "size": [1, 1], "gridPosition": [15, 15], "rotation": 1},
        ],
        "teleports": [
            {
                "id": "to_map_1",
                "position": [4, 0, 4],
                "targetMapId": "map_1",
                "targetSpawn": [12, 10, 12],
                "rotation": [0, 0, 0],
                "model": "/models/items/tp.glb",
                "scale": 1,
            },
        ],
    },
    "map_3": {
        "id": "map_3",
        "size": [50, 50],
        "gridDivision": 5,
        "groundbase": {"baseSize": 1, "baseHeight": -1, "texture": "/models/maps/grass.jpg"},
        "terrain": None,  
        "model": '/models/maps/map.glb',   
        "sky": None, 
        "items": [],
        "teleports": [
            {
                "id": "to_map_1",
                "position": [2, 0, 2],
                "rotation": [0, 0, 0],
                "model": "/models/items/tp.glb",
                "scale": 1,
                "targetMapId": "map_1",
                "targetSpawn": [4, 10, 4],
            }
        ],
    },
        "map_4": {
        "id": "map_4",
        "size": [50, 50],
        "gridDivision": 5,
        "groundbase":  {"baseSize": 4, "baseHeight": 0, "texture": "/models/maps/grass.jpg"},
        "terrain": None,  
        "model": None,   
        "sky": None, 
        "items": [
            {"name": "chair", "size": [1, 1], "gridPosition": [0, 0], "rotation": 0},
            {"name": "table", "size": [4, 4], "gridPosition": [10, 10], "rotation": 0},
        ],
        "fractals": [
        { 
            "id": "f1", 
            "level": 3, 
            "size": 6, 
            "position": [0, 1, 0],
            "color": "#111111"
        }
        ],
        "teleports": [
            {
                "id": "to_map_1",
                "position": [4, 0, 4],
                "rotation": [0, 0, 0],
                "model": "/models/items/tp.glb",
                "scale": 1,
                "targetMapId": "map_1",
                "targetSpawn": [4, 10, 4],
            }
        ],
    },
        "map_5": {
        "id": "map_5",
        "size": [50, 50],
        "gridDivision": 5,
        "groundbase": None,
        "terrain": None,
        "model": None,
        "sky": None,
        "items": [],
        "teleports": [
            {
                "id": "to_map_1",
                "position": [2, 0, 2],
                "rotation": [0, 0, 0],
                "model": "/models/items/tp.glb",
                "scale": 1,
                "targetMapId": "map_1",
                "targetSpawn": [4, 10, 4],
            }
        ],
    },
}


def get_map_data(map_id):
    return MAPS.get(map_id, MAPS[DEFAULT_MAP_ID])

def get_teleport(map_id, teleport_id):
    teleports = get_map_data(map_id).get("teleports", [])
    for tp in teleports:
        if tp.get("id") == teleport_id:
            return tp
    return None


# -------------------------------- FUNCIONES DE SPAWN --------------------------------


def generate_spawn_position(team_name, player_spawn_position=0, map_id=DEFAULT_MAP_ID):
    m = get_map_data(map_id)
    border_offset = 10
    spawn_height = 50
    spawn_player_distance = 1

    team = {
        "blue": [m["size"][0] - border_offset, spawn_height, m["size"][1] - border_offset],
        "red": [m["size"][0] + border_offset, spawn_height, m["size"][1] + border_offset],
   
    }

    start = team.get(team_name)
    if start is None:
        raise ValueError("Equipo invalido: " + str(team_name))

    spawn_team = player_spawn_position * spawn_player_distance
    return [ start[0] - spawn_team, start[1], start[2] + spawn_team ]


