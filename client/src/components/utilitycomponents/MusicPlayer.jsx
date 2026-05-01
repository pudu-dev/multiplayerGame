import './MusicPlayer.css';
import { useEffect, useRef } from 'react';

export default function MusicPlayer({ isPlaying = true, volume = 0.1 }) {
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio('../src/assets/music/music.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = volume;
    if (isPlaying) audioRef.current.play().catch(() => {});
    return () => {
      audioRef.current.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying]);

  return null;
}