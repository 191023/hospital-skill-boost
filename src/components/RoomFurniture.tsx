import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import desk from "@/assets/training-desk.glb.asset.json";
import plant from "@/assets/training-plant.glb.asset.json";
import windowAsset from "@/assets/training-window.glb.asset.json";
import { RoomWallFade } from "./RoomWallFade";

function Furniture({ url, height, position, rotation = 0, frame }: { url: string; height: number; position: [number, number, number]; rotation?: number; frame?: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const copy = scene.clone(true); copy.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(copy); const center = box.getCenter(new THREE.Vector3());
    const factor = height / Math.max(0.01, box.max.y - box.min.y);
    copy.scale.setScalar(factor); copy.position.set(-center.x * factor, -box.min.y * factor, -center.z * factor);
    copy.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; if (frame) { o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach((m) => { if (m instanceof THREE.MeshStandardMaterial) { m.color.set(frame); m.roughness = 0.35; m.metalness = 0.3; } }); } } });
    return copy;
  }, [scene, height, frame]);
  useEffect(() => () => { if (frame) model.traverse((o) => { if (o instanceof THREE.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }); }, [model, frame]);
  return <group position={position} rotation-y={rotation}><primitive object={model} /></group>;
}

export type RoomFinishes = { wall: string; trim: string; window: string; wood: string; fabric: string; carpet: string; panel: string; light: string };

function WallSlats({ color }: { color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 40; i++) { dummy.position.set(-6.45 + i * 0.33, 1.85, -3.84); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[undefined, undefined, 40]} castShadow receiveShadow><boxGeometry args={[0.12, 3.55, 0.08]} /><meshStandardMaterial color={color} roughness={0.65} /></instancedMesh>;
}

export function RoomFurniture({ depth, finishes, reduced }: { depth: number; finishes: RoomFinishes; reduced: boolean }) {
  return <>
    <Furniture url={desk.url} height={0.8} position={[-2.4, 0.35, -2.6]} />
    <Furniture url={desk.url} height={0.8} position={[2.4, 0.35, -2.6]} />
    <Furniture url={plant.url} height={1.55} position={[-5.9, 0, -2.7]} />
    <Furniture url={plant.url} height={1.55} position={[5.9, 0, -2.7]} />
    <RoomWallFade side="front" reduced={reduced}>
    <WallSlats color={finishes.wood} />
    <mesh position={[0, 2.35, -3.71]} castShadow><boxGeometry args={[8.4, 2.3, 0.13]} /><meshStandardMaterial color={finishes.panel} roughness={0.9} /></mesh>
    <mesh position={[0, 3.68, -3.73]}><boxGeometry args={[13.2, 0.055, 0.08]} /><meshStandardMaterial color={finishes.light} emissive={finishes.light} emissiveIntensity={1.4} /></mesh>
    </RoomWallFade>
    <RoomWallFade side="left" reduced={reduced}>
    <mesh position={[-6.68, 0.1, depth / 2 - 2]}><boxGeometry args={[0.08, 0.2, depth + 6.8]} /><meshStandardMaterial color={finishes.trim} metalness={0.5} roughness={0.35} /></mesh>
    {Array.from({ length: Math.max(2, Math.ceil(depth / 3)) }, (_, i) => <group key={i}>
      <mesh position={[-6.73, 1.7, -0.8 + i * 2.8]}><boxGeometry args={[0.025, 2.55, 2.25]} /><meshStandardMaterial color={finishes.window} transparent opacity={0.42} roughness={0.12} metalness={0.15} /></mesh>
      <Furniture url={windowAsset.url} height={2.8} position={[-6.8, 0.4, -0.8 + i * 2.8]} rotation={Math.PI / 2} frame={finishes.trim} />
    </group>)}
    </RoomWallFade>
  </>;
}