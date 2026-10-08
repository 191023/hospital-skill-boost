import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RoomSeat } from "@/lib/training-room";

type Palette = { background: string; floor: string; line: string; checked: string; waiting: string; empty: string; selected: string; white: string };
type Props = { seats: RoomSeat[]; selected: number | null; onSelect: (index: number) => void; highlighted: Set<string>; view: "angle" | "top"; zoom: number };

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
  return { background: color("--room-background"), floor: color("--room-floor"), line: color("--room-grid"), checked: color("--mint"), waiting: color("--amber"), empty: color("--room-empty"), selected: color("--primary"), white: color("--card") };
}

function SeatLabel({ seat, selected, palette, onSelect }: { seat: RoomSeat; selected: boolean; palette: Palette; onSelect: (index: number) => void }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.fillStyle = selected ? palette.selected : palette.white; ctx.fillRect(0, 0, 128, 64); ctx.fillStyle = selected ? palette.white : palette.selected; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(seat.label, 64, 34); }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [seat.label, selected, palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[seat.x, 1.5, seat.z]} scale={[0.65, 0.325, 1]} onClick={(e) => { e.stopPropagation(); onSelect(seat.index); }}><spriteMaterial map={texture} depthTest={false} /></sprite>;
}

function Seating({ seats, selected, onSelect, highlighted, palette, reduced }: Props & { palette: Palette; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const scales = useRef<number[]>([]);
  const heights = useRef<number[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    // Sculpted seating glyph: a rounded cushion and curved-looking back, not a physical seat assignment.
    const parts = [
      new RoundedBoxGeometry(0.88, 0.22, 0.83, 3, 0.1).translate(0, 0.5, 0),
      new RoundedBoxGeometry(0.88, 0.77, 0.22, 3, 0.1).translate(0, 0.91, 0.32),
      new RoundedBoxGeometry(0.58, 0.36, 0.56, 2, 0.08).translate(0, 0.23, 0),
    ];
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return merged;
  }, []);
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
      const target = active ? 1.09 : 1;
      scales.current[i] = reduced ? target : THREE.MathUtils.lerp(scales.current[i] ?? 0.01, target, 1 - Math.exp(-7 * dt));
      heights.current[i] = reduced ? (active ? 0.16 : 0) : THREE.MathUtils.lerp(heights.current[i] ?? 0, active ? 0.16 : 0, 1 - Math.exp(-10 * dt));
      dummy.position.set(seat.x, heights.current[i], seat.z);
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
    {seats.map((seat) => <SeatLabel key={seat.index} seat={seat} selected={selected === seat.index} palette={palette} onSelect={onSelect} />)}
  </>;
}

function Room({ palette, ...props }: Props & { palette: Palette; reduced: boolean }) {
  const { camera, size } = useThree();
  const depth = Math.max(2, Math.ceil(props.seats.length / 8)) * 1.5;
  const center = depth / 2 - 1.6;
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.position.set(props.view === "top" ? 0 : 10, props.view === "top" ? 20 : 14, props.view === "top" ? center + 0.01 : center + 15);
    camera.lookAt(0, 0, center);
    camera.zoom = Math.min(size.width / 14, size.height / (depth + 5)) * props.zoom;
    camera.updateProjectionMatrix();
  }, [camera, size, depth, center, props.view, props.zoom]);
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
    <mesh position={[0, 0.16, -2.6]} receiveShadow castShadow><boxGeometry args={[9.8, 0.35, 1.8]} /><meshStandardMaterial color={palette.white} roughness={0.4} /></mesh>
    <mesh position={[0, 0.35, -1.72]}><boxGeometry args={[9.8, 0.08, 0.06]} /><meshStandardMaterial color={palette.selected} /></mesh>
    <Seating {...props} palette={palette} />
  </>;
}

export default function TrainingRoomScene(props: Props) {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setPalette(readPalette());
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update); return () => query.removeEventListener("change", update);
  }, []);
  if (!palette) return null;
  return <Canvas orthographic shadows dpr={1} camera={{ position: [10, 14, 15], near: 0.1, far: 200 }} gl={{ antialias: true }}>
    <Room {...props} palette={palette} reduced={reduced} />
  </Canvas>;
}