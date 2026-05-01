import { useGLTF, useAnimations, Stars } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import GroundBase from './GroundBase.jsx';

export const Map3 = ({ model = '/models/maps/map.glb', map = null, position = [0, 0, 0], ...props }) => {
  const { scene, animations } = useGLTF(model);
  const group = useRef();
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (!scene) return;
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (actions && animations?.length > 0) {
      const action = actions[animations[0].name];
      if (action) action.play();
    }
  }, [actions, animations]);

  if (!scene) return null;

  return (
    <group ref={group} {...props}>
      <RigidBody type="fixed" colliders="trimesh">
        <Stars />
        <primitive object={scene} />
        <GroundBase map={map} position={position} />
      </RigidBody>
    </group>
  );
};

export default Map3;