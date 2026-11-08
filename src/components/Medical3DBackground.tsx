import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import obhLogoUrl from "@/assets/obh-logo.png?url";

// Subtle camera parallax tracking cursor
function CameraParallax({ reduced = false }: { reduced?: boolean }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 7.5));

  useFrame(({ pointer }) => {
    if (reduced) return;
    target.current.x = pointer.x * 0.9;
    target.current.y = pointer.y * 0.6;
    camera.position.x += (target.current.x - camera.position.x) * 0.04;
    camera.position.y += (target.current.y - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// 3D DNA / Skill Double Helix
function SkillHelix({ x = 3.6, y = 0, z = -1.5 }: { x?: number; y?: number; z?: number }) {
  const ref = useRef<THREE.Group>(null);
  const count = 32;
  const radius = 0.85;
  const height = 7.0;

  const { spheres, rungs } = useMemo(() => {
    const s1: [number, number, number][] = [];
    const s2: [number, number, number][] = [];
    const r: { p1: [number, number, number]; p2: [number, number, number] }[] = [];

    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 4;
      const py = (i / count) * height - height / 2;
      const px1 = Math.cos(t) * radius;
      const pz1 = Math.sin(t) * radius;
      const px2 = Math.cos(t + Math.PI) * radius;
      const pz2 = Math.sin(t + Math.PI) * radius;

      s1.push([px1, py, pz1]);
      s2.push([px2, py, pz2]);

      if (i % 2 === 0) {
        r.push({ p1: [px1, py, pz1], p2: [px2, py, pz2] });
      }
    }
    return { spheres: { s1, s2 }, rungs: r };
  }, [count, height, radius]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.28;
    }
  });

  return (
    <group ref={ref} position={[x, y, z]} rotation={[0.15, 0, 0.12]}>
      {/* Helix Strand A: Teal nodes */}
      {spheres.s1.map((p, i) => (
        <mesh key={`s1-${i}`} position={p}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#0d9488" emissive="#0d9488" emissiveIntensity={0.3} roughness={0.3} />
        </mesh>
      ))}

      {/* Helix Strand B: Cyan nodes */}
      {spheres.s2.map((p, i) => (
        <mesh key={`s2-${i}`} position={p}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} roughness={0.3} />
        </mesh>
      ))}

      {/* Connecting Rungs */}
      {rungs.map((rung, i) => {
        const v1 = new THREE.Vector3(...rung.p1);
        const v2 = new THREE.Vector3(...rung.p2);
        const mid = v1.clone().add(v2).multiplyScalar(0.5);
        const len = v1.distanceTo(v2);
        return (
          <mesh key={`r-${i}`} position={mid} lookAt={() => v2}>
            <cylinderGeometry args={[0.015, 0.015, len, 6]} />
            <meshStandardMaterial color="#99f6e4" transparent opacity={0.65} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

// 3D Soft ECG Heartbeat Pulse Line
function HeartbeatPulseLine({ y = -2.2, z = -0.5 }: { y?: number; z?: number }) {
  const lineRef = useRef<THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>>(null);
  const sampleCount = 90;

  // ECG waveform template
  const ecgProfile = useMemo(() => {
    const raw = [];
    for (let i = 0; i < sampleCount; i++) {
      const u = i / sampleCount; // 0 to 1
      let h = 0;
      // P wave
      if (u > 0.15 && u < 0.25) h = Math.sin((u - 0.15) * 10 * Math.PI) * 0.14;
      // QRS complex
      else if (u >= 0.25 && u < 0.28) h = -(u - 0.25) * 12; // Q
      else if (u >= 0.28 && u < 0.33) h = Math.sin((u - 0.28) * 20 * Math.PI) * 0.95; // R peak
      else if (u >= 0.33 && u < 0.37) h = -Math.sin((u - 0.33) * 25 * Math.PI) * 0.22; // S
      // T wave
      else if (u > 0.45 && u < 0.6) h = Math.sin((u - 0.45) * 6.66 * Math.PI) * 0.24;
      raw.push(h);
    }
    return raw;
  }, [sampleCount]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(sampleCount * 3);
    for (let i = 0; i < sampleCount; i++) {
      const x = (i / (sampleCount - 1)) * 14 - 7;
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [sampleCount]);

  useFrame(() => {
    const line = lineRef.current;
    if (!line) return;
    const t = performance.now() * 0.00075;
    const pos = line.geometry.getAttribute("position");
    if (!pos) return;

    for (let i = 0; i < sampleCount; i++) {
      const u = (i / sampleCount + t) % 1;
      const index = Math.floor(u * (sampleCount - 1));
      const val = ecgProfile[index] ?? 0;
      pos.setY(i, val);
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={[0, y, z]}>
      {/* Glow shadow line */}
      <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#2dd4bf", transparent: true, opacity: 0.85 }))} ref={lineRef} />
    </group>
  );
}

// Floating Pure Hospital Logo Watermark (subtle ambient background watermark)
function FloatingLogo({ x = 4.5, y = 2.2, z = -3.0 }: { x?: number; y?: number; z?: number }) {
  const meshRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const t = loader.load(obhLogoUrl);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useEffect(() => () => {
    texture.dispose();
  }, [texture]);

  useFrame(() => {
    if (meshRef.current) {
      const t = performance.now() * 0.001;
      meshRef.current.rotation.y = Math.sin(t * 0.4) * 0.1;
      meshRef.current.rotation.x = Math.cos(t * 0.3) * 0.05;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.25}>
      <group ref={meshRef} position={[x, y, z]}>
        {/* Very subtle hospital logo watermark in the background to ensure crystal-clear text readability */}
        <mesh>
          <planeGeometry args={[2.2, 2.2]} />
          <meshBasicMaterial map={texture} transparent opacity={0.06} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </Float>
  );
}

// Ambient Floating Skill Particles
function SkillParticles({ count = 60 }: { count?: number }) {
  const points = useMemo(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      coords[i * 3] = (Math.random() - 0.5) * 16;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 10;
      coords[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(coords, 3));
    return geo;
  }, [count]);

  const ref = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.025;
      ref.current.rotation.x += delta * 0.015;
    }
  });

  return (
    <points ref={ref} geometry={points}>
      <pointsMaterial size={0.06} color="#5eead4" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

// Main Interactive Medical 3D Scene
function SceneContent({ reduced }: { reduced: boolean }) {
  return (
    <>
      <CameraParallax reduced={reduced} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[5, 6, 4]} intensity={1.2} color="#f0fdfa" />
      <pointLight position={[-4, 3, 2]} intensity={1.5} color="#38bdf8" distance={10} />
      <pointLight position={[4, -3, 2]} intensity={1.5} color="#14b8a6" distance={10} />

      {/* 3D Elements */}
      <FloatingLogo x={4.5} y={2.2} z={-3.0} />
      <SkillHelix x={3.5} y={0} z={-1.4} />
      <HeartbeatPulseLine y={-2.3} z={-0.6} />
      <SkillParticles count={70} />
    </>
  );
}

export function Medical3DBackground({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handler = () => setReduced(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 46 }}
        dpr={Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5)}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        <SceneContent reduced={reduced} />
      </Canvas>
    </div>
  );
}
