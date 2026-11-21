import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import humanUrl from "@/assets/adult-learner.glb?url";
import { arrivalPath, getLearnerStage, roomFirstName, type RoomSeat } from "@/lib/training-room";

type PersonProps = {
  seat: RoomSeat;
  geometry: THREE.BufferGeometry;
  shirtGroups: number[];
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  color: string;
  faded: boolean;
  pulse: number;
  delay: number;
  back: number;
  reduced?: boolean;
  onSelect: (index: number) => void;
};

// The front of the room is -Z. Use the same landing position for both poses.
const PERSON_SCALE = 0.8955;
const SEATED_FORWARD = -0.2906;
const SEATED_HEIGHT = 0;
const LABEL_ZOOM_MIN = 22;

function NameLabel({
  seat,
  background,
  foreground,
  accent,
  faded,
  selected,
  onSelect,
}: {
  seat: RoomSeat;
  background: string;
  foreground: string;
  accent: string;
  faded: boolean;
  selected?: boolean;
  onSelect: (index: number) => void;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const name = roomFirstName(seat.attendee?.name ?? "");
  const stage = getLearnerStage(seat.attendee);
  const badge =
    stage === "certified"
      ? "🎓"
      : stage === "post_pending"
      ? "✍️"
      : stage === "learning"
      ? "💻"
      : "";
  const displayText = badge ? `${name} ${badge}` : name;

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.roundRect(4, 4, 504, 120, 18);
      ctx.fill();
      ctx.fillStyle = stage === "certified" ? "#10b981" : accent;
      ctx.fillRect(20, 28, 10, 72);
      ctx.fillStyle = foreground;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = 56;
      while (size > 24) {
        ctx.font = `600 ${size}px "IBM Plex Sans Thai", sans-serif`;
        if (ctx.measureText(displayText).width <= 440) break;
        size -= 2;
      }
      ctx.fillText(displayText, 268, 64, 440);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [displayText, stage, background, foreground, accent]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ camera }) => {
    const s = spriteRef.current;
    if (!s) return;
    if (selected) {
      s.visible = true;
      return;
    }
    if (camera instanceof THREE.OrthographicCamera) {
      s.visible = camera.zoom >= LABEL_ZOOM_MIN;
    }
  });

  return (
    <sprite
      ref={spriteRef}
      position={[seat.x, 1.94, seat.z]}
      scale={[1.22, 0.305, 1]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(seat.index);
      }}
    >
      <spriteMaterial
        map={texture}
        transparent
        opacity={faded ? 0.25 : 1}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

/** Mounted ONLY while an attendee is actively walking down the aisle to their seat. Disposes rig immediately upon arrival. */
function WalkingRig({
  seat,
  scene,
  animations,
  color,
  faded,
  delay,
  back,
  onArrived,
}: {
  seat: RoomSeat;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  color: string;
  faded: boolean;
  delay: number;
  back: number;
  onArrived: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(-delay - 0.15);

  const { model, mixer, walk, sit, enter } = useMemo(() => {
    const cloned = clone(scene);
    cloned.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        o.castShadow = true;
      }
    });
    const mx = new THREE.AnimationMixer(cloned);
    const walkClip = animations.find((a) => a.name === "Walk_Loop");
    const sitClip = animations.find((a) => a.name === "Sitting_Idle_Loop");
    const enterClip = animations.find((a) => a.name === "Sitting_Enter");
    const enterAction = enterClip ? mx.clipAction(enterClip) : null;
    if (enterAction) {
      enterAction.setLoop(THREE.LoopOnce, 1);
      enterAction.clampWhenFinished = true;
    }
    return {
      model: cloned,
      mixer: mx,
      enter: enterAction,
      walk: walkClip ? mx.clipAction(walkClip) : null,
      sit: sitClip ? mx.clipAction(sitClip) : null,
    };
  }, [scene, animations]);

  useEffect(() => {
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => {
        if (!(m instanceof THREE.MeshStandardMaterial)) return;
        if (m.name === "skin") m.color.set("#fedac0");
        else if (m.name === "hair") m.color.set("#3e2723");
        else if (m.name === "trousers") m.color.set("#2d3748");
        else if (m.name === "shoes") m.color.set("#f7fafc");
        else if (m.name === "eyes") m.color.set("#1a202c");
        else if (m.name === "cheeks") m.color.set("#ff9aa2");
        else if (m.name === "shirt") m.color.set(color);
        m.transparent = faded;
        m.opacity = faded ? 0.3 : 1;
      });
    });
  }, [model, color, faded]);

  useEffect(() => {
    walk?.reset().fadeIn(0.2).play();
    if (walk) walk.timeScale = 1.4;
    return () => {
      mixer.stopAllAction();
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
    };
  }, [mixer, model, walk]);

  const path = useMemo(
    () => arrivalPath(seat, back).map(([x, z]) => new THREE.Vector3(x, 0, z)),
    [seat.x, seat.z, back],
  );
  const lengths = useMemo(
    () =>
      path.slice(1).map((p, i) => {
        const from = path[i];
        return from ? p.distanceTo(from) : 0;
      }),
    [path],
  );
  const speed = 1.6;
  const distanceTotal = lengths.reduce((a, b) => a + b, 0);
  const travelTime = distanceTotal / speed + 0.3;

  useFrame((_, rawDelta) => {
    const g = group.current;
    if (!g) return;
    elapsed.current += Math.min(rawDelta, 0.05);
    const t = elapsed.current;
    g.visible = t >= 0;
    if (t < 0) return;
    mixer.update(Math.min(rawDelta, 0.05));
    if (t < travelTime) {
      const ramp = 0.4;
      const remaining = travelTime - t;
      let distance =
        t < ramp
          ? (speed * t * t) / (2 * ramp)
          : remaining < ramp
          ? distanceTotal - (speed * remaining * remaining) / (2 * ramp)
          : speed * (t - ramp / 2);
      const speedScale = 1.4;
      if (walk) {
        walk.timeScale = Math.max(
          0.15,
          Math.min(speedScale, (t / ramp) * speedScale, (remaining / ramp) * speedScale),
        );
      }
      for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i];
        const from = path[i];
        const to = path[i + 1];
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
      const transition = enter ?? sit;
      if (transition && !transition.isRunning() && t - travelTime < 0.2) {
        transition.reset().play();
        walk?.crossFadeTo(transition, 0.25, false);
      }
      const duration = enter?.getClip().duration ?? 1.3;
      const p = Math.min(1, (t - travelTime) / duration);
      const eased = p * p * (3 - 2 * p);
      g.position.set(
        seat.x,
        SEATED_HEIGHT * eased,
        seat.z - 0.22 * (1 - eased) + SEATED_FORWARD * eased,
      );
      const diff = Math.atan2(Math.sin(Math.PI - g.rotation.y), Math.cos(Math.PI - g.rotation.y));
      g.rotation.y += diff * (1 - Math.exp(-9 * Math.min(rawDelta, 0.05)));
      if (p === 1) {
        onArrived();
      }
    }
  });

  return (
    <group ref={group} visible={false} scale={PERSON_SCALE}>
      <primitive object={model} />
    </group>
  );
}

