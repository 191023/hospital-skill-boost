import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  Volume2,
  VolumeX,
  Camera,
  CheckCircle2,
  AlertOctagon,
  Heart,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// CPR Workflow Steps
export type CprStep = {
  id: number;
  title: string;
  subtitle: string;
  phase: "safety" | "pulse" | "cpr" | "aed_pads" | "shock";
  description: string;
  clinicalKey: string;
  rateBpm?: number;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
};

export const CPR_STEPS: CprStep[] = [
  {
    id: 1,
    title: "1. ประเมินความปลอดภัย & ปลุกเรียก",
    subtitle: "Scene Safety & Check Responsiveness",
    phase: "safety",
    description:
      "ตรวจสอบความปลอดภัยบริเวณรอบตัวผู้ป่วยและผู้ช่วยเหลือ ตบไหล่ทั้งสองข้างแรงๆ แล้วเรียก 'คุณครับ/คุณคะ เป็นอย่างไรบ้าง' หากไม่ตอบสนอง ตะโกนขอความช่วยเหลือและประกาศ Code Blue ทันที",
    clinicalKey: "อย่าลืมร้องขอเครื่องกระตุกหัวใจ AED และชุดอุปกรณ์ช่วยชีวิตทันทีที่พบผู้ป่วยหมดสติ",
    cameraPos: [0, 4.5, 5],
    cameraTarget: [0, 0.6, 0],
  },
  {
    id: 2,
    title: "2. ตรวจการหายใจ & คลำชีพจร",
    subtitle: "Check Breathing & Carotid Pulse",
    phase: "pulse",
    description:
      "เปิดทางเดินหายใจ (Head-tilt chin-lift) สังเกตการกระเพื่อมของหน้าอก และคลำชีพจร Carotid ที่ข้างหลอดลมพร้อมกัน ใช้เวลาไม่เกิน 10 วินาที หากไม่หายใจหรือหายใจเฮือก (Agonal gasping) ถือว่าหัวใจหยุดเต้น",
    clinicalKey: "หากไม่แน่ใจว่ามีชีพจรหรือไม่ภายใน 10 วินาที ให้เริ่มกดหน้าอก (CPR) ทันที ห้ามเสียเวลาคลำนานเกินไป",
    cameraPos: [-1.2, 3.2, 2.8],
    cameraTarget: [0, 0.7, 0.4],
  },
  {
    id: 3,
    title: "3. การกดหน้าอกคุณภาพสูง (High-Quality CPR)",
    subtitle: "Continuous Chest Compressions (100-120 bpm)",
    phase: "cpr",
    rateBpm: 110,
    description:
      "วางสันมือข้างหนึ่งตรงกึ่งกลางหน้าอก (ครึ่งล่างกระดูกหน้าอก) สันมืออีกข้างประสานทับ แขนเหยียดตรง โน้มไหล่อยู่เหนือผู้ป่วย กดลึก 5-6 ซม. (2-2.4 นิ้ว) อัตราเร็ว 100-120 ครั้ง/นาที ปล่อยให้อกคืนตัวเต็มที่ (Full chest recoil)",
    clinicalKey: "ลดการหยุดกดหน้าอกให้น้อยที่สุด (Chest Compression Fraction > 80%) และสลับผู้กดทุก 2 นาทีเพื่อป้องกันความเหนื่อยล้า",
    cameraPos: [0, 3.5, 3.2],
    cameraTarget: [0, 0.7, 0],
  },
  {
    id: 4,
    title: "4. เปิดเครื่อง & ติดแผ่นขั้วไฟฟ้า AED",
    subtitle: "Power On AED & Pad Placement",
    phase: "aed_pads",
    description:
      "ทันทีที่เครื่อง AED มาถึง ให้เปิดเครื่องทันทีและทำตามเสียงสั่ง เช็ดเหงื่อ/น้ำที่หน้าอกให้แห้ง ติดแผ่น Pad ขั้วบวกใต้กระดูกไหปลาร้าขวา และแผ่นขั้วลบที่ชายโครงด้านซ้าย (Antero-lateral position)",
    clinicalKey: "กดหน้าอก CPR ต่อเนื่องขณะเตรียมเครื่อง หยุดกดเฉพาะช่วงที่เครื่องสั่ง 'กำลังวิเคราะห์จังหวะการเต้นของหัวใจ'",
    cameraPos: [1.8, 3.0, 2.2],
    cameraTarget: [0.3, 0.8, 0],
  },
  {
    id: 5,
    title: "5. วิเคราะห์จังหวะ & ทำการช็อกไฟฟ้า (Shock)",
    subtitle: "Safety Clear & Deliver Shock",
    phase: "shock",
    description:
      "เมื่อเครื่องแจ้งเตือน 'แนะนำให้ทำการช็อก (Shock Advised)' ให้ผู้ช่วยเหลือส่งสัญญาณเตือนเสียงดัง: 'ฉันถอย! คุณถอย! ทุกคนถอย!' กวาดสายตาตรวจเช็คไม่มีใครสัมผัสตัวผู้ป่วย แล้วกดปุ่มช็อกสีส้มกระพริบ และเริ่ม CPR ต่อทันที",
    clinicalKey: "ทันทีหลังปล่อยกระแสไฟฟ้าช็อก ให้เริ่มกดหน้าอก (CPR) ต่อทันที 2 นาที โดยไม่ต้องรอประเมินชีพจรซ้ำ",
    cameraPos: [0, 4.0, 4.0],
    cameraTarget: [0, 0.7, 0],
  },
];

