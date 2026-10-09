import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { roomDivisionTokens, type RoomSeat } from "@/lib/training-room";
import chairAsset from "@/assets/training-chair.asset.json";
import { RoomPeople } from "./RoomPeople";
import { RoomFurniture } from "./RoomFurniture";

type Palette = { background: string; floor: string; line: string; checked: string; waiting: string; empty: string; selected: string; white: string; foreground: string; shirts: Record<string, string> };
export type RoomStats = { registered: number; checked: number; waiting: number; free: number | string };
export type RoomFocus = { index: number; n: number } | null;
type Props = {
  seats: RoomSeat[]; selected: number | null; onSelect: (index: number) => void; highlighted: Set<string>;
  view: "angle" | "top"; zoom: number; roomName: string; date: string; round: string; courseTitle: string;
  kiosk: boolean; walk: boolean; focus: RoomFocus; pulseMap: Record<string, number>;
  stats: RoomStats; updatedLabel: string;
};

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  // Canvas resolves modern CSS colors to sRGB for Three's material parser.
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const color = (token: string) => {
    if (!ctx) return "";
    ctx.fillStyle = css.getPropertyValue(token).trim();
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r},${g},${b})`;
  };
  return { background: color("--room-background"), floor: color("--room-floor"), line: color("--room-grid"), checked: color("--mint"), waiting: color("--amber"), empty: color("--room-empty"), selected: color("--primary"), white: color("--card"), foreground: color("--foreground"), shirts: Object.fromEntries(Object.entries(roomDivisionTokens).map(([division, token]) => [division, color(token)])) };
}

function SessionSign({ palette, roomName, date, round, courseTitle }: Props & { palette: Palette }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1536; canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = palette.white; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = palette.selected; ctx.fillRect(0, 0, 20, canvas.height);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = 'bold 66px "IBM Plex Sans Thai", sans-serif'; ctx.fillText(roomName, 768, 80, 1440);
      ctx.font = '48px "IBM Plex Sans Thai", sans-serif'; ctx.fillText(`${round} · ${date}`, 768, 168, 1440);
      ctx.font = '42px "IBM Plex Sans Thai", sans-serif'; ctx.fillText(courseTitle, 768, 252, 1440);
      ctx.font = '30px "IBM Plex Sans Thai", sans-serif'; ctx.fillText("โรงพยาบาลโอเวอร์บรุ๊ค", 768, 326);
    }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [palette, roomName, date, round, courseTitle]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, 3.1, -3.2]} scale={[8.8, 2.2, 1]}><spriteMaterial map={texture} depthTest={false} toneMapped={false} /></sprite>;
}

function StatsBoard({ palette, stats, updatedLabel, z }: { palette: Palette; stats: RoomStats; updatedLabel: string; z: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = palette.white;
      ctx.beginPath(); ctx.roundRect(0, 0, 512, 300, 26); ctx.fill();
      ctx.textBaseline = "middle";
      ctx.fillStyle = palette.selected; ctx.font = 'bold 36px "IBM Plex Sans Thai", sans-serif'; ctx.textAlign = "left";
      ctx.fillText("สรุปรอบนี้", 40, 54);
      const rows: [string, string, string][] = [
        ["ลงทะเบียน", String(stats.registered), palette.selected],
        ["เช็คชื่อแล้ว", String(stats.checked), palette.checked],
        ["รอเช็คชื่อ", String(stats.waiting), palette.waiting],
        ["ที่นั่งว่าง", String(stats.free), palette.line],
      ];
      rows.forEach(([label, value, dot], i) => {
        const y = 128 + i * 44;
        ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(52, y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = palette.selected; ctx.font = '30px "IBM Plex Sans Thai", sans-serif'; ctx.textAlign = "left";
        ctx.fillText(label, 78, y, 280);
        ctx.textAlign = "right"; ctx.font = 'bold 32px "IBM Plex Sans Thai", sans-serif';
        ctx.fillText(value, 472, y, 140);
      });
      if (updatedLabel) {
        ctx.fillStyle = palette.line; ctx.font = '24px "IBM Plex Sans Thai", sans-serif'; ctx.textAlign = "right";
        ctx.fillText(updatedLabel, 472, 282, 420);
      }
    }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [palette, stats, updatedLabel]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[6.9, 2.9, z]} scale={[3.2, 1.9, 1]}><spriteMaterial map={texture} depthTest={false} toneMapped={false} /></sprite>;
}

function PulseRing({ x, z, color, onDone }: { x: number; z: number; color: string; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    t.current += Math.min(rawDelta, 0.05);
    const p = t.current / 1.6;
    if (p >= 1) { onDone(); return; }
    const s = 0.4 + p * 1.9;
    mesh.scale.set(s, s, s);
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - p);
  });
  return <mesh ref={ref} rotation-x={-Math.PI / 2} position={[x, 0.06, z]}>
    <ringGeometry args={[0.52, 0.68, 40]} />
    <meshBasicMaterial color={color} transparent depthWrite={false} />
  </mesh>;
}

function Pulses({ seats, pulseMap, palette }: { seats: RoomSeat[]; pulseMap: Record<string, number>; palette: Palette }) {
  const [active, setActive] = useState<{ key: string; x: number; z: number }[]>([]);
  useEffect(() => {
    const now = Date.now();
    setActive((cur) => {
      const keys = new Set(cur.map((a) => a.key));
      const add = Object.entries(pulseMap)
        .filter(([uid, ts]) => now - ts < 3000 && !keys.has(uid))
        .map(([uid]) => {
          const seat = seats.find((s) => s.attendee?.userId === uid);
          return seat ? { key: uid, x: seat.x, z: seat.z } : null;
        })
        .filter((p): p is { key: string; x: number; z: number } => p !== null);
      return add.length ? [...cur, ...add] : cur;
    });
  }, [pulseMap, seats]);
  return <>{active.map((p) => <PulseRing key={p.key} x={p.x} z={p.z} color={palette.checked} onDone={() => setActive((cur) => cur.filter((a) => a.key !== p.key))} />)}</>;
}

function Seating({ seats, selected, onSelect, highlighted, palette, reduced, pulseMap }: Props & { palette: Palette; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const scales = useRef<number[]>([]);
  const heights = useRef<number[]>([]);
  const bounces = useRef(new Map<string, { pulse: number; t: number }>());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { scene } = useGLTF(chairAsset.url);
  const geometry = useMemo(() => {
    const source = scene.clone(true); source.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    source.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const g = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      g.applyMatrix4(object.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      parts.push(g);
    });
    if (!parts.length) return null;
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (merged) {
      merged.computeBoundingBox();
      const box = merged.boundingBox;
      if (box) {
        const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
        merged.translate(-center.x, -box.min.y, -center.z);
        const scale = 1.2 / (size.y || 1); merged.scale(scale, scale, scale);
        merged.rotateY(Math.PI);
      }
    }
    return merged;
  }, [scene]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const seatKey = seats.map((s) => s.index).join(",");
  useEffect(() => {
    scales.current = Array.from({ length: seats.length }, () => reduced ? 1 : 0.85);
    heights.current = seats.map(() => 0);
  }, [seatKey, reduced]);
  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05);
    seats.forEach((seat, i) => {
      const active = selected === seat.index || hovered === seat.index;
      const visible = !seat.attendee || highlighted.has(seat.attendee.userId);
      const target = 1;
      scales.current[i] = reduced ? target : THREE.MathUtils.lerp(scales.current[i] ?? 0.01, target, 1 - Math.exp(-7 * dt));
      heights.current[i] = 0;
      const uid = seat.attendee?.userId;
      const pulse = uid ? pulseMap[uid] : 0;
      let bounce = uid ? bounces.current.get(uid) : undefined;
      if (uid && pulse && bounce?.pulse !== pulse && Date.now() - pulse < 4000) {
        bounce = { pulse, t: 0 }; bounces.current.set(uid, bounce);
      }
      if (bounce) bounce.t += dt;
      const lift = !reduced && bounce && bounce.t < 0.8 ? Math.sin(bounce.t / 0.8 * Math.PI) * 0.18 : 0;
      dummy.position.set(seat.x, heights.current[i] + lift, seat.z);
      dummy.scale.setScalar(scales.current[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const color = new THREE.Color(active ? palette.selected : seat.attendee ? (seat.attendee.checkedAt ? palette.checked : palette.waiting) : palette.empty);
      if (!visible) color.lerp(new THREE.Color(palette.floor), 0.8);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const seat = e.instanceId == null ? null : seats[e.instanceId];
    if (seat) onSelect(seat.index);
  };
  if (!geometry) return null;
  return <>
    <instancedMesh ref={ref} args={[geometry, undefined, seats.length]} castShadow receiveShadow onClick={pick}
      onPointerMove={(e) => { const seat = e.instanceId == null ? null : seats[e.instanceId]; setHovered(seat?.index ?? null); }} onPointerOut={() => setHovered(null)}>
      <meshStandardMaterial roughness={0.36} metalness={0.08} />
    </instancedMesh>

  </>;
}

function Room({ palette, reduced, ...props }: Props & { palette: Palette; reduced: boolean }) {
  const { camera, size } = useThree();
  const depth = Math.max(3, ...props.seats.map((seat) => seat.z + 1.8));
  const center = depth / 2 - 2;
  const orbit = useRef(0);
  const look = useRef(new THREE.Vector3(0, 0, center));
  const desired = useRef({ p: new THREE.Vector3(10, 14, center + 15), l: new THREE.Vector3(0, 0, center), zoom: 1 });
  const baseZoom = Math.min(size.width / 14.5, size.height / (depth + 8)) * props.zoom;

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera) || props.walk || props.kiosk) return;
    const focusIndex = props.focus?.index;
    const focusSeat = focusIndex == null ? null : props.seats.find((s) => s.index === focusIndex);
    if (focusSeat) {
      desired.current = { p: new THREE.Vector3(focusSeat.x * 0.5, 9, focusSeat.z + 7), l: new THREE.Vector3(focusSeat.x, 0.9, focusSeat.z), zoom: baseZoom * 2.1 };
    } else if (props.view === "top") {
      desired.current = { p: new THREE.Vector3(0, 20, center + 0.01), l: new THREE.Vector3(0, 0, center), zoom: baseZoom };
    } else {
      desired.current = { p: new THREE.Vector3(10, 14, center + 15), l: new THREE.Vector3(0, 0, center), zoom: baseZoom };
    }
  }, [camera, size, depth, center, props.view, props.zoom, props.focus, props.walk, props.kiosk, props.seats, baseZoom]);

  useFrame((_, rawDelta) => {
    if (props.walk || !(camera instanceof THREE.OrthographicCamera)) return;
    const dt = Math.min(rawDelta, 0.05);
    let target = desired.current;
    if (props.kiosk && !reduced) {
      orbit.current += dt * 0.22;
      const a = orbit.current;
      target = { p: new THREE.Vector3(Math.sin(a) * 15, 11, center + Math.cos(a) * 13), l: new THREE.Vector3(0, 0.6, center), zoom: baseZoom };
    }
    const k = reduced ? 1 : 1 - Math.exp(-3.5 * dt);
    camera.position.lerp(target.p, k);
    look.current.lerp(target.l, k);
    camera.lookAt(look.current);
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, target.zoom, k);
    camera.updateProjectionMatrix();
  });

  const texture = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = palette.floor; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = palette.line; ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 128, 128);
      for (let i = 0; i < 96; i++) { ctx.globalAlpha = 0.22; ctx.fillRect((i * 43) % 128, (i * 71) % 128, 1, 1); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, depth + 5); return t;
  }, [palette, depth]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <>
    <color attach="background" args={[palette.background]} />
    <ambientLight intensity={0.9} />
    <directionalLight position={[-5, 14, 8]} intensity={2.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-0.001} />
    <Environment resolution={64}>
      <Lightformer intensity={2} position={[0, 8, 0]} rotation-x={-Math.PI / 2} scale={[15, 15, 1]} />
      <Lightformer intensity={1} color={palette.checked} position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 5, 1]} />
    </Environment>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, center]} receiveShadow><planeGeometry args={[80, 80]} /><meshStandardMaterial map={texture} roughness={0.8} /></mesh>
    <mesh position={[0, -0.12, center]} receiveShadow><boxGeometry args={[13.8, 0.2, depth + 7]} /><meshStandardMaterial color={palette.line} roughness={0.7} /></mesh>
    <mesh position={[0, 1.9, -4]} receiveShadow><boxGeometry args={[13.8, 3.8, 0.18]} /><meshStandardMaterial map={texture} color={palette.white} roughness={0.85} /></mesh>
    <mesh position={[-6.8, 0.45, center]} receiveShadow><boxGeometry args={[0.15, 0.9, depth + 7]} /><meshStandardMaterial color={palette.white} roughness={0.7} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, center + 1]}><planeGeometry args={[0.75, depth + 1]} /><meshStandardMaterial color={palette.selected} roughness={0.9} /></mesh>
    <mesh position={[0, 0.16, -2.6]} receiveShadow castShadow><boxGeometry args={[9.8, 0.35, 1.8]} /><meshStandardMaterial color={palette.white} roughness={0.4} /></mesh>
    <mesh position={[0, 0.35, -1.72]}><boxGeometry args={[9.8, 0.08, 0.06]} /><meshStandardMaterial color={palette.selected} /></mesh>
    <SessionSign {...props} palette={palette} />
    <StatsBoard palette={palette} stats={props.stats} updatedLabel={props.updatedLabel} z={center} />
    {!reduced && <Pulses seats={props.seats} pulseMap={props.pulseMap} palette={palette} />}
    <Suspense fallback={null}>
      <RoomFurniture depth={depth} />
      <Seating {...props} palette={palette} reduced={reduced} />
      <RoomPeople seats={props.seats} pulseMap={props.pulseMap} reduced={reduced} color={palette.selected} fadedColor={palette.empty} highlighted={props.highlighted} onSelect={props.onSelect} shirts={palette.shirts} labelBackground={palette.white} labelForeground={palette.foreground} />
    </Suspense>
    {props.walk && <OrbitControls target={[0, 0.6, center]} enableDamping dampingFactor={0.08} minZoom={Math.max(0.4, baseZoom * 0.5)} maxZoom={baseZoom * 3.5} />}
  </>;
}

export default function TrainingRoomScene(props: Props) {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    document.fonts.load('600 26px "IBM Plex Sans Thai"')
      .catch(() => undefined).then(() => { if (!cancelled) setPalette(readPalette()); });
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update); return () => { cancelled = true; query.removeEventListener("change", update); };
  }, []);
  if (!palette) return null;
  return <Canvas orthographic shadows dpr={1} camera={{ position: [10, 14, 15], near: 0.1, far: 200 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
    <Room {...props} palette={palette} reduced={reduced} />
  </Canvas>;
}
