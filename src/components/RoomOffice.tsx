import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { RoomSeat } from "@/lib/training-room";
import { RoomWallFade } from "./RoomWallFade";

export type OfficeFinishes = {
  backdrop: string; floor: string; seam: string; wall: string; baseboard: string; rug: string; rugBorder: string;
  wood: string; sofa: string; cushion: string; plant: string; pot: string; screen: string; skin: string; hair: string;
  trousers: string; laptop: string; glow: string;
};
export type OfficeTones = { primary: string; checked: string; waiting: string; empty: string; white: string; foreground: string };
type Stats = { registered: number; checked: number; waiting: number; free: number | string };

const noRay = () => null;
const FONT = '"IBM Plex Sans Thai", sans-serif';

export function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, max: number, min: number, width: number) {
  let size = max;
  while (size > min) { ctx.font = `${weight} ${size}px ${FONT}`; if (ctx.measureText(text).width <= width) break; size -= 2; }
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** One canvas per texture, redrawn in place so faded-wall material clones keep sharing the same map. */
export function useDrawnTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, key: string) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }, [width, height]);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useLayoutEffect(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext("2d");
    if (ctx) { ctx.clearRect(0, 0, width, height); drawRef.current(ctx); }
    texture.needsUpdate = true;
  }, [texture, width, height, key]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function PlankFloor({ depth, finishes }: { depth: number; finishes: OfficeFinishes }) {
  const length = depth + 5.4;
  const centerZ = (depth + 1.4 - 4) / 2;
  const texture = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = finishes.floor; ctx.fillRect(0, 0, 256, 256);
      const rows = 8, h = 256 / rows;
      for (let r = 0; r < rows; r++) {
        for (let x = -((r * 53) % 128); x < 256; x += 128) {
          const v = (((r * 31 + x * 7) % 5) + 5) % 5;
          ctx.globalAlpha = 0.04 + v * 0.015; ctx.fillStyle = v % 2 ? "#ffffff" : "#000000"; ctx.fillRect(x, r * h, 128, h);
          ctx.globalAlpha = 1; ctx.fillStyle = finishes.seam; ctx.fillRect(x, r * h, 2, h);
        }
        ctx.fillStyle = finishes.seam; ctx.fillRect(0, r * h, 256, 2);
      }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(13.5 / 2.6, length / 2.6); return t;
  }, [finishes.floor, finishes.seam, length]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <>
    <mesh raycast={noRay} rotation-x={-Math.PI / 2} position={[0, 0, centerZ]} receiveShadow><planeGeometry args={[13.5, length]} /><meshStandardMaterial map={texture} roughness={0.75} /></mesh>
    <mesh raycast={noRay} position={[0, -0.16, centerZ]} receiveShadow><boxGeometry args={[13.7, 0.3, length + 0.2]} /><meshStandardMaterial color={finishes.seam} roughness={0.8} /></mesh>
  </>;
}

function Rug({ seats, finishes }: { seats: RoomSeat[]; finishes: OfficeFinishes }) {
  const maxX = Math.max(2, ...seats.map((s) => Math.abs(s.x)));
  const maxZ = Math.max(0, ...seats.map((s) => s.z));
  const w = Math.min(12.9, 2 * (maxX + 1)), l = maxZ + 2.1, z = maxZ / 2 - 0.05;
  return <group position={[0, 0, z]}>
    <mesh raycast={noRay} rotation-x={-Math.PI / 2} position-y={0.006} receiveShadow><planeGeometry args={[w, l]} /><meshStandardMaterial color={finishes.rug} roughness={1} /></mesh>
    <mesh raycast={noRay} rotation-x={-Math.PI / 2} position-y={0.008} receiveShadow><planeGeometry args={[w - 0.34, l - 0.34]} /><meshStandardMaterial color={finishes.rugBorder} roughness={1} /></mesh>
    <mesh raycast={noRay} rotation-x={-Math.PI / 2} position-y={0.01} receiveShadow><planeGeometry args={[w - 0.5, l - 0.5]} /><meshStandardMaterial color={finishes.rug} roughness={1} /></mesh>
  </group>;
}

