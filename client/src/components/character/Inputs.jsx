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
    attack_1: false,
    attack_2: false,
    attack_3: false,
    attack_4: false,
    camera: false,
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case "KeyW" :  case "ArrowUp" : input.current.forward = true; break;
        case "KeyS" :  case "ArrowDown" : input.current.backward = true; break;
        case "KeyA" :  case "ArrowLeft" : input.current.left = true; break;
        case "KeyD" :  case "ArrowRight" : input.current.right = true; break;
        case "KeyC" : input.current.camera = true; break;
        case "ShiftLeft" : case "ShiftRight" : input.current.run = true; break;
        case "Space" : input.current.jump = true; break;
        case "Digit1" : case "Numpad1" : input.current.attack_1 = true; break;
        case "Digit2" : case "Numpad2" : input.current.attack_2 = true; break;
        case "Digit3" : case "Numpad3" : input.current.attack_3 = true; break;
        case "Digit4" : case "Numpad4" : input.current.attack_4 = true; break;
      }
    };
    const handleKeyUp = (e) => {
      switch (e.code) {
        case "KeyW" :  case "ArrowUp" : input.current.forward = false; break;
        case "KeyS" :  case "ArrowDown" : input.current.backward = false; break;
        case "KeyA" :  case "ArrowLeft" : input.current.left = false; break;
        case "KeyD" :  case "ArrowRight" : input.current.right = false; break;
        case "KeyC" : input.current.camera = false; break;
        case "ShiftLeft" : case "ShiftRight" : input.current.run = false; break;
        case "Space" : input.current.jump = false; break;
        case "Digit1" : case "Numpad1" : input.current.attack_1 = false; break;
        case "Digit2" : case "Numpad2" : input.current.attack_2 = false; break;
        case "Digit3": case "Numpad3" : input.current.attack_3 = false; break;
        case "Digit4": case "Numpad4" : input.current.attack_4 = false; break;
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


// ------------------------- Hook para capturar inputs del mouse --------------------------
export function MouseInput() {

  const input = useRef({
    deltaX: 0,
    deltaY: 0,

    left: false,
    wheelMiddle: false,
    right: false,
    
    wheel: 0,        // acumulado
    wheelDelta: 0,   // por frame (IMPORTANTE)
  });

  useEffect(() => {
    const handleMouseMove = (e) => {
      input.current.deltaX += e.movementX;
      input.current.deltaY += e.movementY;
    };
    const handleMouseDown = (e) => {
      if (e.button === 0) input.current.left = true;
      if (e.button === 1) input.current.wheelMiddle = true;
      if (e.button === 2) input.current.right = true;
    };
    const handleMouseUp = (e) => {
      if (e.button === 0) input.current.left = false;
      if (e.button === 1) input.current.wheelMiddle = false;
      if (e.button === 2) input.current.right = false;
    };

    const scrollMouse = (e) => {

      e.preventDefault(); // evitar scroll de la página

      const delta = Math.sign(e.deltaY);

      input.current.wheelDelta += delta; 
      input.current.wheel += delta;  
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("wheel", scrollMouse, { passive: false }); // pasive: false para poder llamar preventDefault dentro del handler

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("wheel", scrollMouse);
    };

  }, []);
  
  return input;

}