/* 3D Scene Components */

// Stylized Patient Mannequin
function PatientMannequin({ phase, cprTime }: { phase: string; cprTime: number }) {
  const chestRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!chestRef.current) return;
    if (phase === "cpr") {
      // Compress chest downward rhythmically
      const sin = Math.sin(cprTime * 11.5); // ~110 bpm
      const compress = Math.max(0, sin) * 0.08;
      chestRef.current.position.y = 0.65 - compress;
    } else {
      chestRef.current.position.y = 0.65;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Hospital Bed / Mattress */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.5, 2.6]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
      </mesh>
      {/* Bed Base & Wheels */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.3, 0.08, 2.5]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
      {/* Bed Sheet */}
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[1.36, 0.04, 2.5]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
      </mesh>

      {/* Patient Body Model */}
      {/* Legs */}
      <mesh position={[-0.2, 0.65, -0.6]} rotation={[0.05, 0, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.8, 8, 16]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.6} />
      </mesh>
      <mesh position={[0.2, 0.65, -0.6]} rotation={[0.05, 0, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.8, 8, 16]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.6} />
      </mesh>

      {/* Torso & Chest Group (dynamic compression) */}
      <group ref={chestRef} position={[0, 0.65, 0.2]}>
        {/* Torso */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.56, 0.22, 0.72]} />
          <meshStandardMaterial color="#fed7aa" roughness={0.7} />
        </mesh>

        {/* CPR Target Indicator (Sternum lower half) */}
        <mesh position={[0, 0.12, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.05, 0.09, 32]} />
          <meshBasicMaterial
            color={phase === "cpr" ? "#ef4444" : "#f97316"}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* AED Electrode Pad 1: Upper Right Chest */}
        {(phase === "aed_pads" || phase === "shock") && (
          <group position={[-0.18, 0.12, 0.2]}>
            <mesh rotation={[-Math.PI / 2, 0, -0.2]}>
              <planeGeometry args={[0.12, 0.16]} />
              <meshStandardMaterial color="#22c55e" roughness={0.3} />
            </mesh>
            <pointLight color="#22c55e" intensity={1} distance={0.5} />
          </group>
        )}

        {/* AED Electrode Pad 2: Lower Left Ribs (Antero-lateral) */}
        {(phase === "aed_pads" || phase === "shock") && (
          <group position={[0.22, 0.08, -0.1]}>
            <mesh rotation={[-Math.PI / 3, 0.3, 0]}>
              <planeGeometry args={[0.12, 0.16]} />
              <meshStandardMaterial color="#22c55e" roughness={0.3} />
            </mesh>
            <pointLight color="#22c55e" intensity={1} distance={0.5} />
          </group>
        )}
      </group>

      {/* Head */}
      <mesh position={[0, 0.72, 0.75]} castShadow>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color="#fed7aa" roughness={0.7} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.34, 0.62, 0.15]} rotation={[0, 0, -0.1]} castShadow>
        <capsuleGeometry args={[0.07, 0.6, 8, 16]} />
        <meshStandardMaterial color="#fed7aa" roughness={0.7} />
      </mesh>
      <mesh position={[0.34, 0.62, 0.15]} rotation={[0, 0, 0.1]} castShadow>
        <capsuleGeometry args={[0.07, 0.6, 8, 16]} />
        <meshStandardMaterial color="#fed7aa" roughness={0.7} />
      </mesh>
    </group>
  );
}

