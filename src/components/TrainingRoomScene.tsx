import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { attendeeSymbol, type RoomSeat } from "@/lib/training-room";
import chairAsset from "@/assets/training-chair.asset.json";

type Palette = { background: string; floor: string; line: string; checked: string; waiting: string; empty: string; selected: string; white: string };
type Props = { seats: RoomSeat[]; selected: number | null; onSelect: (index: number) => void; highlighted: Set<string>; view: "angle" | "top"; zoom: number; roomName: string; date: string; round: string; courseTitle: string };

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
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 144;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = selected ? palette.selected : palette.white; ctx.fillRect(0, 0, 256, 144);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = selected ? palette.white : palette.selected;
      ctx.font = '48px "Noto Color Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText(seat.attendee ? attendeeSymbol(seat.attendee).emoji : "", 128, 37);
      ctx.font = 'bold 26px "IBM Plex Sans Thai", sans-serif';
      const name = seat.attendee?.name.split(" ")[0] || "ว่าง";
      ctx.fillText(name, 128, 86, 236);
      ctx.font = '22px "IBM Plex Sans Thai", sans-serif';
      ctx.fillText(`${seat.label}${seat.attendee?.checkedAt ? " ✓" : ""}`, 128, 122);
    }
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [seat.label, seat.attendee, selected, palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[seat.x, 1.85, seat.z]} scale={[1.08, 0.61, 1]} onClick={(e) => { e.stopPropagation(); onSelect(seat.index); }}><spriteMaterial map={texture} depthTest={false} toneMapped={false} /></sprite>;
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

function Seating({ seats, selected, onSelect, highlighted, palette, reduced }: Props & { palette: Palette; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const scales = useRef<number[]>([]);
  const heights = useRef<number[]>([]);
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
  const depth = Math.max(3, ...props.seats.map((seat) => seat.z + 1.8));
  const center = depth / 2 - 2;
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.position.set(props.view === "top" ? 0 : 10, props.view === "top" ? 20 : 14, props.view === "top" ? center + 0.01 : center + 15);
    camera.lookAt(0, 0, center);
    camera.zoom = Math.min(size.width / 17, size.height / (depth + 8)) * props.zoom;
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
    <mesh position={[0, -0.12, center]} receiveShadow><boxGeometry args={[13.8, 0.2, depth + 7]} /><meshStandardMaterial color={palette.line} roughness={0.7} /></mesh>
    <mesh position={[0, 1.9, -4]} receiveShadow><boxGeometry args={[13.8, 3.8, 0.18]} /><meshStandardMaterial map={texture} color={palette.white} roughness={0.85} /></mesh>
    <mesh position={[-6.8, 0.45, center]} receiveShadow><boxGeometry args={[0.15, 0.9, depth + 7]} /><meshStandardMaterial color={palette.white} roughness={0.7} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, center + 1]}><planeGeometry args={[0.75, depth + 1]} /><meshStandardMaterial color={palette.selected} roughness={0.9} /></mesh>
    <mesh position={[0, 0.16, -2.6]} receiveShadow castShadow><boxGeometry args={[9.8, 0.35, 1.8]} /><meshStandardMaterial color={palette.white} roughness={0.4} /></mesh>
    <mesh position={[0, 0.35, -1.72]}><boxGeometry args={[9.8, 0.08, 0.06]} /><meshStandardMaterial color={palette.selected} /></mesh>
    <SessionSign {...props} palette={palette} />
    <Suspense fallback={null}><Seating {...props} palette={palette} /></Suspense>
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