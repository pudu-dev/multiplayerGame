import { useRef, useEffect } from "react";

// ------------------------- Hook para capturar inputs de teclado --------------------------
export function KeyboardInput() {
  const input = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    rotation: 0,

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

export function MouseInput() {
  const input = useRef({
    deltaX: 0,
    deltaY: 0,
  });
  useEffect(() => {
    const handleMouseMove = (e) => {
      input.current.deltaX += e.movementX;
      input.current.deltaY += e.movementY;
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);
  return input;
}
