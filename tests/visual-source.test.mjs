import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const backdrop = readFileSync(new URL('../app/components/visual/NeuralBackdrop.tsx', import.meta.url), 'utf8');
const cosmos = readFileSync(new URL('../app/components/visual/HeroCosmosCanvas.tsx', import.meta.url), 'utf8');
const fieldDraw = readFileSync(new URL('../app/components/visual/hero-field-draw.ts', import.meta.url), 'utf8');
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

test('HeroCosmosCanvas disposes the field resources on unmount', () => {
  assert.match(cosmos, /geometry\.dispose\(\)/);
  assert.match(cosmos, /material\.dispose\(\)/);
  assert.match(cosmos, /<points ref=\{pointsRef\}[^>]*frustumCulled=\{false\}/);
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
  assert.match(cosmos, /const dpr = Math\.min\(window\.devicePixelRatio \|\| 1, config\.dpr\)/);
  assert.match(cosmos, /drawStaticField\(context, width, height, dpr, fontFamily, readStaticCopyBounds\(canvas\), config\)/);
  assert.match(fieldDraw, /export function drawStaticField\([\s\S]*dpr: number/);
  assert.doesNotMatch(fieldDraw, /window\.devicePixelRatio/);
});

test('HeroCosmosCanvas renders the field from the shared tier budget', () => {
  assert.match(cosmos, /const config = isStatic \? null : FIELD_TIERS\[tier\]/);
  assert.match(cosmos, /new ResizeObserver\(draw\)/);
  // The phone tier must start where the Hero CSS switches to its phone layout.
  assert.match(cosmos, /if \(width > 720\) return 'tablet'/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(cosmos, /webgl2SupportRef\.current \?\?= probeWebgl2\(\)/);
  assert.match(cosmos, /webgl2SupportRef\.current = null;/);
  assert.match(cosmos, /createFieldGeometry\(config\.columns, config\.rows\)/);
  assert.match(cosmos, /frameloop=\{paused \? 'never' : 'always'\}/);
  assert.match(cosmos, /data-points=/);
});

test('HeroCosmosCanvas is a quiet point field, not the old cyber sphere', () => {
  assert.match(cosmos, /from '\.\/hero-field'/);
  assert.match(cosmos, /new THREE\.ShaderMaterial/);
  assert.match(cosmos, /HERO_FIELD_PALETTE\.ink/);
  assert.match(cosmos, /HERO_FIELD_PALETTE\.mint/);
  assert.match(cosmos, /drawFieldAnnotations\(context, view, state/);
  assert.match(cosmos, /className="hero-cosmos__annotations"/);
  assert.match(cosmos, /safeDelta = Math\.min\(Math\.max\(delta, 0\), 0\.05\)/);
  assert.doesNotMatch(cosmos, /IcosahedronGeometry/);
  assert.doesNotMatch(cosmos, /SATELLITE_PALETTE/);
  assert.doesNotMatch(cosmos, /orbitGroup/);
  assert.doesNotMatch(cosmos, /AdditiveBlending/);
  assert.doesNotMatch(styles, /\.hero-story__sticky::before/);
  assert.doesNotMatch(styles, /\.hero-story__sticky::after/);
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
  assert.match(cosmos, /visible=\{false\} \/>/);
  assert.match(cosmos, /points\.visible = formation\.rowReveal > 0\.001/);
  assert.match(cosmos, /uniforms\.uRowReveal\.value = formation\.rowReveal/);
  assert.match(cosmos, /uniforms\.uLight\.value = formation\.fieldLight/);
  assert.match(cosmos, /const renderTier = capabilityReady \?/);
  assert.match(cosmos, /\{!capabilityReady \? null : config \? <HeroCosmosR3F/);
  const staticSource = fieldDraw.slice(fieldDraw.indexOf('export function drawStaticField'));
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

test('font tokens resolve because next/font variables sit on <html>', () => {
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  // globals.css declares --font-sans/--font-mono on :root from these variables;
  // on <body> they are undefined at :root and every font token becomes invalid.
  assert.match(styles, /:root \{[\s\S]*--font-sans: var\(--font-geist-sans\)/);
  const htmlTag = layout.match(/<html\s[^>]*>/)?.[0] ?? '';
  const bodyTag = layout.match(/<body[\s>][^>]*>?/)?.[0] ?? '';
  assert.match(htmlTag, /geistSans\.variable/);
  assert.match(htmlTag, /geistMono\.variable/);
  assert.doesNotMatch(bodyTag, /\.variable/);
  // Self-referencing @theme tokens would turn into a cycle if the :root
  // declarations above ever moved; nothing uses Tailwind's font utilities.
  assert.doesNotMatch(styles, /--font-sans: var\(--font-sans\)/);
  assert.doesNotMatch(styles, /--font-mono: var\(--font-mono\)/);
});

test('the right-aligned Hero statement fits between the gutters at tablet widths', () => {
  // 17 full-width characters (~19em with padding) must fit inside 100vw minus
  // two 8.5vw gutters, so the size is capped by the viewport width.
  assert.match(styles, /\.hero-story__statement \{[^}]*font-size: min\(clamp\(2\.35rem, 2\.75vw, 4rem\), 4\.1vw\)/);
  assert.match(styles, /@media \(max-width: 1000px\) \{\s*\.header-status \{ display: none; \}/);
  // Safety net if the copy grows: wrap inside the gutters below 1000px.
  assert.match(styles, /\.hero-story__statement \{ max-width: calc\(100% - 2 \* clamp\(1\.25rem, 8\.5vw, 9rem\)\); \}/);
  assert.match(styles, /\.hero-story__statement p \{ text-wrap: balance; white-space: normal; \}/);
});
