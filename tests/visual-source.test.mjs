import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const backdrop = readFileSync(new URL('../app/components/visual/NeuralBackdrop.tsx', import.meta.url), 'utf8');
const cosmos = readFileSync(new URL('../app/components/visual/HeroCosmosCanvas.tsx', import.meta.url), 'utf8');
const cyberConfig = readFileSync(new URL('../app/components/visual/hero-cyber-config.ts', import.meta.url), 'utf8');
const hero = readFileSync(new URL('../app/components/site/HeroExperience.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('NeuralBackdrop remains a global Canvas2D-only ambient layer', () => {
  assert.match(backdrop, /data-render-surface="canvas2d"/);
  assert.match(backdrop, /className="neural-backdrop__canvas neural-backdrop__canvas--fallback"/);
  assert.doesNotMatch(backdrop, /@react-three\/fiber/);
  assert.doesNotMatch(backdrop, /NeuralFieldCanvas/);
});

test('HeroCosmosCanvas pairs context-loss listener setup and cleanup', () => {
  assert.match(cosmos, /addEventListener\('webglcontextlost', handleContextLost/);
  assert.match(cosmos, /removeEventListener\('webglcontextlost', handleContextLost\)/);
  assert.match(cosmos, /setTier\('static'\)/);
});

test('HeroCosmosCanvas disposes the cyber scene resources on unmount', () => {
  assert.match(cosmos, /geometry\.dispose\(\)/);
  assert.match(cosmos, /coreMaterial\.dispose\(\)/);
  assert.match(cosmos, /shellMaterial\.dispose\(\)/);
  assert.match(cosmos, /pointData\.geometry\.dispose\(\)/);
  assert.match(cosmos, /coreStarData\.geometry\.dispose\(\)/);
  assert.match(cosmos, /const coreStarData = useMemo[\s\S]*depthTest: false/);
  assert.match(cosmos, /<points ref=\{coreStarsRef\}[^>]*renderOrder=\{1\.5\}/);
  assert.match(cosmos, /vAlpha = flicker \* \(0\.14 \+ aPulse \* 0\.22\)/);
  assert.match(cosmos, /orbitGroup\.traverse\(\(object\) =>/);
  assert.match(cosmos, /object\.geometry\.dispose\(\)/);
  assert.match(cosmos, /materials\.forEach\(\(material\) => material\.dispose\(\)\)/);
});

test('HeroCosmosCanvas pauses while either offscreen or hidden', () => {
  assert.match(cosmos, /const \[offscreen, setOffscreen\] = useState\(false\)/);
  assert.match(cosmos, /const \[documentHidden, setDocumentHidden\] = useState\(false\)/);
  assert.match(cosmos, /const paused = offscreen \|\| documentHidden/);
  assert.match(cosmos, /setOffscreen\(!\(entry\?\.isIntersecting \?\? true\)\)/);
  assert.match(cosmos, /setDocumentHidden\(document\.visibilityState !== 'visible'\)/);
  assert.match(cosmos, /data-paused=\{paused \? 'true' : 'false'\}/);
  assert.doesNotMatch(cosmos, /IntersectionObserver\(\[entry\] => setPaused/);
  assert.doesNotMatch(cosmos, /onVisibility = \(\) => setPaused/);
});

test('StaticCosmos uses one capped DPR for backing size and transform', () => {
  assert.match(cosmos, /function drawStaticCosmos\([\s\S]*points: Float32Array, dpr: number\)/);
  assert.match(cosmos, /drawStaticCosmos\(context, width, height, value, points, dpr\)/);
  const drawStaticSource = cosmos.slice(cosmos.indexOf('function drawStaticCosmos'), cosmos.indexOf('\nfunction StaticCosmos'));
  assert.doesNotMatch(drawStaticSource, /window\.devicePixelRatio/);
});

test('HeroCosmosCanvas uses the required responsive detail budget', () => {
  assert.match(cosmos, /pc: \{ detail: 5, points: 3000, coreStars: 260, satellites: 28, orbits: 7, dpr: 1\.6/);
  assert.match(cosmos, /tablet: \{ detail: 4, points: 1700, coreStars: 160, satellites: 18, orbits: 6, dpr: 1\.3/);
  assert.match(cosmos, /mobile: \{ detail: 3, points: 900, coreStars: 90, satellites: 11, orbits: 5, dpr: 1/);
  assert.match(cosmos, /new THREE\.IcosahedronGeometry\(1, config\.detail\)/);
  assert.match(cosmos, /frameloop=\{paused \? 'never' : 'always'\}/);
});

test('HeroCosmosCanvas renders a layered cyber core and varied warm satellites', () => {
  assert.match(cosmos, /const SATELLITE_PALETTE = \[/);
  assert.match(cosmos, /0xffd24a/);
  assert.match(cosmos, /0xffaa24/);
  assert.match(cosmos, /function satelliteScale\(index: number\)/);
  assert.match(cosmos, /satellites\.setColorAt\(index, color\)/);
  assert.match(cosmos, /glows\.setColorAt\(index, color\)/);
  assert.match(cosmos, /new THREE\.Color\(SATELLITE_PALETTE/);
  assert.match(cosmos, /const coreMaterial = useMemo/);
  assert.match(cosmos, /from '\.\/hero-cyber-config'/);
  assert.match(cyberConfig, /dark: '#050812'/);
  assert.match(cyberConfig, /cyan: '#70E9FF'/);
  assert.match(cyberConfig, /violet: '#9E72FF'/);
  assert.match(cyberConfig, /gold: '#FFD24A'/);
  assert.match(cosmos, /data-core-stars=/);
  assert.match(cosmos, /data-orbits=/);
  assert.match(cosmos, /new THREE\.LineSegments/);
  assert.match(cosmos, /aTrack/);
  assert.match(cosmos, /const strokeOffsets = ringIndex < 3 \? \[-0\.006, 0, 0\.006\] : \[0\]/);
  assert.match(cosmos, /const addSegment = \(start: THREE\.Vector3/);
  assert.match(cosmos, /uScanPeriod/);
});

test('HeroCosmosCanvas uses a thin cyber shell and three timed ring axes', () => {
  assert.match(cosmos, /const shellGeometry = geometry/);
  assert.match(cosmos, /const shellMaterial = useMemo/);
  assert.match(cosmos, /float hash21\(vec2 value\)/);
  assert.match(cosmos, /float segmentDistance\(vec2 point/);
  assert.match(cosmos, /float columns = mix\(13\.0, 22\.0, uCircuitDensity\)/);
  assert.match(cosmos, /float routeEdge = max\(fwidth\(routeDistance\)/);
  assert.match(cosmos, /float trunkRow = 1\.0 - step/);
  assert.match(cosmos, /float trunkColumn = 1\.0 - step/);
  assert.match(cosmos, /float terminal = activeCell/);
  assert.match(cosmos, /float traceHalo/);
  assert.match(cosmos, /float trace/);
  assert.match(cosmos, /float junction/);
  assert.match(cosmos, /float scanPosition = fract\(uTime \/ uScanPeriod\)/);
  assert.match(cosmos, /uScanPeriod: \{ value: CIRCUIT_SCAN_PERIOD_SECONDS \}/);
  assert.match(cosmos, /uCircuitDensity/);
  assert.match(cyberConfig, /CORE_BREATH_PERIOD_SECONDS = 8/);
  assert.match(cyberConfig, /CIRCUIT_SCAN_PERIOD_SECONDS = 6/);
  assert.match(cyberConfig, /RING_PERIODS = \[45, 70, 95\]/);
  assert.match(cyberConfig, /RING_DIRECTIONS = \[1, -1, 1\]/);
  assert.match(cosmos, /setFromAxisAngle\(spinAxis, angle\)/);
  assert.match(cosmos, /baseQuaternion/);
  assert.match(cosmos, /getHeroCircuitReveal\(formation\.sphereReveal\)/);
  assert.match(cyberConfig, /function getHeroCircuitReveal/);
  assert.match(cosmos, /radius: 1\.32, scaleY: 1, rotation/);
  assert.match(cosmos, /radius: 1\.5, scaleY: 1, rotation/);
  assert.match(cosmos, /radius: 1\.68, scaleY: 1, rotation/);
  assert.match(cosmos, /new THREE\.Euler\(tilt\[0\], tilt\[1\], rotation\)/);
  assert.match(cosmos, /safeDelta = Math\.min\(Math\.max\(delta, 0\), 0\.05\)/);
  assert.doesNotMatch(cosmos, /STATIC_CRYSTAL_FACETS/);
  assert.doesNotMatch(cosmos, /crystalGeometry/);
  assert.doesNotMatch(cosmos, /crystalMaterial/);
});

test('Hero cosmos forms from an empty first frame after the intro handoff', () => {
  assert.match(hero, /const formationProgress = useMotionValue\(0\)/);
  assert.match(hero, /animate\(formationProgress, 1/);
  assert.match(hero, /delay: 0\.32/);
  assert.match(hero, /duration: 2\.25/);
  assert.match(hero, /const scrollAlreadyAdvanced = progress\.get\(\) >= 0\.14/);
  assert.match(hero, /value >= 0\.14 && formationProgress\.get\(\) < 1/);
  assert.match(hero, /formationAnimationRef\.current\?\.stop\(\)/);
  assert.match(cosmos, /getHeroFormationTimeline\(formationProgress\.get\(\)\)/);
  assert.match(cosmos, /<group ref=\{rootRef\} visible=\{false\}>/);
  assert.match(cosmos, /root\.visible = formation\.particleReveal > 0\.001 \|\| formation\.sphereReveal > 0\.001/);
  assert.match(cosmos, /uReveal: \{ value: 0 \}/);
  assert.match(cosmos, /uFormation: \{ value: 0 \}/);
  assert.match(cosmos, /uBaseOpacity: \{ value: opacity \}/);
  assert.match(cosmos, /material\.uniforms\.uReveal\.value = formation\.orbitReveal/);
  assert.match(cosmos, /formation\.orbitReveal/);
  assert.match(cosmos, /satelliteRevealAt\(formation\.satelliteReveal, index\)/);
  assert.match(cosmos, /satelliteScale\(index\) \* localReveal/);
  assert.match(cosmos, /const renderTier = capabilityReady \?/);
  assert.match(cosmos, /\{!capabilityReady \? null : isStatic \?/);
  const staticSource = cosmos.slice(cosmos.indexOf('function drawStaticCosmos'), cosmos.indexOf('\nfunction StaticCosmos'));
  assert.doesNotMatch(staticSource, /formationProgress/);
});

test('HeroCosmosCanvas shares MotionValue progress without scroll React state', () => {
  assert.match(cosmos, /progress: MotionValue<number>/);
  assert.match(cosmos, /progress\.get\(\)/);
  assert.doesNotMatch(cosmos, /addEventListener\('scroll'/);
  assert.match(hero, /useScroll\(\{ target: heroRef/);
  assert.match(hero, /useSpring\(scrollYProgress/);
  assert.match(hero, /getHeroTimeline\(value\)/);
  assert.doesNotMatch(hero, /setProgress/);
  assert.match(hero, /data-static=\{staticMode \? 'true' : 'false'\}/);
  assert.match(hero, /useMotionValueEvent\(progress, 'change'/);
  assert.match(hero, /ctaInteractiveRef\.current/);
  assert.match(hero, /tabIndex=\{ctaIsInteractive \? 0 : -1\}/);
  assert.match(hero, /aria-hidden=\{!ctaIsInteractive\}/);
  assert.match(hero, /coordinateOpacity/);
  assert.match(hero, /blur\(14px\)/);
  assert.match(hero, /clipPath/);
  assert.match(cosmos, /capabilityReady/);
  assert.match(cosmos, /if \(capabilityReady\) onStaticChange\(isStatic\)/);
  assert.match(styles, /\.hero-story \{ min-height: 420vh/);
  assert.doesNotMatch(hero, /LIVE FIELD MAP/);
  assert.match(hero, /aria-label="Forward Deployed Engineer — Business × AI × Software"/);
  assert.match(hero, /Business × AI × Software/);
  assert.match(hero, /課題整理から設計・開発・導入まで。/);
  assert.match(hero, /事業の課題を、技術で解決します。/);
  assert.match(styles, /--hero-statement-primary: #f8fffd/);
  assert.match(styles, /--hero-statement-accent: #ffe8a6/);
  assert.match(styles, /\.hero-story__statement::before \{[^}]*backdrop-filter: blur\(10px\)/);
  assert.match(styles, /\.hero-story__statement-line \+ \.hero-story__statement-line \{[^}]*text-shadow:/);
  assert.match(styles, /hero-story\[data-static='true'\] \.hero-story__fde-copy[\s\S]*top: 29%/);
  assert.match(styles, /\.hero-story__fde-copy \{[^}]*max-width: none;[^}]*width: min\(76rem,/);
  assert.match(styles, /\.hero-story__initial--forward \{ color: #70e9ff; \}/);
  assert.match(styles, /\.hero-story__initial--deployed \{ color: #d29aff; \}/);
  assert.match(styles, /\.hero-story__initial--engineer \{ color: #ffd460; \}/);
  assert.match(hero, /hero-story__initial--forward[^>]*>F<\/span>orward/);
  assert.match(hero, /hero-story__initial--deployed[^>]*>D<\/span>eployed/);
  assert.match(hero, /hero-story__initial--engineer[^>]*>E<\/span>ngineer/);
  assert.match(styles, /hero-story\[data-static='true'\] \.hero-story__statement[\s\S]*top: 66%/);
});
