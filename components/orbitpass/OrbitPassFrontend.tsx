"use client";

/**
 * OrbitPass — portable frontend (public site + opening cinematic).
 *
 * ONE FILE, NO BACKEND. Everything this file needs comes in through props:
 *   - data      : `stations`, `network`, `session`  (typed below)
 *   - actions   : `onSearchPasses`, `onCheckSatellite`, `onBookStation`, `onSignIn`, `onListStation`, `onNavigate`
 *   - routes    : where plain links point when no callback is given
 *
 * It imports only `react` and (lazily, in the browser) `three`. It does not import a router,
 * a database client, environment variables or any server code. Styles are scoped under `.op-root`.
 *
 * Quick start:
 *   import OrbitPassFrontend from "./OrbitPassFrontend";
 *   <OrbitPassFrontend
 *     stations={{ status: "ready", data: stationsFromYourApi }}
 *     network={{ status: "ready", data: statsFromYourApi }}
 *     session={currentUserOrNull}
 *     onSearchPasses={q => router.push(`/dashboard/operator/find-pass?hours=${q.hours}`)}
 *   />
 *
 * Rendered with no `stations` / `network` props it shows the SAMPLE data at the bottom of the
 * "sample data" block and labels it as sample on screen.
 */

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────────────────── */

/** A verified, bookable ground station. Only fields the OrbitPass API really returns. */
export interface OrbitPassStation {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  altitudeM?: number;
  antennaType: string;
  antennaSizeM: number;
  bands: string[];
  protocols?: string[];
  /** Price per pass in platform credits. Always supplied by the backend, never computed here. */
  pricePerPass: number;
  ownerName?: string;
  /** 0–100, or null/undefined while the station has no settled passes ("New"). */
  reliabilityScore?: number | null;
  /** Predicted passes (max elevation ≥ 10°) over this station in the next 24 h. */
  passes24h?: number;
  /** Predicted contact minutes over this station in the next 24 h. */
  contactMin24h?: number;
}

/** Network-wide figures over active, verified assets. */
export interface OrbitPassNetwork {
  stations: number;
  satellites: number;
  passes24h: number;
  contactMin24h: number;
  /** Epoch ms the figures were computed at. */
  generatedAt?: number;
}

/** Explicit loading / failure / ready wrapper so the page never has to guess. */
export type OrbitPassData<T> =
  | { status: "loading" }
  | { status: "unavailable"; message?: string }
  | { status: "ready"; data: T; /** true = illustrative values, labelled on screen */ sample?: boolean };

export interface OrbitPassSession {
  name: string;
  role: "operator" | "owner" | "admin";
}

/** Filters the pass finder backend supports (GET /api/v1/passes). */
export interface PassSearchQuery {
  /** Optional: the satellite the visitor has in mind. Passes are predicted for registered satellites only. */
  noradId?: number;
  band?: string;
  /** Look-ahead window, 1–72 hours. */
  hours: number;
  /** Minimum peak elevation in degrees, 0–90. */
  minElevationDeg: number;
}

/** Public identity record for a NORAD catalogue number (GET /api/v1/satellite-check). Never proves ownership. */
export interface SatelliteIdentity {
  noradId: number;
  found: boolean;
  name?: string;
  internationalDesignator?: string;
  epoch?: string;
}

export interface OrbitPassRoutes {
  findPass: string;
  listStation: string;
  signIn: string;
  signUpOperator: string;
  dashboard: string;
  terms: string;
  privacy: string;
  /** Guaranteed Downlink planner (operators). */
  guarantee: string;
  /** Public earnings estimate for station owners. */
  estimate: string;
}

export interface OrbitPassFrontendProps {
  /** Verified stations. Omit to render labelled sample data. */
  stations?: OrbitPassData<OrbitPassStation[]>;
  /** Network snapshot. Omit to render labelled sample data. */
  network?: OrbitPassData<OrbitPassNetwork>;
  /** `undefined` = still loading, `null` = signed out. */
  session?: OrbitPassSession | null;
  routes?: Partial<OrbitPassRoutes>;
  /** Frequency bands the backend accepts. */
  bands?: readonly string[];
  /** Earth textures for the cinematic (equirectangular). Falls back to a drawn globe if they fail to load. */
  assets?: { earthDay?: string; earthNight?: string };
  /** "auto": play once per browser session. "off": never play. */
  intro?: "auto" | "off";

  /** Client-side navigation hook (e.g. `router.push`). Without it links are normal page loads. */
  onNavigate?: (href: string) => void;
  /** Start a pass search. Return a string to show it to the visitor instead of navigating. */
  onSearchPasses?: (query: PassSearchQuery) => void | string | Promise<void | string>;
  /** Look a NORAD ID up in public records. */
  onCheckSatellite?: (noradId: number) => Promise<SatelliteIdentity>;
  /** "See passes" on a station preview. Return a string to show it instead of navigating. */
  onBookStation?: (station: OrbitPassStation) => void | string | Promise<void | string>;
  onSignIn?: () => void;
  onListStation?: () => void;
}

/* ────────────────────────────────────────────────────────────────────────────
 * SAMPLE DATA — illustrative only. Shown (and labelled "Sample data") when the
 * `stations` / `network` props are omitted. Replace by passing real data.
 * ──────────────────────────────────────────────────────────────────────────── */

export const SAMPLE_STATIONS: OrbitPassStation[] = [
  { id: "sample-1", name: "Sample station, Reykjavík", country: "Iceland", latitude: 64.13, longitude: -21.94, altitudeM: 40, antennaType: "Parabolic dish", antennaSizeM: 3.7, bands: ["S", "X"], protocols: ["CCSDS"], pricePerPass: 120, reliabilityScore: null, passes24h: 14, contactMin24h: 96 },
  { id: "sample-2", name: "Sample station, Bengaluru", country: "India", latitude: 12.97, longitude: 77.59, altitudeM: 920, antennaType: "Yagi array", antennaSizeM: 2.4, bands: ["VHF", "UHF"], protocols: ["AX.25"], pricePerPass: 35, reliabilityScore: 92, passes24h: 9, contactMin24h: 61 },
  { id: "sample-3", name: "Sample station, Punta Arenas", country: "Chile", latitude: -53.16, longitude: -70.92, altitudeM: 30, antennaType: "Parabolic dish", antennaSizeM: 5.0, bands: ["S"], protocols: ["CCSDS", "DVB-S2"], pricePerPass: 150, reliabilityScore: 88, passes24h: 15, contactMin24h: 114 },
];
export const SAMPLE_NETWORK: OrbitPassNetwork = { stations: 3, satellites: 5, passes24h: 38, contactMin24h: 271 };

const DEFAULT_ROUTES: OrbitPassRoutes = {
  findPass: "/dashboard/operator/find-pass",
  listStation: "/login?as=owner&mode=signup",
  signIn: "/login",
  signUpOperator: "/login?as=operator&mode=signup",
  dashboard: "/dashboard",
  terms: "/terms",
  privacy: "/privacy",
  guarantee: "/login?as=operator&next=%2Fdashboard%2Foperator%2Fcontracts",
  estimate: "/estimate",
};
const DEFAULT_BANDS = ["VHF", "UHF", "L", "S", "X", "Ku", "Ka"] as const;
const DEFAULT_ASSETS = { earthDay: "/tex/earth.jpg", earthNight: "/tex/earth-night.jpg" };
const INTRO_KEY = "orbitpass:intro-seen";

/* ────────────────────────────────────────────────────────────────────────────
 * Emblem geometry — shared by the SVG mark and the particle target shape,
 * so the WebGL emblem and its static fallback are the same drawing.
 * Units: emblem space, x right, y up, planet centred on the origin.
 * ──────────────────────────────────────────────────────────────────────────── */

