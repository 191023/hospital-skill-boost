import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PresentationControls, Sparkles } from "@react-three/drei";
import obhLogoUrl from "@/assets/obh-logo.png";

export interface CheckInBadgeProps {
  fullName: string;
  position?: string | undefined;
  department?: string | undefined;
  courseTitle: string;
  round?: number | null | undefined;
  checkedAt?: string | undefined;
}

// Draw dynamic high-res badge front texture
function createBadgeFrontCanvas(props: CheckInBadgeProps, logoImg: HTMLImageElement | null): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 920;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background gradient: Modern medical executive badge
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 920);
  bgGrad.addColorStop(0, "#042f2e");
  bgGrad.addColorStop(0.35, "#0f172a");
  bgGrad.addColorStop(0.8, "#022c22");
  bgGrad.addColorStop(1, "#064e3b");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 600, 920);

  // Security wave lines / pattern
  ctx.strokeStyle = "rgba(45, 212, 191, 0.12)";
  ctx.lineWidth = 1.5;
  for (let y = 40; y < 900; y += 28) {
    ctx.beginPath();
    for (let x = 0; x <= 600; x += 10) {
      const cy = y + Math.sin((x + y) * 0.02) * 8;
      if (x === 0) ctx.moveTo(x, cy);
      else ctx.lineTo(x, cy);
    }
    ctx.stroke();
  }

  // Header band
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fillRect(0, 0, 600, 140);
  ctx.fillStyle = "#2dd4bf";
  ctx.fillRect(0, 138, 600, 3);

  // Logo & Title
  if (logoImg && logoImg.complete) {
    ctx.drawImage(logoImg, 35, 30, 80, 80);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  ctx.fillText("OVERBROOK HOSPITAL", 130, 65);
  ctx.fillStyle = "#2dd4bf";
  ctx.font = "600 16px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  ctx.fillText("โรงพยาบาลโอเวอร์บรุ๊ค · ศูนย์พัฒนาศักยภาพ", 130, 95);

  // Smart Card IC Chip
  ctx.fillStyle = "#eab308";
  ctx.beginPath();
  ctx.roundRect(40, 170, 84, 64, 8);
  ctx.fill();
  ctx.strokeStyle = "#ca8a04";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chip circuit traces
  ctx.strokeStyle = "#854d0e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 202); ctx.lineTo(124, 202);
  ctx.moveTo(82, 170); ctx.lineTo(82, 234);
  ctx.moveTo(60, 170); ctx.lineTo(60, 234);
  ctx.moveTo(104, 170); ctx.lineTo(104, 234);
  ctx.stroke();

  // Contactless RFID icon
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 2.5;
  for (let r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.arc(160, 202, r * 10, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
  }

  // Profile Avatar / Medical Emblem
  const isDoctor = (props.position ?? "").includes("แพทย์") || props.fullName.includes("พญ.") || props.fullName.includes("นพ.");
  const isNurse = (props.position ?? "").includes("พยาบาล") || props.fullName.includes("พว.");

  ctx.save();
  ctx.beginPath();
  ctx.arc(300, 330, 75, 0, Math.PI * 2);
  ctx.fillStyle = isDoctor ? "#0284c7" : isNurse ? "#059669" : "#0d9488";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // Medical Cross Icon inside avatar
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(288, 280, 24, 100);
  ctx.fillRect(250, 318, 100, 24);
  ctx.restore();

  // Role Pill Badge
  const roleText = isDoctor ? "แพทย์ (PHYSICIAN)" : isNurse ? "พยาบาล (NURSE)" : "บุคลากรทางการแพทย์ (STAFF)";
  const roleBg = isDoctor ? "#0284c7" : isNurse ? "#059669" : "#0d9488";
  ctx.fillStyle = roleBg;
  ctx.beginPath();
  ctx.roundRect(170, 425, 260, 32, 16);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(roleText, 300, 447);

  // Full Name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  ctx.fillText(props.fullName || "ผู้เข้ารับการอบรม", 300, 505);

  // Department / Position
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 20px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  const posText = [props.position, props.department].filter(Boolean).join(" · ");
  ctx.fillText(posText || "โรงพยาบาลโอเวอร์บรุ๊ค", 300, 540);

  // CHECKED IN Success Banner (Glowing Green Badge)
  const bannerGrad = ctx.createLinearGradient(50, 580, 550, 660);
  bannerGrad.addColorStop(0, "#10b981");
  bannerGrad.addColorStop(1, "#059669");
  ctx.fillStyle = bannerGrad;
  ctx.beginPath();
  ctx.roundRect(40, 580, 520, 80, 20);
  ctx.fill();
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Checkmark & Check-in text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  ctx.fillText("✓  CHECKED IN · เช็คชื่อสำเร็จ", 300, 630);

  // Course title & round
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 20px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  ctx.fillText(props.courseTitle + (props.round ? ` (รอบที่ ${props.round})` : ""), 300, 705);

  // Timestamp
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 16px 'Noto Sans Thai', 'Segoe UI', sans-serif";
  const timeStr = props.checkedAt
    ? `เวลาเช็คชื่อ: ${new Date(props.checkedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "medium" })}`
    : `ยืนยันสิทธิ์เข้าร่วมอบรมเรียบร้อย`;
  ctx.fillText(timeStr, 300, 740);

  // Bottom Security Barcode
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(80, 780, 440, 55);
  ctx.fillStyle = "#000000";
  for (let bx = 95; bx < 505; bx += 7) {
    const w = ((bx * 13) % 5 === 0) ? 4 : 2;
    ctx.fillRect(bx, 788, w, 38);
  }
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 13px monospace";
  ctx.fillText("OBH-TRAINING-CHECKIN-VERIFIED", 300, 855);

  return canvas;
}

// 3D Radar Beacon Ripple Waves
function RadarBeaconWaves() {
  const ringsRef = useRef<THREE.Group>(null);
  const waveCount = 4;

  const geometries = useMemo(() => {
    return Array.from({ length: waveCount }, () => new THREE.RingGeometry(0.1, 0.18, 64));
  }, []);

  const materials = useMemo(() => {
    return Array.from(
      { length: waveCount },
      () =>
        new THREE.MeshBasicMaterial({
          color: "#2dd4bf",
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
    );
  }, []);

  useEffect(() => () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }, [geometries, materials]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.8;
    materials.forEach((mat, i) => {
      const progress = (t + i / waveCount) % 1; // 0 to 1
      const scale = 0.5 + progress * 5.5;
      const mesh = ringsRef.current?.children[i] as THREE.Mesh | undefined;
      if (mesh) {
        mesh.scale.set(scale, scale, 1);
      }
      mat.opacity = Math.pow(1 - progress, 1.8) * 0.75;
    });
  });

  return (
    <group ref={ringsRef} position={[0, -2.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {materials.map((mat, i) => {
        const geo = geometries[i];
        if (!geo) return null;
        return <mesh key={i} geometry={geo} material={mat} />;
      })}
    </group>
  );
}

// Rotating 3D Staff Card Mesh
function StaffBadgeMesh(props: CheckInBadgeProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = obhLogoUrl;
    img.crossOrigin = "anonymous";
    img.onload = () => setLogoImg(img);
  }, []);

  const frontCanvas = useMemo(() => {
    return createBadgeFrontCanvas(props, logoImg);
  }, [props, logoImg]);

  const frontTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(frontCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [frontCanvas]);

  useEffect(() => {
    frontTexture.needsUpdate = true;
  }, [frontTexture, props, logoImg]);

  useEffect(() => () => {
    frontTexture.dispose();
  }, [frontTexture]);

  const materials = useMemo(() => {
    const acrylicRim = new THREE.MeshPhysicalMaterial({
      color: "#0d9488",
      metalness: 0.1,
      roughness: 0.15,
      transmission: 0.65,
      thickness: 0.5,
      transparent: true,
      opacity: 0.85,
    });

    const frontFace = new THREE.MeshPhysicalMaterial({
      map: frontTexture,
      roughness: 0.25,
      metalness: 0.4,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      iridescence: 0.35,
      iridescenceIOR: 1.4,
      toneMapped: false,
    });

    const backFace = new THREE.MeshStandardMaterial({
      color: "#0f172a",
      roughness: 0.4,
      metalness: 0.6,
    });

    const goldClip = new THREE.MeshStandardMaterial({
      color: "#f59e0b",
      metalness: 0.9,
      roughness: 0.2,
    });

    return { acrylicRim, frontFace, backFace, goldClip };
  }, [frontTexture]);

  useEffect(() => () => {
    Object.values(materials).forEach((m) => m.dispose());
  }, [materials]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.y = Math.sin(t * 0.7) * 0.18;
      meshRef.current.position.y = Math.sin(t * 1.4) * 0.08;
    }
  });

  return (
    <group ref={meshRef} position={[0, 0.1, 0]}>
      {/* Badge Body Box */}
      <mesh>
        <boxGeometry args={[2.3, 3.5, 0.06]} />
        {/* Six face materials: +x, -x, +y, -y, +z (front), -z (back) */}
        <primitive object={materials.acrylicRim} attach="material-0" />
        <primitive object={materials.acrylicRim} attach="material-1" />
        <primitive object={materials.acrylicRim} attach="material-2" />
        <primitive object={materials.acrylicRim} attach="material-3" />
        <primitive object={materials.frontFace} attach="material-4" />
        <primitive object={materials.backFace} attach="material-5" />
      </mesh>

      {/* Lanyard Clip at top */}
      <group position={[0, 1.82, 0]}>
        {/* Clip Body */}
        <mesh>
          <boxGeometry args={[0.55, 0.22, 0.12]} />
          <primitive object={materials.goldClip} attach="material" />
        </mesh>
        {/* Clip Ring */}
        <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.035, 16, 32]} />
          <primitive object={materials.goldClip} attach="material" />
        </mesh>
      </group>

      {/* Ambient Floating Sparkles */}
      <Sparkles count={24} scale={3.6} size={2.5} speed={0.5} color="#2dd4bf" opacity={0.7} />
      <Sparkles count={16} scale={3.2} size={2} speed={0.4} color="#f59e0b" opacity={0.6} />
    </group>
  );
}

