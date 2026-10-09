import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { roomWallVisibility } from "@/lib/room-wall-visibility";

/** Own material copies so loaded/cached GLBs are never changed by fading. */
export function RoomWallFade({ side, reduced, children }: { side: "front" | "left"; reduced: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const opacity = useRef(1);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const entries = useRef<{ mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; materials: { material: THREE.Material; opacity: number; depthWrite: boolean }[]; shadow: boolean }[]>([]);

  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;
    const copies: typeof entries.current = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material;
      const clones = (Array.isArray(original) ? original : [original]).map((material) => material.clone());
      object.material = Array.isArray(original) ? clones : clones[0];
      copies.push({ mesh: object, original, shadow: object.castShadow, materials: clones.map((material) => {
        const entry = { material, opacity: material.opacity, depthWrite: material.depthWrite };
        material.transparent = true;
        return entry;
      }) });
    });
    entries.current = copies;
    return () => {
      copies.forEach(({ mesh, original, materials, shadow }) => {
        mesh.material = original;
        mesh.castShadow = shadow;
        materials.forEach(({ material }) => material.dispose());
      });
      entries.current = [];
    };
  }, [children]);

  useFrame(({ camera }, rawDelta) => {
    camera.getWorldDirection(direction);
    // Outward normals: front wall -Z, window wall -X.
    const target = roomWallVisibility(side === "front" ? -direction.z : -direction.x);
    opacity.current = THREE.MathUtils.lerp(opacity.current, target, reduced ? 1 : 1 - Math.exp(-9 * Math.min(rawDelta, 0.05)));
    for (const { mesh, materials, shadow } of entries.current) {
      mesh.castShadow = shadow && opacity.current > 0.98;
      for (const { material, opacity: base, depthWrite } of materials) {
        material.opacity = base * opacity.current;
        material.depthWrite = depthWrite && opacity.current > 0.98;
      }
    }
  });

  return <group ref={group} name={`fading-${side}-wall`}>{children}</group>;
}