const EM = {
  planetR: 0.62,
  orbitA: 1.0,
  orbitB: 0.34,
  tilt: (24 * Math.PI) / 180,
  satTheta: (-35 * Math.PI) / 180,
  ground: [0.26, -0.17] as const,
};
function orbitPoint(theta: number): [number, number] {
  const x = EM.orbitA * Math.cos(theta), y = EM.orbitB * Math.sin(theta);
  const c = Math.cos(EM.tilt), s = Math.sin(EM.tilt);
  return [x * c - y * s, x * s + y * c];
}
/** The far half of the orbit is hidden where it passes behind the planet. */
function orbitHidden(theta: number) {
  const [x, y] = orbitPoint(theta);
  return Math.sin(theta) > 0 && Math.hypot(x, y) < EM.planetR;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Opening cinematic (WebGL, three.js loaded on demand)
 *
 * Timeline, in seconds:
 *   0.0  deep space: stars and faint orbit markings
 *   0.9  Earth fades up, slow rotation, camera push
 *   2.0  satellites enter on three orbits, trails and contact signals
 *   4.9  globe dissolves into particles (right edge first)
 *   5.2  particles sweep in an arc and gather into the emblem
 *   6.4  wordmark cue
 *   7.7  resolved: this frame is the hero
 * ──────────────────────────────────────────────────────────────────────────── */

const T_EARTH = 0.9, T_DISSOLVE = 4.9, T_WORDMARK = 6.4, T_END = 7.7;
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface Cinematic { skip(): void; dispose(): void }
interface CinematicOptions {
  canvas: HTMLCanvasElement;
  /** Element whose box the emblem should fill. */
  anchor: HTMLElement;
  mode: "play" | "resolved";
  lite: boolean;
  assets: { earthDay?: string; earthNight?: string };
  /** Real station coordinates for contact signals; a few illustrative points are used when empty. */
  ground: { lat: number; lon: number }[];
  onCue(cue: "wordmark" | "done"): void;
}

const ILLUSTRATIVE_GROUND = [{ lat: 64.1, lon: -21.9 }, { lat: -33.9, lon: 18.4 }, { lat: 13, lon: 77.6 }, { lat: 35.7, lon: 139.7 }, { lat: -53.2, lon: -70.9 }, { lat: 40.4, lon: -3.7 }];

async function startCinematic(o: CinematicOptions): Promise<Cinematic> {
  const THREE = await import("three");
  const { canvas, anchor, lite } = o;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 0, 6);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const rnd = rng(20261113);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.6;

  const ll2v = (lat: number, lon: number, r = 1) => {
    const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };
  const SUN = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();

  /* Stars ------------------------------------------------------------------ */
  const starCount = lite ? 520 : 1300;
  const starPos = new Float32Array(starCount * 3), starMisc = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = rnd() * 2 - 1, th = rnd() * TAU, r = 40 + rnd() * 30, s = Math.sqrt(1 - u * u);
    starPos.set([r * s * Math.cos(th), r * u, -Math.abs(r * s * Math.sin(th)) - 6], i * 3);
    starMisc.set([0.6 + Math.pow(rnd(), 3) * 2.0, rnd() * TAU, 0.25 + rnd() * 0.75], i * 3);
  }
  const starGeo = keep(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("aMisc", new THREE.BufferAttribute(starMisc, 3));
  const starMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uPx: { value: dpr } },
    vertexShader: "attribute vec3 aMisc;uniform float uTime,uPx;varying float vA;void main(){vA=aMisc.z*(0.72+0.28*sin(uTime*0.6+aMisc.y));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aMisc.x*uPx;}",
    fragmentShader: "uniform float uAlpha;varying float vA;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(.86,.9,.94,smoothstep(.5,.05,r)*vA*uAlpha);}",
  }));
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  /* World: Earth, atmosphere, orbits (scaled as one to fit narrow screens) -- */
  const world = new THREE.Group();
  scene.add(world);
  const globe = new THREE.Group();
  world.add(globe);

  const earthUniforms = {
    uDay: { value: null as unknown }, uNight: { value: null as unknown },
    uHasDay: { value: 0 }, uHasNight: { value: 0 }, uOpacity: { value: 0 }, uSun: { value: SUN },
  };
  const earthGeo = keep(new THREE.SphereGeometry(1, lite ? 48 : 96, lite ? 48 : 96));
  const earthMat = keep(new THREE.ShaderMaterial({
    transparent: true, uniforms: earthUniforms,
    vertexShader: "varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 wp=modelMatrix*vec4(position,1.);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}",
    fragmentShader: `uniform sampler2D uDay,uNight;uniform float uHasDay,uHasNight,uOpacity;uniform vec3 uSun;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
      void main(){
        float nl=dot(vN,uSun);float day=smoothstep(-.18,.38,nl);
        vec3 d=uHasDay>.5?texture2D(uDay,vUv).rgb:mix(vec3(.05,.17,.27),vec3(.1,.3,.33),.5+.5*sin(vUv.y*9.+sin(vUv.x*12.566)*1.4));
        vec3 n=uHasNight>.5?texture2D(uNight,vUv).rgb:vec3(0.);
        vec3 col=(d*1.18+.015)*(.05+1.05*day)*mix(vec3(.8,.9,1.),vec3(1.04,1.,.93),day);
        col+=n*vec3(1.,.76,.46)*(1.-day)*.85;
        float fres=pow(1.-max(dot(vN,vV),0.),2.6);
        col+=vec3(.2,.56,.66)*fres*(.12+.7*day);
        col+=vec3(.9,.5,.22)*fres*smoothstep(.3,0.,abs(nl))*.22;
        gl_FragColor=vec4(col,uOpacity);
      }`,
  }));
  const earth = new THREE.Mesh(earthGeo, earthMat);
  globe.add(earth);

  const atmoMat = keep(new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: "varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform float uOpacity;varying vec3 n;void main(){float i=pow(clamp(.62-dot(n,vec3(0.,0.,1.)),0.,1.),3.6);gl_FragColor=vec4(vec3(.2,.55,.68)*i*uOpacity,1.);}",
  }));
  const atmo = new THREE.Mesh(earthGeo, atmoMat);
  atmo.scale.setScalar(1.1);
  world.add(atmo);

  // Ground points (real stations when provided)
  const groundSrc = (o.ground.length ? o.ground : ILLUSTRATIVE_GROUND).slice(0, 8);
  const groundLocal = groundSrc.map(g => ll2v(g.lat, g.lon, 1));
  const dotMaterial = (color: number, size: number) => keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uAlpha: { value: 0 }, uSize: { value: size * dpr }, uColor: { value: new THREE.Color(color) } },
    vertexShader: "uniform float uSize;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=uSize;}",
    fragmentShader: "uniform float uAlpha;uniform vec3 uColor;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.2,r)*.45+smoothstep(.22,.08,r)*.55;gl_FragColor=vec4(uColor,a*uAlpha);}",
  }));
  const groundGeo = keep(new THREE.BufferGeometry().setFromPoints(groundLocal.map(v => v.clone().multiplyScalar(1.008))));
  const groundMat = dotMaterial(0xe5a862, 6);
  globe.add(new THREE.Points(groundGeo, groundMat));

  // Orbits
  const ORBITS = [
    { incl: 52, raan: 18, r: 1.24, period: 9.5, phase: 2.6, enter: 2.0 },
    { incl: 97, raan: 128, r: 1.4, period: 12.5, phase: 0.4, enter: 2.45 },
    { incl: 66, raan: 246, r: 1.6, period: 16, phase: 4.3, enter: 2.9 },
  ];
  const SEG = 220;
  const orbits = ORBITS.map(def => {
    const rot = new THREE.Euler(THREE.MathUtils.degToRad(def.incl), THREE.MathUtils.degToRad(def.raan), 0, "YXZ");
    const pos = new Float32Array(SEG * 3), ang = new Float32Array(SEG);
    for (let i = 0; i < SEG; i++) { const a = (i / SEG) * TAU; pos.set([Math.cos(a) * def.r, 0, Math.sin(a) * def.r], i * 3); ang[i] = a; }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aAng", new THREE.BufferAttribute(ang, 1));
    const mat = keep(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uHead: { value: 0 }, uTrail: { value: 0 }, uRing: { value: 0 } },
      vertexShader: "attribute float aAng;uniform float uHead;varying float vB;void main(){vB=mod(uHead-aAng+6.2831853,6.2831853);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "uniform float uTrail,uRing;varying float vB;void main(){float t=pow(max(0.,1.-vB/1.9),2.4);gl_FragColor=vec4(mix(vec3(.62,.72,.78),vec3(.96,.9,.8),t),uRing*.16+uTrail*t*.9);}",
    }));
    const ring = new THREE.LineLoop(geo, mat);
    ring.rotation.copy(rot);
    world.add(ring);
    const headGeo = keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]));
    const headMat = dotMaterial(0xfff4e2, 9);
    const head = new THREE.Points(headGeo, headMat);
    head.frustumCulled = false;
    world.add(head);
    const linkGeo = keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
    const linkMat = keep(new THREE.LineBasicMaterial({ color: 0x8de4f2, transparent: true, opacity: 0, depthWrite: false }));
    const link = new THREE.Line(linkGeo, linkMat);
    link.frustumCulled = false;
    world.add(link);
    return { def, rot, mat, head, headMat, link, linkGeo, linkMat, p: new THREE.Vector3() };
  });

  /* Particles: the globe's surface, later the emblem --------------------------- */
  const N = lite ? 6500 : 15000;
  const aSphere = new Float32Array(N * 3), aTarget = new Float32Array(N * 3), aCol0 = new Float32Array(N * 3), aCol1 = new Float32Array(N * 3), aRnd = new Float32Array(N * 3), aEnd = new Float32Array(N * 2);
  const uvs = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const lat = (Math.asin(rnd() * 2 - 1) * 180) / Math.PI, lon = rnd() * 360 - 180;
    const v = ll2v(lat, lon, 1);
    aSphere.set([v.x, v.y, v.z], i * 3);
    uvs.set([(lon + 180) / 360, (90 - lat) / 180], i * 2);
    aCol0.set([0.16, 0.36, 0.42], i * 3);
    aRnd.set([rnd(), rnd(), rnd()], i * 3);
  }
  // Emblem targets. aK.x is the particle's role in the finished emblem:
  //   0 fixed point, 1 downlink packet (aK.y = phase), 2 surface of the turning globe, 3 reception pulse (aK.y = angle)
  const MOON = [0.9, 0.93, 0.9], TEAL = [0.49, 0.81, 0.77], AMBER = [0.93, 0.68, 0.38], OCEAN = [0.3, 0.6, 0.6], LAND = [0.93, 0.98, 0.94];
  const [sx, sy] = orbitPoint(EM.satTheta), [gx, gy] = EM.ground;
  const aK = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const k = i / N;
    let x = 0, y = 0, z = 0, size = 1.3, alpha = 0.8, col = MOON;
    if (k < 0.1) { // planet limb, lit from the upper left
      const a = rnd() * TAU, r = EM.planetR + gauss() * 0.006;
      x = Math.cos(a) * r; y = Math.sin(a) * r;
      const lit = clamp01(Math.cos(a - 2.36) * 0.5 + 0.5);
      alpha = 0.22 + 0.78 * lit; size = 1.25 + 0.5 * lit;
    } else if (k < 0.58) { // globe surface: keeps its own latitude/longitude and turns (land is brightened once the map loads)
      aK[i * 2] = 2;
      col = OCEAN; alpha = 0.4; size = 1.1;
    } else if (k < 0.79) { // orbit
      let th = rnd() * TAU, guard = 0;
      while (orbitHidden(th) && guard++ < 20) th = rnd() * TAU;
      const p = orbitPoint(th);
      x = p[0] + gauss() * 0.004; y = p[1] + gauss() * 0.004;
      const front = Math.sin(th) < 0 ? 1 : 0.5;
      col = TEAL; alpha = 0.85 * front; size = 1.3;
    } else if (k < 0.83) { // downlink: packets of frames travelling from the satellite to the station
      aK.set([1, Math.floor(rnd() * 9) / 9 + rnd() * 0.035], i * 2);
      col = AMBER; alpha = 0.95; size = 1.5;
    } else if (k < 0.85) { // reception pulse around the station
      aK.set([3, rnd() * TAU], i * 2);
      col = AMBER; alpha = 0.7; size = 1.1;
    } else if (k < 0.9) { // satellite and ground nodes
      const sat = rnd() < 0.62, sp = sat ? 0.016 : 0.011;
      x = (sat ? sx : gx) + gauss() * sp; y = (sat ? sy : gy) + gauss() * sp;
      col = AMBER; alpha = 1; size = sat ? 2.3 : 1.9;
    } else { // dust
      const a = rnd() * TAU, r = 0.72 + Math.pow(rnd(), 1.6) * 0.62;
      x = Math.cos(a) * r * 1.08; y = Math.sin(a) * r * 0.9;
      alpha = 0.1 + rnd() * 0.3; size = 0.9 + rnd() * 0.5;
    }
    aTarget.set([x, y, z], i * 3);
    aCol1.set(col, i * 3);
    aEnd.set([size, alpha], i * 2);
  }
  const pGeo = keep(new THREE.BufferGeometry());
  pGeo.setAttribute("position", new THREE.BufferAttribute(aSphere, 3));
  pGeo.setAttribute("aTarget", new THREE.BufferAttribute(aTarget, 3));
  const col0Attr = new THREE.BufferAttribute(aCol0, 3);
  pGeo.setAttribute("aCol0", col0Attr);
  const col1Attr = new THREE.BufferAttribute(aCol1, 3), endAttr = new THREE.BufferAttribute(aEnd, 2);
  pGeo.setAttribute("aCol1", col1Attr);
  pGeo.setAttribute("aRnd", new THREE.BufferAttribute(aRnd, 3));
  pGeo.setAttribute("aEnd", endAttr);
  pGeo.setAttribute("aK", new THREE.BufferAttribute(aK, 2));
  const pUniforms = {
    uT: { value: -10 }, uTime: { value: 0 }, uRot: { value: 0 }, uGlobe: { value: 1 }, uEScale: { value: 1 },
    uPx: { value: dpr }, uAlpha: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uSun: { value: SUN },
    uSat: { value: new THREE.Vector2(sx, sy) }, uGnd: { value: new THREE.Vector2(gx, gy) }, uPlanet: { value: EM.planetR * 0.97 },
  };
  const pMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, uniforms: pUniforms,
    vertexShader: `attribute vec3 aTarget,aCol0,aCol1,aRnd;attribute vec2 aEnd,aK;
      uniform float uT,uTime,uRot,uGlobe,uEScale,uPx,uAlpha,uPlanet;uniform vec3 uCenter,uSun;uniform vec2 uSat,uGnd;varying vec3 vCol;varying float vA;
      void main(){
        float c=cos(uRot),s=sin(uRot);
        vec3 sp=vec3(c*position.x+s*position.z,position.y,-s*position.x+c*position.z);
        float delay=(1.-(sp.x*.5+.5))*.72+aRnd.x*.3;
        float p=clamp((uT-delay)/1.75,0.,1.);
        float e=p*p*p*(p*(p*6.-15.)+10.);
        float bow=sin(3.14159*p);
        vec3 tg=aTarget;float vis=1.;
        if(aK.x>1.5&&aK.x<2.5){
          float a=uRot+uTime*.06,ca=cos(a),sa=sin(a);
          vec3 q=vec3(ca*position.x+sa*position.z,position.y,-sa*position.x+ca*position.z);
          q=vec3(q.x,.93*q.y-.36*q.z,.36*q.y+.93*q.z);
          tg=vec3(q.xy*uPlanet,0.);
          vis=smoothstep(-.02,.25,q.z)*(.45+.55*clamp(dot(q,vec3(-.55,.5,.67)),0.,1.));
        }else if(aK.x>.5&&aK.x<1.5){
          float f=fract(aK.y+uTime*.14);
          tg=vec3(mix(uSat,uGnd,f),0.);vis=smoothstep(0.,.1,f)*smoothstep(1.,.88,f);
        }else if(aK.x>2.5){
          float f=fract(uTime*.5+aRnd.z*.12);
          tg=vec3(uGnd+vec2(cos(aK.y),sin(aK.y)*.8)*(.025+.12*f),0.);vis=(1.-f)*(1.-f);
        }
        vec3 target=uCenter+tg*uEScale;
        vec3 arc=vec3(-.2+.5*(aRnd.y-.5),.5+.55*aRnd.y,.75*aRnd.z)*bow*(.55+.6*aRnd.z)*uGlobe;
        vec3 pos=mix(sp*uGlobe,target,e)+arc;
        pos.xy+=e*.0045*uEScale*vec2(sin(uTime*.8+aRnd.y*40.),cos(uTime*.65+aRnd.z*40.));
        vec4 mv=viewMatrix*vec4(pos,1.);
        gl_Position=projectionMatrix*mv;
        float facing=smoothstep(-.12,.3,sp.z);
        float light=.22+.9*smoothstep(-.15,.4,dot(sp,uSun));
        vCol=mix(aCol0*light,aCol1,smoothstep(.12,.8,p));
        vA=uAlpha*mix(facing*.9,aEnd.y*vis,e);
        gl_PointSize=mix(1.9,aEnd.x,e)*(1.+1.1*bow*aRnd.z)*uPx*(6./-mv.z);
      }`,
    fragmentShader: "varying vec3 vCol;varying float vA;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(vCol,smoothstep(.5,.1,r)*vA);}",
  }));
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  scene.add(particles);

  /* Textures (never block the timeline for more than a few seconds) ----------- */
  let earthReady = false;
  const loader = new THREE.TextureLoader();
  const loadDay = o.assets.earthDay
    ? loader.loadAsync(o.assets.earthDay).then(tex => {
        keep(tex);
        tex.anisotropy = lite ? 2 : 8;
        earthUniforms.uDay.value = tex; earthUniforms.uHasDay.value = 1;
        try { // colour the particles from the same map
          const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
          const cx = cv.getContext("2d", { willReadFrequently: true });
          if (cx) {
            cx.drawImage(tex.image as CanvasImageSource, 0, 0, 512, 256);
            const px = cx.getImageData(0, 0, 512, 256).data;
            for (let i = 0; i < N; i++) {
              const ix = Math.min(511, Math.floor(uvs[i * 2] * 512)), iy = Math.min(255, Math.floor(uvs[i * 2 + 1] * 256)), q = (iy * 512 + ix) * 4;
              aCol0.set([Math.min(1, px[q] / 255 * 1.5 + 0.05), Math.min(1, px[q + 1] / 255 * 1.5 + 0.07), Math.min(1, px[q + 2] / 255 * 1.5 + 0.1)], i * 3);
              if (aK[i * 2] === 2) { // continents bright, oceans faint, on the emblem's globe
                const land = (px[q] + px[q + 1]) / 2 > px[q + 2] * 1.02 || px[q] + px[q + 1] + px[q + 2] > 450;
                aCol1.set(land ? LAND : OCEAN, i * 3);
                aEnd.set(land ? [1.75, 1] : [1.15, 0.26], i * 2);
              }
            }
            col0Attr.needsUpdate = col1Attr.needsUpdate = endAttr.needsUpdate = true;
          }
        } catch { /* tainted canvas: keep the flat tint */ }
      }).catch(err => { console.warn("[OrbitPass] Earth texture unavailable, drawing a plain globe.", err); })
    : Promise.resolve();
  Promise.race([loadDay, new Promise(r => setTimeout(r, 5000))]).then(() => { earthReady = true; });
  if (!lite && o.assets.earthNight && o.mode === "play") {
    loader.loadAsync(o.assets.earthNight).then(tex => { keep(tex); earthUniforms.uNight.value = tex; earthUniforms.uHasNight.value = 1; }).catch(() => {});
  }

  /* Layout -------------------------------------------------------------------- */
  let disposed = false, visW = 1, visH = 1;
  function layout() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visH = 2 * 6 * Math.tan((35 * Math.PI) / 360); visW = visH * camera.aspect;
    const gs = Math.min(1, visW * 0.3);
    world.scale.setScalar(gs);
    pUniforms.uGlobe.value = gs;
    const c = canvas.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    const cx = (a.left + a.width / 2 - c.left) / c.width, cy = (a.top + a.height / 2 - c.top) / c.height;
    pUniforms.uCenter.value.set((cx - 0.5) * visW, (0.5 - cy) * visH, 0);
    pUniforms.uEScale.value = (Math.min(a.width / 2.12, a.height / 1.66) / c.height) * visH;
    const px = dpr * Math.min(1.35, Math.max(0.8, h / 880));
    pUniforms.uPx.value = px; starMat.uniforms.uPx.value = dpr;
  }
  layout();
  const ro = new ResizeObserver(() => { if (!disposed) { layout(); if (!running) renderOnce(); } });
  ro.observe(canvas); ro.observe(anchor);

  /* Clock --------------------------------------------------------------------- */
  let t = o.mode === "resolved" ? T_END + 1 : 0, wall = 0, last = performance.now(), raf = 0, running = false;
  let cuedWord = o.mode === "resolved", cuedDone = o.mode === "resolved", rotFrozen = 0, rotIsFrozen = false, onScreen = true;
  const tmp = new THREE.Vector3(), gw = new THREE.Vector3();

  function frame(now: number) {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    wall += dt;
    if (t < T_EARTH || earthReady) t += dt; // hold in deep space until the Earth can be drawn
    update();
    renderer.render(scene, camera);
    const settled = t > T_END + 0.6;
    if (onScreen && !document.hidden && !(settled && lite)) { running = true; raf = requestAnimationFrame(frame); } else running = false;
  }
  function renderOnce() { if (!disposed) { update(); renderer.render(scene, camera); } }
  function wake() { if (!running && !disposed && !raf) { last = performance.now(); running = true; raf = requestAnimationFrame(frame); } }

  function update() {
    const intro = 1 - sstep(T_DISSOLVE, T_DISSOLVE + 0.8, t);
    starMat.uniforms.uTime.value = wall;
    starMat.uniforms.uAlpha.value = sstep(0, 1.1, t);
    stars.rotation.z = wall * 0.004;

    const push = 1 - clamp01((t - 0.4) / (T_DISSOLVE - 0.5));
    camera.position.z = 6 + 2.6 * push * push * push;

    const rot = 3.9 + Math.min(t, T_DISSOLVE + 0.3) * 0.11;
    if (t >= T_DISSOLVE + 0.3 && !rotIsFrozen) { rotIsFrozen = true; rotFrozen = rot; }
    globe.rotation.y = rotIsFrozen ? rotFrozen : rot;
    world.visible = intro > 0.001;
    earthUniforms.uOpacity.value = sstep(T_EARTH, T_EARTH + 1.5, t) * (1 - sstep(T_DISSOLVE, T_DISSOLVE + 0.7, t));
    atmoMat.uniforms.uOpacity.value = sstep(T_EARTH + 0.2, T_EARTH + 1.8, t) * intro;
    groundMat.uniforms.uAlpha.value = sstep(2.2, 3.0, t) * intro * 0.9;

    for (const ob of orbits) {
      const a = ob.def.phase - (t / ob.def.period) * TAU;
      const inA = sstep(ob.def.enter, ob.def.enter + 0.9, t) * intro;
      ob.mat.uniforms.uHead.value = ((a % TAU) + TAU) % TAU;
      ob.mat.uniforms.uTrail.value = inA;
      ob.mat.uniforms.uRing.value = sstep(0.3, 1.6, t) * intro;
      ob.p.set(Math.cos(a) * ob.def.r, 0, Math.sin(a) * ob.def.r).applyEuler(ob.rot);
      ob.head.position.copy(ob.p);
      ob.headMat.uniforms.uAlpha.value = inA;
      // contact signal to the best ground point above the horizon
      let best = -1, bd = 1.06;
      for (let i = 0; i < groundLocal.length; i++) {
        gw.copy(groundLocal[i]).applyAxisAngle(THREE.Object3D.DEFAULT_UP, globe.rotation.y);
        const d = gw.dot(ob.p);
        if (d > bd && gw.z > -0.1) { bd = d; best = i; }
      }
      if (best >= 0 && inA > 0.05) {
        gw.copy(groundLocal[best]).applyAxisAngle(THREE.Object3D.DEFAULT_UP, globe.rotation.y);
        ob.linkGeo.setFromPoints([ob.p, tmp.copy(gw)]);
        ob.linkMat.opacity = inA * (0.35 + 0.4 * (0.5 + 0.5 * Math.sin(wall * 11 + ob.def.phase)));
      } else ob.linkMat.opacity = 0;
    }

    pUniforms.uTime.value = wall;
    pUniforms.uRot.value = globe.rotation.y;
    pUniforms.uT.value = t - (T_DISSOLVE + 0.3);
    pUniforms.uAlpha.value = sstep(T_DISSOLVE - 0.1, T_DISSOLVE + 0.5, t);

    if (!cuedWord && t >= T_WORDMARK) { cuedWord = true; o.onCue("wordmark"); }
    if (!cuedDone && t >= T_END) { cuedDone = true; o.onCue("done"); }
  }

  const io = new IntersectionObserver(es => { onScreen = es[0]?.isIntersecting ?? true; if (onScreen) wake(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => { if (!document.hidden) wake(); };
  document.addEventListener("visibilitychange", onVis);
  const onLost = (e: Event) => { e.preventDefault(); };
  canvas.addEventListener("webglcontextlost", onLost);

  renderOnce();
  wake();

  return {
    skip() { if (t < T_END + 1) { t = T_END + 1; earthReady = true; cuedWord = cuedDone = true; renderOnce(); wake(); } },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      disposables.forEach(d => d.dispose());
      renderer.dispose();
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small building blocks
 * ──────────────────────────────────────────────────────────────────────────── */

const NavContext = createContext<((href: string) => void) | undefined>(undefined);

/** Anchor that hands same-site navigation to `onNavigate` when one is provided. */
function A({ href, onClick, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const nav = useContext(NavContext);
  return (
    <a href={href} {...rest} onClick={e => {
      onClick?.(e);
      if (e.defaultPrevented || !nav || href.startsWith("#") || /^[a-z]+:/i.test(href) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      nav(href);
    }}>{children}</a>
  );
}

/** The OrbitPass mark: a planet, one inclined orbit, and a contact between a ground point and a satellite. */
export function OrbitPassEmblem({ size, className, title }: { size?: number | string; className?: string; title?: string }) {
  const { front, back } = useMemo(() => {
    const seg = (from: number, to: number) => {
      const runs: string[] = []; let cur = "";
      for (let i = 0; i <= 96; i++) {
        const th = from + ((to - from) * i) / 96;
        if (orbitHidden(th)) { if (cur) runs.push(cur); cur = ""; continue; }
        const [x, y] = orbitPoint(th);
        cur += `${cur ? "L" : "M"}${x.toFixed(4)} ${(-y).toFixed(4)}`;
      }
      if (cur) runs.push(cur);
      return runs.join("");
    };
    return { front: seg(Math.PI, TAU), back: seg(0, Math.PI) };
  }, []);
  const [sx, sy] = orbitPoint(EM.satTheta), [gx, gy] = EM.ground;
  return (
    <svg className={className} width={size} height={size} viewBox="-1.12 -0.92 2.24 1.84" fill="none" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d={back} stroke="var(--op-em-orbit, #7ccfc4)" strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle r={EM.planetR} fill="var(--op-em-fill, rgba(124,207,196,.1))" stroke="var(--op-em-limb, #eceee9)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <path d={front} stroke="var(--op-em-orbit, #7ccfc4)" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={`M${gx} ${-gy}L${sx.toFixed(4)} ${(-sy).toFixed(4)}`} stroke="var(--op-em-signal, #e5a862)" strokeWidth="1.2" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <circle cx={gx} cy={-gy} r=".035" fill="var(--op-em-signal, #e5a862)" />
      <circle cx={sx.toFixed(4)} cy={(-sy).toFixed(4)} r=".06" fill="var(--op-em-signal, #e5a862)" />
    </svg>
  );
}

/**
 * Scroll choreography for the whole page, driven by one observer and one rAF-throttled scroll listener.
 *  - Reveals: headings wipe up from a mask, blocks rise, list rows follow one another.
 *  - Scrubs: elements marked data-scrub get a --p custom property (0..1) tied to scroll position;
 *    the CSS uses it to move the satellite along the pass curve, turn the antenna, and ease the hero away.
 * Nothing is hidden unless this runs, so the page reads normally without JavaScript or with reduced motion.
 */
const REVEALS: [selector: string, kind: "mask" | "rise" | "row"][] = [
  ["main h2, .op-close h2", "mask"], // headings resolve out of soft focus,
  [".op-find-head p, .op-how-intro p, .op-pod-head p, .op-own-copy > p, .op-form, .op-form-notes, .op-source, .op-example, .op-own-copy .op-cta, .op-close p, .op-close .op-cta, .op-stations h3, .op-empty, .op-footer-mark", "rise"],
  [".op-figs > div, .op-st, .op-steps li, .op-own-list li, .op-trust li, .op-qa details, .op-layers li, .op-gd-card, .op-footer-top > *", "row"],
];
function useScrollChoreography(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.setAttribute("data-motion", "on");
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.setAttribute("data-in", ""); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });
    // Track observed elements per run, not by attribute: in dev, React runs this effect twice, and an
    // attribute left by the first run made the second skip everything, leaving whole sections invisible.
    const seen = new WeakSet<Element>();
    const tag = () => {
      for (const [sel, kind] of REVEALS) root.querySelectorAll<HTMLElement>(sel).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.hasAttribute("data-in")) return;
        el.setAttribute("data-rv", kind);
        if (kind === "row" && el.parentElement) el.style.setProperty("--rd", `${Math.min(7, Array.prototype.indexOf.call(el.parentElement.children, el)) * 80}ms`);
        io.observe(el);
      });
    };
    tag();
    const mo = new MutationObserver(tag); // station rows and figures arrive after the first paint
    mo.observe(root, { childList: true, subtree: true });

    let raf = 0;
    const tick = () => {
      raf = 0;
      const vh = window.innerHeight, doc = document.documentElement;
      root.style.setProperty("--page", Math.min(1, window.scrollY / Math.max(1, doc.scrollHeight - vh)).toFixed(4));
      root.querySelectorAll<HTMLElement>("[data-scrub]").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -300 || r.top > vh + 300) return;
        const p = el.dataset.scrub === "exit" ? -r.top / (r.height * 0.85) : (vh * 0.86 - r.top) / (vh * 0.62);
        el.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    tick();
    return () => { io.disconnect(); mo.disconnect(); if (raf) cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); root.removeAttribute("data-motion"); };
  }, [rootRef]);
}

