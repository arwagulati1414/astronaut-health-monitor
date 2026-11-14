"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { SHIP_ZONES, zoneById, type ShipZone } from "@/lib/ship/zones";
import { useHud } from "@/lib/store/hud";

export function ShipScene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [16, 9, 16], fov: 40 }} gl={{ antialias: true }}>
      <color attach="background" args={["#04101f"]} />
      <gridHelper args={[40, 40, "#2b7fbf", "#0a2740"]} />
      {SHIP_ZONES.map((zone) => (
        <ZoneMesh key={zone.id} zone={zone} />
      ))}
      <CrewMarkers />
      <CameraRig />
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.15} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}

function ZoneMesh({ zone }: { zone: ShipZone }) {
  const activeZoneId = useHud((state) => state.activeZoneId);
  const alerts = useHud((state) => state.alerts);
  const setActiveZone = useHud((state) => state.setActiveZone);
  const active = activeZoneId === zone.id;
  const critical = alerts.some(
    (alert) => alert.status === "open" && alert.severity === "critical" && alert.zoneId === zone.id,
  );
  const geometry = useMemo(() => {
    if (zone.shape === "cylinder") {
      return new THREE.CylinderGeometry(zone.size[0], zone.size[0], zone.size[1], 16);
    }
    return new THREE.BoxGeometry(zone.size[0], zone.size[1], zone.size[2]);
  }, [zone]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const material = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!material.current) return;
    if (!active && !critical) {
      material.current.emissiveIntensity = 0.05;
      return;
    }
    const speed = critical ? 7 : 2.4;
    material.current.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * speed) * 0.4;
  });

  return (
    <group position={zone.position}>
      <mesh
        geometry={geometry}
        onClick={(event) => {
          event.stopPropagation();
          setActiveZone(zone.id);
        }}
      >
        <meshStandardMaterial
          ref={material}
          color={active ? "#ff2d95" : "#072033"}
          emissive={critical ? "#ff1473" : "#ff2d95"}
          transparent
          opacity={active ? 0.28 : 0.08}
          roughness={0.6}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={active || critical ? "#ff2d95" : "#2b7fbf"} />
      </lineSegments>
    </group>
  );
}

function CrewMarkers() {
  const crew = useHud((state) => state.crew);
  return (
    <>
      {crew.map((member) => {
        const zone = zoneById(member.zoneId);
        if (!zone) return null;
        return (
          <mesh key={member.id} position={[zone.position[0], zone.position[1] + 0.15, zone.position[2]]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color="#ff2d95" />
          </mesh>
        );
      })}
    </>
  );
}

function CameraRig() {
  const activeZoneId = useHud((state) => state.activeZoneId);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3(16, 9, 16));
  const focus = useRef(new THREE.Vector3(0, 0.7, 0));
  const flying = useRef(false);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (seen.current === activeZoneId) return;
    seen.current = activeZoneId;
    flying.current = true;
  }, [activeZoneId]);

  useFrame((_, delta) => {
    if (!flying.current) return;
    const zone = zoneById(activeZoneId);
    if (zone) {
      desired.current.set(zone.position[0] + 8.5, zone.position[1] + 5.4, zone.position[2] + 9);
      focus.current.set(zone.position[0], zone.position[1], zone.position[2]);
    }
    const step = 1 - Math.exp(-2.2 * delta);
    camera.position.lerp(desired.current, step);
    const target = controls.current?.target;
    if (target) target.lerp(focus.current, step);
    controls.current?.update();
    if (camera.position.distanceTo(desired.current) < 0.15) flying.current = false;
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={4}
      maxDistance={28}
    />
  );
}
