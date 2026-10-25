import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { roomWallVisibility } from "@/lib/room-wall-visibility";

/** Own material copies so loaded/cached GLBs are never changed by fading. */
export function RoomWallFade({ side, reduced, children }: { side: "front" | "left"; reduced: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const opacity = useRef(1);
  const lastFactor = useRef(-1);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const entries = useRef<{ mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; materials: { material: THREE.Material; opacity: number }[] }[]>([]);

  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;
    const copies: typeof entries.current = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material;
      const clones = (Array.isArray(original) ? original : [original]).map((material) => {
        const clone = material.clone();
        clone.transparent = true;
        clone.depthWrite = false;
        return clone;
      });
      object.material = Array.isArray(original) ? clones : clones[0];
      copies.push({
        mesh: object,
        original,
        materials: clones.map((material) => ({ material, opacity: material.opacity })),
      });
    });
    entries.current = copies;
    return () => {
      copies.forEach(({ mesh, original, materials }) => {
        mesh.material = original;
        materials.forEach(({ material }) => material.dispose());
      });
      entries.current = [];
    };
  }, []);

  useFrame(({ camera }, rawDelta) => {
    camera.getWorldDirection(direction);
    // Outward normals: front wall -Z, window wall -X.
    const target = roomWallVisibility(side === "front" ? -direction.z : -direction.x);
    const dt = Math.min(rawDelta, 0.05);
    const next = THREE.MathUtils.lerp(opacity.current, target, 1 - Math.exp(-9 * dt));
    if (Math.abs(next - opacity.current) < 0.0005 && Math.abs(opacity.current - target) < 0.0005) {
      opacity.current = target;
    } else {
      opacity.current = next;
    }

    // Map [0.05, 1.0] -> [0.0, 1.0] so wall fades completely to 0 and does not obstruct learners
    const factor = Math.max(0, Math.min(1, (opacity.current - 0.05) / 0.95));
    const isVisible = factor > 0.005;

    if (group.current && group.current.visible !== isVisible) {
      group.current.visible = isVisible;
    }

    if (isVisible && Math.abs(lastFactor.current - factor) > 0.001) {
      lastFactor.current = factor;
      for (const { materials } of entries.current) {
        for (const { material, opacity: base } of materials) {
          material.opacity = base * factor;
        }
      }
    }
  });

  return <group ref={group} name={`fading-${side}-wall`}>{children}</group>;
}