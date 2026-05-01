import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export default function Water({
  width = 200,
  height = 200,
  segments = 128,
  position = [0, 0.02, 0],
  color = [0.0, 0.4, 0.7],
  opacity = 0.8,
  speed = 1.0,
  amplitude = 0.35,
  frequency = 0.12,
}) {
  const matRef = useRef();

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
      uOpacity: { value: opacity },
      uAmp: { value: amplitude },
      uFreq: { value: frequency },
      uSpeed: { value: speed },
    }),
    [color, opacity, amplitude, frequency, speed]
  );

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.time.value += delta * uniforms.uSpeed.value;
  });

  const vertexShader = `
    precision highp float;
    uniform float time;
    uniform float uAmp;
    uniform float uFreq;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      // mover eje Z (antes de rotar el plano) para que, tras rotation-x, afecte a Y
      pos.z += sin((pos.x * uFreq) + time) * uAmp;
      pos.z += cos((pos.y * (uFreq * 0.8)) + time * 1.1) * (uAmp * 0.6);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
      float fresnel = pow(1.0 - vUv.y, 2.0);
      vec3 col = uColor * (0.75 + fresnel * 0.35);
      gl_FragColor = vec4(col, uOpacity);
    }
  `;

  return (
    <mesh position={position} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[width, height, segments, segments]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}