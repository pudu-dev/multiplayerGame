import math

def character_controller(char: dict, delta: float, config: dict = None):
    if config is None:
        config = {}

    # -------------------- Configuración --------------------
    walk_speed        = config.get("walkSpeed",      4)
    run_speed         = config.get("runSpeed",       16)
    jump_velocity     = config.get("jumpVelocity",   5)
    player_gravity    = config.get("playerGravity",  -10)
    player_map_limit  = config.get("playerMapLimit", 500)
    terrain           = config.get("terrain") or (config.get("terrains") or {}).get(char.get("mapId"))

    # double-jump config
    max_air_jumps     = int(config.get("maxAirJumps",     2))
    air_jump_cooldown = float(config.get("airJumpCooldown", 1.0))

    input_data = char.get("input", {})
    speed      = run_speed if input_data.get("run") else walk_speed

    # per-character state for air-jumps (persistente en el dict)
    char["_airJumpsUsed"]         = char.get("_airJumpsUsed",         0)
    char["_airJumpCooldownTimer"] = char.get("_airJumpCooldownTimer",  0.0)

    # decrementar cooldown timer
    char["_airJumpCooldownTimer"] = max(0.0, char["_airJumpCooldownTimer"] - delta)

    # recordar estado previo de suelo para detectar aterrizaje
    prev_isGrounded = bool(char.get("isGrounded", True))

    # guardar posición anterior para revertir en caso de colisión con pared
    prev_x = char["position"][0]
    prev_y = char["position"][1]
    prev_z = char["position"][2]

    # -------------------- Movimiento horizontal --------------------
    moveX = input_data.get("moveX")
    moveZ = input_data.get("moveZ")

    if isinstance(moveX, (int, float)) or isinstance(moveZ, (int, float)):
        mvx = moveX or 0
        mvz = moveZ or 0

        char["position"][0] += mvx * delta
        char["position"][2] += mvz * delta

        if "rotation" in input_data and isinstance(input_data.get("rotation"), (int, float)):
            char["rotation"] = float(input_data["rotation"])

    else:
        # Fallback WASD sin moveX/moveZ (bots o clientes sin predicción)
        move_dir = {"x": 0, "z": 0}

        if input_data.get("forward"):  move_dir["z"] += 1
        if input_data.get("backward"): move_dir["z"] -= 1
        if input_data.get("left"):     move_dir["x"] += 1
        if input_data.get("right"):    move_dir["x"] -= 1

        if move_dir["x"] != 0 or move_dir["z"] != 0:
            length = math.hypot(move_dir["x"], move_dir["z"])
            move_dir["x"] /= length
            move_dir["z"] /= length

            char["position"][0] += move_dir["x"] * speed * delta
            char["position"][2] += move_dir["z"] * speed * delta

            # En el fallback sin moveX/Z la rotación sí se puede calcular desde la
            # dirección, ya que el cliente no envía una rotación visual independiente.
            char["rotation"] = math.atan2(move_dir["x"], move_dir["z"])

    # -------------------- Salto (con soporte air-jump) --------------------
    if input_data.get("jump"):
        if char.get("isGrounded"):
            char["velocityY"]              = jump_velocity
            char["isGrounded"]             = False
            input_data["jump"]             = False
            char["_airJumpsUsed"]          = 0
            char["_airJumpCooldownTimer"]  = 0.0
        else:
            if (
                max_air_jumps > 0
                and char["_airJumpsUsed"] < max_air_jumps
                and char["_airJumpCooldownTimer"] <= 0.0
            ):
                char["velocityY"]             = jump_velocity
                char["_airJumpsUsed"]        += 1
                char["_airJumpCooldownTimer"] = air_jump_cooldown
                input_data["jump"]            = False

    # -------------------- Gravedad --------------------
    char["velocityY"]  = char.get("velocityY", 0)
    char["velocityY"] += player_gravity * delta
    char["position"][1] += char["velocityY"] * delta

    # -------------------- Colisión con terreno --------------------
    if terrain and hasattr(terrain, "sampleGroundY"):
        ground_y = terrain.sampleGroundY(char["position"][0], char["position"][2])
    else:
        ground_y = 0

    if char["position"][1] <= ground_y:
        char["position"][1] = ground_y
        char["velocityY"]   = 0
        char["isGrounded"]  = True
    else:
        char["isGrounded"] = False

    # si aterrizó este tick, resetear conteo/tiempo de air-jumps
    if not prev_isGrounded and char["isGrounded"]:
        char["_airJumpsUsed"]         = 0
        char["_airJumpCooldownTimer"] = 0.0

    # -------------------- Colisión con paredes --------------------
    walls_list  = (config or {}).get("walls") or []
    CHAR_RADIUS = 0.7

    for w in walls_list:
        if w.get("mapId") != char.get("mapId"):
            continue

        px, py, pz = char["position"][0], char["position"][1], char["position"][2]
        cx, cy, cz = w["position"]
        sx, sy, sz = w["size"]

        minX = cx - sx / 2.0 - CHAR_RADIUS
        maxX = cx + sx / 2.0 + CHAR_RADIUS
        minY = cy - sy / 2.0
        maxY = cy + sy / 2.0
        minZ = cz - sz / 2.0 - CHAR_RADIUS
        maxZ = cz + sz / 2.0 + CHAR_RADIUS

        if (minX <= px <= maxX) and (minY <= py <= maxY) and (minZ <= pz <= maxZ):
            char["position"][0] = prev_x
            char["position"][1] = prev_y
            char["position"][2] = prev_z
            char["velocityY"]   = 0
            break

    # -------------------- Límites del mapa --------------------
    char["position"][0] = max(-player_map_limit, min(player_map_limit, char["position"][0]))
    char["position"][2] = max(-player_map_limit, min(player_map_limit, char["position"][2]))

    # -------------------- Animaciones --------------------
    if not char["isGrounded"]:
        char["animation"] = "CharacterArmature|Jump"
    else:
        moving = (
            (isinstance(moveX, (int, float)) and abs(moveX) > 0) or
            (isinstance(moveZ, (int, float)) and abs(moveZ) > 0)
        )

        if not moving:
            bo_moving = (
                input_data.get("forward") or
                input_data.get("backward") or
                input_data.get("left")    or
                input_data.get("right")
            )
            char["animation"] = "CharacterArmature|Run" if bo_moving else "CharacterArmature|Idle"
        else:
            char["animation"] = "CharacterArmature|Run"

    return True