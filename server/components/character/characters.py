import math
import random
from typing import List, Dict, Any

from .characterController import character_controller


# ------------------------- Estado global --------------------------

characters: List[Dict[str, Any]] = []

MAX_INPUT_QUEUE      = 64
MAX_SERVER_MOVE_SPEED = 18.0
MAX_INPUTS_PER_TICK  = 3


# ------------------------- Crear personaje --------------------------

def new_character(id, position, team, spawn_by_team, name=None, map_id="map_1"):
    if name is None:
        name = f"Player_{str(id)[:4]}"

    health     = 100
    energy     = 100
    max_health = 100
    max_energy = 100

    return {
        "id":          id,
        "name":        name,
        "team":        team,
        "spawnByTeam": spawn_by_team,
        "mapId":       map_id,
        "position":    position,   # [x, y, z]
        "rotation":    0,
        "hairColor":   generate_random_hex_color(),
        "topColor":    get_team_color(team),
        "bottomColor": get_team_color(team),
        "shoeColor":   generate_random_hex_color(),
        "animation":   "CharacterArmature|Idle",
        "input": {
            "forward":  False,
            "backward": False,
            "left":     False,
            "right":    False,
            "run":      False,
            "jump":     False,
            "moveX":    0.0,
            "moveZ":    0.0,
            "rotation": 0.0,
        },
        "lastProcessedInput": -1,
        "velocityY":   0,
        "isGrounded":  True,
        "health":      health,
        "maxHealth":   max_health,
        "energy":      energy,
        "maxEnergy":   max_energy,
        "isAlive":     True,
        "_inputQueue":       [],
        "_lastReceivedSeq":  -1,
    }


# ------------------------- Color aleatorio --------------------------

def generate_random_hex_color():
    return "#{:06x}".format(random.randint(0, 0xFFFFFF))


# ------------------------- Color por equipo --------------------------

def get_team_color(team_name):
    team_colors = {
        "red":  "#ff0000",
        "blue": "#0000ff",
    }
    return team_colors.get(team_name)


# ------------------------- Agregar personaje --------------------------

def add_character(char: Dict[str, Any]):
    characters.append(char)


# ------------------------- Eliminar personaje --------------------------

def remove_character(id):
    global characters
    characters = [c for c in characters if c["id"] != id]


# ------------------------- Helpers de input --------------------------

def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float))


def _sanitize_input(input_data: Dict[str, Any]) -> Dict[str, Any]:
    clean: Dict[str, Any] = {}

    # Bools (solo si vienen en el paquete)
    for key in ("forward", "backward", "left", "right", "run", "jump"):
        if key in input_data:
            clean[key] = bool(input_data.get(key))

    # Rotación (si viene y es numérica)
    # FIX: solo incluir "rotation" en el paquete limpio si realmente vino del cliente.
    # characterController.py ya depende de que "rotation" esté en input_data para
    # decidir si sobrescribir char["rotation"], así que no agregamos un valor por defecto.
    if "rotation" in input_data and _is_number(input_data.get("rotation")):
        clean["rotation"] = float(input_data["rotation"])

    # moveX/moveZ con clamp de velocidad
    has_move_x = "moveX" in input_data and _is_number(input_data.get("moveX"))
    has_move_z = "moveZ" in input_data and _is_number(input_data.get("moveZ"))

    if has_move_x or has_move_z:
        move_x = float(input_data.get("moveX", 0.0)) if has_move_x else 0.0
        move_z = float(input_data.get("moveZ", 0.0)) if has_move_z else 0.0

        speed = math.hypot(move_x, move_z)
        if speed > MAX_SERVER_MOVE_SPEED and speed > 0:
            scale  = MAX_SERVER_MOVE_SPEED / speed
            move_x *= scale
            move_z *= scale

        clean["moveX"] = move_x
        clean["moveZ"] = move_z

    return clean


# ------------------------- Aplicar input --------------------------

def apply_input(id, input_data: Dict[str, Any]):
    char = next((c for c in characters if c["id"] == id), None)
    if not char or not isinstance(input_data, dict):
        return False

    clean_input = _sanitize_input(input_data)
    seq = input_data.get("seq")

    # Flujo híbrido con seq: encolamos y procesamos por tick
    if isinstance(seq, int):
        last_received = char.get("_lastReceivedSeq", -1)
        if seq <= last_received:
            return False

        char["_lastReceivedSeq"] = seq

        queue = char.setdefault("_inputQueue", [])
        queue.append({"seq": seq, "input": clean_input})

        # Protección contra crecimiento infinito por lag/spam
        if len(queue) > MAX_INPUT_QUEUE:
            del queue[:-MAX_INPUT_QUEUE]

        return True

    # Fallback sin seq (debug/bots)
    if clean_input:
        char["input"].update(clean_input)
        return True

    return False


# ------------------------- Tick del servidor --------------------------

def tick_characters(delta: float, config: dict = None):
    if config is None:
        config = {}

    updated = False

    for character in characters:
        queue = character.get("_inputQueue", [])

        if queue:
            # Procesamos un lote en orden para no perder transiciones de input
            packets_to_process = queue[:MAX_INPUTS_PER_TICK]
            del queue[:MAX_INPUTS_PER_TICK]

            last_seq = character.get("lastProcessedInput", -1)

            for packet in packets_to_process:
                packet_input = packet.get("input", {})
                if packet_input:
                    character["input"].update(packet_input)

                packet_seq = packet.get("seq")
                if isinstance(packet_seq, int):
                    last_seq = packet_seq

            character["lastProcessedInput"] = last_seq

        was_updated = character_controller(character, delta, config)
        if was_updated:
            updated = True

    return updated