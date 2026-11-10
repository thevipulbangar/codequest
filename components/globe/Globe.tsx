"use client";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const R = 1;
export const ll2v = (lat: number, lon: number, r = R) => {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

export interface GlobeStation { id: string; name: string; lat: number; lon: number }
/** Illustrative circular orbit (landing page only — labelled as illustrative). */
interface Orbit { incl: number; raan: number; alt: number; periodS: number; color: string }

function Earth() {
  const [day, night] = useLoader(THREE.TextureLoader, ["/tex/earth.jpg", "/tex/earth-night.jpg"]);
  return (
    <group>
      <ambientLight intensity={0.35} color="#7aa2ff" />
      <directionalLight position={[4, 2, 3]} intensity={2.4} color="#fff3e0" />
      <pointLight position={[-4, -1, -2]} intensity={1.2} color="#3b82f6" />
      <mesh>
        <sphereGeometry args={[R, 96, 96]} />
        <meshStandardMaterial map={day} map-colorSpace={THREE.SRGBColorSpace} emissiveMap={night} emissiveMap-colorSpace={THREE.SRGBColorSpace} emissive="#ffd9a0" emissiveIntensity={1.6} roughness={0.9} metalness={0} />
      </mesh>
      {/* atmosphere */}
      <mesh scale={1.14}>
        <sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false}
          vertexShader="varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader="varying vec3 n;void main(){float i=pow(.62-dot(n,vec3(0,0,1.)),3.);gl_FragColor=vec4(.2,.55,1.,1.)*i;}" />
      </mesh>
    </group>
  );
}

function Marker({ s }: { s: GlobeStation }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => ref.current.scale.setScalar(1 + 0.35 * Math.sin(clock.elapsedTime * 3 + s.lat)));
  return (
    <group position={ll2v(s.lat, s.lon, R * 1.005)}>
      <mesh><sphereGeometry args={[0.012, 12, 12]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      <mesh ref={ref}><sphereGeometry args={[0.024, 12, 12]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.25} /></mesh>
    </group>
  );
}

function SatOrbit({ o, stations }: { o: Orbit; stations: GlobeStation[] }) {
  const sat = useRef<THREE.Mesh>(null!);
  const link = useRef<THREE.Line>(null!);
  const r = R + o.alt;
  const rot = useMemo(() => new THREE.Euler(THREE.MathUtils.degToRad(o.incl), THREE.MathUtils.degToRad(o.raan), 0, "YXZ"), [o]);
  const ring = useMemo(() => {
    const pts = Array.from({ length: 129 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); });
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [r]);
  const linkGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const a = (clock.elapsedTime / o.periodS) * Math.PI * 2;
    tmp.set(Math.cos(a) * r, 0, Math.sin(a) * r).applyEuler(rot);
    sat.current.position.copy(tmp);
    // communication line to nearest station with line-of-sight (satellite above that station's horizon)
    let best: THREE.Vector3 | null = null, bd = 1e9;
    for (const s of stations) { const p = ll2v(s.lat, s.lon, R); if (p.dot(tmp) > R * R * 1.06 && p.distanceTo(tmp) < bd) { bd = p.distanceTo(tmp); best = p; } }
    link.current.visible = !!best;
    if (best) linkGeo.setFromPoints([tmp, best]);
  });
  return (
    <>
      <group rotation={rot}><lineLoop geometry={ring}><lineBasicMaterial color={o.color} transparent opacity={0.45} /></lineLoop></group>
      <mesh ref={sat}><boxGeometry args={[0.03, 0.03, 0.03]} /><meshBasicMaterial color="#fff" /></mesh>
      <primitive object={useMemo(() => { const l = new THREE.Line(linkGeo, new THREE.LineBasicMaterial({ color: "#22d3ee", transparent: true, opacity: 0.8 })); return l; }, [linkGeo])} ref={link} />
    </>
  );
}

export default function Globe({ stations, interactive = true, autoRotate = true }: { stations: GlobeStation[]; interactive?: boolean; autoRotate?: boolean }) {
  const orbits: Orbit[] = [
    { incl: 51.6, raan: 20, alt: 0.18, periodS: 28, color: "#3b82f6" },
    { incl: 97.4, raan: 120, alt: 0.24, periodS: 36, color: "#22d3ee" },
    { incl: 63, raan: 250, alt: 0.32, periodS: 46, color: "#6366f1" },
  ];
  return (
    <Canvas camera={{ position: [0, 0.4, 3.1], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <Earth />
      {stations.map(s => <Marker key={s.id} s={s} />)}
      {orbits.map((o, i) => <SatOrbit key={i} o={o} stations={stations} />)}
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={interactive && !(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches)} autoRotate={autoRotate} autoRotateSpeed={0.5} />
    </Canvas>
  );
}

