import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { arrivalPath, roomFirstName, type RoomSeat } from "@/lib/training-room";
import { fitFont, useDrawnTexture, type OfficeFinishes, type OfficeTones } from "./RoomOffice";

// Stylized seated figures for the office theme. One neutral skin/hair token for everyone:
// variety comes only from division shirt colors and accessories, never inferred demographics.

function makeGeometries() {
  return {
    torso: new THREE.CapsuleGeometry(0.16, 0.2, 6, 14),
    head: new THREE.SphereGeometry(0.2, 22, 16),
    hair: new THREE.SphereGeometry(0.214, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    eye: new THREE.SphereGeometry(0.026, 10, 8),
    thigh: new THREE.CapsuleGeometry(0.07, 0.24, 4, 10),
    shin: new THREE.CapsuleGeometry(0.064, 0.26, 4, 10),
    shoe: new THREE.BoxGeometry(0.12, 0.07, 0.18),
    arm: new THREE.CapsuleGeometry(0.055, 0.22, 4, 10),
    hand: new THREE.SphereGeometry(0.052, 10, 8),
    lens: new THREE.TorusGeometry(0.048, 0.009, 6, 18),
    bridge: new THREE.BoxGeometry(0.05, 0.01, 0.01),
    band: new THREE.TorusGeometry(0.222, 0.018, 6, 22, Math.PI),
    cup: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14),
  };
}
type Geo = ReturnType<typeof makeGeometries>;

