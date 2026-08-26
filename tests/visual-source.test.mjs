import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const backdrop = readFileSync(new URL('../app/components/visual/NeuralBackdrop.tsx', import.meta.url), 'utf8');
const cosmos = readFileSync(new URL('../app/components/visual/HeroCosmosCanvas.tsx', import.meta.url), 'utf8');
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

test('HeroCosmosCanvas renders a layered galactic core and varied warm satellites', () => {
  assert.match(cosmos, /const SATELLITE_PALETTE = \[/);
  assert.match(cosmos, /0xffd84a/);
  assert.match(cosmos, /0xffaa24/);
  assert.match(cosmos, /function satelliteScale\(index: number\)/);
  assert.match(cosmos, /satellites\.setColorAt\(index, color\)/);
  assert.match(cosmos, /glows\.setColorAt\(index, color\)/);
  assert.match(cosmos, /new THREE\.Color\(SATELLITE_PALETTE/);
  assert.match(cosmos, /const coreMaterial = useMemo/);
  assert.match(cosmos, /const auraMaterial = useMemo/);
  assert.match(cosmos, /float spiralRaw/);
  assert.match(cosmos, /float cyberGrid/);
  assert.match(cosmos, /vec3 gold = vec3\(1\.0, 0\.58, 0\.08\)/);
  assert.match(cosmos, /new THREE\.LineDashedMaterial/);
  assert.match(cosmos, /data-core-stars=/);
  assert.match(cosmos, /data-orbits=/);
  assert.match(cosmos, /for \(let index = 0; index < 16; index \+= 1\)/);
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
