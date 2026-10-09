import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import humanAsset from "@/assets/cartoon-attendee-final.glb.asset.json";
import { arrivalPath, type RoomSeat } from "@/lib/training-room";

type PersonProps = { seat: RoomSeat; geometry: THREE.BufferGeometry; scene: THREE.Group; animations: THREE.AnimationClip[]; color: string; pulse: number; delay: number; back: number; reduced: boolean; onSelect: (index: number) => void };

function Person({ seat, geometry, scene, animations, color, pulse, delay, back, reduced, onSelect }: PersonProps) {
  const group = useRef<THREE.Group>(null);
  const seated = useRef<THREE.Mesh>(null);
  const elapsed = useRef(1000);
  const moving = useRef(false);
  const { model, mixer, walk, sit, material } = useMemo(() => {
    const model = clone(scene);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    model.traverse((o) => { if (o instanceof THREE.Mesh) { o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); o.castShadow = true; } });
    const mixer = new THREE.AnimationMixer(model);
    const walkClip = animations.find((a) => a.name === "Walk_Loop");
    const sitClip = animations.find((a) => a.name === "Sitting_Idle_Loop");
    return { model, material, mixer, walk: walkClip ? mixer.clipAction(walkClip) : null, sit: sitClip ? mixer.clipAction(sitClip) : null };
  }, [scene, animations]);
  useEffect(() => { material.color.set(color).lerp(new THREE.Color("white"), 0.92); }, [material, color]);
  // Strict Mode replays effects using the same memoized actions; uncacheRoot would invalidate them.
  useEffect(() => () => { mixer.stopAllAction(); material.dispose(); }, [mixer, material]);
  const path = useMemo(() => arrivalPath(seat, back).map(([x, z]) => new THREE.Vector3(x, 0, z)), [seat.x, seat.z, back]);
  const lengths = useMemo(() => path.slice(1).map((p, i) => { const from = path[i]; return from ? p.distanceTo(from) : 0; }), [path]);
  const speed = 1.65;
  const travelTime = lengths.reduce((a, b) => a + b, 0) / speed;
  useEffect(() => {
    if (!pulse || reduced || Date.now() - pulse > 4000) return;
    elapsed.current = -delay - 0.9;
    moving.current = true;
    sit?.stop(); walk?.reset().fadeIn(0.35).play();
    if (walk) walk.timeScale = 0.9;
  }, [pulse, reduced, delay, sit, walk]);
  useFrame((_, rawDelta) => {
    const g = group.current; const still = seated.current;
    if (!g || !still) return;
    if (reduced) moving.current = false;
    still.visible = !moving.current;
    g.visible = moving.current && elapsed.current >= 0;
    if (!moving.current) return;
    elapsed.current += Math.min(rawDelta, 0.05);
    const t = elapsed.current;
    if (t < 0) return;
    mixer.update(Math.min(rawDelta, 0.05));
    if (t < travelTime) {
      let distance = t * speed;
      for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i]; const from = path[i]; const to = path[i + 1];
        if (length == null || !from || !to) continue;
        if (distance <= length || i === lengths.length - 1) {
          g.position.copy(from).lerp(to, Math.min(1, distance / (length || 1)));
          const yaw = Math.atan2(to.x - from.x, to.z - from.z);
          const diff = Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y));
          g.rotation.y += diff * (1 - Math.exp(-9 * Math.min(rawDelta, 0.05)));
          break;
        }
        distance -= length;
      }
    } else {
      if (sit && !sit.isRunning()) { sit.reset().play(); walk?.crossFadeTo(sit, 0.5, false); }
      const p = Math.min(1, (t - travelTime) / 0.95);
      g.position.set(seat.x, 0, seat.z - 0.22 * (1 - p));
      const diff = Math.atan2(Math.sin(Math.PI - g.rotation.y), Math.cos(Math.PI - g.rotation.y));
      g.rotation.y += diff * (1 - Math.exp(-9 * Math.min(rawDelta, 0.05)));
      if (p === 1) { moving.current = false; still.visible = true; g.visible = false; }
    }
  });
  return <group onClick={(e) => { e.stopPropagation(); onSelect(seat.index); }}>
    <mesh ref={seated} geometry={geometry} position={[seat.x, 0, seat.z]} material={material} castShadow />
    <group ref={group} visible={false} scale={0.92}><primitive object={model} /></group>
  </group>;
}

export function RoomPeople({ seats, pulseMap, reduced, color, fadedColor, highlighted, onSelect }: { seats: RoomSeat[]; pulseMap: Record<string, number>; reduced: boolean; color: string; fadedColor: string; highlighted: Set<string>; onSelect: (index: number) => void }) {
  const { scene, animations } = useGLTF(humanAsset.url);
  const geometry = useMemo(() => {
    const model = clone(scene); const mixer = new THREE.AnimationMixer(model);
    const clip = animations.find((a) => a.name === "Sitting_Idle_Loop");
    if (clip) { mixer.clipAction(clip).play(); mixer.update(0.01); }
    model.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      const source = o.geometry.getAttribute("position");
      const original = new THREE.Vector3();
      const positions = g.getAttribute("position");
      const index = o.geometry.index;
      for (let i = 0; i < positions.count; i++) {
        const vertexIndex = index ? index.getX(i) : i;
        original.fromBufferAttribute(source, vertexIndex);
        if (o instanceof THREE.SkinnedMesh) o.applyBoneTransform(vertexIndex, original);
        original.applyMatrix4(o.matrixWorld);
        positions.setXYZ(i, original.x, original.y, original.z);
      }
      const colors = new Float32Array(positions.count * 3);
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < positions.count; i++) {
        const part = o.geometry.groups.find((group) => i >= group.start && i < group.start + group.count);
        const m = materials[part?.materialIndex ?? 0];
        const c = m instanceof THREE.MeshStandardMaterial ? m.color : new THREE.Color(1, 1, 1);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      for (const key of Object.keys(g.attributes)) if (key !== "position") g.deleteAttribute(key);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      g.computeVertexNormals();
      parts.push(g);
    });
    const merged = mergeGeometries(parts) ?? new THREE.BufferGeometry();
    parts.forEach((g) => g.dispose()); mixer.stopAllAction(); mixer.uncacheRoot(model);
    merged.scale(0.92, 0.92, 0.92); merged.rotateY(Math.PI);
    return merged;
  }, [scene, animations]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const back = Math.max(0, ...seats.map((s) => s.z));
  const arrivals = seats.filter((s) => s.attendee && (pulseMap[s.attendee.userId] ?? 0) > 0);
  return <>{seats.filter((s) => s.attendee?.checkedAt).map((seat) => <Person key={seat.attendee?.userId} seat={seat} geometry={geometry} scene={scene} animations={animations} color={seat.attendee && highlighted.has(seat.attendee.userId) ? color : fadedColor} pulse={seat.attendee ? pulseMap[seat.attendee.userId] ?? 0 : 0} delay={Math.max(0, arrivals.indexOf(seat)) * 0.35} back={back} reduced={reduced} onSelect={onSelect} />)}</>;
}