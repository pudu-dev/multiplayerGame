// ...existing code...
import { useEffect, useRef } from 'react';
import { useAtom, } from 'jotai';
import { Socket, characterAtom, myIdAtom, mapAtom} from "./SocketConnection.js";

export const SocketManager = ({ name, team }) => {
  const [_characters, setCharacters] = useAtom(characterAtom);
  const [_myId, setMyId] = useAtom(myIdAtom);
  const [_mapAtom, setMap] = useAtom(mapAtom);

  const bufferRef = useRef({ characters: null, map: null, id: null });
  const intervalRef = useRef(null);

  useEffect(() => {
    // solo conectar cuando tengamos nombre y equipo
    if (!name || !team) return;

    // proporcionar auth antes de conectar para que el server lo vea en handshake
    Socket.auth = { name, team };

    // función para procesar el buffer y aplicar actualizaciones de estado agrupadas
    const flushBuffer = () => {
      const buf = bufferRef.current;
      // aplicar actualizaciones agrupadas en una sola renderización
      if (buf.characters) {
        setCharacters(buf.characters);
        buf.characters = null;
      }
      if (buf.map) {
        setMap(buf.map);
        buf.map = null;
      }
      if (buf.id) {
        setMyId(buf.id);
        buf.id = null;
      }
    };

    // procesar buffer a 20Hz (ajusta si necesitas más/menos frecuencia)
    intervalRef.current = setInterval(flushBuffer, 1000 / 20);

    const onConnect = () => {
      console.log('connect', Socket.id, { connected: Socket.connected });
      if (Socket.id) setMyId(Socket.id);
    };
    const onDisconnect = (reason) => console.log('disconnect', reason);

    const onWelcome = (value) => {
      console.log('welcome', value);
      // bufferizar en vez de setState inmediato
      bufferRef.current.characters = value.characters;
      bufferRef.current.id = value.id;
      bufferRef.current.map = value.map;
    };
    const onCharacters = (value) => {
      // bufferizar actualizaciones de personajes
      bufferRef.current.characters = value;
      // intentar inferir myId si no está fijado
      if (!_myId && Socket.id) {
        const found = value.find((c) => String(c.id) === String(Socket.id));
        if (found) {
          bufferRef.current.id = found.id;
        }
      }
    };

    Socket.on('connect', onConnect);
    Socket.on('disconnect', onDisconnect);
    Socket.on('welcome', onWelcome);
    Socket.on('characters', onCharacters);

    if (Socket.connected && Socket.id) {
      setMyId(Socket.id);
    }
    Socket.connect();

    return () => {
      clearInterval(intervalRef.current);
      Socket.off('connect', onConnect);
      Socket.off('disconnect', onDisconnect);
      Socket.off('welcome', onWelcome);
      Socket.off('characters', onCharacters);
    };
  }, [setCharacters, setMyId, setMap ,_myId, name, team]);

  return null;
};
