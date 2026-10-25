import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PresentationControls, Sparkles } from "@react-three/drei";
import obhSealUrl from "@/assets/obh-seal.png";

interface HolographicSealMeshProps {
  onInteract?: (() => void) | undefined;
}

function HolographicSealMesh({ onInteract }: HolographicSealMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const [hovered, setHovered] = useState(false);
  const [pulse, setPulse] = useState(0);

  // Load seal texture with sRGB color space
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const t = loader.load(obhSealUrl);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }, []);

  useEffect(() => () => {
    texture.dispose();
  }, [texture]);

  // Materials
  const { sealMaterial, goldRimMaterial, holoRingMaterial } = useMemo(() => {
    // Holographic front seal material
    const seal = new THREE.MeshPhysicalMaterial({
      map: texture,
      transparent: true,
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      iridescence: 0.95,
      iridescenceIOR: 1.65,
      iridescenceThicknessRange: [140, 420],
      reflectivity: 0.9,
      toneMapped: false,
    });

    // Outer milled gold rim
    const goldRim = new THREE.MeshPhysicalMaterial({
      color: "#f59e0b",
      metalness: 0.95,
      roughness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      iridescence: 0.6,
      iridescenceIOR: 1.5,
      reflectivity: 1.0,
    });

    // Glowing holographic orbital rings
    const holoRing = new THREE.MeshBasicMaterial({
      color: "#2dd4bf",
      transparent: true,
      opacity: 0.45,
      wireframe: false,
    });

    return { sealMaterial: seal, goldRimMaterial: goldRim, holoRingMaterial: holoRing };
  }, [texture]);

  // Clean up materials
  useEffect(() => () => {
    sealMaterial.dispose();
    goldRimMaterial.dispose();
    holoRingMaterial.dispose();
  }, [sealMaterial, goldRimMaterial, holoRingMaterial]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Orbital holographic rings rotation
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.45;
      ring1Ref.current.rotation.x = Math.sin(t * 0.3) * 0.25;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.35;
      ring2Ref.current.rotation.y = Math.cos(t * 0.25) * 0.25;
    }

    // Dynamic shimmer light orbit
    if (lightRef.current) {
      lightRef.current.position.x = Math.sin(t * 1.5) * 2.2;
      lightRef.current.position.y = Math.cos(t * 1.2) * 2.2;
      lightRef.current.position.z = 2.0 + Math.sin(t * 2) * 0.5;
    }

    // Pulse decay on click
    if (pulse > 0) {
      setPulse((prev) => Math.max(0, prev - 0.03));
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setPulse(1);
    if (onInteract) onInteract();
  };

  const scale = 1 + pulse * 0.12 + (hovered ? 0.05 : 0);

  return (
    <group
      ref={groupRef}
      scale={[scale, scale, scale]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Dynamic Specular Point Light for Rainbow Iridescence */}
      <pointLight ref={lightRef} intensity={2.5} distance={6} color={hovered ? "#38bdf8" : "#fbbf24"} />

      {/* Main 3D Seal Medallion Face */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.42, 1.42, 0.06, 64]} />
        <primitive object={sealMaterial} attach="material" />
      </mesh>

      {/* Gold Outer Beveled Rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.08, 64]} />
        <primitive object={goldRimMaterial} attach="material" />
      </mesh>

      {/* Inner Stepped Gold Border */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.43, 0.035, 16, 64]} />
        <primitive object={goldRimMaterial} attach="material" />
      </mesh>

      {/* Outer Holographic Halo Torus */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.54, 0.02, 16, 64]} />
        <meshPhysicalMaterial
          color="#2dd4bf"
          metalness={0.9}
          roughness={0.1}
          iridescence={1}
          clearcoat={1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Holographic Orbital Rings */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.72, 0.012, 16, 64]} />
        <primitive object={holoRingMaterial} attach="material" />
      </mesh>
      <mesh ref={ring2Ref} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[1.85, 0.008, 16, 64]} />
        <primitive object={holoRingMaterial} attach="material" />
      </mesh>

      {/* Ambient Floating Sparkles */}
      <Sparkles count={26} scale={3.4} size={2.8} speed={0.4} color="#f59e0b" opacity={0.65} />
      <Sparkles count={18} scale={3.2} size={2.2} speed={0.3} color="#2dd4bf" opacity={0.55} />
    </group>
  );
}

export interface HolographicSeal3DProps {
  onInteract?: (() => void) | undefined;
  className?: string;
}

export function HolographicSeal3D({ onInteract, className = "" }: HolographicSeal3DProps) {
  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <div className="relative h-64 w-64 cursor-grab active:cursor-grabbing sm:h-72 sm:w-72">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 4.4], fov: 45 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          className="size-full touch-none"
        >
          <ambientLight intensity={1.4} />
          <directionalLight position={[3, 4, 3]} intensity={2.2} color="#ffffff" />
          <directionalLight position={[-3, -2, -2]} intensity={1.2} color="#0d9488" />
          <pointLight position={[0, -2, 2]} intensity={1.5} color="#ec4899" />

          <PresentationControls
            global={false}
            cursor={false}
            snap={true}
            speed={1.6}
            zoom={1}
            rotation={[0, 0, 0]}
            polar={[-Math.PI / 4, Math.PI / 4]}
            azimuth={[-Math.PI / 3, Math.PI / 3]}
          >
            <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
              <HolographicSealMesh onInteract={onInteract} />
            </Float>
          </PresentationControls>
        </Canvas>

        {/* Subtle radial glow under seal */}
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-mint/20 via-primary/25 to-amber/20 blur-2xl" />
      </div>

      {/* Interactive Hint Text */}
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/80">
        <span className="inline-block size-2 animate-pulse rounded-full bg-mint" />
        <span>ลากเพื่อหมุนตราประทับ 3D · แตะเพื่อจุดพลุฉลอง 🎉</span>
      </div>
    </div>
  );
}
