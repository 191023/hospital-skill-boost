import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import humanAsset from "@/assets/cartoon-attendee-final.glb.asset.json";
import { arrivalPath, roomFirstName, type RoomSeat } from "@/lib/training-room";

type PersonProps = { seat: RoomSeat; geometry: THREE.BufferGeometry; shirtGroups: number[]; scene: THREE.Group; animations: THREE.AnimationClip[]; color: string; faded: boolean; pulse: number; delay: number; back: number; reduced: boolean; onSelect: (index: number) => void };

// The front of the room is -Z. Use the same landing position for both poses.
const PERSON_SCALE = 0.8955;
const SEATED_FORWARD = -0.2906;
const SEATED_HEIGHT = 0;

function NameLabel({ seat, background, foreground, accent, faded, onSelect }: { seat: RoomSeat; background: string; foreground: string; accent: string; faded: boolean; onSelect: (index: number) => void }) {
  const name = roomFirstName(seat.attendee?.name ?? "");
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = background; ctx.beginPath(); ctx.roundRect(4, 4, 504, 120, 18); ctx.fill();
      ctx.fillStyle = accent; ctx.fillRect(20, 28, 9, 72);
      ctx.fillStyle = foreground; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let size = 58;
      while (size > 26) { ctx.font = `600 ${size}px "IBM Plex Sans Thai", sans-serif`; if (ctx.measureText(name).width <= 440) break; size -= 2; }
      ctx.fillText(name, 268, 64, 440);
    }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [name, background, foreground, accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[seat.x, 1.72, seat.z]} scale={[1.22, 0.305, 1]} onClick={(e) => { e.stopPropagation(); onSelect(seat.index); }}>
    <spriteMaterial map={texture} transparent opacity={faded ? 0.3 : 1} depthWrite={false} toneMapped={false} />
  </sprite>;
}

function Person({ seat, geometry, shirtGroups, scene, animations, color, faded, pulse, delay, back, reduced, onSelect }: PersonProps) {
  const group = useRef<THREE.Group>(null);
  const seated = useRef<THREE.Mesh>(null);
  const elapsed = useRef(1000);
  const moving = useRef(false);
  const { model, mixer, walk, sit, material } = useMemo(() => {
    const model = clone(scene);
    const base = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const shirt = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const material = (geometry.groups.length ? geometry.groups : [{ materialIndex: 0 }]).map((_, i) => shirtGroups.includes(i) ? shirt : base);
    model.traverse((o) => { if (o instanceof THREE.Mesh) { o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); o.castShadow = true; } });
    const mixer = new THREE.AnimationMixer(model);
    const walkClip = animations.find((a) => a.name === "Walk_Loop");
    const sitClip = animations.find((a) => a.name === "Sitting_Idle_Loop");
    return { model, material, mixer, walk: walkClip ? mixer.clipAction(walkClip) : null, sit: sitClip ? mixer.clipAction(sitClip) : null };
  }, [scene, animations, geometry, shirtGroups]);
  useEffect(() => {
    material.forEach((m) => { if (!m.vertexColors) m.color.set(color); m.transparent = faded; m.opacity = faded ? 0.3 : 1; });
    model.traverse((o) => { if (!(o instanceof THREE.Mesh)) return; const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach((m) => { if (!(m instanceof THREE.MeshStandardMaterial)) return; if (m.name === "shirt") m.color.set(color); m.transparent = faded; m.opacity = faded ? 0.3 : 1; }); });
  }, [material, model, color, faded]);
  // Strict Mode replays effects using the same memoized actions; uncacheRoot would invalidate them.
  useEffect(() => () => { mixer.stopAllAction(); new Set(material).forEach((m) => m.dispose()); model.traverse((o) => { if (o instanceof THREE.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }); }, [mixer, material, model]);
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
      g.position.set(seat.x, SEATED_HEIGHT * p, seat.z - 0.22 * (1 - p) + SEATED_FORWARD * p);
      const diff = Math.atan2(Math.sin(Math.PI - g.rotation.y), Math.cos(Math.PI - g.rotation.y));
      g.rotation.y += diff * (1 - Math.exp(-9 * Math.min(rawDelta, 0.05)));
      if (p === 1) { moving.current = false; still.visible = true; g.visible = false; }
    }
  });
  return <group onClick={(e) => { e.stopPropagation(); onSelect(seat.index); }}>
    <mesh ref={seated} geometry={geometry} position={[seat.x, SEATED_HEIGHT, seat.z + SEATED_FORWARD]} material={material} castShadow />
    <group ref={group} visible={false} scale={PERSON_SCALE}><primitive object={model} /></group>
  </group>;
}

export function RoomPeople({ seats, pulseMap, reduced, color, highlighted, onSelect, shirts, labelBackground, labelForeground }: { seats: RoomSeat[]; pulseMap: Record<string, number>; reduced: boolean; color: string; fadedColor: string; highlighted: Set<string>; onSelect: (index: number) => void; shirts: Record<string, string>; labelBackground: string; labelForeground: string }) {
  const { scene, animations } = useGLTF(humanAsset.url);
  const { geometry, shirtGroups } = useMemo(() => {
    const model = clone(scene); const mixer = new THREE.AnimationMixer(model);
    const clip = animations.find((a) => a.name === "Sitting_Idle_Loop");
    if (clip) { mixer.clipAction(clip).play(); mixer.update(0.01); }
    model.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    const shirtGroups: number[] = [];
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
        const part = o.geometry.groups.find((group: { start: number; count: number; materialIndex?: number }) => i >= group.start && i < group.start + group.count);
        const m = materials[part?.materialIndex ?? 0];
        const c = m instanceof THREE.MeshStandardMaterial ? m.color : new THREE.Color(1, 1, 1);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      for (const key of Object.keys(g.attributes)) if (key !== "position") g.deleteAttribute(key);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      g.computeVertexNormals();
      if (materials.some((m) => m.name === "shirt")) shirtGroups.push(parts.length);
      parts.push(g);
    });
    const merged = mergeGeometries(parts, true) ?? new THREE.BufferGeometry();
    parts.forEach((g) => g.dispose()); mixer.stopAllAction(); mixer.uncacheRoot(model);
    merged.scale(PERSON_SCALE, PERSON_SCALE, PERSON_SCALE); merged.rotateY(Math.PI);
    return { geometry: merged, shirtGroups };
  }, [scene, animations]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const back = Math.max(0, ...seats.map((s) => s.z));
  const arrivals = seats.filter((s) => s.attendee && (pulseMap[s.attendee.userId] ?? 0) > 0);
  return <>{seats.filter((s) => s.attendee).map((seat) => {
    const person = seat.attendee; if (!person) return null;
    const shirt = shirts[person.division] ?? color;
    const faded = !highlighted.has(person.userId);
    return <group key={person.userId}>
      {person.checkedAt && <Person seat={seat} geometry={geometry} shirtGroups={shirtGroups} scene={scene} animations={animations} color={shirt} faded={faded} pulse={pulseMap[person.userId] ?? 0} delay={Math.max(0, arrivals.indexOf(seat)) * 0.35} back={back} reduced={reduced} onSelect={onSelect} />}
      <NameLabel seat={seat} background={labelBackground} foreground={labelForeground} accent={shirt} faded={faded} onSelect={onSelect} />
    </group>;
  })}</>;
}