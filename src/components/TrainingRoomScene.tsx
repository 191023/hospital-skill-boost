import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { roomDivisionTokens, type RoomSeat } from "@/lib/training-room";
import chairUrl from "@/assets/chair.glb?url";
import { RoomPeople } from "./RoomPeople";
import { RoomFurniture, type RoomFinishes } from "./RoomFurniture";
import { RoomWallFade } from "./RoomWallFade";
import { RoomTrainers } from "./RoomTrainers";
import { OfficeEnvironment, OfficeDesks, type OfficeFinishes, type OfficeTones } from "./RoomOffice";
import { RoomOfficePeople } from "./RoomOfficePeople";

type Palette = { background: string; floor: string; line: string; checked: string; waiting: string; empty: string; selected: string; white: string; foreground: string; shirts: Record<string, string>; finishes: RoomFinishes };
export type RoomStats = { registered: number; checked: number; waiting: number; free: number | string };
export type RoomFocus = { index: number; n: number } | null;
type Props = {
  seats: RoomSeat[]; selected: number | null; onSelect: (index: number) => void; highlighted: Set<string>;
  view: "angle" | "top"; zoom: number; roomName: string; date: string; round: string; courseTitle: string;
  kiosk: boolean; walk: boolean; focus: RoomFocus; pulseMap: Record<string, number>;
  stats: RoomStats; updatedLabel: string; countdownText?: string; celebrate?: number; theme?: "hall" | "office";
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
  return { background: color("--room-background"), floor: color("--room-floor"), line: color("--room-grid"), checked: color("--mint"), waiting: color("--amber"), empty: color("--room-empty"), selected: color("--primary"), white: color("--card"), foreground: color("--foreground"), shirts: Object.fromEntries(Object.entries(roomDivisionTokens).map(([division, token]) => [division, color(token)])), finishes: { wall: color("--room-wall"), trim: color("--room-trim"), window: color("--room-window"), wood: color("--room-wood"), fabric: color("--room-fabric"), carpet: color("--room-carpet"), panel: color("--room-panel"), light: color("--room-light") } };
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
  return <mesh name="fixed-session-board" position={[0, 2.35, -3.61]} renderOrder={10}>
    <planeGeometry args={[7.9, 1.975]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
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
  const dummyColor = useMemo(() => new THREE.Color(), []);
  const floorColor = useMemo(() => new THREE.Color(), []);
  const { scene } = useGLTF(chairUrl);
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
    const mesh = ref.current;
    if (mesh) {
      seats.forEach((seat, i) => {
        dummy.position.set(seat.x, 0, seat.z);
        dummy.scale.setScalar(scales.current[i] ?? 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [seatKey, reduced, seats, dummy]);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    floorColor.set(palette.floor);
    seats.forEach((seat, i) => {
      const active = selected === seat.index || hovered === seat.index;
      const visible = !seat.attendee || highlighted.has(seat.attendee.userId);
      dummyColor.set(active ? palette.selected : seat.attendee ? (seat.attendee.checkedAt ? palette.checked : palette.waiting) : palette.empty);
      if (!visible) dummyColor.lerp(floorColor, 0.8);
      mesh.setColorAt(i, dummyColor);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seats, selected, hovered, highlighted, palette, dummyColor, floorColor]);

  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05);
    let matrixChanged = false;

    seats.forEach((seat, i) => {
      const target = 1;
      const prevScale = scales.current[i] ?? 1;
      const isScaling = prevScale < 0.999;
      if (isScaling) {
        scales.current[i] = reduced ? target : THREE.MathUtils.lerp(prevScale, target, 1 - Math.exp(-7 * dt));
      } else {
        scales.current[i] = target;
      }

      const uid = seat.attendee?.userId;
      const pulse = uid ? pulseMap[uid] : 0;
      let bounce = uid ? bounces.current.get(uid) : undefined;
      if (uid && pulse && bounce?.pulse !== pulse && Date.now() - pulse < 4000) {
        bounce = { pulse, t: 0 }; bounces.current.set(uid, bounce);
      }
      if (bounce) bounce.t += dt;
      const isBouncing = Boolean(!reduced && bounce && bounce.t < 0.8);
      const lift = isBouncing && bounce ? Math.sin(bounce.t / 0.8 * Math.PI) * 0.18 : 0;

      if (isScaling || isBouncing || Boolean(bounce && bounce.t < 1.0)) {
        dummy.position.set(seat.x, lift, seat.z);
        dummy.scale.setScalar(scales.current[i]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        matrixChanged = true;
      }
    });

    if (matrixChanged) mesh.instanceMatrix.needsUpdate = true;
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
  const isOffice = props.theme === "office";
  const widthSpan = isOffice ? 15.2 : 17.5;
  const heightSpan = isOffice ? depth + 4.2 : depth + 6.2;
  const baseZoom = Math.min(size.width / widthSpan, size.height / heightSpan) * props.zoom * (isOffice ? 1.38 : 1.18);
  const desired = useRef<{ p: THREE.Vector3; l: THREE.Vector3; zoom: number }>({ p: new THREE.Vector3(14, 14, center + 14), l: new THREE.Vector3(0, 0, center), zoom: 1 });
  const orbitPos = useMemo(() => new THREE.Vector3(), []);
  const kioskProgress = useRef(1);
  const kioskStartPos = useRef(new THREE.Vector3());
  const smoothDt = useRef(0.01666);
  const wasKiosk = useRef(false);

  useEffect(() => {
    if (props.kiosk && !wasKiosk.current && camera) {
      kioskStartPos.current.copy(camera.position);
      orbit.current = Math.atan2(camera.position.x, (camera.position.z - center) || 1);
      kioskProgress.current = 0;
    }
    wasKiosk.current = props.kiosk;
  }, [props.kiosk, camera, center]);

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera) || props.walk || props.kiosk) return;
    const focusIndex = props.focus?.index;
    const focusSeat = focusIndex == null ? null : props.seats.find((s) => s.index === focusIndex);
    if (focusSeat) {
      desired.current = { p: new THREE.Vector3(focusSeat.x + 2, 3.2, focusSeat.z - 2.7), l: new THREE.Vector3(focusSeat.x, 0.9, focusSeat.z), zoom: baseZoom * 3.3 };
    } else if (props.view === "top") {
      desired.current = { p: new THREE.Vector3(0, 20, center + 0.01), l: new THREE.Vector3(0, 0, center), zoom: baseZoom };
    } else {
      desired.current = { p: new THREE.Vector3(14, 14, center + 14), l: new THREE.Vector3(0, 0, center), zoom: baseZoom };
    }
  }, [camera, size, depth, center, props.view, props.zoom, props.focus, props.walk, props.kiosk, props.seats, baseZoom]);

  useFrame((_, rawDelta) => {
    if (props.walk || !(camera instanceof THREE.OrthographicCamera)) return;
    const dt = Math.min(rawDelta, 0.05);

    if (props.kiosk) {
      // Smooth frame-to-frame delta variation to eliminate display refresh micro-jitter
      smoothDt.current = THREE.MathUtils.lerp(smoothDt.current, dt, 0.08);
      orbit.current += smoothDt.current * 0.18;
      const a = orbit.current;
      const radius = 14;
      orbitPos.set(Math.sin(a) * radius, 11, center + Math.cos(a) * radius);

      if (kioskProgress.current < 1) {
        kioskProgress.current = Math.min(1, kioskProgress.current + smoothDt.current * 1.2);
        const t = kioskProgress.current;
        const ease = t * t * (3 - 2 * t);
        camera.position.lerpVectors(kioskStartPos.current, orbitPos, ease);
      } else {
        camera.position.copy(orbitPos);
      }

      look.current.set(0, 0.6, center);
      camera.lookAt(look.current);

      if (Math.abs(camera.zoom - baseZoom) > 0.002) {
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, baseZoom, 1 - Math.exp(-6 * dt));
        camera.updateProjectionMatrix();
      }
      return;
    }

    const k = 1 - Math.exp(-6 * dt);
    camera.position.lerp(desired.current.p, k);
    look.current.lerp(desired.current.l, k);
    camera.lookAt(look.current);
    if (Math.abs(camera.zoom - desired.current.zoom) > 0.005) {
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, desired.current.zoom, k);
      camera.updateProjectionMatrix();
    }
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
  const officeFinishes: OfficeFinishes = useMemo(() => ({
    backdrop: palette.background,
    floor: "#ecd8b8",
    seam: "#d5bc95",
    wall: "#f6f3ed",
    baseboard: "#3e4249",
    rug: "#273a5a",
    rugBorder: "#f0f4f8",
    wood: "#d8a368",
    sofa: "#326c7e",
    cushion: "#f5a742",
    plant: "#48bb78",
    pot: "#d97736",
    screen: "#18202c",
    skin: "#fcd6b5",
    hair: "#3d2314",
    trousers: "#2d3748",
    laptop: "#79879c",
    glow: "#68c5f5",
  }), [palette.background]);

  const officeTones: OfficeTones = useMemo(() => ({
    primary: palette.selected,
    checked: palette.checked,
    waiting: palette.waiting,
    empty: palette.empty,
    white: palette.white,
    foreground: palette.foreground,
  }), [palette]);

  return <>
    <color attach="background" args={[palette.background]} />
    <ambientLight intensity={isOffice ? 0.8 : 0.6} />
    <directionalLight
      position={isOffice ? [-3, 15, 6] : [-5, 14, 8]}
      intensity={isOffice ? 1.8 : 1.6}
      castShadow={!reduced}
      shadow-mapSize-width={reduced ? 512 : 1024}
      shadow-mapSize-height={reduced ? 512 : 1024}
      shadow-camera-left={-14}
      shadow-camera-right={14}
      shadow-camera-top={14}
      shadow-camera-bottom={-14}
      shadow-bias={-0.001}
    />
    <Environment resolution={64}>
      <Lightformer intensity={2} position={[0, 8, 0]} rotation-x={-Math.PI / 2} scale={[15, 15, 1]} />
      <Lightformer intensity={1} color={palette.finishes.light} position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 5, 1]} />
    </Environment>

    {isOffice ? (
      <>
        <OfficeEnvironment
          depth={depth}
          seats={props.seats}
          finishes={officeFinishes}
          tones={officeTones}
          stats={props.stats}
          roomName={props.roomName}
          round={props.round}
          date={props.date}
          courseTitle={props.courseTitle}
          countdownText={props.countdownText}
          reduced={reduced}
        />
        <Pulses seats={props.seats} pulseMap={props.pulseMap} palette={palette} />
        <Suspense fallback={null}>
          <OfficeDesks seats={props.seats} finishes={officeFinishes} tones={officeTones} />
          <RoomOfficePeople
            seats={props.seats}
            highlighted={props.highlighted}
            selected={props.selected}
            pulseMap={props.pulseMap}
            onSelect={props.onSelect}
            shirts={palette.shirts}
            finishes={officeFinishes}
            tones={officeTones}
            reduced={reduced}
          />
        </Suspense>
      </>
    ) : (
      <>
        <mesh raycast={() => null} rotation-x={-Math.PI / 2} position={[0, -0.04, center]} receiveShadow><planeGeometry args={[80, 80]} /><meshStandardMaterial color={palette.background} roughness={0.8} /></mesh>
        <mesh raycast={() => null} rotation-x={-Math.PI / 2} position={[0, 0, center]} receiveShadow><planeGeometry args={[13.5, depth + 6.8]} /><meshStandardMaterial map={texture} color={palette.finishes.carpet} roughness={1} /></mesh>
        <mesh raycast={() => null} position={[0, -0.12, center]} receiveShadow><boxGeometry args={[13.8, 0.2, depth + 7]} /><meshStandardMaterial color={palette.line} roughness={0.7} /></mesh>
        <RoomWallFade side="front" reduced={reduced}>
          <mesh raycast={() => null} position={[0, 1.9, -4]} receiveShadow><boxGeometry args={[13.8, 3.8, 0.18]} /><meshStandardMaterial color={palette.finishes.wall} roughness={0.85} /></mesh>
          <SessionSign {...props} palette={palette} />
        </RoomWallFade>
        <RoomWallFade side="left" reduced={reduced}><mesh raycast={() => null} position={[-6.8, 0.25, center]} receiveShadow><boxGeometry args={[0.15, 0.5, depth + 7]} /><meshStandardMaterial color={palette.finishes.wall} roughness={0.7} /></mesh></RoomWallFade>
        <mesh raycast={() => null} rotation-x={-Math.PI / 2} position={[0, 0.005, center + 1]}><planeGeometry args={[0.85, depth + 1]} /><meshStandardMaterial map={texture} color={palette.finishes.fabric} roughness={1} /></mesh>
        <mesh raycast={() => null} position={[0, 0.16, -2.6]} receiveShadow castShadow={!reduced}><boxGeometry args={[9.8, 0.35, 1.8]} /><meshStandardMaterial color={palette.finishes.wood} roughness={0.6} /></mesh>
        <mesh raycast={() => null} position={[0, 0.35, -1.72]}><boxGeometry args={[9.8, 0.08, 0.06]} /><meshStandardMaterial color={palette.selected} /></mesh>
        <Pulses seats={props.seats} pulseMap={props.pulseMap} palette={palette} />
        <Suspense fallback={null}>
          <RoomFurniture depth={depth} finishes={palette.finishes} reduced={reduced} />
          <RoomTrainers white={palette.white} dark={palette.finishes.panel} doctor={palette.shirts["ฝ่ายการแพทย์"] ?? palette.selected} nurse={palette.checked} accent={palette.selected} celebrate={props.celebrate ?? 0} reduced={reduced} />
          <Seating {...props} palette={palette} reduced={reduced} />
          <RoomPeople seats={props.seats} pulseMap={props.pulseMap} reduced={reduced} color={palette.selected} fadedColor={palette.empty} highlighted={props.highlighted} onSelect={props.onSelect} shirts={palette.shirts} labelBackground={palette.white} labelForeground={palette.foreground} />
        </Suspense>
      </>
    )}
    {props.walk && <OrbitControls target={[0, 0.6, center]} enableDamping dampingFactor={0.08} minZoom={Math.max(0.4, baseZoom * 0.5)} maxZoom={baseZoom * 3.5} />}
  </>;
}

export default function TrainingRoomScene(props: Props) {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [reduced, setReduced] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    document.fonts.load('600 26px "IBM Plex Sans Thai"')
      .catch(() => undefined).then(() => { if (!cancelled) setPalette(readPalette()); });
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);

    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      query.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!palette) return null;

  return (
    <Canvas
      orthographic
      frameloop={isVisible ? "always" : "never"}
      shadows={reduced ? false : { type: THREE.PCFShadowMap }}
      dpr={[1, typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.75) : 1]}
      camera={{ position: [14, 14, 14], near: 0.1, far: 200 }}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
    >
      <Room {...props} palette={palette} reduced={reduced} />
    </Canvas>
  );
}
