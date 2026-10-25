import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";

export interface CelebrationHandle {
  burst: (x?: number, y?: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tilt: number;
  tiltSpeed: number;
  type: "confetti" | "ribbon" | "star";
  alpha: number;
  decay: number;
}

const PALETTE: readonly string[] = [
  "#f59e0b", // Gold
  "#fbbf24", // Light Gold
  "#0d9488", // Emerald
  "#2dd4bf", // Mint
  "#38bdf8", // Sky Blue
  "#ec4899", // Pink Ribbon
  "#8b5cf6", // Purple
  "#ffffff", // Shimmer White
];

const TYPES: readonly ("confetti" | "ribbon" | "star")[] = [
  "confetti",
  "confetti",
  "ribbon",
  "star",
];

export const CelebrationConfetti = forwardRef<CelebrationHandle, { autoTrigger?: boolean }>(
  ({ autoTrigger = true }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animIdRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(performance.now());

    const spawnParticles = useCallback((originX?: number, originY?: number, count = 120) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const startX = originX ?? canvas.width / 2;
      const startY = originY ?? canvas.height * 0.4;

      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 12 + 4;
        const color = PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? "#f59e0b";
        const type = TYPES[Math.floor(Math.random() * TYPES.length)] ?? "confetti";

        newParticles.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
          vy: Math.sin(angle) * speed - Math.random() * 6 - 3,
          size: type === "ribbon" ? Math.random() * 8 + 8 : Math.random() * 6 + 5,
          color,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          tilt: Math.random() * Math.PI,
          tiltSpeed: Math.random() * 0.12 + 0.05,
          type,
          alpha: 1,
          decay: Math.random() * 0.003 + 0.002,
        });
      }

      particlesRef.current.push(...newParticles);
    }, []);

    useImperativeHandle(ref, () => ({
      burst: (x, y) => spawnParticles(x, y, 140),
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const handleResize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
      };

      handleResize();
      window.addEventListener("resize", handleResize);

      const render = (now: number) => {
        const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = now;

        const width = window.innerWidth;
        const height = window.innerHeight;

        ctx.clearRect(0, 0, width, height);

        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          if (!p) continue;

          p.x += p.vx * delta * 60;
          p.y += p.vy * delta * 60;
          p.vy += 0.28 * delta * 60;
          p.vx *= 0.985;
          p.rotation += p.rotationSpeed;
          p.tilt += p.tiltSpeed;
          p.alpha -= p.decay * delta * 60;

          if (p.y > height + 20 || p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;

          const tiltX = Math.cos(p.tilt);

          if (p.type === "confetti") {
            ctx.scale(tiltX, 1);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          } else if (p.type === "ribbon") {
            ctx.scale(tiltX, 1);
            ctx.beginPath();
            ctx.moveTo(-p.size, -p.size * 0.2);
            ctx.bezierCurveTo(-p.size * 0.5, p.size * 0.4, p.size * 0.5, -p.size * 0.4, p.size, p.size * 0.2);
            ctx.lineWidth = 3;
            ctx.strokeStyle = p.color;
            ctx.stroke();
          } else {
            ctx.scale(tiltX, 1);
            ctx.beginPath();
            for (let s = 0; s < 5; s++) {
              ctx.lineTo(
                Math.cos(((18 + s * 72) * Math.PI) / 180) * p.size,
                -Math.sin(((18 + s * 72) * Math.PI) / 180) * p.size
              );
              ctx.lineTo(
                Math.cos(((54 + s * 72) * Math.PI) / 180) * (p.size / 2),
                -Math.sin(((54 + s * 72) * Math.PI) / 180) * (p.size / 2)
              );
            }
            ctx.closePath();
            ctx.fill();
          }

          ctx.restore();
        }

        animIdRef.current = requestAnimationFrame(render);
      };

      animIdRef.current = requestAnimationFrame(render);

      if (autoTrigger) {
        const t1 = setTimeout(() => {
          spawnParticles(window.innerWidth * 0.35, window.innerHeight * 0.35, 100);
        }, 300);
        const t2 = setTimeout(() => {
          spawnParticles(window.innerWidth * 0.65, window.innerHeight * 0.35, 100);
        }, 750);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
          window.removeEventListener("resize", handleResize);
        };
      }

      return () => {
        if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
        window.removeEventListener("resize", handleResize);
      };
    }, [autoTrigger, spawnParticles]);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 size-full no-print"
      />
    );
  }
);
