import { useRef, useEffect } from "react";

export function KeyboardInput() {
  const input = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    rotation: 0
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case "KeyW": input.current.forward = true; break;
        case "KeyS": input.current.backward = true; break;
        case "KeyA": input.current.left = true; break;
        case "KeyD": input.current.right = true; break;
        case "ShiftLeft": input.current.run = true; break;
        case "Space": input.current.jump = true; break;
      }
    };
    const handleKeyUp = (e) => {
      switch (e.code) {
        case "KeyW": input.current.forward = false; break;
        case "KeyS": input.current.backward = false; break;
        case "KeyA": input.current.left = false; break;
        case "KeyD": input.current.right = false; break;
        case "ShiftLeft": input.current.run = false; break;
        case "Space": input.current.jump = false; break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return input;
}