// Rescuer Arms / Hands performing CPR
function RescuerCPR({ phase, cprTime }: { phase: string; cprTime: number }) {
  const rescuerRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!rescuerRef.current) return;
    if (phase === "cpr") {
      const sin = Math.sin(cprTime * 11.5);
      const compress = Math.max(0, sin) * 0.08;
      rescuerRef.current.position.y = 1.05 - compress;
    } else {
      rescuerRef.current.position.y = 1.05;
    }
  });

  if (phase !== "cpr" && phase !== "pulse") return null;

  return (
    <group ref={rescuerRef} position={[0, 1.05, 0.25]}>
      {/* Hands clasped together on center chest */}
      <mesh position={[0, -0.28, 0]} castShadow>
        <boxGeometry args={[0.14, 0.09, 0.14]} />
        <meshStandardMaterial color="#fed7aa" roughness={0.6} />
      </mesh>
      {/* Rescuer Straight Arms (Nursing Scrubs Cyan) */}
      <mesh position={[-0.07, 0.05, 0.05]} rotation={[0.2, 0, -0.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.5, 16]} />
        <meshStandardMaterial color="#0284c7" roughness={0.5} />
      </mesh>
      <mesh position={[0.07, 0.05, 0.05]} rotation={[0.2, 0, 0.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.5, 16]} />
        <meshStandardMaterial color="#0284c7" roughness={0.5} />
      </mesh>
      {/* Rescuer Torso/Shoulders poised directly above */}
      <mesh position={[0, 0.38, 0.15]} castShadow>
        <boxGeometry args={[0.45, 0.25, 0.25]} />
        <meshStandardMaterial color="#0284c7" roughness={0.5} />
      </mesh>
    </group>
  );
}

