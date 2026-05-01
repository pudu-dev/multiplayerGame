from time import monotonic, time
from contextlib import asynccontextmanager, suppress
import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from components.character import characters as characters_state
from components.character.characters import (
    new_character,
    add_character,
    remove_character,
    apply_input,
    tick_characters,
)
from components.terrain.groundConfig import (
    DEFAULT_MAP_ID,
    get_map_data,
    get_teleport,
    generate_spawn_position,
    MAPS,
)
from components.terrain.useHeighmap import create_terrain_authority


from components.character import attacks as attacks_state

import math



TERRAIN_AUTHORITIES = {}
for mid, m in MAPS.items():
    cfg = m.get("terrain")
    if cfg is not None:
        try:
            TERRAIN_AUTHORITIES[mid] = create_terrain_authority(m["size"], cfg)
        except Exception as e:
            print("terrain authority error", mid, e)


def spread_spawn(base_spawn, slot, spacing=1.8, slots_per_ring=8):
    ring = (slot // slots_per_ring) + 1
    idx = slot % slots_per_ring
    angle = (2 * math.pi * idx) / slots_per_ring
    return [
        base_spawn[0] + math.cos(angle) * spacing * ring,
        base_spawn[1],
        base_spawn[2] + math.sin(angle) * spacing * ring,
    ]


def reset_character_motion_after_teleport(character):
    # Evita arrastre de inputs en el primer tick despues del teleport.
    character["velocityY"] = 0
    character["isGrounded"] = False
    character["input"].update(
        {
            "forward": False,
            "backward": False,
            "left": False,
            "right": False,
            "run": False,
            "jump": False,
            "moveX": 0.0,
            "moveZ": 0.0,
        }
    )
    character["_inputQueue"] = []

# ------------------------------ ESTADO DEL JUEGO ------------------------------

connected_clients = []  # Lista de conexiones WebSocket activas
connected_players = {}  # Diccionario que almacena la informacion de los personajes ingame


# ------------------------------ CONFIGURACION ------------------------------

# Simulacion autoritativa fija (hibrido estable con client prediction)
SIMULATION_HZ = 60
SIMULATION_DT_SECONDS = 1.0 / SIMULATION_HZ

# Frecuencia de snapshots de red (mas escalable para muchos jugadores)
SNAPSHOT_HZ = 30
SNAPSHOT_DT_SECONDS = 1.0 / SNAPSHOT_HZ

# Protecciones de estabilidad bajo carga
MAX_FRAME_TIME_SECONDS = 0.25
MAX_SIM_STEPS_PER_FRAME = 5
WS_SEND_TIMEOUT_SECONDS = 0.05


# ------------------------------ BROADCAST ------------------------------------

async def _safe_send(ws: WebSocket, payload: str):
    await asyncio.wait_for(ws.send_text(payload), timeout=WS_SEND_TIMEOUT_SECONDS)


async def broadcast_game_state(state_tick: int):
    if not connected_clients:
        return

    payload = json.dumps(
        {
            "message_type": "game_state",
            "stateTick": state_tick,
            "serverTimeMs": int(time() * 1000),
            "simDtMs": int(SIMULATION_DT_SECONDS * 1000),
            "characters": characters_state.characters,
            "projectiles": attacks_state.get_projectiles(),
            "walls": attacks_state.get_walls(),
        }
    )

    current_clients = list(connected_clients)

    results = await asyncio.gather(
        *[_safe_send(ws, payload) for ws in current_clients],
        return_exceptions=True,
    )

    alive_clients = []
    dead_player_ids = []

    for ws, result in zip(current_clients, results):
        if isinstance(result, Exception):
            dead_player_ids.append(str(id(ws)))
            with suppress(Exception):
                await ws.close()
            continue
        alive_clients.append(ws)

    connected_clients[:] = alive_clients

    # Limpieza defensiva: evita fantasmas si un socket deja de responder
    for player_id in dead_player_ids:
        remove_character(player_id)
        connected_players.pop(player_id, None)


# ------------------------------ LOOP DEL JUEGO ------------------------------

async def game_loop():
    previous_time = monotonic()
    sim_accumulator = 0.0
    net_accumulator = 0.0
    state_tick = 0

    while True:
        now = monotonic()
        frame_time = now - previous_time
        previous_time = now

        # Evita saltos gigantes si el proceso se pausa
        if frame_time > MAX_FRAME_TIME_SECONDS:
            frame_time = MAX_FRAME_TIME_SECONDS

        sim_accumulator += frame_time
        net_accumulator += frame_time

        sim_steps = 0
        while sim_accumulator >= SIMULATION_DT_SECONDS and sim_steps < MAX_SIM_STEPS_PER_FRAME:
            walls_for_sim = attacks_state.get_walls_for_sim()
            game_cfg = {
                "walls": walls_for_sim,
                "maxAirJumps": 2,         # ajustar a 1 para doble salto
                "airJumpCooldown": 1.0,   # segundos
                "terrains": TERRAIN_AUTHORITIES,
            }
            tick_characters(SIMULATION_DT_SECONDS, game_cfg)
            attacks_state.tick_projectiles(SIMULATION_DT_SECONDS)
            
            sim_accumulator -= SIMULATION_DT_SECONDS
            state_tick += 1
            sim_steps += 1

        # Evita "spiral of death" bajo sobrecarga
        if sim_steps == MAX_SIM_STEPS_PER_FRAME and sim_accumulator >= SIMULATION_DT_SECONDS:
            sim_accumulator = min(sim_accumulator, SIMULATION_DT_SECONDS)

        if net_accumulator >= SNAPSHOT_DT_SECONDS:
            await broadcast_game_state(state_tick)
            net_accumulator = net_accumulator % SNAPSHOT_DT_SECONDS

        next_sim_in = max(0.0, SIMULATION_DT_SECONDS - sim_accumulator)
        next_net_in = max(0.0, SNAPSHOT_DT_SECONDS - net_accumulator)
        sleep_for = min(next_sim_in, next_net_in)

        if sleep_for > 0:
            await asyncio.sleep(sleep_for)
        else:
            await asyncio.sleep(0)


# ------------------------------ LIFESPAN (startup/shutdown) ------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    loop_task = asyncio.create_task(game_loop())
    try:
        yield
    finally:
        loop_task.cancel()
        with suppress(asyncio.CancelledError):
            await loop_task


server = FastAPI(lifespan=lifespan)


# ------------------------------ CONEXION ------------------------------

@server.websocket("/game-connection")
async def handle_game_connection(websocket_connection: WebSocket):
    await websocket_connection.accept()
    connected_clients.append(websocket_connection)

    player_identifier = str(id(websocket_connection))
    player_name = websocket_connection.query_params.get("name")
    player_team = websocket_connection.query_params.get("team", "red")

    if player_team not in ("red", "blue"):
        player_team = "red"


    team_count = sum(
        1
        for c in characters_state.characters
        if c.get("team") == player_team and c.get("mapId", DEFAULT_MAP_ID) == DEFAULT_MAP_ID
    )
    start_map_id = DEFAULT_MAP_ID
    spawn_position = generate_spawn_position(player_team, team_count, start_map_id)

    player_character = new_character(
        id=player_identifier,
        position=spawn_position,
        team=player_team,
        spawn_by_team=team_count,
        name=player_name,
        map_id=start_map_id,
    )

    add_character(player_character)
    connected_players[player_identifier] = player_character

    await websocket_connection.send_text(
        json.dumps(
            {
                "message_type": "welcome",
                "player_identifier": player_identifier,
                "serverTickRate": SIMULATION_HZ,
                "snapshotRate": SNAPSHOT_HZ,
                "simDtMs": int(SIMULATION_DT_SECONDS * 1000),
                "characters": characters_state.characters,
                "map": get_map_data(start_map_id),
            }
        )
    )

    try:
        while True:
            raw_message = await websocket_connection.receive_text()

            try:
                data = json.loads(raw_message)
            except json.JSONDecodeError:
                continue

            message_type = data.get("message_type")
            payload = data.get("payload", {})

            # movimiento
            if message_type == "move" and isinstance(payload, dict):
                apply_input(player_identifier, payload)

            # en el while de mensajes
            if message_type == "teleport" and isinstance(payload, dict):
                me = connected_players.get(player_identifier)
                if not me:
                    continue

                current_map_id = me.get("mapId", DEFAULT_MAP_ID)
                teleport_id = payload.get("teleportId")
                tp = get_teleport(current_map_id, teleport_id)
                if not tp:
                    continue

                # validacion server-side: debe estar dentro del portal
                px, pz = me["position"][0], me["position"][2]
                tx, tz = tp["position"][0], tp["position"][2]
                radius = float(tp.get("radius", 2.0))
                if ((px - tx) ** 2 + (pz - tz) ** 2) > ((radius + 0.7) ** 2):
                    continue

                target_map_id = tp.get("targetMapId", DEFAULT_MAP_ID)

                target_players = [
                    c
                    for c in characters_state.characters
                    if c.get("id") != player_identifier and c.get("mapId") == target_map_id
                ]
                slot = len(target_players)

                base_spawn = tp.get("targetSpawn")
                if base_spawn:
                    me["position"] = spread_spawn(base_spawn, slot, spacing=1.9)
                else:
                    same_team_count = sum(
                        1 for c in target_players if c.get("team") == me.get("team", "red")
                    )
                    me["position"] = generate_spawn_position(
                        me.get("team", "red"),
                        same_team_count,
                        target_map_id,
                    )

                me["mapId"] = target_map_id
                reset_character_motion_after_teleport(me)

                await websocket_connection.send_text(
                    json.dumps(
                        {
                            "message_type": "map",
                            "payload": get_map_data(target_map_id),
                        }
                    )
                )
            # ataque simple (click cliente)
            if message_type == "attack" and isinstance(payload, dict):
                attacks_state.create_projectile(
                    player_identifier,
                    position=payload.get("position"),
                    direction=payload.get("direction"),
                    speed=payload.get("speed", 30),
                    max_distance=payload.get("maxDistance", 50),
                    radius=payload.get("radius", 0.12),
                    color=payload.get("color", "orange"),
                    damage=payload.get("damage", 10),
                )
            
            # habilidad (1..4)
            if message_type == "ability" and isinstance(payload, dict):
                attacks_state.handle_ability(player_identifier, payload)


    except WebSocketDisconnect:
        pass
    except Exception as error:
        print("Error con cliente:", player_identifier, error)
    finally:
        print("Cliente desconectado:", player_identifier)

        if websocket_connection in connected_clients:
            connected_clients.remove(websocket_connection)

        remove_character(player_identifier)
        connected_players.pop(player_identifier, None)