function Person({
  seat,
  geometry,
  shirtGroups,
  scene,
  animations,
  color,
  faded,
  pulse,
  delay,
  back,
  reduced,
  onSelect,
}: PersonProps) {
  const [walking, setWalking] = useState(() => Boolean(!reduced && pulse && Date.now() - pulse < 8000));

  useEffect(() => {
    if (!reduced && pulse && Date.now() - pulse < 8000) {
      setWalking(true);
    } else {
      setWalking(false);
    }
  }, [pulse, reduced]);

  const material = useMemo(() => {
    const base = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const shirt = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    return (geometry.groups.length ? geometry.groups : [{ materialIndex: 0 }]).map((_, i) =>
      shirtGroups.includes(i) ? shirt : base,
    );
  }, [geometry, shirtGroups]);

  useEffect(() => {
    material.forEach((m) => {
      if (!m.vertexColors) m.color.set(color);
      m.transparent = faded;
      m.opacity = faded ? 0.3 : 1;
    });
  }, [material, color, faded]);

  useEffect(
    () => () => {
      new Set(material).forEach((m) => m.dispose());
    },
    [material],
  );

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect(seat.index);
      }}
    >
      <mesh
        visible={!walking}
        geometry={geometry}
        position={[seat.x, SEATED_HEIGHT, seat.z + SEATED_FORWARD]}
        material={material}
        castShadow
      />
      {walking && (
        <WalkingRig
          seat={seat}
          scene={scene}
          animations={animations}
          color={color}
          faded={faded}
          delay={delay}
          back={back}
          onArrived={() => setWalking(false)}
        />
      )}
    </group>
  );
}

export function RoomPeople({ seats, pulseMap, reduced, color, highlighted, selected, onSelect, shirts, labelBackground, labelForeground }: { seats: RoomSeat[]; pulseMap: Record<string, number>; reduced: boolean; color: string; fadedColor: string; highlighted: Set<string>; selected?: number | null; onSelect: (index: number) => void; shirts: Record<string, string>; labelBackground: string; labelForeground: string }) {
  const { scene, animations } = useGLTF(humanUrl);
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
        let c = m instanceof THREE.MeshStandardMaterial ? m.color : new THREE.Color(1, 1, 1);
        if (m?.name === "skin") c = new THREE.Color("#fedac0");
        else if (m?.name === "hair") c = new THREE.Color("#3e2723");
        else if (m?.name === "trousers") c = new THREE.Color("#2d3748");
        else if (m?.name === "shoes") c = new THREE.Color("#f7fafc");
        else if (m?.name === "eyes") c = new THREE.Color("#1a202c");
        else if (m?.name === "cheeks") c = new THREE.Color("#ff9aa2");
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
      <NameLabel seat={seat} background={labelBackground} foreground={labelForeground} accent={shirt} faded={faded} selected={seat.index === selected} onSelect={onSelect} />
    </group>;
  })}</>;
}