/** Counts a figure up from zero the first time it scrolls into view. */
function CountUp({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const el = ref.current, target = Number(text.replace(/,/g, ""));
    if (!el || !Number.isFinite(target) || target <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(text); return; }
    let raf = 0, t0 = 0;
    setShown("0");
    const io = new IntersectionObserver(es => {
      if (!es[0]?.isIntersecting) return;
      io.disconnect();
      const step = (now: number) => {
        t0 ||= now;
        const k = Math.min(1, (now - t0) / 1500), e = 1 - Math.pow(1 - k, 3);
        setShown(Math.round(target * e).toLocaleString("en-US"));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [text]);
  return <span ref={ref}>{shown}</span>;
}

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtCredits = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCoord = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
const fmtUtc = (ms: number) => new Date(ms).toISOString().slice(11, 16) + " UTC";

/** Where a station sits between the poles, drawn on a small meridian. */
function LatitudeDial({ lat }: { lat: number }) {
  const y = -Math.sin((lat * Math.PI) / 180) * 20, x = Math.cos((lat * Math.PI) / 180) * 20;
  return (
    <svg className="op-dial" width="56" height="56" viewBox="-28 -28 56 56" aria-hidden="true">
      <circle r="20" />
      <ellipse rx="20" ry="6.5" />
      <ellipse rx="8" ry="20" />
      <line x1={(-x).toFixed(2)} y1={y.toFixed(2)} x2={x.toFixed(2)} y2={y.toFixed(2)} className="op-dial-lat" />
      <circle cx={(x * 0.38).toFixed(2)} cy={y.toFixed(2)} r="3.2" className="op-dial-pt" />
    </svg>
  );
}

function AntennaArt() {
  return (
    <svg className="op-antenna" viewBox="0 0 520 420" aria-hidden="true" data-scrub="enter">
      <g className="op-antenna-arcs" fill="none">
        <path d="M70 250 A 250 250 0 0 1 430 70" />
        <path d="M118 262 A 200 200 0 0 1 404 118" />
        <path d="M166 274 A 150 150 0 0 1 378 166" />
        <path className="op-antenna-pass" d="M40 196 Q 190 -30 486 96" />
      </g>
      <circle className="op-antenna-sat" r="5.5" />
      <g className="op-antenna-body">
        <path d="M0 392 H520" className="op-antenna-ground" />
        <path d="M236 392 L250 300 H302 L316 392 Z" />
        <path d="M262 300 V268 H290 V300 Z" />
        <g className="op-antenna-dish">
          <path d="M166 232 Q276 336 386 232 Z" />
          <path d="M166 232 L276 150 L386 232" className="op-antenna-strut" />
          <circle cx="276" cy="150" r="7" />
        </g>
      </g>
    </svg>
  );
}

function PassCurve() {
  return (
    <svg className="op-curve" viewBox="0 0 960 300" role="img" aria-label="Elevation of one satellite pass over time: the manifest is committed before the pass rises, the signed receipt is uploaded after it sets, then the booking settles.">
      <path className="op-curve-horizon" d="M0 232 H960" />
      <path className="op-curve-grid" d="M0 172 H960 M0 112 H960 M0 52 H960" />
      <path className="op-curve-fill" d="M250 232 C 380 -14, 580 -14, 710 232 Z" />
      <path className="op-curve-line" pathLength={1} d="M250 232 C 380 -14, 580 -14, 710 232" />
      <path className="op-curve-tick" d="M250 222 V262 M710 222 V262 M480 48 V232" />
      <circle className="op-curve-node op-curve-n1" cx="120" cy="232" r="7" />
      <circle className="op-curve-node op-curve-n2" cx="810" cy="232" r="7" />
      <circle className="op-curve-node op-curve-n3" cx="900" cy="232" r="7" />
      <circle className="op-curve-sat" r="6" />
      <text x="250" y="284" textAnchor="middle">AOS</text>
      <text x="710" y="284" textAnchor="middle">LOS</text>
      <text x="492" y="40">max elevation</text>
      <text x="8" y="222">horizon</text>
    </svg>
  );
}

const HERO_FACTS: [string, string][] = [
  ["One pass at a time", "No contract or minimum term"],
  ["Escrow first", "The fee is held before the pass starts"],
  ["Paid per frame", "Only frames the station proves it received"],
  ["24-hour refund", "No verified receipt, full escrow back"],
];

const LAYERS: [string, string, string][] = [
  ["L1", "Application", "Marketplace, pass finder, owner verification, bookings, disputes and admin review."],
  ["L2", "Verification", "SGP4 prediction on CelesTrak elements, Merkle manifest, ed25519 receipt, timestamp and Doppler checks. Payouts are decided by these rules, never by an AI model."],
  ["L3", "Settlement", "Every credit movement is written to a ledger. Escrow is split pro-rata on verified frames, in whole cents that always add up to what was held."],
];

const GUARANTEE_POINTS: [string, string][] = [
  ["Pass planner.", "Picks passes by price per expected megabyte, using each station's verified delivery record."],
  ["Backup passes.", "Extra passes are reserved until the chance of meeting the target is at least 95%, and released with a refund once it is met."],
  ["Automatic re-booking.", "If a station cancels, a booking expires or a pass under-delivers, the next feasible pass is booked elsewhere."],
  ["Guarantee price.", "Pass prices plus a premium. Reliable stations and longer deadlines make the premium smaller."],
  ["Compensation.", "Miss the deadline and the agreed amount is paid to your wallet from the reserve, automatically."],
  ["Certificate.", "One public page with the target, the verified volume and a proof for every pass."],
];

const OPERATOR_POINTS = [
  "More downlink time without building or renting a station.",
  "Book single passes. No contract, no minimum term.",
  "Pay only for the share of frames that verify. The rest is refunded.",
  "Every station shows a public reliability score before you book.",
];

const FAQS: [string, string][] = [
  ["What do I pay with?", "Platform credits. An OrbitPass admin adds credits to your wallet after an off-platform payment; card and bank payments are not connected yet. When you book, the price of the pass moves from your wallet into escrow."],
  ["Which satellites can I search passes for?", "Your own. Register a satellite with its NORAD ID, complete owner verification, and wait for an admin to activate it. The pass finder then predicts contact windows for your active satellites over every active, verified station that supports their band."],
  ["What if the station receives only part of my data?", "Settlement is pro-rata. The station is paid for the share of frames that verify, less the platform fee, and the rest of the escrow returns to your wallet."],
  ["What if no receipt is ever submitted?", "If a booking is not settled within 24 hours after the pass ends, the full amount can be reclaimed from escrow and the booking is marked expired."],
  ["Can a booking be cancelled?", "An operator can cancel up to one hour before the pass starts. A station can cancel any time before it starts. Either way the operator is refunded in full."],
  ["How are passes predicted?", "With SGP4 on current orbital elements from CelesTrak. When you book, the server predicts the pass again, checks it against the station's other bookings and blackout periods, and only then confirms."],
  ["What can a receipt be rejected for?", "A signature that does not match the station's registered key, or a manifest root that differs from the one you committed. A rejected receipt is refused, not settled at zero, and the station can submit a corrected one."],
  ["How does a delivery guarantee work?", "Choose a satellite, a volume and a deadline. OrbitPass books the passes it plans, holds each in escrow as usual and charges a premium into a compensation reserve. If the verified volume misses the target by the deadline, the compensation you chose is paid to your wallet. Unused backup passes are refunded in full."],
  ["How do disputes work?", "Either side can open one dispute per booking within 24 hours of settlement. An admin reviews it and can move up to the station's payout back to the operator."],
];

/* ────────────────────────────────────────────────────────────────────────────
 * The page
 * ──────────────────────────────────────────────────────────────────────────── */

type Phase = "pending" | "playing" | "wordmark" | "done";
const delay = (d: string) => ({ "--d": d }) as React.CSSProperties;

export default function OrbitPassFrontend(props: OrbitPassFrontendProps) {
  const routes = useMemo(() => ({ ...DEFAULT_ROUTES, ...props.routes }), [props.routes]);
  const bands = props.bands ?? DEFAULT_BANDS;
  const stations: OrbitPassData<OrbitPassStation[]> = props.stations ?? { status: "ready", data: SAMPLE_STATIONS, sample: true };
  const network: OrbitPassData<OrbitPassNetwork> = props.network ?? { status: "ready", data: SAMPLE_NETWORK, sample: true };
  const { session, onNavigate } = props;
  const go = useCallback((href: string) => { if (onNavigate) onNavigate(href); else window.location.assign(href); }, [onNavigate]);

  /* Intro orchestration ------------------------------------------------------ */
  const [phase, setPhase] = useState<Phase>("pending");
  const [gl, setGl] = useState<"unknown" | "on" | "off">("unknown");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollChoreography(rootRef);
  const cine = useRef<Cinematic | null>(null);
  const groundRef = useRef<{ lat: number; lon: number }[]>([]);
  const realStations = stations.status === "ready" && !stations.sample ? stations.data : null;
  useEffect(() => { if (realStations) groundRef.current = realStations.map(s => ({ lat: s.latitude, lon: s.longitude })); }, [realStations]);
  const introPref = props.intro ?? "auto";
  const assets = props.assets;

  const finish = useCallback(() => {
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* private mode */ }
    cine.current?.skip();
    setPhase("done");
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_KEY) === "1"; } catch { /* ignore */ }
    const play = introPref !== "off" && !reduce && !seen;
    if (reduce || !canvasRef.current || !anchorRef.current) { // calm static version
      setGl("off"); setPhase("done");
      return;
    }
    setPhase(play ? "playing" : "done");
    let dead = false, ready = false, bailed = false;
    // Never hold the page hostage to a slow GPU or network: after 6 s show the finished hero regardless.
    const bail = window.setTimeout(() => { if (!ready && !dead) { bailed = true; setGl("off"); setPhase("done"); } }, 6000);
    startCinematic({
      canvas: canvasRef.current, anchor: anchorRef.current, mode: play ? "play" : "resolved",
      lite: window.matchMedia("(max-width: 820px), (pointer: coarse)").matches,
      assets: { ...DEFAULT_ASSETS, ...assets }, ground: groundRef.current,
      onCue: cue => {
        if (dead) return;
        if (cue === "wordmark") setPhase(p => (p === "playing" ? "wordmark" : p));
        else { try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* private mode */ } setPhase("done"); }
      },
    }).then(c => {
      ready = true;
      if (dead) { c.dispose(); return; }
      if (bailed) c.skip();
      cine.current = c; setGl("on");
    }).catch(err => { ready = true; console.warn("[OrbitPass] WebGL scene unavailable, showing the static emblem.", err); if (!dead) { setGl("off"); setPhase("done"); } });
    return () => { dead = true; window.clearTimeout(bail); cine.current?.dispose(); cine.current = null; };
    // The cinematic is created once per mount; later prop changes must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const introRunning = phase === "playing" || phase === "wordmark";
  useEffect(() => {
    if (!introRunning) return;
    const onKey = (e: KeyboardEvent) => { if (["Escape", " ", "PageDown", "ArrowDown", "End"].includes(e.key)) finish(); };
    window.addEventListener("wheel", finish, { passive: true });
    window.addEventListener("touchmove", finish, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("wheel", finish); window.removeEventListener("touchmove", finish); window.removeEventListener("keydown", onKey); };
  }, [introRunning, finish]);

  /* Header ------------------------------------------------------------------- */
  const [solid, setSolid] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();
  useEffect(() => {
    const onScroll = () => { setSolid(window.scrollY > (heroRef.current?.offsetHeight ?? 600) - 90); setScrolled(window.scrollY > 24); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const { onCheckSatellite, onSearchPasses, onBookStation, onSignIn, onListStation } = props;
  const signInClick = (e: React.MouseEvent) => { if (onSignIn) { e.preventDefault(); onSignIn(); } };
  const listClick = (e: React.MouseEvent) => { if (onListStation) { e.preventDefault(); onListStation(); } };

  /* Pass search ---------------------------------------------------------------- */
  const [norad, setNorad] = useState("");
  const [band, setBand] = useState("");
  const [hours, setHours] = useState(24);
  const [minEl, setMinEl] = useState(10);
  const [lookup, setLookup] = useState<{ status: "idle" | "checking" | "found" | "missing" | "error" | "invalid"; id?: SatelliteIdentity }>({ status: "idle" });
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const noradNum = /^\d{1,9}$/.test(norad.trim()) && +norad > 0 ? +norad.trim() : undefined;

  async function checkSatellite() {
    if (!noradNum) { setLookup({ status: "invalid" }); return; }
    if (!onCheckSatellite) return;
    setLookup({ status: "checking" });
    try { const id = await onCheckSatellite(noradNum); setLookup({ status: id.found ? "found" : "missing", id }); }
    catch { setLookup({ status: "error" }); }
  }
  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchNote(null);
    if (norad.trim() && !noradNum) { setLookup({ status: "invalid" }); return; }
    const q: PassSearchQuery = { noradId: noradNum, band: band || undefined, hours, minElevationDeg: Math.min(90, Math.max(0, minEl || 0)) };
    if (!onSearchPasses) {
      const p = new URLSearchParams({ hours: String(q.hours), minEl: String(q.minElevationDeg) });
      if (q.band) p.set("band", q.band);
      if (q.noradId) p.set("norad", String(q.noradId));
      go(`${routes.findPass}?${p}`);
      return;
    }
    setSearching(true);
    try { const r = await onSearchPasses(q); if (typeof r === "string") setSearchNote(r); }
    catch (err) { setSearchNote(err instanceof Error ? err.message : "The pass finder could not be opened. Try again."); }
    finally { setSearching(false); }
  }

  const [stationNote, setStationNote] = useState<{ id: string; text: string } | null>(null);
  async function seePasses(s: OrbitPassStation) {
    setStationNote(null);
    if (!onBookStation) { go(`${routes.findPass}?stationId=${encodeURIComponent(s.id)}`); return; }
    const r = await onBookStation(s);
    if (typeof r === "string") setStationNote({ id: s.id, text: r });
  }

  const stationRow = (s: OrbitPassStation, example: boolean) => (
    <li key={s.id} className="op-st">
      <LatitudeDial lat={s.latitude} />
      <div className="op-st-main">
        <h4>{s.name}</h4>
        <p>{s.country}. {s.antennaType}, {s.antennaSizeM} m.{s.ownerName ? ` Run by ${s.ownerName}.` : ""}</p>
        <p className="op-mono">{fmtCoord(s.latitude, s.longitude)}{s.altitudeM != null ? `, ${Math.round(s.altitudeM)} m` : ""}</p>
      </div>
      <dl className="op-st-facts">
        <div><dt>Bands</dt><dd>{s.bands.join(", ")}</dd></div>
        {s.passes24h != null && <div><dt>Next 24 hours</dt><dd>{s.passes24h} {s.passes24h === 1 ? "pass" : "passes"}{s.contactMin24h != null ? `, ${s.contactMin24h} min` : ""}</dd></div>}
        <div><dt>Reliability</dt><dd>{s.reliabilityScore == null ? "New" : `${Math.round(s.reliabilityScore)} of 100`}</dd></div>
      </dl>
      <div className="op-st-price">
        <p><b>{fmtCredits(s.pricePerPass)}</b> credits per pass</p>
        {!example && <button type="button" className="op-link" onClick={() => seePasses(s)}>See passes<span className="op-sr"> at {s.name}</span></button>}
      </div>
      {stationNote?.id === s.id && <p className="op-warn op-st-note" role="alert">{stationNote.text}</p>}
    </li>
  );

  const net = network.status === "ready" ? network.data : null;
  const isSampleNet = network.status === "ready" && !!network.sample;
  const statusLine =
    network.status === "loading" ? { tone: "wait", text: "Checking the network" }
    : !net ? { tone: "off", text: "Network status is unavailable right now" }
    : net.stations === 0 ? { tone: "wait", text: "No verified stations are live yet. Station onboarding is open." }
    : { tone: "ok", text: `${fmtInt(net.stations)} verified ${net.stations === 1 ? "station" : "stations"}, ${fmtInt(net.passes24h)} passes predicted in the next 24 hours${isSampleNet ? " (sample data)" : ""}` };

  const figures: [string, string, string][] = [
    ["Verified ground stations", net ? fmtInt(net.stations) : "", "Active, with an approved owner"],
    ["Verified satellites", net ? fmtInt(net.satellites) : "", "Registered by approved operators"],
    ["Passes in the next 24 hours", net ? fmtInt(net.passes24h) : "", "Peak elevation of 10° or more"],
    ["Contact minutes in the next 24 hours", net ? fmtInt(net.contactMin24h) : "", "Summed over every predicted pass"],
  ];
  const stationList = stations.status === "ready" ? stations.data.slice(0, 6) : [];
  const links: [string, string][] = [["#find", "Find a pass"], ["#guarantee", "Guarantee"], ["#how", "How it works"], ["#owners", "Station owners"], ["#faq", "Questions"]];

  return (
    <NavContext.Provider value={onNavigate}>
      <div className="op-root" id="top" ref={rootRef} data-phase={phase} data-gl={gl}>
        <style>{CSS}</style>
        <noscript><style>{`.op-root .op-rv{opacity:1!important;transform:none!important;animation:none!important}`}</style></noscript>

        <a className="op-skiplink" href="#find">Skip to pass search</a>

        <header className="op-header" data-solid={solid || menuOpen ? "" : undefined} data-scrolled={scrolled ? "" : undefined}>
          <a href="#top" className="op-brand"><OrbitPassEmblem className="op-brand-mark" /><span>OrbitPass</span></a>
          <nav id={navId} className="op-nav" aria-label="Primary" data-open={menuOpen ? "" : undefined}>
            {links.map(([href, label]) => <a key={href} href={href} onClick={() => { setMenuOpen(false); if (introRunning) finish(); }}>{label}</a>)}
            <span className="op-nav-account">
              {session
                ? <A href={routes.dashboard} className="op-btn op-btn-line op-btn-sm">Open dashboard</A>
                : <A href={routes.signIn} className="op-btn op-btn-line op-btn-sm" onClick={signInClick}>Sign in</A>}
            </span>
          </nav>
          <button type="button" className="op-menu-btn" aria-expanded={menuOpen} aria-controls={navId} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? "Close" : "Menu"}</button>
        </header>

        {/* ── Hero / cinematic ── */}
        <section className="op-hero" ref={heroRef} aria-label="OrbitPass" onFocusCapture={e => { if (introRunning && !(e.target as HTMLElement).classList.contains("op-skip")) finish(); }}>
          <div className="op-stars-css" aria-hidden="true" />
          <canvas ref={canvasRef} className="op-canvas" aria-hidden="true" />
          <div className="op-hero-grid">
            <div className="op-anchor" ref={anchorRef} aria-hidden="true"><OrbitPassEmblem className="op-emblem-svg" /></div>
            <div className="op-hero-copy">
              <h1 className="op-wordmark op-rv">OrbitPass</h1>
              <p className="op-tagline op-rv" style={delay(".25s")}>Ground time, on your terms.</p>
              <p className="op-promise op-rv op-late" style={delay(".1s")}>
                Book a single satellite pass at a verified ground station. Your fee waits in escrow and is released only for the downlink frames the station can prove it received.
              </p>
              <div className="op-cta op-rv op-late" style={delay(".22s")}>
                <a href="#find" className="op-btn op-btn-signal">Find a pass</a>
                <A href={routes.listStation} className="op-btn op-btn-line" onClick={listClick}>List your station</A>
              </div>
              <p className="op-status op-rv op-late" data-tone={statusLine.tone} role="status" style={delay(".34s")}>
                <i aria-hidden="true" />{statusLine.text}
              </p>
            </div>
          </div>
          {introRunning && <button type="button" className="op-skip" onClick={finish}>Skip intro</button>}
          <ul className="op-hero-facts op-rv op-late" style={delay(".46s")}>
            {HERO_FACTS.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
          </ul>
          <p className="op-hero-note op-rv op-late" style={delay(".58s")}>Orbits in the opening sequence are illustrative. Network figures on this page are read from the live service.</p>
          <div className="op-horizon" aria-hidden="true" />
        </section>

        <main>
          {/* ── Pass search ── */}
          <section className="op-sec op-find" id="find" aria-labelledby="op-find-h">
            <div className="op-find-head">
              <h2 id="op-find-h">Start with a contact window</h2>
              <p>Say what you need from the pass. The finder predicts every window for your satellites over the stations that can hear them.</p>
            </div>
            <form className="op-form" onSubmit={submitSearch} noValidate>
              <label className="op-field op-field-wide">
                <span>Satellite NORAD ID <em>(optional)</em></span>
                <span className="op-field-row">
                  <input inputMode="numeric" value={norad} onChange={e => { setNorad(e.target.value); setLookup({ status: "idle" }); }} placeholder="25544" aria-describedby="op-norad-help" aria-invalid={lookup.status === "invalid"} />
                  {onCheckSatellite && <button type="button" className="op-textbtn" onClick={checkSatellite} disabled={!norad.trim() || lookup.status === "checking"}>{lookup.status === "checking" ? "Looking up" : "Look up"}</button>}
                </span>
              </label>
              <label className="op-field">
                <span>Frequency band</span>
                <select value={band} onChange={e => setBand(e.target.value)}>
                  <option value="">Any band</option>
                  {bands.map(b => <option key={b} value={b}>{b} band</option>)}
                </select>
              </label>
              <label className="op-field">
                <span>Time window</span>
                <select value={hours} onChange={e => setHours(+e.target.value)}>
                  {[6, 12, 24, 48, 72].map(h => <option key={h} value={h}>Next {h} hours</option>)}
                </select>
              </label>
              <label className="op-field">
                <span>Minimum elevation</span>
                <span className="op-field-row"><input type="number" min={0} max={90} value={minEl} onChange={e => setMinEl(+e.target.value)} /><b aria-hidden="true">°</b></span>
              </label>
              <button className="op-btn op-btn-ink op-form-go" disabled={searching}>{searching ? "Opening the finder" : "Find passes"}</button>
            </form>
            <div className="op-form-notes" id="op-norad-help" aria-live="polite">
              {lookup.status === "invalid" && <p className="op-warn">A NORAD ID is a whole number, for example 25544.</p>}
              {lookup.status === "found" && lookup.id && <p><b>{lookup.id.name ?? `NORAD ${lookup.id.noradId}`}</b>{lookup.id.internationalDesignator ? `, ${lookup.id.internationalDesignator}` : ""} is in the public catalogue. This confirms the object exists; it does not show who operates it.</p>}
              {lookup.status === "missing" && <p className="op-warn">No public record for NORAD {noradNum}. Check the number; passes cannot be predicted without current orbital elements.</p>}
              {lookup.status === "error" && <p className="op-warn">The public catalogue could not be reached. You can still continue to the pass finder.</p>}
              {searchNote && <p className="op-warn" role="alert">{searchNote}</p>}
              <p>Passes are predicted for satellites registered to your account and approved by OrbitPass, so the finder asks you to sign in. The pass is predicted again at the moment you book.</p>
            </div>
          </section>

          {/* ── Network ── */}
          <section className="op-sec op-network" id="network" aria-labelledby="op-net-h">
            <div className="op-net-figs">
              <h2 id="op-net-h">The network, as it stands</h2>
              {network.status === "unavailable"
                ? <p className="op-empty">{network.message ?? "Network figures are unavailable right now. The service that computes them did not answer."}</p>
                : <dl className="op-figs" aria-busy={network.status === "loading"}>
                    {figures.map(([label, value, hint]) => (
                      <div key={label}><dd>{network.status === "loading" ? <span className="op-skel" /> : <CountUp text={value} />}</dd><dt>{label}<small>{hint}</small></dt></div>
                    ))}
                  </dl>}
              <p className="op-source">
                {isSampleNet && <b className="op-sample">Sample data</b>}
                {net && !isSampleNet && "Counted over active, verified stations and satellites. Passes are SGP4 predictions on CelesTrak orbital elements."}
                {net?.generatedAt ? <> Computed at <span className="op-mono">{fmtUtc(net.generatedAt)}</span>.</> : null}
              </p>
            </div>

            <div className="op-stations">
              <h3>Verified stations</h3>
              {stations.status === "loading" && <ul className="op-st-list" aria-busy="true">{[0, 1, 2].map(i => <li key={i} className="op-st"><span className="op-skel op-skel-row" /></li>)}</ul>}
              {stations.status === "unavailable" && <p className="op-empty">{stations.message ?? "The station list could not be loaded. Try again in a moment."}</p>}
              {stations.status === "ready" && stationList.length === 0 && (<>
                <div className="op-empty">
                  <p>No station has finished verification yet, so there is nothing to book today. Stations appear here once their owner is approved and an admin activates the antenna.</p>
                  <A href={routes.listStation} className="op-link" onClick={listClick}>Own a ground station? Start verification</A>
                </div>
                <p className="op-source op-eg-label"><b className="op-sample">Example</b> This is how a verified station will be listed. These two are not real and cannot be booked.</p>
                <ul className="op-st-list op-st-eg">{SAMPLE_STATIONS.slice(0, 2).map(s => stationRow(s, true))}</ul>
              </>)}
              {stationList.length > 0 && (
                <ul className="op-st-list">
                  {stationList.map(s => stationRow(s, false))}
                </ul>
              )}
              {stations.status === "ready" && stations.sample && <p className="op-source"><b className="op-sample">Sample data</b> These stations are placeholders, not listings.</p>}
            </div>
          </section>

          {/* ── How it works ── */}
          <section className="op-sec op-how" id="how" aria-labelledby="op-how-h">
            <div className="op-how-intro">
              <h2 id="op-how-h">One pass, booked and accounted for</h2>
              <p>A pass is a few minutes of sky. OrbitPass treats each one as its own contract, checked before it is confirmed and settled on evidence afterwards.</p>
              <h3 className="op-sub">For satellite operators</h3>
              <ul className="op-own-list">{OPERATOR_POINTS.map(t => <li key={t}>{t}</li>)}</ul>
              <div className="op-cta"><A href={routes.signUpOperator} className="op-btn op-btn-ink">Create an operator account</A></div>
            </div>
            <ol className="op-steps">
              <li><h3>Choose a window</h3><p>The finder lists each predicted pass with its rise and set times, peak elevation, duration, band and the station&apos;s price.</p></li>
              <li><h3>Book it</h3><p>The server predicts the pass again, refuses anything that overlaps another booking or a station blackout period, and moves the price from your wallet into escrow in the same step.</p></li>
              <li><h3>Change your mind</h3><p>Cancel up to one hour before the pass starts and the escrow returns in full. A station that cancels refunds you in full too.</p></li>
            </ol>
          </section>

          <section className="op-pod" aria-labelledby="op-pod-h">
            <div className="op-pod-inner">
              <div className="op-pod-head">
                <h2 id="op-pod-h">Proof of Downlink</h2>
                <p>The station is paid for the frames that verifiably arrived. Nobody has to take anybody&apos;s word for it.</p>
              </div>
              <div className="op-pod-stage" data-scrub="enter">
              <PassCurve />
              <ol className="op-pod-steps">
                <li><span className="op-mono">before the pass</span><h3>You commit the manifest</h3><p>Upload the SHA-256 hash of every frame you expect to send. They are sealed under one Merkle root, which cannot be changed afterwards.</p></li>
                <li><span className="op-mono">after the pass</span><h3>The station signs a receipt</h3><p>The station uploads what it received, signed with its registered ed25519 key. OrbitPass checks the signature, the manifest root, each hash, duplicates, timestamps against the pass window, and the Doppler sweep.</p></li>
                <li><span className="op-mono">settlement</span><h3>Escrow is split on the evidence</h3><p>The verified share goes to the station, less the platform fee. The rest returns to you. Amounts are whole cents and always add up to what was held.</p></li>
              </ol>
              </div>
              <figure className="op-example">
                <figcaption>Worked example, not live data: a 100-credit pass at an 8% platform fee</figcaption>
                <dl className="op-example-figs">
                  <div><dd><CountUp text="100" /></dd><dt>frames promised</dt></div>
                  <div><dd><CountUp text="94" /></dd><dt>frames verified</dt></div>
                  <div><dd><CountUp text="94" />%</dd><dt>delivery</dt></div>
                </dl>
                <div className="op-example-split">
                  <div className="op-example-bar" role="img" aria-label="Escrow of 100 credits split: 86.48 to the station, 7.52 platform fee, 6.00 refunded"><i style={{ width: "86.48%" }} /><i style={{ width: "7.52%" }} /><i style={{ width: "6%" }} /></div>
                  <ul className="op-example-legend">
                    <li><i /><b>86.48</b> to the station</li>
                    <li><i /><b>7.52</b> platform fee</li>
                    <li><i /><b>6.00</b> back to the operator</li>
                  </ul>
                  <p>The station earns 94% of the fee, less the platform&apos;s cut. The 6% that never arrived goes back to the operator&apos;s wallet.</p>
                </div>
              </figure>
            </div>
          </section>

          {/* ── Guaranteed Downlink ── */}
          <section className="op-sec op-gd" id="guarantee" aria-labelledby="op-gd-h">
            <div className="op-gd-copy">
              <h2 id="op-gd-h">Order data, not passes</h2>
              <p>Ask for &ldquo;500 MB from your satellite by Friday 18:00 UTC&rdquo;. OrbitPass plans the cheapest set of passes across every verified station, books them in one step and stands behind the result.</p>
              <ul className="op-own-list">
                {GUARANTEE_POINTS.map(([b, t]) => <li key={b}><b>{b}</b> {t}</li>)}
              </ul>
              <div className="op-cta">
                <A href={routes.guarantee} className="op-btn op-btn-ink">Plan a guarantee</A>
                <a href="#faq" className="op-link">How compensation works</a>
              </div>
            </div>
            <figure className="op-gd-card" aria-label="Worked example of a guarantee in progress">
              <figcaption>Worked example, not live data</figcaption>
              <p className="op-gd-title">500 MB from SAT-X <span>by Fri 18:00 UTC</span></p>
              <div className="op-gd-bar" role="img" aria-label="320 of 500 MB verified, 470 MB expected"><i style={{ width: "94%" }} /><i style={{ width: "64%" }} /></div>
              <p className="op-gd-line"><b>320 of 500 MB verified</b> · 3 passes left · <em>on track</em></p>
              <dl className="op-gd-facts">
                <div><dt>Passes</dt><dd>7 + 2 backup</dd></div>
                <div><dt>Confidence</dt><dd>96.4%</dd></div>
                <div><dt>Compensation</dt><dd>400.00</dd></div>
              </dl>
              <ol className="op-gd-log">
                <li><span className="op-mono">Tue 09:12</span> Station in Chile cancelled. Replacement pass booked over Iceland.</li>
                <li><span className="op-mono">Wed 22:40</span> Pass verified at 94%. Proof published.</li>
              </ol>
            </figure>
          </section>

          {/* ── Station owners ── */}
          <section className="op-sec op-owners" id="owners" aria-labelledby="op-own-h">
            <div className="op-own-copy">
              <h2 id="op-own-h">An antenna with spare sky can earn its keep</h2>
              <p>List the hours your station is free. Operators book the passes they need, and you are paid for every frame you deliver and can prove.</p>
              <ul className="op-own-list">
                <li><b>Verification comes first.</b> Upload company, ownership and licensing documents. Reviewers award three badges: organisation, asset owner and operator. Documents are encrypted before they are stored.</li>
                <li><b>Your station goes live on approval.</b> Each station is reviewed on its own. It becomes bookable once you are approved and an admin activates it.</li>
                <li><b>You keep control of the calendar.</b> Set your price per pass and block any period you need the antenna yourself. Blocked time cannot be booked.</li>
                <li><b>Payment is already waiting.</b> The operator&apos;s fee is in escrow before the pass. Sign your receipt with the station key and the verified share is paid out, less the platform fee.</li>
                <li><b>Your record is public.</b> A reliability score built from verified delivery, completed passes and disputes is shown to operators. New stations are marked as new.</li>
              </ul>
              <div className="op-cta">
                <A href={routes.listStation} className="op-btn op-btn-ink" onClick={listClick}>Create a station owner account</A>
                <A href={routes.estimate} className="op-link">Estimate what your antenna could earn</A>
              </div>
            </div>
            <AntennaArt />
          </section>

          {/* ── Architecture ── */}
          <section className="op-sec op-arch" id="platform" aria-labelledby="op-arch-h">
            <div className="op-arch-head">
              <h2 id="op-arch-h">Built on open data, settled on evidence</h2>
              <p>Three layers, each with one job. Orbits come from public catalogues, money moves only on verified data, and every number shown to you is calculated on the server.</p>
            </div>
            <ol className="op-layers">
              {LAYERS.map(([n, t, d]) => <li key={n}><span className="op-mono">{n}</span><h3>{t}</h3><p>{d}</p></li>)}
            </ol>
          </section>

          {/* ── Trust and questions ── */}
          <section className="op-sec op-faq" id="faq" aria-labelledby="op-faq-h">
            <div className="op-trust">
              <h2 id="op-faq-h">What you can rely on</h2>
              <ul>
                <li>Only stations and satellites with an approved owner and an admin-activated listing are visible or bookable.</li>
                <li>Prices and settlement amounts are calculated on the server from stored records. Nothing your browser sends can change them.</li>
                <li>A committed manifest cannot be edited, by you or by OrbitPass.</li>
                <li>Admin actions and document views are written to an audit log.</li>
                <li>Credits are an internal ledger today. Real payment rails and station withdrawals are not connected yet.</li>
              </ul>
            </div>
            <div className="op-qa">
              {FAQS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
            </div>
          </section>
        </main>

        <section className="op-close" aria-labelledby="op-close-h">
          <div className="op-close-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="op-close-inner">
            <h2 id="op-close-h">Somewhere overhead, a pass is about to begin</h2>
            <p>Book the window your satellite needs, or put your antenna to work on someone else&apos;s.</p>
            <div className="op-cta">
              <a href="#find" className="op-btn op-btn-signal">Find a pass</a>
              <A href={routes.listStation} className="op-btn op-btn-line" onClick={listClick}>List your station</A>
            </div>
          </div>
        </section>

        <footer className="op-footer">
          <div className="op-footer-top">
            <div className="op-footer-brand">
              <a href="#top" className="op-brand"><OrbitPassEmblem className="op-brand-mark" /><span>OrbitPass</span></a>
              <p>Pay-per-pass ground station access, settled on Proof of Downlink.</p>
            </div>
            <nav aria-label="Operators"><h2>Operators</h2><a href="#find">Find a pass</a><a href="#guarantee">Guaranteed Downlink</a><a href="#how">How booking works</a><A href={routes.signUpOperator}>Create an operator account</A></nav>
            <nav aria-label="Station owners"><h2>Station owners</h2><a href="#owners">Listing a station</a><A href={routes.estimate}>Earnings estimate</A><A href={routes.listStation} onClick={listClick}>Start verification</A></nav>
            <nav aria-label="Account"><h2>Account</h2>{session ? <A href={routes.dashboard}>Open dashboard</A> : <A href={routes.signIn} onClick={signInClick}>Sign in</A>}<a href="#faq">Questions</a><A href={routes.terms}>Terms</A><A href={routes.privacy}>Privacy</A></nav>
          </div>
          <p className="op-footer-mark" aria-hidden="true">OrbitPass</p>
          <p className="op-footer-base">© 2026 OrbitPass. Pass predictions use SGP4 on CelesTrak orbital elements.</p>
        </footer>
      </div>
    </NavContext.Provider>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Styles — everything is scoped under .op-root
 * Fonts: set --font-display / --font-geist-sans / --font-geist-mono on an ancestor
 * (the Next.js layout does); otherwise system fallbacks are used.
 * ──────────────────────────────────────────────────────────────────────────── */

const CSS = `
.op-root{--op-ink:#060a12;--op-navy:#0f1d33;--op-navy2:#182c4c;--op-paper:#f2f3ef;--op-moon:#e6e9e4;--op-mineral:#c2c9c6;--op-slate:#56626d;--op-text:#101a28;--op-teal:#22756f;--op-teal-l:#7ccfc4;--op-copper:#b8692b;--op-amber:#e5a862;--op-cyan:#8de4f2;--op-rule:rgba(16,26,40,.16);
  --op-display:var(--font-display,"Fraunces","Iowan Old Style","Palatino Linotype",Georgia,serif);
  --op-sans:var(--font-geist-sans,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);
  --op-mono-f:var(--font-geist-mono,ui-monospace,"SF Mono",Menlo,Consolas,monospace);
  --op-pad:clamp(20px,5vw,72px);--op-max:1240px;
  background:var(--op-paper);color:var(--op-text);font-family:var(--op-sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:clip;color-scheme:light}
:where(.op-root) *,:where(.op-root) *::before,:where(.op-root) *::after{box-sizing:border-box}
:where(.op-root) :where(h1,h2,h3,h4,p,ul,ol,dl,dd,figure){margin:0;padding:0}
:where(.op-root) :where(ul,ol){list-style:none}
:where(.op-root) a{color:inherit}
:where(.op-root) :where(button,input,select){font:inherit;color:inherit}
.op-root :focus-visible{outline:2px solid var(--op-copper);outline-offset:3px;border-radius:2px}
.op-hero :focus-visible,.op-header:not([data-solid]) :focus-visible,.op-pod :focus-visible,.op-footer :focus-visible{outline-color:var(--op-amber)}
.op-root [id]{scroll-margin-top:84px}
.op-mono{font-family:var(--op-mono-f);font-size:.82em;letter-spacing:.01em}
.op-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.op-skiplink{position:fixed;left:12px;top:-60px;z-index:100;background:var(--op-paper);color:var(--op-text);padding:10px 14px;border-radius:4px}
.op-skiplink:focus{top:12px}
:where(.op-root) h2{font-family:var(--op-display);font-weight:400;font-size:clamp(30px,3.6vw,50px);line-height:1.06;letter-spacing:-.022em;font-variation-settings:"opsz" 96;text-wrap:balance}
:where(.op-root) h3{font-size:17px;font-weight:600;letter-spacing:-.005em;line-height:1.35}

/* buttons and links */
.op-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:999px;border:1px solid transparent;font-weight:550;font-size:15.5px;text-decoration:none;cursor:pointer;transition:background-color .2s,border-color .2s,color .2s,transform .2s}
.op-btn:active{transform:translateY(1px)}
.op-btn[disabled]{opacity:.6;cursor:progress}
.op-btn-sm{min-height:38px;padding:0 16px;font-size:14px}
.op-btn-signal{background:var(--op-amber);color:#1a1206}
.op-btn-signal:hover{background:#f0b877}
.op-btn-line{border-color:currentColor;color:inherit;background:transparent}
.op-btn-line:hover{background:rgba(127,140,150,.16)}
.op-btn-ink{background:var(--op-navy);color:var(--op-paper)}
.op-btn-ink:hover{background:var(--op-navy2)}
.op-link,.op-textbtn{background:none;border:0;padding:0;cursor:pointer;font-weight:550;color:var(--op-teal);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px}
.op-link:hover,.op-textbtn:hover{color:var(--op-text)}
.op-textbtn{white-space:nowrap;font-size:14.5px}
.op-textbtn[disabled]{opacity:.45;cursor:default;text-decoration:none}

/* header */
.op-header{position:fixed;inset:0 0 auto 0;z-index:40;display:flex;align-items:center;gap:24px;height:68px;padding:0 var(--op-pad);color:var(--op-moon);transition:background-color .3s,color .3s,box-shadow .3s,opacity .8s}
.op-header[data-solid]{background:rgba(242,243,239,.94);color:var(--op-text);box-shadow:0 1px 0 var(--op-rule);backdrop-filter:blur(10px)}
.op-header[data-scrolled]:not([data-solid]){background:rgba(5,9,16,.8);backdrop-filter:blur(10px)}
.op-header::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:linear-gradient(90deg,var(--op-teal-l),var(--op-amber));transform:scaleX(var(--page,0));transform-origin:0 50%;opacity:0;transition:opacity .4s}
.op-header[data-scrolled]::after{opacity:1}
.op-root[data-phase="playing"] .op-header,.op-root[data-phase="pending"] .op-header{opacity:.62}
.op-brand{display:inline-flex;align-items:center;gap:10px;font-family:var(--op-display);font-size:22px;letter-spacing:-.02em;text-decoration:none;font-variation-settings:"opsz" 40}
.op-brand-mark{width:38px;height:31px;flex:none}
.op-header[data-solid] .op-brand-mark{--op-em-limb:var(--op-navy);--op-em-orbit:var(--op-teal);--op-em-signal:var(--op-copper);--op-em-fill:rgba(34,117,111,.1)}
.op-nav{display:flex;align-items:center;gap:clamp(16px,2.4vw,34px);margin-left:auto;font-size:14.5px}
.op-nav>a{text-decoration:none;opacity:.86;padding:8px 0;border-bottom:1px solid transparent}
.op-nav>a:hover{opacity:1;border-bottom-color:currentColor}
.op-menu-btn{display:none;margin-left:auto;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid currentColor;background:transparent;cursor:pointer;font-size:14px}

/* hero */
.op-hero{position:relative;min-height:100svh;display:flex;flex-direction:column;justify-content:center;color:var(--op-moon);overflow:hidden;isolation:isolate;
  background:radial-gradient(58% 46% at 92% -6%,rgba(229,168,98,.2),transparent 62%),radial-gradient(64% 56% at -6% 104%,rgba(34,117,111,.26),transparent 62%),linear-gradient(180deg,#04070d 0%,#081120 58%,#0f1d33 100%)}
.op-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
.op-stars-css{position:absolute;inset:0;z-index:-2;opacity:.45;transition:opacity 1s;
  background-image:radial-gradient(1px 1px at 12% 22%,#fff9 50%,transparent 51%),radial-gradient(1px 1px at 68% 14%,#dfe9f3aa 50%,transparent 51%),radial-gradient(1.4px 1.4px at 38% 72%,#fff7 50%,transparent 51%),radial-gradient(1px 1px at 86% 58%,#fff8 50%,transparent 51%),radial-gradient(1px 1px at 52% 40%,#cfe0ee88 50%,transparent 51%);
  background-size:340px 280px,410px 330px,290px 360px,520px 300px,230px 250px}
.op-root[data-gl="off"] .op-stars-css{opacity:.7}
.op-hero-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:center;gap:clamp(16px,3vw,56px);width:100%;max-width:1480px;margin:0 auto;padding:104px var(--op-pad) clamp(32px,4vw,56px)}
.op-anchor{aspect-ratio:2.3/1.75;width:100%;max-height:56svh;justify-self:center;display:grid;place-items:center}
.op-emblem-svg{width:100%;height:100%;transition:opacity .8s}
.op-root[data-gl="on"] .op-emblem-svg,.op-root[data-phase="pending"] .op-emblem-svg,.op-root[data-phase="playing"] .op-emblem-svg{opacity:0}
.op-wordmark{font-family:var(--op-display);font-weight:300;font-size:clamp(60px,10.4vw,176px);line-height:.92;letter-spacing:-.045em;font-variation-settings:"opsz" 144,"SOFT" 40;margin-left:-.04em}
.op-tagline{font-family:var(--op-display);font-style:italic;font-weight:300;font-size:clamp(22px,2.5vw,38px);line-height:1.15;color:var(--op-amber);margin-top:clamp(10px,1.4vw,20px);font-variation-settings:"opsz" 60}
.op-promise{max-width:33em;margin-top:clamp(20px,2.4vw,34px);font-size:clamp(16px,1.25vw,18.5px);line-height:1.62;color:#c9d1d3}
.op-cta{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;margin-top:clamp(24px,2.6vw,36px)}
.op-status{display:flex;align-items:baseline;gap:10px;margin-top:clamp(22px,2.4vw,34px);font-size:14px;color:#a9b5ba;max-width:34em}
.op-status i{flex:none;width:7px;height:7px;border-radius:50%;background:#7b8791;transform:translateY(-1px)}
.op-status[data-tone="ok"] i{background:var(--op-teal-l);box-shadow:0 0 0 4px rgba(124,207,196,.16)}
.op-status[data-tone="wait"] i{background:var(--op-amber)}
.op-hero-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 clamp(16px,2.4vw,40px);width:100%;max-width:1480px;margin:0 auto;padding:0 var(--op-pad)}
.op-hero-facts li{border-top:1px solid rgba(230,233,228,.18);padding-top:14px;display:grid;gap:4px}
.op-hero-facts b{font-family:var(--op-display);font-weight:400;font-size:clamp(18px,1.6vw,23px);letter-spacing:-.01em;color:var(--op-moon);font-variation-settings:"opsz" 40}
.op-hero-facts span{font-size:14px;color:#a9b5ba;line-height:1.45}
.op-hero-facts li:nth-child(1) b::before,.op-hero-facts li:nth-child(4) b::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 10px 3px 0;background:var(--op-amber)}
.op-hero-facts li:nth-child(2) b::before,.op-hero-facts li:nth-child(3) b::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 10px 3px 0;background:var(--op-teal-l)}
.op-hero-note{width:100%;max-width:1480px;margin:22px auto calc(7vw + 28px);padding:0 var(--op-pad);font-size:12.5px;color:rgba(169,181,186,.72)}
.op-horizon{position:absolute;left:-12%;right:-12%;bottom:-1px;height:7vw;background:var(--op-paper);border-radius:50% 50% 0 0/100% 100% 0 0;box-shadow:0 -1px 0 rgba(124,207,196,.5),0 -18px 60px rgba(124,207,196,.16)}
.op-skip{position:absolute;right:var(--op-pad);bottom:calc(7vw + 22px);z-index:5;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid rgba(230,233,228,.5);background:rgba(6,10,18,.55);color:var(--op-moon);cursor:pointer;font-size:14px;backdrop-filter:blur(6px)}
.op-skip:hover{background:rgba(230,233,228,.14)}

/* intro reveal states */
.op-rv{transition:opacity 1s cubic-bezier(.2,.7,.2,1) var(--d,0s),transform 1.2s cubic-bezier(.2,.7,.2,1) var(--d,0s)}
.op-root[data-phase="pending"] .op-rv,.op-root[data-phase="playing"] .op-rv,.op-root[data-phase="wordmark"] .op-rv.op-late{opacity:0;transform:translateY(16px)}
.op-root[data-phase="pending"] .op-rv{animation:op-failsafe .8s 4s forwards}
@keyframes op-failsafe{to{opacity:1;transform:none}}

/* scroll choreography (only once the script has switched it on) */
.op-root{--op-ease:cubic-bezier(.2,.7,.2,1)}
@media (prefers-reduced-motion:no-preference){:root:has(.op-root){scroll-behavior:smooth}}
.op-root[data-motion="on"] [data-rv]{opacity:0;transform:translate3d(0,18px,0);transition:opacity .7s var(--op-ease) var(--rd,0s),transform .8s var(--op-ease) var(--rd,0s)}
.op-root[data-motion="on"] [data-rv][data-in]{opacity:1;transform:none}

/* sections */
.op-sec{max-width:var(--op-max);margin:0 auto;padding:clamp(56px,7vw,104px) var(--op-pad)}
.op-root .op-find{padding-top:clamp(40px,5vw,72px)}
.op-find-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px clamp(24px,5vw,80px);align-items:end}
.op-find-head p{color:var(--op-slate);max-width:32em}
.op-form{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(0,1fr)) auto;gap:0 clamp(16px,2.2vw,32px);align-items:end;margin-top:clamp(28px,4vw,52px);padding-bottom:22px;border-bottom:1px solid var(--op-text)}
.op-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.op-field>span:first-child{font-size:13px;color:var(--op-slate)}
.op-field em{font-style:normal;opacity:.8}
.op-field-row{display:flex;align-items:baseline;gap:10px}
.op-field input,.op-field select{width:100%;min-width:0;height:44px;border:0;border-bottom:1px solid var(--op-rule);border-radius:0;background:transparent;font-size:19px;font-family:var(--op-display);font-variation-settings:"opsz" 30;outline-offset:4px;padding:0}
.op-field input::placeholder{color:#9aa4a8}
.op-field input:hover,.op-field select:hover{border-bottom-color:var(--op-text)}
.op-field select{cursor:pointer}
.op-form-go{white-space:nowrap}
.op-form-notes{margin-top:16px;display:grid;gap:8px;font-size:14px;color:var(--op-slate);max-width:62em}
.op-form-notes b{color:var(--op-text);font-weight:600}
.op-root .op-warn{color:#8a3d12}

.op-network{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(40px,7vw,110px);border-top:1px solid var(--op-rule)}
.op-figs{margin-top:clamp(24px,3vw,40px)}
.op-figs>div{display:grid;grid-template-columns:minmax(96px,auto) 1fr;gap:20px;align-items:baseline;padding:16px 0;border-top:1px solid var(--op-rule)}
.op-figs dd{font-family:var(--op-display);font-weight:300;font-size:clamp(40px,4.6vw,64px);line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;font-variation-settings:"opsz" 96;min-height:1em}
.op-figs dt{font-size:15px;font-weight:550}
.op-figs dt small{display:block;font-size:13.5px;font-weight:400;color:var(--op-slate)}
.op-source{margin-top:18px;font-size:13.5px;color:var(--op-slate)}
.op-sample{display:inline-block;margin-right:8px;padding:1px 8px;border-radius:3px;background:var(--op-amber);color:#1a1206;font-weight:600;font-size:12.5px}
.op-empty{margin-top:20px;padding:22px 0;border-top:1px solid var(--op-rule);border-bottom:1px solid var(--op-rule);color:var(--op-slate);display:grid;gap:12px;justify-items:start}
.op-root .op-stations h3{font-family:var(--op-display);font-weight:400;font-size:26px;letter-spacing:-.015em;margin-top:8px}
.op-st-list{margin-top:18px;border-bottom:1px solid var(--op-rule)}
.op-st{display:grid;grid-template-columns:56px minmax(0,1.5fr) minmax(0,1fr);gap:8px 20px;padding:22px 0;border-top:1px solid var(--op-rule);align-items:start}
.op-st-main h4{font-family:var(--op-display);font-weight:400;font-size:23px;line-height:1.15;letter-spacing:-.015em}
.op-st-main p{font-size:14.5px;color:var(--op-slate);margin-top:4px}
.op-st-facts{display:grid;gap:6px;font-size:14px}
.op-st-facts div{display:grid;grid-template-columns:104px 1fr;gap:8px}
.op-st-facts dt{color:var(--op-slate)}
.op-st-price{grid-column:2/-1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px 20px;font-size:14.5px;color:var(--op-slate)}
.op-st-price b{font-family:var(--op-display);font-weight:400;font-size:22px;color:var(--op-text);font-variant-numeric:tabular-nums}
.op-st-note{grid-column:2/-1;font-size:14px}
.op-root .op-eg-label{margin-top:28px}
.op-st-eg{opacity:.72;margin-top:6px}
.op-st-eg .op-st{border-top-style:dashed}
.op-dial{margin-top:2px}
.op-dial circle,.op-dial ellipse{fill:none;stroke:var(--op-mineral);stroke-width:1}
.op-dial .op-dial-lat{stroke:var(--op-teal);stroke-width:1.2}
.op-dial .op-dial-pt{fill:var(--op-copper);stroke:var(--op-paper);stroke-width:1.5}
.op-skel{display:inline-block;width:1.6em;height:.72em;border-radius:3px;background:var(--op-moon);animation:op-pulse 1.4s ease-in-out infinite}
.op-skel-row{grid-column:1/-1;width:100%;height:64px}
@keyframes op-pulse{50%{opacity:.45}}

.op-how{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(32px,7vw,110px);border-top:1px solid var(--op-rule)}
.op-how-intro p{margin-top:20px;color:var(--op-slate);max-width:30em}
.op-steps{counter-reset:s}
.op-steps li{counter-increment:s;display:grid;grid-template-columns:54px 1fr;padding:22px 0;border-top:1px solid var(--op-rule)}
.op-steps li:last-child{border-bottom:1px solid var(--op-rule)}
.op-steps li::before{content:counter(s);grid-row:1/3;font-family:var(--op-display);font-size:34px;line-height:1;color:var(--op-copper);font-weight:300}
.op-steps p{grid-column:2;margin-top:6px;color:var(--op-slate);max-width:38em}

.op-pod{position:relative;padding-top:6vw;color:var(--op-moon);
  background:radial-gradient(1px 1px at 14% 30%,#fff8 50%,transparent 51%) 0 0/360px 300px,radial-gradient(1px 1px at 72% 64%,#dfe9f399 50%,transparent 51%) 0 0/430px 350px,radial-gradient(50% 40% at 100% 0%,rgba(229,168,98,.1),transparent 70%),linear-gradient(180deg,#070d18,#0f1d33)}
.op-pod::before,.op-close::before{content:"";position:absolute;left:-12%;right:-12%;top:-1px;height:6vw;background:var(--op-paper);border-radius:0 0 50% 50%/0 0 100% 100%}
.op-pod-inner{max-width:var(--op-max);margin:0 auto;padding:clamp(64px,9vw,120px) var(--op-pad)}
.op-pod-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px clamp(24px,5vw,80px);align-items:end}
.op-pod-head p{color:#b9c4c8;max-width:30em}
.op-curve{display:block;width:100%;height:auto;margin-top:clamp(28px,4vw,52px);overflow:visible}
.op-curve path{fill:none}
.op-curve-horizon{stroke:rgba(230,233,228,.55);stroke-width:1}
.op-curve-grid{stroke:rgba(230,233,228,.1);stroke-width:1;stroke-dasharray:2 7}
.op-curve .op-curve-fill{fill:rgba(124,207,196,.1)}
.op-pod-stage{--p:1;--fly:clamp(0,calc((var(--p) - .12)/.68),1)}
.op-curve-line{stroke:var(--op-teal-l);stroke-width:2;stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--fly))}
.op-curve .op-curve-fill{opacity:var(--fly)}
.op-curve-tick{stroke:rgba(230,233,228,.4);stroke-width:1;stroke-dasharray:3 4}
.op-curve-node{fill:var(--op-amber);fill-opacity:0;stroke:var(--op-amber);stroke-width:2}
.op-curve-n1{fill-opacity:clamp(0,calc(var(--p)*12),1)}
.op-curve-n2{fill-opacity:clamp(0,calc((var(--p) - .82)*14),1)}
.op-curve-n3{fill-opacity:clamp(0,calc((var(--p) - .93)*16),1)}
.op-curve-sat{fill:var(--op-moon);filter:drop-shadow(0 0 6px rgba(230,233,228,.8));offset-path:path("M250 232 C 380 -14, 580 -14, 710 232");offset-distance:calc(var(--fly)*100%);offset-rotate:0deg;opacity:clamp(0,calc(var(--fly)*20),1)}
@supports not (offset-path:path("M0 0")){.op-curve-sat{transform:translate(480px,48px)}}
.op-curve text{font-family:var(--op-mono-f);font-size:15px;fill:#aab6bb}
.op-pod-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(24px,3.4vw,52px);margin-top:clamp(20px,3vw,36px)}
.op-pod-steps li{border-top:1px solid rgba(230,233,228,.24);padding-top:16px;transition:opacity .3s}
.op-pod-steps li:nth-child(1){opacity:clamp(.32,calc(var(--p)*9),1)}
.op-pod-steps li:nth-child(2){opacity:clamp(.32,calc((var(--p) - .8)*10),1)}
.op-pod-steps li:nth-child(3){opacity:clamp(.32,calc((var(--p) - .92)*14),1)}
.op-pod-steps .op-mono{color:var(--op-amber)}
.op-root .op-pod-steps h3{margin-top:6px;font-family:var(--op-display);font-weight:400;font-size:24px;letter-spacing:-.015em;line-height:1.2}
.op-pod-steps p{margin-top:10px;color:#b9c4c8;font-size:15.5px}
.op-example{margin-top:clamp(36px,5vw,64px);display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:10px clamp(24px,5vw,80px);align-items:center}
.op-example figcaption{grid-column:1/-1;font-size:13.5px;color:#9aa8ae}
.op-example-bar{display:flex;height:10px;border-radius:5px;overflow:hidden;gap:2px}
.op-root[data-motion="on"] .op-example .op-example-bar{clip-path:inset(0 100% 0 0);transition:clip-path 1.6s var(--op-ease) .3s}
.op-root[data-motion="on"] .op-example[data-in] .op-example-bar{clip-path:inset(0)}
.op-example-bar i:nth-child(1){background:var(--op-teal-l)}
.op-example-bar i:nth-child(2){background:var(--op-mineral)}
.op-example-bar i:nth-child(3){background:var(--op-amber)}
.op-example p{color:#c9d1d3;font-size:15.5px;margin-top:14px}
.op-example-figs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.op-example-figs div{border-top:1px solid rgba(230,233,228,.24);padding-top:12px}
.op-example-figs dd{font-family:var(--op-display);font-weight:300;font-size:clamp(40px,4.4vw,60px);line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--op-moon)}
.op-example-figs div:nth-child(2) dd{color:var(--op-teal-l)}
.op-example-figs div:nth-child(3) dd{color:var(--op-amber)}
.op-example-figs dt{margin-top:8px;font-size:13.5px;color:#9aa8ae}
.op-example-legend{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:14px;font-size:14px;color:#b9c4c8}
.op-example-legend li{display:flex;align-items:center;gap:8px}
.op-example-legend i{width:10px;height:10px;border-radius:2px;background:var(--op-teal-l)}
.op-example-legend li:nth-child(2) i{background:var(--op-mineral)}
.op-example-legend li:nth-child(3) i{background:var(--op-amber)}
.op-example-legend b{font-family:var(--op-mono-f);font-weight:500;color:var(--op-moon)}

.op-owners{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(32px,6vw,96px);align-items:center}
.op-own-copy>p{margin-top:20px;color:var(--op-slate);max-width:34em;font-size:17.5px}
.op-own-list{margin-top:28px;display:grid;gap:14px;max-width:40em}
.op-own-list li{padding-left:20px;position:relative;color:var(--op-slate)}
.op-own-list li::before{content:"";position:absolute;left:0;top:.66em;width:9px;height:1px;background:var(--op-copper)}
.op-own-list b{color:var(--op-text);font-weight:600}
.op-antenna{width:100%;height:auto;max-width:520px;justify-self:center}
.op-antenna-body path,.op-antenna-body circle{fill:var(--op-navy)}
.op-antenna-body .op-antenna-ground{fill:none;stroke:var(--op-navy);stroke-width:1.5}
.op-antenna-body .op-antenna-strut{fill:none;stroke:var(--op-navy);stroke-width:2.5}
.op-antenna-arcs path{stroke:var(--op-mineral);stroke-width:1.2;stroke-dasharray:2 7}
.op-antenna-arcs .op-antenna-pass{stroke:var(--op-teal);stroke-dasharray:none;stroke-width:1.5}
.op-antenna{--p:.62}
.op-antenna-dish{transform-box:view-box;transform-origin:276px 250px;transform:rotate(calc(-70deg + var(--p)*118deg))}
.op-antenna-sat{fill:var(--op-copper);offset-path:path("M40 196 Q 190 -30 486 96");offset-distance:calc(var(--p)*100%);offset-rotate:0deg}
@supports not (offset-path:path("M0 0")){.op-antenna-sat{transform:translate(318px,52px)}.op-antenna-dish{transform:rotate(-24deg)}}

.op-root .op-sub{margin-top:clamp(32px,4vw,48px);font-family:var(--op-display);font-weight:400;font-size:24px;letter-spacing:-.015em}
.op-how-intro .op-own-list{margin-top:16px}
.op-arch{border-top:1px solid var(--op-rule)}
.op-arch-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px clamp(24px,5vw,80px);align-items:end}
.op-arch-head p{color:var(--op-slate);max-width:32em}
.op-layers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,44px);margin-top:clamp(28px,4vw,52px)}
.op-layers li{border-top:2px solid var(--op-text);padding-top:18px}
.op-layers li:nth-child(2){border-top-color:var(--op-teal)}
.op-layers li:nth-child(3){border-top-color:var(--op-copper)}
.op-layers .op-mono{color:var(--op-slate)}
.op-root .op-layers h3{margin-top:4px;font-family:var(--op-display);font-weight:400;font-size:26px;letter-spacing:-.015em}
.op-layers p{margin-top:10px;color:var(--op-slate);font-size:15.5px}
.op-gd{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(32px,6vw,96px);align-items:center;border-top:1px solid var(--op-rule)}
.op-gd-copy>p{margin-top:20px;color:var(--op-slate);max-width:34em;font-size:17.5px}
.op-gd-card{background:var(--op-navy);color:var(--op-moon);border-radius:18px;padding:clamp(22px,2.6vw,34px);box-shadow:0 30px 60px -30px rgba(6,10,18,.55)}
.op-gd-card figcaption{font-size:12.5px;color:#9aa8ae}
.op-gd-title{margin-top:14px;font-family:var(--op-display);font-size:26px;letter-spacing:-.015em;line-height:1.15}
.op-gd-title span{display:block;font-size:15px;color:#b9c4c8;font-family:var(--op-sans);letter-spacing:0;margin-top:4px}
.op-gd-bar{position:relative;height:10px;margin-top:20px;border-radius:5px;background:rgba(230,233,228,.12);overflow:hidden}
.op-gd-bar i{position:absolute;inset:0 auto 0 0;border-radius:5px}
.op-gd-bar i:first-child{background:rgba(124,207,196,.3)}
.op-gd-bar i:last-child{background:var(--op-teal-l)}
.op-gd-line{margin-top:12px;font-size:15px;color:#c9d1d3}
.op-gd-line b{color:var(--op-moon);font-weight:600}
.op-gd-line em{font-style:normal;color:var(--op-teal-l)}
.op-gd-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}
.op-gd-facts div{border-top:1px solid rgba(230,233,228,.18);padding-top:10px}
.op-gd-facts dt{font-size:12.5px;color:#9aa8ae}
.op-gd-facts dd{margin-top:2px;font-family:var(--op-mono-f);font-size:15px}
.op-gd-log{margin-top:18px;display:grid;gap:8px;font-size:13.5px;color:#b9c4c8}
.op-gd-log .op-mono{color:var(--op-amber);margin-right:8px}
.op-faq{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(32px,7vw,110px);border-top:1px solid var(--op-rule)}
.op-trust ul{margin-top:24px;display:grid;gap:14px;color:var(--op-slate)}
.op-trust li{padding-left:20px;position:relative}
.op-trust li::before{content:"";position:absolute;left:0;top:.66em;width:9px;height:1px;background:var(--op-teal)}
.op-qa details{border-top:1px solid var(--op-rule)}
.op-qa details:last-child{border-bottom:1px solid var(--op-rule)}
.op-qa summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:20px;padding:18px 0;font-size:17.5px;font-weight:550}
.op-qa summary::-webkit-details-marker{display:none}
.op-qa summary::after{content:"+";font-family:var(--op-display);font-size:24px;line-height:1;color:var(--op-copper);flex:none}
.op-qa details[open] summary::after{content:"\\2212"}
.op-qa details p{padding:0 40px 20px 0;color:var(--op-slate);max-width:44em}
.op-qa summary{transition:color .2s}
.op-qa summary:hover{color:var(--op-teal)}
.op-qa summary::after{transition:transform .35s var(--op-ease)}
.op-qa details[open] summary::after{transform:rotate(180deg)}
@supports (interpolate-size:allow-keywords){.op-qa{interpolate-size:allow-keywords}.op-qa details::details-content{block-size:0;overflow:clip;opacity:0;transition:block-size .45s var(--op-ease),opacity .45s,content-visibility .45s allow-discrete}.op-qa details[open]::details-content{block-size:auto;opacity:1}}
.op-st{transition:background-color .3s}
.op-st:hover{background:linear-gradient(90deg,transparent,rgba(34,117,111,.06) 30%,transparent)}
.op-dial .op-dial-pt{transition:r .3s}
.op-st:hover .op-dial-pt{r:4.4}
.op-btn-signal{box-shadow:0 0 0 0 rgba(229,168,98,0)}
.op-btn-signal:hover{box-shadow:0 0 0 6px rgba(229,168,98,.16),0 10px 30px -10px rgba(229,168,98,.6)}
.op-btn{transition:background-color .25s,border-color .25s,color .25s,transform .25s var(--op-ease),box-shadow .35s}
.op-btn:hover{transform:translateY(-2px)}

.op-close{position:relative;overflow:hidden;color:var(--op-moon);text-align:center;padding:calc(6vw + clamp(72px,10vw,150px)) var(--op-pad) clamp(72px,10vw,150px);
  background:radial-gradient(1px 1px at 12% 22%,#fff9 50%,transparent 51%) 0 0/340px 280px,radial-gradient(1px 1px at 68% 14%,#dfe9f3aa 50%,transparent 51%) 0 0/410px 330px,radial-gradient(1.4px 1.4px at 38% 72%,#fff7 50%,transparent 51%) 0 0/290px 360px,radial-gradient(60% 70% at 50% 120%,rgba(34,117,111,.4),transparent 70%),linear-gradient(180deg,#0b1627,#050810)}
.op-close-inner{position:relative;max-width:900px;margin:0 auto}
.op-root .op-close h2{font-size:clamp(36px,5.6vw,84px);font-weight:300;line-height:1.02;letter-spacing:-.03em}
.op-close p{margin:24px auto 0;max-width:30em;color:#b9c4c8;font-size:clamp(16px,1.3vw,19px)}
.op-close .op-cta{justify-content:center}
.op-close-orbit{position:absolute;left:50%;top:58%;width:0;height:0}
.op-close-orbit i{position:absolute;left:50%;top:50%;border:1px solid rgba(124,207,196,.2);border-radius:50%;translate:-50% -50%}
.op-close-orbit i:nth-child(1){width:min(150vw,1500px);height:min(46vw,460px);rotate:-14deg}
.op-close-orbit i:nth-child(2){width:min(118vw,1180px);height:min(64vw,640px);rotate:18deg;border-color:rgba(230,233,228,.1)}
.op-close-orbit i:nth-child(3){width:min(190vw,1900px);height:min(34vw,340px);rotate:6deg;border-style:dashed;border-color:rgba(229,168,98,.18)}
.op-close-orbit i:nth-child(1)::after{content:"";position:absolute;left:50%;top:-4px;width:7px;height:7px;border-radius:50%;background:var(--op-amber);box-shadow:0 0 14px 3px rgba(229,168,98,.6)}
.op-footer-mark{max-width:var(--op-max);margin:clamp(40px,6vw,90px) auto -0.06em;font-family:var(--op-display);font-weight:300;font-size:clamp(72px,19.5vw,300px);line-height:.8;letter-spacing:-.05em;font-variation-settings:"opsz" 144,"SOFT" 40;color:transparent;background:linear-gradient(180deg,rgba(230,233,228,.2),rgba(124,207,196,.05) 78%,transparent);-webkit-background-clip:text;background-clip:text;user-select:none;white-space:nowrap}

.op-footer{background:var(--op-ink);color:#b4bfc4;padding:clamp(48px,6vw,80px) var(--op-pad) 28px}
.op-footer-top{max-width:var(--op-max);margin:0 auto;display:grid;grid-template-columns:minmax(0,2fr) repeat(3,minmax(0,1fr));gap:36px clamp(24px,4vw,64px)}
.op-footer .op-brand{color:var(--op-moon)}
.op-footer-brand p{margin-top:14px;max-width:24em;font-size:14.5px}
.op-footer nav{display:grid;gap:10px;align-content:start;font-size:14.5px}
.op-root .op-footer nav h2{font-family:var(--op-sans);font-size:13px;font-weight:600;letter-spacing:0;line-height:1.4;color:#7f8c94;margin-bottom:4px}
.op-footer nav a{text-decoration:none;width:fit-content}
.op-footer nav a:hover{color:var(--op-moon);text-decoration:underline;text-underline-offset:4px}
.op-footer-base{max-width:var(--op-max);margin:clamp(28px,4vw,48px) auto 0;padding-top:20px;border-top:1px solid rgba(230,233,228,.14);font-size:13px;color:#7f8c94}

@media (max-width:980px){
  .op-form{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 24px}
  .op-field-wide,.op-form-go{grid-column:1/-1}
  .op-network,.op-how,.op-faq,.op-owners,.op-arch-head,.op-gd{grid-template-columns:minmax(0,1fr)}
  .op-layers{grid-template-columns:minmax(0,1fr)}
  .op-hero-facts{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 20px}
  .op-antenna{max-width:380px;order:-1}
}
@media (max-width:820px){
  .op-menu-btn{display:inline-flex;align-items:center}
  .op-nav{display:none;position:absolute;left:0;right:0;top:68px;flex-direction:column;align-items:stretch;gap:0;margin:0;padding:6px var(--op-pad) 22px;background:rgba(242,243,239,.98);color:var(--op-text);box-shadow:0 1px 0 var(--op-rule),0 24px 40px -24px rgba(6,10,18,.4)}
  .op-nav[data-open]{display:flex}
  .op-nav>a{padding:15px 0;border-bottom:1px solid var(--op-rule);font-size:17px;opacity:1}
  .op-nav-account{padding-top:18px}
  .op-hero-grid{grid-template-columns:minmax(0,1fr);gap:8px;padding:84px var(--op-pad) 28px}
  .op-anchor{max-height:30svh;max-width:420px}
  .op-find-head,.op-pod-head,.op-example{grid-template-columns:minmax(0,1fr)}
  .op-pod-steps{grid-template-columns:minmax(0,1fr)}
  .op-curve text{font-size:24px}
  .op-st{grid-template-columns:56px minmax(0,1fr)}
  .op-st-facts,.op-st-price,.op-st-note{grid-column:2}
  .op-footer-top{grid-template-columns:repeat(2,minmax(0,1fr))}
  .op-footer-brand{grid-column:1/-1}
  .op-hero-note{font-size:12px}
  .op-example-figs dd{font-size:36px}
  .op-skip{bottom:calc(7vw + 64px)}
}
@media (max-width:480px){
  .op-form{grid-template-columns:minmax(0,1fr)}
  .op-cta .op-btn{flex:1 1 100%}
  .op-figs>div{grid-template-columns:minmax(0,1fr);gap:4px}
}
@media (prefers-reduced-motion:reduce){
  .op-root *,.op-root *::before,.op-root *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  .op-root .op-rv{opacity:1!important;transform:none!important}
}
`;