function makeMaterials(f: OfficeFinishes, faded: string) {
  return {
    skin: new THREE.MeshStandardMaterial({ color: f.skin, roughness: 0.6 }),
    hair: new THREE.MeshStandardMaterial({ color: f.hair, roughness: 0.7 }),
    eye: new THREE.MeshBasicMaterial({ color: f.screen }),
    trousers: new THREE.MeshStandardMaterial({ color: f.trousers, roughness: 0.8 }),
    gear: new THREE.MeshStandardMaterial({ color: f.screen, roughness: 0.35, metalness: 0.4 }),
    faded: new THREE.MeshStandardMaterial({ color: faded, transparent: true, opacity: 0.35, roughness: 0.9, depthWrite: false }),
  };
}
type Mats = ReturnType<typeof makeMaterials>;

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function OfficePerson({ seat, geo, mats, shirt, faded, pulse, delay, back, reduced, onSelect }: {
  seat: RoomSeat; geo: Geo; mats: Mats; shirt: THREE.Material; faded: boolean; pulse: number; delay: number; back: number; reduced: boolean; onSelect: (index: number) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const walkLegL = useRef<THREE.Group>(null);
  const walkLegR = useRef<THREE.Group>(null);
  const walkArmL = useRef<THREE.Group>(null);
  const walkArmR = useRef<THREE.Group>(null);
  const seatedGroup = useRef<THREE.Group>(null);
  const walkingGroup = useRef<THREE.Group>(null);

  const seed = hash(seat.attendee?.userId ?? String(seat.index));
  const accessory = seed % 3; // 0 glasses · 1 headset · 2 none
  const phase = (seed % 628) / 100;

  const path: THREE.Vector3[] = useMemo(() => arrivalPath(seat, back).map(([x, z]: [number, number]) => new THREE.Vector3(x, 0, z)), [seat.x, seat.z, back]);
  const lengths: number[] = useMemo(() => path.slice(1).map((p: THREE.Vector3, i: number) => { const from = path[i]; return from ? p.distanceTo(from) : 0; }), [path]);
  const distanceTotal: number = useMemo(() => lengths.reduce((a: number, b: number) => a + b, 0), [lengths]);
  const speed = 1.8;
  const travelTime = distanceTotal / speed + 0.35;
  const isRecentArrival = Boolean(pulse && Date.now() - pulse < (travelTime + delay + 2) * 1000);
  const moving = useRef(isRecentArrival);

  useEffect(() => {
    const isRecent = Boolean(pulse && Date.now() - pulse < (travelTime + delay + 2) * 1000);
    moving.current = isRecent;
    if (seatedGroup.current) seatedGroup.current.visible = !isRecent;
    if (walkingGroup.current) walkingGroup.current.visible = isRecent;
    if (!isRecent && root.current) {
      root.current.position.set(seat.x, 0, seat.z);
      root.current.rotation.set(0, 0, 0);
    }
  }, [pulse, travelTime, delay, seat.x, seat.z]);

  useFrame(({ clock }) => {
    const g = root.current;
    if (!g || reduced) return;
    const t = clock.getElapsedTime();

    if (moving.current && pulse) {
      const elapsed = (Date.now() - pulse) / 1000 - delay;
      if (elapsed < 0) {
        g.visible = false;
        return;
      }
      g.visible = true;
      if (seatedGroup.current) seatedGroup.current.visible = false;
      if (walkingGroup.current) walkingGroup.current.visible = true;

      if (elapsed < travelTime) {
        const ramp = 0.35;
        const remaining = travelTime - elapsed;
        const dist = elapsed < ramp
          ? speed * elapsed * elapsed / (2 * ramp)
          : remaining < ramp
          ? distanceTotal - speed * remaining * remaining / (2 * ramp)
          : speed * (elapsed - ramp / 2);

        let rem = dist;
        for (let i = 0; i < lengths.length; i++) {
          const l = lengths[i]; const from = path[i]; const to = path[i + 1];
          if (l == null || !from || !to) continue;
          if (rem <= l || i === lengths.length - 1) {
            g.position.copy(from).lerp(to, Math.min(1, Math.max(0, rem / (l || 1))));
            const yaw = Math.atan2(to.x - from.x, to.z - from.z);
            g.rotation.y = yaw;
            break;
          }
          rem -= l;
        }

        g.position.y = 0.035 * Math.abs(Math.sin(elapsed * 14));
        const legAngle = Math.sin(elapsed * 12) * 0.55;
        if (walkLegL.current) walkLegL.current.rotation.x = legAngle;
        if (walkLegR.current) walkLegR.current.rotation.x = -legAngle;
        if (walkArmL.current) walkArmL.current.rotation.x = -legAngle * 0.8;
        if (walkArmR.current) walkArmR.current.rotation.x = legAngle * 0.8;
      } else {
        // Arrived at desk
        moving.current = false;
        g.position.set(seat.x, 0, seat.z);
        g.rotation.set(0, 0, 0);
        if (seatedGroup.current) seatedGroup.current.visible = true;
        if (walkingGroup.current) walkingGroup.current.visible = false;
      }
      return;
    }

    g.visible = true;
    if (seatedGroup.current) seatedGroup.current.visible = true;
    if (walkingGroup.current) walkingGroup.current.visible = false;

    // Normal typing & gentle breathing at desk
    if (armL.current) armL.current.rotation.x = 1.15 + Math.sin(t * 9 + phase) * 0.06;
    if (armR.current) armR.current.rotation.x = 1.15 + Math.sin(t * 9 + phase + Math.PI) * 0.06;
    if (head.current) { head.current.rotation.x = Math.sin(t * 1.3 + phase) * 0.05; head.current.rotation.y = Math.sin(t * 0.6 + phase) * 0.12; }
  });

  const m = (material: THREE.Material) => (faded ? mats.faded : material);
  const select = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(seat.index); };

  const commonHead = (
    <group ref={head} position={[0, 1.2, 0]}>
      <mesh geometry={geo.head} material={m(mats.skin)} position-y={0.04} castShadow />
      <mesh geometry={geo.hair} material={m(mats.hair)} position={[0, 0.07, 0.015]} rotation-x={0.38} castShadow />
      {[-1, 1].map((s) => <mesh key={s} geometry={geo.eye} material={m(mats.eye)} position={[s * 0.07, 0.03, -0.185]} />)}
      {accessory === 0 && <>
        {[-1, 1].map((s) => <mesh key={s} geometry={geo.lens} material={m(mats.gear)} position={[s * 0.07, 0.03, -0.2]} />)}
        <mesh geometry={geo.bridge} material={m(mats.gear)} position={[0, 0.035, -0.205]} />
      </>}
      {accessory === 1 && <>
        <mesh geometry={geo.band} material={m(mats.gear)} position={[0, 0.05, 0]} />
        {[-1, 1].map((s) => <mesh key={s} geometry={geo.cup} material={m(mats.gear)} position={[s * 0.215, 0.02, 0]} rotation-z={Math.PI / 2} />)}
      </>}
    </group>
  );

  return <group ref={root} position={[seat.x, 0, seat.z]} onClick={select}>
    {/* Seated Pose (Typing at Desk) */}
    <group ref={seatedGroup}>
      {[-1, 1].map((s) => <group key={s}>
        <mesh geometry={geo.thigh} material={m(mats.trousers)} position={[s * 0.09, 0.5, -0.14]} rotation-x={Math.PI / 2} castShadow />
        <mesh geometry={geo.shin} material={m(mats.trousers)} position={[s * 0.09, 0.27, -0.3]} castShadow />
        <mesh geometry={geo.shoe} material={m(mats.gear)} position={[s * 0.09, 0.045, -0.35]} />
      </group>)}
      <mesh geometry={geo.torso} material={m(shirt)} position={[0, 0.8, 0.02]} castShadow />
      {[[-0.21, armL], [0.21, armR]].map(([x, ref]) => <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.95, 0]} rotation-x={1.15}>
        <mesh geometry={geo.arm} material={m(shirt)} position-y={-0.16} castShadow />
        <mesh geometry={geo.hand} material={m(mats.skin)} position-y={-0.33} />
      </group>)}
      {commonHead}
    </group>

    {/* Walking Pose (Entering aisle and moving to seat) */}
    <group ref={walkingGroup} visible={false}>
      {[-1, 1].map((s) => {
        const legRef = s === -1 ? walkLegL : walkLegR;
        return <group key={s} ref={legRef} position={[s * 0.09, 0.6, 0]}>
          <mesh geometry={geo.thigh} material={m(mats.trousers)} position-y={-0.12} castShadow />
          <mesh geometry={geo.shin} material={m(mats.trousers)} position-y={-0.34} castShadow />
          <mesh geometry={geo.shoe} material={m(mats.gear)} position={[0, -0.48, 0.04]} />
        </group>;
      })}
      <mesh geometry={geo.torso} material={m(shirt)} position={[0, 0.82, 0]} castShadow />
      {[-1, 1].map((s) => {
        const armRef = s === -1 ? walkArmL : walkArmR;
        return <group key={s} ref={armRef} position={[s * 0.21, 0.96, 0]}>
          <mesh geometry={geo.arm} material={m(shirt)} position-y={-0.14} castShadow />
          <mesh geometry={geo.hand} material={m(mats.skin)} position-y={-0.29} />
        </group>;
      })}
      {commonHead}
    </group>
  </group>;
}

