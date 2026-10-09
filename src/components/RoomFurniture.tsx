import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import desk from "@/assets/training-desk.glb.asset.json";
import plant from "@/assets/training-plant.glb.asset.json";
import windowAsset from "@/assets/training-window.glb.asset.json";

function Furniture({ url, height, position, rotation = 0 }: { url: string; height: number; position: [number, number, number]; rotation?: number }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const copy = scene.clone(true); copy.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(copy); const center = box.getCenter(new THREE.Vector3());
    const factor = height / Math.max(0.01, box.max.y - box.min.y);
    copy.scale.setScalar(factor); copy.position.set(-center.x * factor, -box.min.y * factor, -center.z * factor);
    copy.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    return copy;
  }, [scene, height]);
  return <group position={position} rotation-y={rotation}><primitive object={model} /></group>;
}

export function RoomFurniture({ depth }: { depth: number }) {
  return <>
    <Furniture url={desk.url} height={0.8} position={[-2.4, 0.35, -2.6]} />
    <Furniture url={desk.url} height={0.8} position={[2.4, 0.35, -2.6]} />
    <Furniture url={plant.url} height={1.55} position={[-5.9, 0, -2.7]} />
    <Furniture url={plant.url} height={1.55} position={[5.9, 0, -2.7]} />
    {Array.from({ length: Math.max(2, Math.ceil(depth / 3)) }, (_, i) => <Furniture key={i} url={windowAsset.url} height={2.8} position={[-6.8, 0, -1 + i * 2.8]} rotation={Math.PI / 2} />)}
  </>;
}