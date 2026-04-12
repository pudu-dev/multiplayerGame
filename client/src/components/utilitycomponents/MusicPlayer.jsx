import './MusicPlayer.css';
import { useState, useEffect , useRef} from 'react';

export default function MusicPlayer() {

    const [isPlaying, setIsPlaying] = useState(true);
    const audioRef = useRef(null);

    useEffect(() => {
      audioRef.current = new Audio('../src/assets/music/music.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.1;
      
      // Reproducir la música al montar el componente
      audioRef.current.play().catch(() => {"Error al reproducir la música"});

        return () => {
          // Detener la música al desmontar el componente
          audioRef.current.pause();
          audioRef.current = null;
      };
    }, []);


    /* ---------------------------------------------------------------------------- */
    // Función para alternar entre reproducir y pausar la música

    const togglePlayPause = () => {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    };

    return (
      <div className="contenedor-principal-musicplayer">

        <button className={`onclick-button ${isPlaying ? 'playing' : 'paused'}`}
                onClick={togglePlayPause}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}

        </button>

      </div>
    );
}