import { useEffect, useRef } from "react";
import { useAtom } from "jotai";
import { Socket, characterAtom, myIdAtom, mapAtom, wallsAtom } from "./SocketConnection.js";

const DEFAULT_FLUSH_HZ = 20;
const MIN_FLUSH_HZ = 10;
const MAX_FLUSH_HZ = 60;

function normalizeHz(value, fallback = DEFAULT_FLUSH_HZ) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(MIN_FLUSH_HZ, Math.min(MAX_FLUSH_HZ, Math.round(num)));
}

// socketmanager que recibe las actualizaciones del servidor.
export const SocketManager = ({ name, team }) => {
  const [, setCharacters] = useAtom(characterAtom);
  const [, setMyId] = useAtom(myIdAtom);
  const [, setMap] = useAtom(mapAtom);
  const [, setWalls] = useAtom(wallsAtom);
  const bufferRef = useRef({
    characters: null,
    map: null,
    walls: null,
    id: null,
    stateTick: null,
  });

  const lastAppliedTickRef = useRef(-1);
  const intervalRef = useRef(null);
  const flushHzRef = useRef(DEFAULT_FLUSH_HZ);

  useEffect(() => {
    if (!name || !team) return undefined;

    Socket.auth = { name, team };

    const flushBuffer = () => {
      const buffer = bufferRef.current;

      if (buffer.id !== null) {
        setMyId(buffer.id);
        buffer.id = null;
      }

      if (buffer.map !== null) {
        setMap(buffer.map);
        buffer.map = null;
      }

      if (buffer.walls !== null) {
        setWalls(buffer.walls);
        buffer.walls = null;
      }

      if (buffer.characters !== null) {
        const incomingTick = buffer.stateTick;
        const shouldApply =
          incomingTick === null || incomingTick !== lastAppliedTickRef.current;

        if (shouldApply) {
          setCharacters(buffer.characters);
          if (incomingTick !== null) {
            lastAppliedTickRef.current = incomingTick;
          }
        }

        buffer.characters = null;
        buffer.stateTick = null;
      }
    };

    const restartFlushLoop = (hz) => {
      const targetHz = normalizeHz(hz, DEFAULT_FLUSH_HZ);

      if (intervalRef.current && flushHzRef.current === targetHz) return;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      flushHzRef.current = targetHz;
      intervalRef.current = setInterval(flushBuffer, 1000 / targetHz);
    };

    restartFlushLoop(DEFAULT_FLUSH_HZ);

    const onConnect = () => {
      console.log("ws conectado");
      if (Socket.id) bufferRef.current.id = Socket.id;
    };

    const onDisconnect = (reason) => {
      console.log("ws desconectado:", reason);
      lastAppliedTickRef.current = -1;
    };

    const onWelcome = (value) => {
      const incomingId = (value && (value.player_identifier || value.id)) || null;
      if (incomingId) bufferRef.current.id = incomingId;

      if (value && value.characters !== undefined) {
        bufferRef.current.characters = value.characters;
        bufferRef.current.stateTick = null;
      }

      if (value && value.map !== undefined) {
        bufferRef.current.map = value.map;
      }

      const snapshotRate = normalizeHz(value?.snapshotRate, DEFAULT_FLUSH_HZ);
      restartFlushLoop(snapshotRate);

      const simDtMs = Number(value?.simDtMs);
      if (Number.isFinite(simDtMs) && simDtMs > 0) {
        Socket.serverSimDt = simDtMs / 1000;
      }
    };

    const onGameState = (value) => {
      if (value && value.characters !== undefined) {
        bufferRef.current.characters = value.characters;
        bufferRef.current.stateTick = Number.isInteger(value.stateTick)
          ? value.stateTick
          : null;
      }

      if (value && value.walls !== undefined) {    
        bufferRef.current.walls = value.walls;
      }

      const simDtMs = Number(value?.simDtMs);
      if (Number.isFinite(simDtMs) && simDtMs > 0) {
        Socket.serverSimDt = simDtMs / 1000;
      }
    };

    const onMap = (map) => {
      bufferRef.current.map = map;
    };

    const onWalls = (walls) => {
      bufferRef.current.walls = walls;
    };

    Socket.on("connect", onConnect);
    Socket.on("disconnect", onDisconnect);
    Socket.on("welcome", onWelcome);
    Socket.on("game_state", onGameState);
    Socket.on("map", onMap);
    Socket.on("walls", onWalls);

    Socket.connect();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      Socket.off("connect", onConnect);
      Socket.off("disconnect", onDisconnect);
      Socket.off("welcome", onWelcome);
      Socket.off("game_state", onGameState);
      Socket.off("map", onMap);

      Socket.disconnect();
    };
  }, [name, team, setCharacters, setMyId, setMap, setWalls]);

  return null;
};