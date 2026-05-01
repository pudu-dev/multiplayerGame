import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export const GroundBase = ({ map, position = [0, 0, 0], baseProps = {} }) => {
  if (!map) return null;

  const gb = map?.groundbase ?? null;
  const isArrayGB = Array.isArray(gb);
  const gbObj = gb != null && !isArrayGB && typeof gb === "object" ? gb : {};

  let baseSize = isArrayGB ? gb[0] ?? 2 : gbObj.baseSize ?? map?.terrain?.baseSize ?? 2;
  let baseHeight = isArrayGB ? gb[1] ?? 0 : gbObj.baseHeight ?? map?.terrain?.baseHeight ?? 0;
  const texturePath = baseProps.texture ?? gbObj.texture ?? map?.groundTexture ?? "/models/maps/grass.jpg";

  baseSize = baseProps.baseSize ?? baseSize;
  baseHeight = baseProps.baseHeight ?? baseHeight;

  const tex = useTexture(texturePath);
  const grass = Array.isArray(tex) ? tex[0] : tex;
  if (grass) {
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    if (grass.repeat) {
      grass.repeat.set((map.size[0] * baseSize) / 10, (map.size[1] * baseSize) / 10);
    }
  }

  return (
    <mesh position={[position[0], baseHeight, position[2]]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[map.size[0] * baseSize, map.size[1] * baseSize]} />
      <meshStandardMaterial map={grass} />
    </mesh>
  );
};

export default GroundBase;