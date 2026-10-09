import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import learner from "@/assets/adult-learner.glb.asset.json";

type TrainerColors = { uniform: string; white: string; dark: string; accent: string };

// Bake the registered character's relaxed walking pose into a standing figure.
// All cloned materials and baked geometry belong to this presentation only.
function Trainer({ role, x, colors }: { role: "doctor" | "nurse"; x: number; colors: TrainerColors }) {
  const { scene, animations } = useGLTF(learner.url);
  const geometry = useMemo(() => {
    const model = clone(scene);
    const mixer = new THREE.AnimationMixer(model);
    const pose = animations.find((clip) => clip.name === "Walk_Loop");
    if (pose) { mixer.clipAction(pose).play(); mixer.update(0.04); }
    model.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const part = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      const positions = part.getAttribute("position");
      const source = object.geometry.getAttribute("position");
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const vertex = new THREE.Vector3();
      const paint = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        const index = object.geometry.index?.getX(i) ?? i;
        vertex.fromBufferAttribute(source, index);
        if (object instanceof THREE.SkinnedMesh) object.applyBoneTransform(index, vertex);
        vertex.applyMatrix4(object.matrixWorld);
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        const group = object.geometry.groups.find((g) => i >= g.start && i < g.start + g.count);
        const material = materials[group?.materialIndex ?? 0];
        let color = material instanceof THREE.MeshStandardMaterial ? material.color : new THREE.Color(colors.white);
        if (material?.name === "shirt") color = new THREE.Color(role === "doctor" ? colors.white : colors.uniform);
        if (material?.name === "trousers") color = new THREE.Color(colors.uniform);
        paint.set([color.r, color.g, color.b], i * 3);
      }
      for (const attribute of Object.keys(part.attributes)) if (attribute !== "position") part.deleteAttribute(attribute);
      part.setAttribute("color", new THREE.BufferAttribute(paint, 3));
      part.computeVertexNormals(); parts.push(part);
    });
    const merged = mergeGeometries(parts) ?? new THREE.BufferGeometry();
    parts.forEach((part) => part.dispose()); mixer.stopAllAction(); mixer.uncacheRoot(model);
    merged.computeBoundingBox();
    if (merged.boundingBox) merged.translate(0, -merged.boundingBox.min.y, 0);
    return merged;
  }, [scene, animations, role, colors]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const stethoscope = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.105, 1.49, 0.13), new THREE.Vector3(-0.15, 1.32, 0.17),
    new THREE.Vector3(-0.08, 1.17, 0.185), new THREE.Vector3(0.06, 1.19, 0.185),
    new THREE.Vector3(0.115, 1.32, 0.17), new THREE.Vector3(0.085, 1.49, 0.13),
  ]), []);
  return <group name={`stage-${role}`} position={[x, 0.335, -2.45]} scale={1.05}>
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.8} /></mesh>
    {role === "doctor" ? <>
      {/* Coat hem, lapels and stethoscope identify an illustrative doctor. */}
      <mesh position={[0, 0.99, 0]} castShadow><cylinderGeometry args={[0.195, 0.235, 0.35, 12]} /><meshStandardMaterial color={colors.white} roughness={0.85} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.065, 1.38, 0.147]} rotation-z={side * -0.24}><boxGeometry args={[0.065, 0.24, 0.018]} /><meshStandardMaterial color={colors.white} /></mesh>)}
      <mesh><tubeGeometry args={[stethoscope, 20, 0.012, 6, false]} /><meshStandardMaterial color={colors.dark} roughness={0.5} /></mesh>
      <mesh position={[0.06, 1.19, 0.2]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.034, 0.034, 0.018, 12]} /><meshStandardMaterial color={colors.accent} metalness={0.55} roughness={0.3} /></mesh>
    </> : <>
      <mesh position={[0, 1.92, 0]} castShadow><cylinderGeometry args={[0.125, 0.15, 0.1, 16]} /><meshStandardMaterial color={colors.white} roughness={0.85} /></mesh>
      <mesh position={[0, 1.92, 0.14]}><boxGeometry args={[0.12, 0.028, 0.012]} /><meshStandardMaterial color={colors.uniform} /></mesh>
      <mesh position={[0, 1.45, 0.133]} rotation-z={Math.PI / 4}><boxGeometry args={[0.08, 0.08, 0.016]} /><meshStandardMaterial color={colors.dark} /></mesh>
    </>}
    <mesh position={[-0.105, 1.31, 0.165]}><boxGeometry args={[0.07, 0.1, 0.012]} /><meshStandardMaterial color={colors.white} /></mesh>
    <mesh position={[-0.105, 1.325, 0.174]}><boxGeometry args={[0.045, 0.025, 0.008]} /><meshStandardMaterial color={colors.accent} /></mesh>
  </group>;
}

export function RoomTrainers({ white, dark, doctor, nurse, accent }: { white: string; dark: string; doctor: string; nurse: string; accent: string }) {
  const doctorColors = useMemo(() => ({ white, dark, uniform: doctor, accent }), [white, dark, doctor, accent]);
  const nurseColors = useMemo(() => ({ white, dark, uniform: nurse, accent }), [white, dark, nurse, accent]);
  return <><Trainer role="doctor" x={-0.95} colors={doctorColors} /><Trainer role="nurse" x={0.95} colors={nurseColors} /></>;
}