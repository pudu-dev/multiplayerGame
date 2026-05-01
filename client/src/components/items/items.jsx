/* import { useMemo } from 'react';
import { useGLTF} from "@react-three/drei";
import { useAtom } from 'jotai';
import { mapAtom } from "../conection/SocketConnection";
import { SkeletonUtils } from 'three-stdlib';

export const Items = ({ item }) => {

    const {name, size, gridPosition, rotation } = item; // Desestructurar las propiedades del item

    const [map] = useAtom(mapAtom);

    const { scene } = useGLTF(`/models/items/${name}.glb`);

    const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])

    return <primitive object={clone} position={[
        size[0] / map.gridDivision / 2 + gridPosition[0] / map.gridDivision,
        0,
        size[1] / map.gridDivision / 2 + gridPosition[1] / map.gridDivision
    ]}
    rotation-y={rotation || 0 * (Math.PI / 2)}
    
    />;
};

export default Items; */


import { useMemo } from 'react';
import { useGLTF} from "@react-three/drei";
import { useAtom } from 'jotai';
import { mapAtom } from "../../conection/SocketConnection.js";
import { SkeletonUtils } from 'three-stdlib';
import { RigidBody } from "@react-three/rapier";

export const Items = ({ item }) => {

    const {name, size, gridPosition, rotation } = item; // Desestructurar las propiedades del item

    const [map] = useAtom(mapAtom);

    const { scene } = useGLTF(`/models/items/${name}.glb`);

    const clone = useMemo(() => {
      const c = SkeletonUtils.clone(scene);
      c.userData = { ...(c.userData || {}), item }; // identificar el item en colisiones
      return c;
    }, [scene, item]);

    const pos = [
      size[0] / map.gridDivision / 2 + gridPosition[0] / map.gridDivision,
      0,
      size[1] / map.gridDivision / 2 + gridPosition[1] / map.gridDivision
    ];

    const rotationY = (rotation ?? 0) * (Math.PI / 2);

    return (
      <RigidBody type="fixed" colliders="cuboid" position={pos} rotation={[0, rotationY, 0]}>
        <primitive object={clone} />
      </RigidBody>
    );
};

export default Items;