function StatusScreen({ x, title, value, sub, foot, accent, finishes }: { x: number; title: string; value: string; sub: string; foot?: string; accent: string; finishes: OfficeFinishes }) {
  const texture = useDrawnTexture(640, 384, (ctx) => {
    ctx.fillStyle = finishes.screen; ctx.fillRect(0, 0, 640, 384);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 640, 64);
    ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = "#ffffff";
    fitFont(ctx, title, "700", 34, 18, 500); ctx.fillText(title, 24, 33);
    ctx.textAlign = "right"; ctx.font = `700 22px ${FONT}`; ctx.fillText("LIVE", 616, 33);
    ctx.textAlign = "left"; fitFont(ctx, value, "700", 112, 36, 590); ctx.fillText(value, 24, 172);
    ctx.fillStyle = "rgba(255,255,255,0.66)"; fitFont(ctx, sub, "500", 32, 16, 590); ctx.fillText(sub, 24, 268);
    if (foot) { ctx.fillStyle = "rgba(255,255,255,0.5)"; fitFont(ctx, foot, "500", 26, 14, 590); ctx.fillText(foot, 24, 334); }
    else { ctx.fillStyle = accent; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(34 + i * 26, 336, 7, 0, Math.PI * 2); ctx.fill(); } }
  }, `${title}|${value}|${sub}|${foot}|${accent}|${finishes.screen}`);
  return <group position={[x, 3.0, -3.87]}>
    <mesh raycast={noRay} castShadow><boxGeometry args={[2.5, 1.5, 0.07]} /><meshStandardMaterial color={finishes.screen} roughness={0.4} metalness={0.3} /></mesh>
    <mesh raycast={noRay} position-z={0.04}><planeGeometry args={[2.36, 1.38]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
  </group>;
}

function WallClock({ finishes, tones }: { finishes: OfficeFinishes; tones: OfficeTones }) {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(((d.getHours() % 12) + m / 60) / 12) * Math.PI * 2;
  });
  return <group position={[0, 3.0, -3.88]}>
    <mesh raycast={noRay} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.38, 0.38, 0.06, 40]} /><meshStandardMaterial color={tones.white} roughness={0.5} /></mesh>
    <mesh raycast={noRay}><torusGeometry args={[0.38, 0.035, 10, 40]} /><meshStandardMaterial color={finishes.screen} metalness={0.4} roughness={0.35} /></mesh>
    {Array.from({ length: 12 }, (_, i) => <mesh key={i} raycast={noRay} position={[Math.sin((i / 12) * Math.PI * 2) * 0.3, Math.cos((i / 12) * Math.PI * 2) * 0.3, 0.035]} rotation-z={-(i / 12) * Math.PI * 2}>
      <boxGeometry args={[0.02, i % 3 === 0 ? 0.07 : 0.04, 0.01]} /><meshBasicMaterial color={finishes.screen} />
    </mesh>)}
    <group ref={hour} position-z={0.045}><mesh raycast={noRay} position-y={0.08}><boxGeometry args={[0.032, 0.17, 0.01]} /><meshBasicMaterial color={finishes.screen} /></mesh></group>
    <group ref={minute} position-z={0.05}><mesh raycast={noRay} position-y={0.12}><boxGeometry args={[0.022, 0.25, 0.01]} /><meshBasicMaterial color={finishes.screen} /></mesh></group>
    <mesh raycast={noRay} position-z={0.058} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.025, 0.025, 0.01, 16]} /><meshBasicMaterial color={tones.primary} /></mesh>
  </group>;
}

function OfficeWindow({ z, finishes, tones }: { z: number; finishes: OfficeFinishes; tones: OfficeTones }) {
  const bars: [number, number, number, number][] = [[0, 0.99, 2.02, 0.08], [0, -0.99, 2.02, 0.08], [0.99, 0, 0.08, 2.02], [-0.99, 0, 0.08, 2.02], [0, 0, 0.04, 1.9], [0, 0, 1.9, 0.04]];
  return <group position={[-6.74, 1.75, z]} rotation-y={Math.PI / 2}>
    <mesh raycast={noRay}><planeGeometry args={[1.9, 1.9]} /><meshStandardMaterial color={finishes.glow} transparent opacity={0.55} roughness={0.1} emissive={finishes.glow} emissiveIntensity={0.35} /></mesh>
    {bars.map(([x, y, w, h], i) =>
      <mesh key={i} raycast={noRay} position={[x, y, 0.03]}><boxGeometry args={[w, h, 0.06]} /><meshStandardMaterial color={tones.white} roughness={0.5} /></mesh>)}
    <mesh raycast={noRay} position={[0, -1.04, 0.08]}><boxGeometry args={[2.1, 0.05, 0.18]} /><meshStandardMaterial color={tones.white} roughness={0.5} /></mesh>
  </group>;
}

