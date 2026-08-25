'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useRef } from 'react';

type NeuralFieldCanvasProps = {
  dpr: number;
  count: number;
  paused: boolean;
  onContextLost: () => void;
};

function FieldPoints({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const points = useMemo(() => {
    let seed = 41;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = random() * 2 - 1;
      positions[index * 3 + 1] = random() * 2 - 1;
      positions[index * 3 + 2] = 0;
      sizes[index] = 1.3 + random() * (index % 11 === 0 ? 3.6 : 1.5);
      alphas[index] = 0.14 + random() * 0.64;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        precision mediump float;
        attribute float aSize;
        attribute float aAlpha;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec2 offset = vec2(sin(uTime * 0.15 + position.y * 9.0), cos(uTime * 0.12 + position.x * 8.0)) * 0.009;
          gl_Position = vec4(position.xy + offset, 0.0, 1.0);
          gl_PointSize = aSize;
          vAlpha = aAlpha;
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying float vAlpha;
        uniform float uTime;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          float glow = smoothstep(0.5, 0.02, radius);
          float pulse = 0.82 + sin(uTime * 0.8) * 0.12;
          gl_FragColor = vec4(0.55, 1.0, 0.80, glow * vAlpha * pulse);
        }
      `,
    });
    return new THREE.Points(geometry, material);
  }, [count]);

  useEffect(() => () => {
    points.geometry.dispose();
    (points.material as THREE.Material).dispose();
  }, [points]);

  useFrame(({ clock }) => {
    const current = pointsRef.current;
    if (!current) return;
    const material = current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = clock.elapsedTime;
    current.rotation.z = Math.sin(clock.elapsedTime * 0.035) * 0.035;
  });

  return <primitive ref={pointsRef} object={points} />;
}

export function NeuralFieldCanvas({ dpr, count, paused, onContextLost }: NeuralFieldCanvasProps) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const handleContextLost = useCallback((event: Event) => {
    event.preventDefault();
    onContextLost();
  }, [onContextLost]);

  useEffect(() => () => {
    const element = rendererRef.current?.domElement;
    if (element) element.removeEventListener('webglcontextlost', handleContextLost);
  }, [handleContextLost]);

  return (
    <Canvas
      className="neural-backdrop__r3f"
      camera={{ position: [0, 0, 1], near: 0.1, far: 10 }}
      dpr={dpr}
      frameloop={paused ? 'never' : 'always'}
      gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        rendererRef.current = gl;
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', handleContextLost, { passive: false });
      }}
    >
      <FieldPoints count={count} />
    </Canvas>
  );
}