export function CheckInSuccess3D(props: CheckInBadgeProps) {
  return (
    <div className="relative mx-auto flex h-[380px] w-full max-w-sm flex-col items-center justify-center select-none sm:h-[440px]">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5.2], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        className="size-full touch-none"
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 5, 4]} intensity={2.2} color="#ffffff" />
        <directionalLight position={[-4, -3, -3]} intensity={1.2} color="#0d9488" />
        <pointLight position={[0, 2, 3]} intensity={2.0} color="#2dd4bf" />

        {/* 3D Radar Beacon Ripple Waves */}
        <RadarBeaconWaves />

        {/* Interactive 3D Staff ID Badge */}
        <PresentationControls
          global={false}
          cursor={false}
          snap={true}
          speed={1.6}
          zoom={1}
          rotation={[0, 0, 0]}
          polar={[-Math.PI / 6, Math.PI / 6]}
          azimuth={[-Math.PI / 3, Math.PI / 3]}
        >
          <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.5}>
            <StaffBadgeMesh {...props} />
          </Float>
        </PresentationControls>
      </Canvas>

      {/* Interactive Helper Text */}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/80">
        <span className="inline-block size-2 animate-ping rounded-full bg-mint" />
        <span>บัตรประจำตัว 3D โต้ตอบได้ · แตะหรือลากเพื่อหมุนตรวจดูรายละเอียด</span>
      </div>
    </div>
  );
}