// 3D AED Device with blinking lights & wires
function AedDevice({ phase }: { phase: string }) {
  const blinkRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!blinkRef.current) return;
    if (phase === "shock") {
      blinkRef.current.intensity = Math.sin(clock.elapsedTime * 15) > 0 ? 3 : 0.2;
    } else if (phase === "aed_pads") {
      blinkRef.current.intensity = Math.sin(clock.elapsedTime * 6) > 0 ? 2 : 0.5;
    } else {
      blinkRef.current.intensity = 0.5;
    }
  });

  return (
    <group position={[0.95, 0.65, 0.35]}>
      {/* Side Cart / Stand */}
      <mesh position={[0, -0.3, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.55, 24]} />
        <meshStandardMaterial color="#64748b" roughness={0.7} />
      </mesh>

      {/* AED Main Unit (Red/Yellow Hospital Style) */}
      <mesh position={[0, 0.06, 0]} rotation={[-0.3, -0.4, 0]} castShadow>
        <boxGeometry args={[0.3, 0.12, 0.28]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>

      {/* AED Screen / LED Display */}
      <mesh position={[0, 0.13, 0.02]} rotation={[-0.3, -0.4, 0]}>
        <planeGeometry args={[0.18, 0.1]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>

      {/* Flashing Shock Button */}
      <group position={[0.06, 0.14, 0.07]} rotation={[-0.3, -0.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
          <meshStandardMaterial
            color={phase === "shock" ? "#f97316" : "#64748b"}
            emissive={phase === "shock" ? "#ea580c" : "#000000"}
            emissiveIntensity={phase === "shock" ? 2 : 0}
          />
        </mesh>
        <pointLight
          ref={blinkRef}
          color={phase === "shock" ? "#f97316" : "#22c55e"}
          distance={0.8}
        />
      </group>
    </group>
  );
}

// Shock Wave Visual Effect during Shock Phase
function ShockWaveEffect({ phase }: { phase: string }) {
  const waveRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!waveRef.current) return;
    if (phase === "shock") {
      const scale = 1 + (Math.sin(clock.elapsedTime * 12) + 1) * 0.4;
      waveRef.current.scale.set(scale, scale, scale);
      waveRef.current.visible = true;
    } else {
      waveRef.current.visible = false;
    }
  });

  return (
    <mesh ref={waveRef} position={[0, 0.72, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.2, 0.35, 32]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Camera Director smooth transition
function CameraRig({ targetPos, targetLookAt }: { targetPos: [number, number, number]; targetLookAt: [number, number, number] }) {
  useFrame(({ camera }) => {
    camera.position.lerp(new THREE.Vector3(...targetPos), 0.05);
    camera.lookAt(targetLookAt[0], targetLookAt[1], targetLookAt[2]);
  });
  return null;
}

/* Main Interactive Component */
export function CprWorkflowSimulation() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cprTime, setCprTime] = useState(0);

  const currentStep = CPR_STEPS[currentStepIndex] ?? CPR_STEPS[0]!;

  // Metronome Beep with Web Audio API (Synthesized 110 bpm)
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = () => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz standard metronome beep
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // Audio autoplay restrictions
    }
  };

  // Continuous animation loop for CPR rhythm
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let metronomeTimer = 0;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (currentStep.phase === "cpr") {
        setCprTime((t) => t + dt);
        metronomeTimer += dt;
        // 110 bpm = 1 beat every 0.545 seconds
        if (metronomeTimer >= 60 / 110) {
          metronomeTimer = 0;
          playBeep();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [currentStep.phase, audioEnabled]);

  // Auto-play steps progression
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      setCurrentStepIndex((prev) => (prev < CPR_STEPS.length - 1 ? prev + 1 : 0));
    }, 6500);
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < CPR_STEPS.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* 3D Canvas Viewport */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-white/30 bg-slate-950 shadow-2xl">
        <Canvas shadows camera={{ position: [0, 4, 4.5], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[4, 7, 3]}
            intensity={1.4}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-3, 4, -2]} intensity={0.5} />

          {/* Hospital Floor Grid */}
          <gridHelper args={[10, 20, "#334155", "#1e293b"]} position={[0, 0, 0]} />

          <Suspense fallback={null}>
            <PatientMannequin phase={currentStep.phase} cprTime={cprTime} />
            <RescuerCPR phase={currentStep.phase} cprTime={cprTime} />
            <AedDevice phase={currentStep.phase} />
            <ShockWaveEffect phase={currentStep.phase} />
          </Suspense>

          <CameraRig
            targetPos={currentStep.cameraPos}
            targetLookAt={currentStep.cameraTarget}
          />
          <OrbitControls enablePan={true} maxPolarAngle={Math.PI / 2.1} minDistance={1.8} maxDistance={8} />
        </Canvas>

        {/* HUD Overlay: Phase Badge & Status */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900/80 backdrop-blur-md px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
            <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
            3D Interactive Medical Simulator
          </span>
          {currentStep.phase === "cpr" && (
            <span className="flex items-center gap-1 rounded-full bg-rose-950/80 backdrop-blur-md px-3 py-1 text-xs font-bold text-rose-300 border border-rose-500/40">
              <Heart className="h-3.5 w-3.5 animate-bounce text-rose-400" />
              อัตรากด 110 ครั้ง/นาที (AHA Guideline)
            </span>
          )}
          {currentStep.phase === "shock" && (
            <span className="flex items-center gap-1 rounded-full bg-amber-950/90 backdrop-blur-md px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/50 animate-pulse">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              เตรียมปล่อยกระแสไฟฟ้าช็อก AED
            </span>
          )}
        </div>

        {/* Sound & Camera hint */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md transition-all ${
              audioEnabled
                ? "bg-emerald-600 text-white shadow-brand"
                : "bg-slate-900/80 text-slate-300 hover:text-white"
            }`}
            title="เปิด/ปิด เสียงจังหวะ Metronome"
          >
            {audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {audioEnabled ? "Metronome เปิด" : "เปิดเสียงจังหวะ"}
          </button>
        </div>

        {/* Viewport Floating Info Card */}
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none sm:left-6 sm:right-6">
          <div className="pointer-events-auto rounded-2xl bg-slate-900/85 backdrop-blur-xl p-4 border border-white/10 text-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {currentStep.id}
                </span>
                <span className="text-sm font-bold tracking-tight text-white">
                  {currentStep.title}
                </span>
              </div>
              <span className="text-[11px] text-slate-400">{currentStep.subtitle}</span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-200">
              {currentStep.description}
            </p>

            <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-500/10 p-2 text-[11px] font-medium text-amber-300 border border-amber-500/20">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong>ข้อควรระวังสำคัญ:</strong> {currentStep.clinicalKey}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Timeline Controls */}
      <div className="glass space-y-3 rounded-3xl p-5 shadow-sm">
        {/* Step Progress Bar */}
        <div className="grid grid-cols-5 gap-2">
          {CPR_STEPS.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentStepIndex(idx)}
              className={`rounded-xl p-2 text-left transition-all ${
                idx === currentStepIndex
                  ? "bg-primary text-primary-foreground font-bold shadow-brand scale-102"
                  : idx < currentStepIndex
                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold"
                  : "bg-card text-muted-foreground hover:bg-mist"
              }`}
            >
              <div className="text-[10px] opacity-75">ขั้นตอน {s.id}</div>
              <div className="text-xs truncate">{s.title.split(".")[1] || s.title}</div>
            </button>
          ))}
        </div>

        {/* Playback Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              ขั้นตอนก่อนหน้า
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="gap-1.5 text-xs font-semibold"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5 text-amber-600" /> : <Play className="h-3.5 w-3.5 text-emerald-600" />}
              {isPlaying ? "หยุดจำลองชั่วคราว" : "เล่นขั้นตอนอัตโนมัติ"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentStepIndex === CPR_STEPS.length - 1}
              className="gap-1 text-xs"
            >
              ขั้นตอนถัดไป
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentStepIndex(0);
                setIsPlaying(false);
              }}
              className="gap-1 text-xs text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              เริ่มใหม่
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