function AgendaBoard({ finishes, tones }: { finishes: OfficeFinishes; tones: OfficeTones }) {
  const steps = ["ลงทะเบียน", "Pre-test", "เข้าอบรม", "Post-test", "แบบประเมิน", "รับใบประกาศ"];
  const colors = [tones.primary, tones.waiting, tones.checked, tones.primary, finishes.cushion, tones.checked];
  const texture = useDrawnTexture(680, 440, (ctx) => {
    ctx.fillStyle = tones.white; ctx.fillRect(0, 0, 680, 440);
    ctx.fillStyle = tones.foreground; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.font = `700 38px ${FONT}`; ctx.fillText("ลำดับการอบรม", 30, 44);
    steps.forEach((step, i) => {
      const x = 30 + (i % 3) * 210, y = 100 + Math.floor(i / 3) * 160;
      ctx.fillStyle = colors[i] || tones.primary; ctx.beginPath(); ctx.roundRect(x, y, 190, 130, 14); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.font = `700 30px ${FONT}`; ctx.fillText(String(i + 1), x + 16, y + 34);
      fitFont(ctx, step, "600", 30, 18, 160); ctx.fillText(step, x + 16, y + 90);
    });
  }, `${tones.white}|${tones.primary}|${finishes.cushion}`);
  return <group position={[-6.74, 1.75, -2.75]} rotation-y={Math.PI / 2}>
    <mesh raycast={noRay}><boxGeometry args={[1.8, 1.2, 0.04]} /><meshStandardMaterial color={finishes.wood} roughness={0.6} /></mesh>
    <mesh raycast={noRay} position-z={0.025}><planeGeometry args={[1.7, 1.1]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
  </group>;
}

function WallArt({ z, finishes, tones }: { z: number; finishes: OfficeFinishes; tones: OfficeTones }) {
  const texture = useDrawnTexture(300, 380, (ctx) => {
    ctx.fillStyle = finishes.wall; ctx.fillRect(0, 0, 300, 380);
    [[110, 140, 80, tones.primary], [190, 210, 70, tones.checked], [120, 260, 55, tones.waiting], [200, 110, 40, finishes.cushion]].forEach(([x, y, r, c]) => {
      ctx.globalAlpha = 0.85; ctx.fillStyle = c as string; ctx.beginPath(); ctx.arc(x as number, y as number, r as number, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }, `${finishes.wall}|${tones.primary}`);
  return <group position={[-6.74, 2.0, z]} rotation-y={Math.PI / 2}>
    <mesh raycast={noRay}><boxGeometry args={[0.9, 1.14, 0.05]} /><meshStandardMaterial color={finishes.screen} roughness={0.5} /></mesh>
    <mesh raycast={noRay} position-z={0.03}><planeGeometry args={[0.78, 1.0]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
  </group>;
}

export function OfficePlant({ position, scale = 1, finishes }: { position: [number, number, number]; scale?: number; finishes: OfficeFinishes }) {
  const shade = useMemo(() => `#${new THREE.Color(finishes.plant).offsetHSL(0, 0, -0.07).getHexString()}`, [finishes.plant]);
  const leaves: [number, number, number, number, string][] = [[0, 0.8, 0, 0.34, finishes.plant], [-0.19, 0.64, 0.1, 0.24, shade], [0.2, 0.67, -0.08, 0.26, shade], [0.04, 1.04, -0.04, 0.22, finishes.plant]];
  return <group position={position} scale={scale}>
    <mesh raycast={noRay} position-y={0.21} castShadow receiveShadow><cylinderGeometry args={[0.26, 0.2, 0.42, 24]} /><meshStandardMaterial color={finishes.pot} roughness={0.7} /></mesh>
    {leaves.map(([x, y, z, r, c], i) => <mesh key={i} raycast={noRay} position={[x, y, z]} castShadow><icosahedronGeometry args={[r, 1]} /><meshStandardMaterial color={c} roughness={0.8} flatShading /></mesh>)}
  </group>;
}

function MiniLaptop({ position, finishes }: { position: [number, number, number]; finishes: OfficeFinishes }) {
  return <group position={position}>
    <mesh raycast={noRay} castShadow><boxGeometry args={[0.38, 0.02, 0.26]} /><meshStandardMaterial color={finishes.laptop} metalness={0.4} roughness={0.35} /></mesh>
    <mesh raycast={noRay} position={[0, 0.13, -0.13]} rotation-x={-0.22}><boxGeometry args={[0.38, 0.25, 0.015]} /><meshBasicMaterial color={finishes.glow} toneMapped={false} /></mesh>
  </group>;
}

function PresenterDesk({ finishes, tones }: { finishes: OfficeFinishes; tones: OfficeTones }) {
  const legPositions: [number, number][] = [[-1.22, -0.32], [1.22, -0.32], [-1.22, 0.32], [1.22, 0.32]];
  const papers: [number, number, number][] = [[0.62, 0.79, -0.1], [0.75, 0.79, 0.05]];
  return <group position={[0, 0, -1.6]}>
    <mesh raycast={noRay} position-y={0.75} castShadow receiveShadow><boxGeometry args={[2.6, 0.06, 0.75]} /><meshStandardMaterial color={finishes.wood} roughness={0.55} /></mesh>
    {legPositions.map(([x, z], i) => <mesh key={i} raycast={noRay} position={[x, 0.36, z]} castShadow><boxGeometry args={[0.05, 0.72, 0.05]} /><meshStandardMaterial color={finishes.screen} /></mesh>)}
    <MiniLaptop position={[-0.45, 0.79, 0.05]} finishes={finishes} />
    <mesh raycast={noRay} position={[0.35, 0.83, 0.12]} castShadow><cylinderGeometry args={[0.045, 0.04, 0.1, 16]} /><meshStandardMaterial color={tones.white} /></mesh>
    {papers.map(([x, y, z], i) => <mesh key={i} raycast={noRay} position={[x, y + i * 0.012, z]} rotation-y={i * 0.3}><boxGeometry args={[0.3, 0.012, 0.22]} /><meshStandardMaterial color={tones.white} /></mesh>)}
    <OfficePlant position={[1.05, 0.78, 0]} scale={0.35} finishes={finishes} />
  </group>;
}

function Sofa({ position, rotation, finishes }: { position: [number, number, number]; rotation: number; finishes: OfficeFinishes }) {
  const seat = useMemo(() => `#${new THREE.Color(finishes.sofa).offsetHSL(0, 0, 0.06).getHexString()}`, [finishes.sofa]);
  return <group position={position} rotation-y={rotation}>
    <mesh raycast={noRay} position-y={0.27} castShadow receiveShadow><boxGeometry args={[2.0, 0.38, 0.85]} /><meshStandardMaterial color={finishes.sofa} roughness={0.85} /></mesh>
    <mesh raycast={noRay} position={[0, 0.62, -0.33]} castShadow><boxGeometry args={[2.0, 0.55, 0.2]} /><meshStandardMaterial color={finishes.sofa} roughness={0.85} /></mesh>
    {[-1, 1].map((s) => <mesh key={s} raycast={noRay} position={[s * 1.0, 0.42, 0]} castShadow><boxGeometry args={[0.18, 0.5, 0.85]} /><meshStandardMaterial color={finishes.sofa} roughness={0.85} /></mesh>)}
    {[-1, 1].map((s) => <mesh key={`c${s}`} raycast={noRay} position={[s * 0.46, 0.51, 0.05]}><boxGeometry args={[0.9, 0.1, 0.62]} /><meshStandardMaterial color={seat} roughness={0.9} /></mesh>)}
    {[-1, 1].map((s) => <mesh key={`p${s}`} raycast={noRay} position={[s * 0.62, 0.74, -0.16]} rotation={[-0.2, 0, s * 0.18]} castShadow><boxGeometry args={[0.42, 0.36, 0.12]} /><meshStandardMaterial color={finishes.cushion} roughness={0.9} /></mesh>)}
  </group>;
}

function FloorLamp({ position, finishes, tones }: { position: [number, number, number]; finishes: OfficeFinishes; tones: OfficeTones }) {
  return <group position={position}>
    <mesh raycast={noRay} position-y={0.015}><cylinderGeometry args={[0.17, 0.17, 0.03, 24]} /><meshStandardMaterial color={finishes.screen} /></mesh>
    <mesh raycast={noRay} position-y={0.78} castShadow><cylinderGeometry args={[0.018, 0.018, 1.5, 10]} /><meshStandardMaterial color={finishes.screen} metalness={0.5} /></mesh>
    <mesh raycast={noRay} position-y={1.56} castShadow><cylinderGeometry args={[0.13, 0.25, 0.32, 24, 1, true]} /><meshStandardMaterial color={tones.white} emissive={tones.white} emissiveIntensity={0.55} side={THREE.DoubleSide} /></mesh>
  </group>;
}

function SideTable({ position, finishes, tones }: { position: [number, number, number]; finishes: OfficeFinishes; tones: OfficeTones }) {
  return <group position={position}>
    <mesh raycast={noRay} position-y={0.5} castShadow><cylinderGeometry args={[0.28, 0.28, 0.04, 28]} /><meshStandardMaterial color={finishes.wood} /></mesh>
    <mesh raycast={noRay} position-y={0.25}><cylinderGeometry args={[0.03, 0.03, 0.5, 10]} /><meshStandardMaterial color={finishes.screen} /></mesh>
    <mesh raycast={noRay} position-y={0.015}><cylinderGeometry args={[0.16, 0.16, 0.03, 20]} /><meshStandardMaterial color={finishes.screen} /></mesh>
    <mesh raycast={noRay} position={[0.06, 0.57, 0.04]}><cylinderGeometry args={[0.045, 0.04, 0.1, 14]} /><meshStandardMaterial color={tones.waiting} /></mesh>
  </group>;
}

function Bookshelf({ position, rotation, finishes, tones }: { position: [number, number, number]; rotation: number; finishes: OfficeFinishes; tones: OfficeTones }) {
  const colors = [tones.primary, tones.checked, tones.waiting, finishes.cushion, finishes.sofa, tones.white];
  const books = useMemo(() => {
    const list: { x: number; y: number; h: number; w: number; c: string; tilt: number }[] = [];
    [0.45, 0.95, 1.45].forEach((y, row) => {
      let x = -0.66;
      for (let k = 0; x < 0.55; k++) {
        const w = 0.07 + ((row * 7 + k * 3) % 4) * 0.015; const h = 0.3 + ((row + k * 5) % 3) * 0.04;
        list.push({ x: x + w / 2, y: y + h / 2, h, w, c: colors[(row * 2 + k) % colors.length] ?? tones.primary, tilt: k % 7 === 6 ? 0.25 : 0 });
        x += w + 0.012;
      }
    });
    return list;
  }, [colors.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return <group position={position} rotation-y={rotation}>
    <mesh raycast={noRay} position={[0, 0.95, -0.18]} castShadow receiveShadow><boxGeometry args={[1.6, 1.9, 0.04]} /><meshStandardMaterial color={finishes.wood} roughness={0.6} /></mesh>
    {[-0.78, 0.78].map((x) => <mesh key={x} raycast={noRay} position={[x, 0.95, 0]} castShadow><boxGeometry args={[0.04, 1.9, 0.4]} /><meshStandardMaterial color={finishes.wood} roughness={0.6} /></mesh>)}
    {[0.02, 0.43, 0.93, 1.43, 1.88].map((y) => <mesh key={y} raycast={noRay} position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[1.56, 0.04, 0.4]} /><meshStandardMaterial color={finishes.wood} roughness={0.6} /></mesh>)}
    {books.map((b, i) => <mesh key={i} raycast={noRay} position={[b.x, b.y, 0.02]} rotation-z={b.tilt}><boxGeometry args={[b.w, b.h, 0.26]} /><meshStandardMaterial color={b.c} roughness={0.8} /></mesh>)}
  </group>;
}

function WaterCooler({ position, finishes, tones }: { position: [number, number, number]; finishes: OfficeFinishes; tones: OfficeTones }) {
  return <group position={position}>
    <mesh raycast={noRay} position-y={0.48} castShadow receiveShadow><boxGeometry args={[0.38, 0.96, 0.38]} /><meshStandardMaterial color={tones.white} roughness={0.4} /></mesh>
    <mesh raycast={noRay} position={[-0.2, 0.72, 0]}><boxGeometry args={[0.04, 0.06, 0.12]} /><meshStandardMaterial color={tones.primary} /></mesh>
    <mesh raycast={noRay} position-y={1.2} castShadow><cylinderGeometry args={[0.15, 0.15, 0.46, 24]} /><meshStandardMaterial color={finishes.glow} transparent opacity={0.65} roughness={0.1} /></mesh>
    <mesh raycast={noRay} position-y={1.45}><cylinderGeometry args={[0.06, 0.06, 0.05, 16]} /><meshStandardMaterial color={tones.primary} /></mesh>
  </group>;
}

export function OfficeEnvironment({ depth, seats, finishes, tones, stats, roomName, round, date, courseTitle, countdownText, reduced }: {
  depth: number; seats: RoomSeat[]; finishes: OfficeFinishes; tones: OfficeTones; stats: Stats;
  roomName: string; round: string; date: string; courseTitle: string; countdownText?: string | undefined; reduced: boolean;
}) {
  const length = depth + 5.4;
  const centerZ = (depth + 1.4 - 4) / 2;
  const windows: number[] = [];
  for (let z = 0.4; z + 1 < depth + 0.9; z += 3.6) windows.push(z);
  const pct = stats.registered ? Math.round((stats.checked / stats.registered) * 100) : 0;
  return <>
    <hemisphereLight args={[finishes.wall, finishes.seam, 0.45]} />
    <mesh raycast={noRay} rotation-x={-Math.PI / 2} position={[0, -0.32, centerZ]}><planeGeometry args={[90, 90]} /><meshBasicMaterial color={finishes.backdrop} /></mesh>
    <PlankFloor depth={depth} finishes={finishes} />
    <Rug seats={seats} finishes={finishes} />

    {/* Entrance Mat at Hallway (Where people enter when checking in) */}
    <group position={[0, 0.006, depth + 1.8]}>
      <mesh raycast={noRay} rotation-x={-Math.PI / 2}><planeGeometry args={[2.4, 1.2]} /><meshStandardMaterial color={finishes.rug} roughness={0.9} /></mesh>
      <mesh raycast={noRay} position={[0, 0.01, 0.55]}><boxGeometry args={[2.4, 0.02, 0.05]} /><meshStandardMaterial color={tones.primary} /></mesh>
    </group>

    <RoomWallFade side="front" reduced={reduced}>
      <mesh raycast={noRay} position={[0, 1.9, -4]} receiveShadow><boxGeometry args={[13.8, 3.8, 0.18]} /><meshStandardMaterial color={finishes.wall} roughness={0.9} /></mesh>
      <mesh raycast={noRay} position={[0, 0.07, -3.89]}><boxGeometry args={[13.8, 0.14, 0.04]} /><meshStandardMaterial color={finishes.baseboard} /></mesh>
      <StatusScreen x={-4.95} title={roomName} value={round} sub={countdownText ? `⏳ ${countdownText}` : date} foot={courseTitle} accent={tones.primary} finishes={finishes} />
      <StatusScreen x={-2.15} title="ลงทะเบียน" value={`${stats.registered} คน`} sub={`ที่นั่งว่าง ${stats.free}`} accent={tones.primary} finishes={finishes} />
      <WallClock finishes={finishes} tones={tones} />
      <StatusScreen x={2.15} title="เช็คชื่อแล้ว" value={`${stats.checked} คน`} sub={`${pct}% ของผู้ลงทะเบียน`} accent={tones.checked} finishes={finishes} />
      <StatusScreen x={4.95} title="รอเช็คชื่อ" value={`${stats.waiting} คน`} sub={countdownText ? `เวลา: ${countdownText}` : "สแกน QR หน้าห้องเพื่อเช็คชื่อ"} accent={tones.waiting} finishes={finishes} />
    </RoomWallFade>

    <RoomWallFade side="left" reduced={reduced}>
      <mesh raycast={noRay} position={[-6.84, 1.9, centerZ]} receiveShadow><boxGeometry args={[0.18, 3.8, length]} /><meshStandardMaterial color={finishes.wall} roughness={0.9} /></mesh>
      <mesh raycast={noRay} position={[-6.73, 0.07, centerZ]}><boxGeometry args={[0.04, 0.14, length]} /><meshStandardMaterial color={finishes.baseboard} /></mesh>
      <AgendaBoard finishes={finishes} tones={tones} />
      {windows.map((z) => <OfficeWindow key={z} z={z} finishes={finishes} tones={tones} />)}
      {windows.length > 1 && windows[0] !== undefined && <WallArt z={windows[0] + 1.8} finishes={finishes} tones={tones} />}
    </RoomWallFade>

    <PresenterDesk finishes={finishes} tones={tones} />
    <OfficePlant position={[-6.2, 0, -3.35]} finishes={finishes} />
    <OfficePlant position={[6.2, 0, -3.35]} finishes={finishes} />
    <Sofa position={[-6.2, 0, depth + 0.15]} rotation={Math.PI / 2} finishes={finishes} />
    <SideTable position={[-5.2, 0, depth + 0.95]} finishes={finishes} tones={tones} />
    <FloorLamp position={[-4.4, 0, depth + 1.05]} finishes={finishes} tones={tones} />
    <Bookshelf position={[6.4, 0, depth - 0.2]} rotation={-Math.PI / 2} finishes={finishes} tones={tones} />
    <WaterCooler position={[6.3, 0, depth + 1.0]} finishes={finishes} tones={tones} />
    <OfficePlant position={[5.4, 0, depth + 1.0]} scale={0.8} finishes={finishes} />
  </>;
}

/** Per-seat desks and laptops; laptop screens glow when checked in, dim while waiting, dark when empty. */
export function OfficeDesks({ seats, finishes, tones }: { seats: RoomSeat[]; finishes: OfficeFinishes; tones: OfficeTones }) {
  const top = useRef<THREE.InstancedMesh>(null);
  const panel = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const base = useRef<THREE.InstancedMesh>(null);
  const screen = useRef<THREE.InstancedMesh>(null);
  const n = seats.length;
  useLayoutEffect(() => {
    const t = top.current;
    const p = panel.current;
    const l = legs.current;
    const b = base.current;
    const s = screen.current;
    if (!t || !p || !l || !b || !s) return;
    const d = new THREE.Object3D(); const c = new THREE.Color();
    const put = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rx = 0) => { d.position.set(x, y, z); d.rotation.set(rx, 0, 0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); };
    seats.forEach((seat, i) => {
      put(t, i, seat.x, 0.74, seat.z - 0.62);
      put(p, i, seat.x, 0.4, seat.z - 0.86);
      put(l, i * 2, seat.x - 0.5, 0.36, seat.z - 0.62);
      put(l, i * 2 + 1, seat.x + 0.5, 0.36, seat.z - 0.62);
      put(b, i, seat.x, 0.775, seat.z - 0.58);
      put(s, i, seat.x, 0.9, seat.z - 0.71, -0.22);
      c.set(seat.attendee ? (seat.attendee.checkedAt ? finishes.glow : finishes.laptop) : finishes.screen);
      s.setColorAt(i, c);
    });
    [t, p, l, b, s].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    if (s.instanceColor) s.instanceColor.needsUpdate = true;
  }, [seats, finishes, tones]);
  return <group key={n}>
    <instancedMesh ref={top} raycast={noRay} args={[undefined, undefined, n]} castShadow receiveShadow><boxGeometry args={[1.05, 0.05, 0.5]} /><meshStandardMaterial color={finishes.wood} roughness={0.55} /></instancedMesh>
    <instancedMesh ref={panel} raycast={noRay} args={[undefined, undefined, n]} castShadow><boxGeometry args={[0.98, 0.6, 0.03]} /><meshStandardMaterial color={finishes.baseboard} roughness={0.7} /></instancedMesh>
    <instancedMesh ref={legs} raycast={noRay} args={[undefined, undefined, n * 2]} castShadow><boxGeometry args={[0.04, 0.72, 0.46]} /><meshStandardMaterial color={finishes.baseboard} roughness={0.7} /></instancedMesh>
    <instancedMesh ref={base} raycast={noRay} args={[undefined, undefined, n]} castShadow><boxGeometry args={[0.36, 0.02, 0.25]} /><meshStandardMaterial color={finishes.laptop} metalness={0.4} roughness={0.35} /></instancedMesh>
    <instancedMesh ref={screen} raycast={noRay} args={[undefined, undefined, n]}><boxGeometry args={[0.36, 0.24, 0.015]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
  </group>;
}
