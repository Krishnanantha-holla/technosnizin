import * as THREE from 'three';
import { InstrumentEnergy } from '@/types';

export class CosmosScene {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  points!: THREE.Points;
  positions!: Float32Array;
  basePositions!: Float32Array;
  velocities!: Float32Array;
  colors!: Float32Array;
  count: number;
  rotation = 0;

  constructor(canvas: HTMLCanvasElement, w: number, h: number, count = 3000) {
    this.count = count;
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    this.camera.position.z = 80;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.basePositions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Galaxy spiral
      const arm = i % 3;
      const t = (i / count) * Math.PI * 6 + arm * (Math.PI * 2 / 3);
      const r = 5 + (i / count) * 60;
      const x = Math.cos(t) * r + (Math.random() - 0.5) * 8;
      const y = (Math.random() - 0.5) * 12;
      const z = Math.sin(t) * r + (Math.random() - 0.5) * 8;
      this.positions[i * 3] = this.basePositions[i * 3] = x;
      this.positions[i * 3 + 1] = this.basePositions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = this.basePositions[i * 3 + 2] = z;
      this.colors[i * 3] = 0.6 + Math.random() * 0.4;
      this.colors[i * 3 + 1] = 0.6 + Math.random() * 0.4;
      this.colors[i * 3 + 2] = 1;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.scene.add(this.points);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  render(e: InstrumentEnergy, smoothed: InstrumentEnergy, dt: number) {
    const pos = this.positions, base = this.basePositions, vel = this.velocities, col = this.colors;
    // Vocals → rotation
    this.rotation += dt * (0.05 + smoothed.vocals * 0.6);
    this.points.rotation.y = this.rotation;

    // Bass impulse
    const bassKick = e.bass > 0.55 ? e.bass : 0;
    // Guitar streak factor
    const guitarStreak = smoothed.guitar;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      // Spring back to base
      const dx = pos[i3] - base[i3], dy = pos[i3 + 1] - base[i3 + 1], dz = pos[i3 + 2] - base[i3 + 2];
      vel[i3] += -dx * 4 * dt - vel[i3] * 2 * dt;
      vel[i3 + 1] += -dy * 4 * dt - vel[i3 + 1] * 2 * dt;
      vel[i3 + 2] += -dz * 4 * dt - vel[i3 + 2] * 2 * dt;
      // Bass: outward push
      if (bassKick > 0) {
        const len = Math.hypot(base[i3], base[i3 + 1], base[i3 + 2]) || 1;
        vel[i3] += (base[i3] / len) * bassKick * 30 * dt;
        vel[i3 + 1] += (base[i3 + 1] / len) * bassKick * 30 * dt;
        vel[i3 + 2] += (base[i3 + 2] / len) * bassKick * 30 * dt;
      }
      // Guitar: tangential streak
      if (guitarStreak > 0.3 && (i % 5) === 0) {
        vel[i3] += -base[i3 + 2] * guitarStreak * 0.5 * dt;
        vel[i3 + 2] += base[i3] * guitarStreak * 0.5 * dt;
      }
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;

      // Drums strobe white briefly; keys aurora hue
      if (e.drums > 0.55) {
        col[i3] = col[i3 + 1] = col[i3 + 2] = 1;
      } else {
        const k = smoothed.keys;
        col[i3] = 0.5 + 0.5 * Math.sin(this.rotation * 2 + i * 0.01) * (1 - k) + k * 0.0;
        col[i3 + 1] = 0.6 + k * 0.4;
        col[i3 + 2] = 0.7 + 0.3 * Math.cos(this.rotation + i * 0.01);
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