function StatusPill({ seat, finishes, tones, faded, onSelect }: { seat: RoomSeat; finishes: OfficeFinishes; tones: OfficeTones; faded: boolean; onSelect: (index: number) => void }) {
  const checked = Boolean(seat.attendee?.checkedAt);
  const accent = checked ? tones.checked : tones.waiting;
  const text = `${roomFirstName(seat.attendee?.name ?? "")} · ${checked ? "เช็คชื่อแล้ว" : "รอเช็คชื่อ"}`;
  const texture = useDrawnTexture(560, 112, (ctx) => {
    ctx.fillStyle = finishes.screen; ctx.strokeStyle = accent; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(6, 6, 548, 100, 50); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(56, 56, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    fitFont(ctx, text, "600", 42, 22, 450); ctx.fillText(text, 84, 58);
  }, `${text}|${accent}|${finishes.screen}`);
  return <sprite position={[seat.x, 1.86, seat.z]} scale={[1.4, 0.28, 1]} onClick={(e) => { e.stopPropagation(); onSelect(seat.index); }}>
    <spriteMaterial map={texture} transparent opacity={faded ? 0.3 : 1} depthWrite={false} toneMapped={false} />
  </sprite>;
}

function SpeechBubble({ seat, tones }: { seat: RoomSeat; tones: OfficeTones }) {
  const person = seat.attendee;
  const line1 = person?.name ?? "";
  const line2 = person ? `${person.department || person.division || "บุคลากร"} · ${person.checkedAt ? "เช็คชื่อแล้ว" : "รอเช็คชื่อ"}` : "";
  const texture = useDrawnTexture(768, 264, (ctx) => {
    ctx.fillStyle = tones.white; ctx.strokeStyle = tones.primary; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(8, 8, 752, 188, 36); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(354, 193); ctx.lineTo(384, 252); ctx.lineTo(414, 193); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(354, 196); ctx.lineTo(384, 252); ctx.lineTo(414, 196); ctx.stroke();
    ctx.fillStyle = tones.foreground; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    fitFont(ctx, line1, "700", 52, 26, 700); ctx.fillText(line1, 384, 76);
    ctx.globalAlpha = 0.7; fitFont(ctx, line2, "500", 36, 20, 700); ctx.fillText(line2, 384, 140); ctx.globalAlpha = 1;
  }, `${line1}|${line2}|${tones.white}|${tones.primary}`);
  return <sprite position={[seat.x, 2.5, seat.z]} scale={[2.2, 0.756, 1]} renderOrder={20}>
    <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
  </sprite>;
}

export function RoomOfficePeople({ seats, highlighted, selected, pulseMap, onSelect, shirts, finishes, tones, reduced }: {
  seats: RoomSeat[]; highlighted: Set<string>; selected: number | null; pulseMap: Record<string, number>; onSelect: (index: number) => void;
  shirts: Record<string, string>; finishes: OfficeFinishes; tones: OfficeTones; reduced: boolean;
}) {
  const geo = useMemo(makeGeometries, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const mats = useMemo(() => makeMaterials(finishes, tones.empty), [finishes, tones.empty]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const shirtMats = useMemo(() => {
    const map = new Map<string, THREE.MeshStandardMaterial>();
    for (const color of new Set([...Object.values(shirts), tones.primary])) map.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.65 }));
    return map;
  }, [shirts, tones.primary]);
  useEffect(() => () => shirtMats.forEach((m) => m.dispose()), [shirtMats]);

  const back = Math.max(0, ...seats.map((s) => s.z));
  const occupied = seats.filter((s) => s.attendee);
  const chosen = occupied.find((s) => s.index === selected);
  const arrivals = occupied.filter((s) => s.attendee && (pulseMap[s.attendee.userId] ?? 0) > 0);

  return <>
    {occupied.map((seat) => {
      const person = seat.attendee!;
      const faded = !highlighted.has(person.userId);
      const shirt = shirtMats.get(shirts[person.division] ?? tones.primary) ?? shirtMats.get(tones.primary)!;
      const isChecked = Boolean(person.checkedAt);
      const pulse = pulseMap[person.userId] ?? 0;
      const delay = Math.max(0, arrivals.indexOf(seat)) * 0.4;

      return <group key={person.userId}>
        {/* Only checked-in people appear seated or walking to seat */}
        {isChecked && (
          <OfficePerson
            seat={seat}
            geo={geo}
            mats={mats}
            shirt={shirt}
            faded={faded}
            pulse={pulse}
            delay={delay}
            back={back}
            reduced={reduced}
            onSelect={onSelect}
          />
        )}
        <StatusPill seat={seat} finishes={finishes} tones={tones} faded={faded} onSelect={onSelect} />
      </group>;
    })}
    {chosen && <SpeechBubble key={chosen.index} seat={chosen} tones={tones} />}
  </>;
}

