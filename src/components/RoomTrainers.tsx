import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import learnerUrl from "@/assets/adult-learner.glb?url";

type TrainerColors = { uniform: string; white: string; dark: string; accent: string };

// Bake the registered character's initial sit-entry pose into a standing figure.
// All cloned materials and baked geometry belong to this presentation only.
function Trainer({ role, x, colors, celebrate, reduced }: { role: "doctor" | "nurse"; x: number; colors: TrainerColors; celebrate: number; reduced: boolean }) {
  const { scene, animations } = useGLTF(learnerUrl);
  const geometry = useMemo(() => {
    const model = clone(scene);
    const mixer = new THREE.AnimationMixer(model);
    const pose = animations.find((clip) => clip.name === "Sitting_Enter");
    if (pose) { mixer.clipAction(pose).play(); mixer.update(0); }
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
        const group = object.geometry.groups.find((g: { start: number; count: number; materialIndex?: number }) => i >= g.start && i < g.start + g.count);
        const material = materials[group?.materialIndex ?? 0];
        let color = material instanceof THREE.MeshStandardMaterial ? material.color : new THREE.Color(colors.white);
        if (material?.name === "skin") color = new THREE.Color("#fedac0");
        if (material?.name === "hair") color = new THREE.Color(role === "doctor" ? "#3e2723" : "#4a3525");
        if (material?.name === "shirt") color = new THREE.Color(role === "doctor" ? "#ffffff" : colors.uniform);
        if (material?.name === "trousers") color = new THREE.Color(role === "doctor" ? "#2b3a4a" : colors.uniform);
        if (material?.name === "shoes") color = new THREE.Color(role === "doctor" ? "#1e293b" : "#f7fafc");
        if (material?.name === "eyes") color = new THREE.Color("#1a202c");
        if (material?.name === "cheeks") color = new THREE.Color("#ff9aa2");
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
  const ref = useRef<THREE.Group>(null);
  const phase = role === "doctor" ? 0 : Math.PI / 2;
  useFrame(({ clock }) => {
    const g = ref.current; if (!g) return;
    const t = clock.getElapsedTime();
    const dancing = !reduced && celebrate > 0 && Date.now() - celebrate < 4500;
    if (reduced) { g.position.y = 0.335; g.rotation.set(0, 0, 0); return; }
    if (dancing) {
      g.position.y = 0.335 + Math.abs(Math.sin(t * 7 + phase)) * 0.16;
      g.rotation.y = Math.sin(t * 3.5 + phase) * 0.6;
      g.rotation.z = Math.sin(t * 7 + phase) * 0.1;
    } else {
      // Gentle continuous groove while presenting.
      g.position.y = 0.335 + Math.abs(Math.sin(t * 2.2 + phase)) * 0.035;
      g.rotation.y = Math.sin(t * 1.1 + phase) * 0.18;
      g.rotation.z = Math.sin(t * 2.2 + phase) * 0.035;
    }
  });
  return <group ref={ref} name={`stage-${role}`} position={[x, 0.335, -2.45]} scale={1.05}>
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.7} /></mesh>
    {/* Clean Hospital Badge flush on chest */}
    <mesh position={[-0.105, 1.31, 0.165]}><boxGeometry args={[0.065, 0.09, 0.012]} /><meshStandardMaterial color="#ffffff" roughness={0.5} /></mesh>
    <mesh position={[-0.105, 1.325, 0.172]}><boxGeometry args={[0.045, 0.022, 0.008]} /><meshStandardMaterial color={colors.accent} roughness={0.5} /></mesh>
  </group>;
}

export function RoomTrainers({ white, dark, doctor, nurse, accent, celebrate = 0, reduced = false }: { white: string; dark: string; doctor: string; nurse: string; accent: string; celebrate?: number; reduced?: boolean }) {
  const doctorColors = useMemo(() => ({ white, dark, uniform: doctor, accent }), [white, dark, doctor, accent]);
  const nurseColors = useMemo(() => ({ white, dark, uniform: nurse, accent }), [white, dark, nurse, accent]);
  return <><Trainer role="doctor" x={-0.95} colors={doctorColors} celebrate={celebrate} reduced={reduced} /><Trainer role="nurse" x={0.95} colors={nurseColors} celebrate={celebrate} reduced={reduced} /></>;
}