// Cena 3D fixa atrás do site: disco, pedra, braço da agulha, retratos no túnel, pegadas e vagalumes.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (x) => x * x * (3 - 2 * x);
const seg = (x, a, b) => clamp((x - a) / (b - a));
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
function kf(p, keys, vals) {
  if (p <= keys[0]) return vals[0];
  const n = keys.length - 1;
  if (p >= keys[n]) return vals[n];
  for (let i = 0; i < n; i++) if (p <= keys[i + 1]) return lerp(vals[i], vals[i + 1], sm(seg(p, keys[i], keys[i + 1])));
  return vals[n];
}

const NOISE = /* glsl */ `
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return s; }
`;
const FIM = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

// ---------- discos e pedras ----------
const VINIL_FRAG = /* glsl */ `
uniform float uTime, uRot, uOpacity, uAudio, uTrackF, uPlaying;
varying vec2 vP;
const float R = 1.6;
${NOISE}
void main(){
  float r = length(vP)/R;
  if(r>1.0) discard;
  float a = atan(vP.y, vP.x);
  float w = vn(vec2(a*1.5, 3.0))*0.012 + vn(vec2(a*4.0+7.0, r*8.0))*0.006;   // anéis de árvore: levemente tortos
  float rr = r + w;
  float bandPos = (0.96 - rr)/0.145;
  float bi = floor(bandPos);
  float bf = fract(bandPos);
  float inB = step(0.0,bandPos)*step(bandPos,4.0);
  float gap = smoothstep(0.0,0.05,bf)*smoothstep(0.0,0.05,1.0-bf);
  float g1 = 0.5+0.5*sin(rr*900.0 + vn(vec2(rr*40.0,a))*3.0);
  float g2 = 0.5+0.5*sin(rr*2300.0);
  float tex = mix(g1,g2,0.4);
  vec3 base = vec3(0.010,0.012,0.011) + 0.012*tex;
  vec3 t0=vec3(.84,.12,.56), t1=vec3(1.,.62,.24), t2=vec3(.77,.89,.64), t3=vec3(.55,.12,.25);
  vec3 tint = bi<0.5?t0:(bi<1.5?t1:(bi<2.5?t2:t3));
  float shine = mix(0.95, 0.35+0.65*tex, gap);
  float ang = a + uRot;
  float l1 = pow(max(0.0, cos(2.0*(ang-0.75))), 18.0);
  float l2 = pow(max(0.0, cos(2.0*(ang-2.35))), 40.0)*0.8;
  vec3 spec = 0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + rr*2.2 + ang*0.15 + uTime*0.02));
  spec = mix(spec, tint, 0.55);
  float radial = smoothstep(0.34,0.5,rr)*(1.0-smoothstep(0.93,0.99,rr));
  vec3 col = base;
  col += spec*(l1+l2)*shine*1.15*radial*(0.35+0.65*tex);
  col += tint*0.03*inB*(0.4+0.6*tex);
  float act = inB*(1.0-step(0.5,abs(bi-uTrackF)));
  col += tint*act*(0.16+0.45*uAudio)*(0.3+0.7*tex)*uPlaying*(0.75+0.25*sin(uTime*2.0));
  col += vec3(0.05,0.03,0.07)*pow(max(0.0,cos(ang-0.75)),3.0)*radial;
  float rim = smoothstep(0.965,0.985,r)*(1.0-smoothstep(0.995,1.0,r));
  col += vec3(0.25,0.2,0.3)*rim*0.35;
  gl_FragColor = vec4(col, uOpacity);
  ${FIM}
}`;
const PEDRA_FRAG = /* glsl */ `
uniform float uTime, uGlow, uAudio, uOpacity;
uniform sampler2D uTex;
varying vec2 vUv;
varying vec2 vP;
const float RL = 0.56;
${NOISE}
void main(){
  vec2 p = vP/RL;
  float r = length(p);
  if(r>1.0) discard;
  float n1 = fbm(p*2.2 + uTime*0.02);
  float n2 = fbm(p*5.0 - 3.0 + n1*1.5);
  vec3 deep = vec3(0.045,0.012,0.075);
  vec3 vio  = vec3(0.30,0.07,0.45);
  vec3 col = mix(deep, vio, smoothstep(0.35,0.85,n1)*0.7);
  float vein = smoothstep(0.035,0.0,abs(n2-0.5));
  col += vec3(1.0,0.25,0.65)*vein*(0.7+uGlow*1.3);
  float vein2 = smoothstep(0.02,0.0,abs(fbm(p*9.0+11.0)-0.5));
  col += vec3(1.0,0.62,0.25)*vein2*0.3*uGlow;
  float core = exp(-r*r*7.0);
  col += vec3(0.9,0.2,0.8)*core*(0.2+uGlow*0.9+uAudio*0.9);
  vec2 hp = p - vec2(-0.35,0.4);
  col += vec3(0.95,0.9,1.0)*exp(-dot(hp,hp)*18.0)*0.35;
  vec4 tx = texture2D(uTex, vUv);
  col = mix(col, tx.rgb*1.5, tx.a*0.9);
  col *= 1.0 - smoothstep(0.93,1.0,r)*0.6;
  col = mix(col, vec3(0.0), 1.0-smoothstep(0.04,0.05,r));
  gl_FragColor = vec4(col, uOpacity);
  ${FIM}
}`;
const LOCAL_VERT = /* glsl */ `
varying vec2 vP; varying vec2 vUv;
void main(){ vP = position.xy; vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

// ---------- retratos no túnel ----------
const RETRATO_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const RETRATO_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uTime,uShow,uCamZ,uVel,uSeed;
varying vec2 vUv; varying vec3 vW;
${NOISE}
void main(){
  vec2 uv=vUv, c=uv-0.5;
  float edge = max(abs(c.x), abs(c.y)*1.33);
  float n = vn(uv*7.0+uSeed)*0.5 + vn(uv*19.0-uSeed)*0.25;
  float mask = 1.0-smoothstep(0.40,0.50, edge + (n-0.37)*0.13);
  float off = (0.004+abs(uVel)*0.014)*(0.5+edge*2.0);
  vec2 d = vec2(off,0.0)*sign(c.x+0.0001);
  vec3 col = vec3(texture2D(uMap,uv+d).r, texture2D(uMap,uv).g, texture2D(uMap,uv-d).b);
  float lum = dot(col,vec3(.299,.587,.114));
  col = max(mix(vec3(lum), col, 1.12), vec3(0.0));
  col = pow(col, vec3(1.1)) * vec3(1.0,0.93,1.06);
  float depth = uCamZ - vW.z;
  float fog = 1.0-exp(-max(depth,0.0)*0.15);
  col = mix(col, vec3(0.03,0.06,0.045), fog*0.85);
  float near = smoothstep(0.2,1.6,depth);
  float alpha = mask*uShow*near*(1.0-fog*0.5);
  col += vec3(0.9,0.25,0.7)*0.05*(0.5+0.5*sin(uTime*0.8+vUv.y*6.0));
  gl_FragColor = vec4(col,alpha);
  ${FIM}
}`;

// ---------- pegadas ----------
const PEGADA_VERT = /* glsl */ `
attribute float aSide; varying vec2 vUv; varying vec3 vW; varying float vK;
void main(){ vUv=uv; if(aSide>0.5) vUv.x=1.0-vUv.x; vK=aSide;
  vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const PEGADA_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uCamZ,uShow,uTime;
varying vec2 vUv; varying vec3 vW; varying float vK;
void main(){
  float a = texture2D(uMap,vUv).a;
  float ahead = uCamZ - vW.z;
  float glow = (1.0-smoothstep(2.5,9.0,ahead))*smoothstep(-1.2,0.4,ahead);
  vec3 c = mix(vec3(0.9,0.12,0.6), vec3(1.0,0.62,0.22), (1.0-smoothstep(-16.0,0.0,vW.z)));
  float pulse = 0.85+0.15*sin(uTime*2.0+vW.z);
  gl_FragColor = vec4(c*glow*pulse*2.2, a*glow*uShow);
  ${FIM}
}`;

// ---------- vagalumes ----------
const VAG_VERT = /* glsl */ `
attribute float aSeed; uniform float uTime,uPx,uShow,uAudio; varying vec3 vC; varying float vA;
void main(){
  vec3 p=position;
  p.x += sin(uTime*0.18*(0.4+aSeed)+aSeed*50.0)*0.6;
  p.y = -3.2 + mod(position.y+3.2 + uTime*(0.04+aSeed*0.07), 7.6);
  p.z += cos(uTime*0.12*(0.4+aSeed)+aSeed*30.0)*0.5;
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  gl_Position = projectionMatrix*mv;
  float tw = 0.5+0.5*sin(uTime*(1.0+aSeed*3.0)+aSeed*40.0);
  gl_PointSize = clamp(uPx*(1.5+aSeed*5.0)*(1.0/max(0.4,-mv.z))*(0.6+0.4*tw)*3.4, 1.0, 30.0);
  vC = color; vA = (0.25+0.75*tw)*uShow*(0.7+uAudio*0.5);
}`;
const VAG_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main(){ float d=length(gl_PointCoord-0.5); float a=1.0-smoothstep(0.0,0.5,d); gl_FragColor=vec4(vC*vA*1.6, a*vA);
  ${FIM}
}`;

const GLOW_FRAG = /* glsl */ `
uniform float uS; varying vec2 vUv;
void main(){ vec2 c=vUv-0.5; float d=length(c*vec2(1.0,1.25));
  float g=exp(-d*d*14.0); vec3 col=mix(vec3(0.55,0.04,0.42), vec3(1.0,0.5,0.22), (1.0-smoothstep(0.0,0.2,d))*0.7);
  gl_FragColor=vec4(col*g*uS, g*uS*0.9);
  ${FIM}
}`;

// ---------- texturas desenhadas ----------
function desenharPe(ctx, x, y, s, rot, cor) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = cor;
  ctx.beginPath(); ctx.ellipse(0, 18 * s, 15 * s, 24 * s, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-2 * s, -12 * s, 13 * s, 12 * s, 0, 0, 7); ctx.fill();
  [[-17, -33, 5.5], [-8, -42, 5], [2, -44, 4.6], [11, -40, 4.2], [18, -31, 3.8]].forEach(([dx, dy, rr]) => {
    ctx.beginPath(); ctx.arc(dx * s, dy * s, rr * s, 0, 7); ctx.fill();
  });
  ctx.restore();
}
function texturaRotulo() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, S, S); ctx.translate(S / 2, S / 2);
  const texto = 'DI GARROCINI  ·  PEGADAS NA TRILHA  ·  EP 2026  ·  ';
  ctx.font = '600 38px "IBM Plex Mono", ui-monospace, monospace'; ctx.fillStyle = '#EEE6D2';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const raio = 430, passo = (Math.PI * 2) / texto.length;
  for (let i = 0; i < texto.length; i++) {
    ctx.save(); ctx.rotate(i * passo - Math.PI / 2); ctx.translate(0, -raio); ctx.fillText(texto[i], 0, 0); ctx.restore();
  }
  for (let i = 0; i < 7; i++) {          // trilha de pegadas em volta do furo
    const ang = i * 0.88 + 0.3, rr = 275 + Math.sin(i * 1.7) * 18;
    desenharPe(ctx, Math.cos(ang) * rr, Math.sin(ang) * rr, 0.62, ang + Math.PI / 2 + (i % 2 ? 0.2 : -0.2), 'rgba(196,227,162,0.92)');
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function texturaPegada() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const ctx = c.getContext('2d'); desenharPe(ctx, 64, 150, 2.1, 0, '#fff');
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

export function criarCena(canvas, { fotos, estreito, reduzir }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !estreito, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, estreito ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x050b08, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050b08, 0.035);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 80);

  // reflexos coloridos para o latão
  const pm = new THREE.PMREMGenerator(renderer);
  const envS = new THREE.Scene();
  envS.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0a1410, side: THREE.BackSide })));
  [[0xd61f8e, [4, 3, 3]], [0xff9f3c, [-4, 2, 2]], [0xc4e3a2, [0, -3, 5]], [0x6a2bb0, [0, 5, -4]]].forEach(([cor, p]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(2.4), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); envS.add(m);
  });
  scene.environment = pm.fromScene(envS, 0.03).texture;
  scene.environmentIntensity = 0.55;

  // ---- disco ----
  const disco = new THREE.Group(); scene.add(disco);
  const uVinil = { uTime: { value: 0 }, uRot: { value: 0 }, uOpacity: { value: 1 }, uAudio: { value: 0 }, uTrackF: { value: -1 }, uPlaying: { value: 0 } };
  const vinil = new THREE.Mesh(new THREE.CircleGeometry(1.6, 128), new THREE.ShaderMaterial({ uniforms: uVinil, vertexShader: LOCAL_VERT, fragmentShader: VINIL_FRAG, transparent: true }));
  vinil.position.z = 0.0185; disco.add(vinil);
  const lado = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.037, 96, 1, true).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3, metalness: 0.7, transparent: true }));
  disco.add(lado);
  const verso = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64).rotateY(Math.PI), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.35, metalness: 0.6, transparent: true }));
  verso.position.z = -0.0185; disco.add(verso);
  const uPedra = { uTime: { value: 0 }, uGlow: { value: 0.4 }, uAudio: { value: 0 }, uOpacity: { value: 1 }, uTex: { value: texturaRotulo() } };
  const pedra = new THREE.Mesh(new THREE.CircleGeometry(0.56, 96), new THREE.ShaderMaterial({ uniforms: uPedra, vertexShader: LOCAL_VERT, fragmentShader: PEDRA_FRAG, transparent: true }));
  pedra.position.z = 0.0205; disco.add(pedra);
  document.fonts?.ready.then(() => { uPedra.uTex.value.dispose(); uPedra.uTex.value = texturaRotulo(); });

  // ---- braço da agulha ----
  const latao = new THREE.MeshStandardMaterial({ color: 0xc9b07a, metalness: 0.95, roughness: 0.28 });
  const braco = new THREE.Group(); braco.position.set(1.95, 1.35, 0.16); disco.add(braco);
  const L = 2.05;
  braco.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 40).rotateX(Math.PI / 2), latao));
  const eixo = new THREE.Group(); braco.add(eixo);
  eixo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L, 20).rotateZ(Math.PI / 2).translate(L / 2, 0, 0.03), latao));
  eixo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 28).rotateZ(Math.PI / 2).translate(-0.34, 0, 0.03), latao));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, metalness: 0.5, roughness: 0.4 }));
  cab.position.set(L + 0.05, 0, 0.03); eixo.add(cab);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3aa8).multiplyScalar(3) }));
  led.position.set(L + 0.13, 0.05, 0.062); eixo.add(led);
  const agulha = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 8).rotateX(-Math.PI / 2), latao);
  agulha.position.set(L + 0.14, 0, -0.01); eixo.add(agulha);

  // ---- retratos ----
  const retratos = fotos.map((tex, i) => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const u = { uMap: { value: tex }, uTime: { value: 0 }, uShow: { value: 1 }, uCamZ: { value: 0 }, uVel: { value: 0 }, uSeed: { value: i * 7.3 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.1), new THREE.ShaderMaterial({ uniforms: u, vertexShader: RETRATO_VERT, fragmentShader: RETRATO_FRAG, transparent: true, depthWrite: false }));
    const lado = i % 2 ? -1 : 1;
    m.position.set(lado * 1.55, 0.05 + i * 0.05, -4.4 - i * 3.6); m.rotation.y = -lado * 0.3; m.renderOrder = 2 + i;
    scene.add(m); return { u, m };
  });

  // ---- pegadas no chão ----
  const NP = 30, pegU = { uMap: { value: texturaPegada() }, uCamZ: { value: 0 }, uShow: { value: 1 }, uTime: { value: 0 } };
  const pegG = new THREE.PlaneGeometry(0.3, 0.6);
  pegG.setAttribute('aSide', new THREE.InstancedBufferAttribute(new Float32Array(NP).map((_, i) => i % 2), 1));
  const pegadas = new THREE.InstancedMesh(pegG, new THREE.ShaderMaterial({ uniforms: pegU, vertexShader: PEGADA_VERT, fragmentShader: PEGADA_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), NP);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < NP; i++) {
    const side = i % 2 ? 1 : -1;
    dummy.position.set(side * 0.3 + Math.sin(i * 1.3) * 0.08, -1.25, -0.8 - i * 0.62);
    dummy.rotation.set(-Math.PI / 2, 0, side * 0.12 + Math.sin(i * 2.1) * 0.08);
    dummy.updateMatrix(); pegadas.setMatrixAt(i, dummy.matrix);
  }
  pegadas.frustumCulled = false; scene.add(pegadas);

  // ---- vagalumes ----
  const NV = estreito ? 260 : 520, pos = new Float32Array(NV * 3), cor = new Float32Array(NV * 3), sem = new Float32Array(NV);
  const paleta = [new THREE.Color(0xe0239f), new THREE.Color(0xffb04a), new THREE.Color(0xbfe3a0), new THREE.Color(0xe0239f)];
  for (let i = 0; i < NV; i++) {
    pos.set([(Math.random() - 0.5) * 12, -3.2 + Math.random() * 7.6, 5 - Math.random() * 24], i * 3);
    const c = paleta[(Math.random() * paleta.length) | 0]; cor.set([c.r, c.g, c.b], i * 3); sem[i] = Math.random();
  }
  const vg = new THREE.BufferGeometry();
  vg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); vg.setAttribute('color', new THREE.BufferAttribute(cor, 3)); vg.setAttribute('aSeed', new THREE.BufferAttribute(sem, 1));
  const vgU = { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() * 60 }, uShow: { value: 1 }, uAudio: { value: 0 } };
  const vagalumes = new THREE.Points(vg, new THREE.ShaderMaterial({ uniforms: vgU, vertexShader: VAG_VERT, fragmentShader: VAG_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true }));
  vagalumes.frustumCulled = false; scene.add(vagalumes);

  // ---- luz no fim da trilha ----
  const gU = { uS: { value: 0.2 } };
  const luz = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.ShaderMaterial({ uniforms: gU, vertexShader: RETRATO_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  luz.position.set(0, 0.3, -21); scene.add(luz);

  // ---- pós-processamento (só em tela grande) ----
  let composer = null, bloom = null;
  if (!estreito) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.55, 0.78);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let W = 0, H = 0;
  function redimensionar(forcar) {
    const w = innerWidth, h = innerHeight;
    if (!forcar && w === W && Math.abs(h - H) < 120) return;       // barra de endereço do celular não deve refazer a cena
    W = w; H = h; renderer.setSize(w, h, false); composer?.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  redimensionar(true);

  // pose do disco no player: depende da proporção da tela
  function poseP() {
    const asp = W / H, d = 5.2, halfH = Math.tan(THREE.MathUtils.degToRad(20)) * d, halfW = halfH * asp;
    if (asp < 0.95) { const s = clamp(halfW * 0.5, 0.36, 0.95); return { gx: 0, gy: halfH * 0.36, s }; }
    const s = clamp(halfW * 0.5 / 1.6 * 0.84, 0.5, 0.95);
    return { gx: -halfW * 0.47, gy: -0.05, s };
  }

  function poseA(p, mx, my) {
    const K = [0, 0.2, 0.46, 0.58, 1];
    return {
      cx: kf(p, K, [0, 0, 0, 0, 0]) + Math.sin(p * 9) * 0.22 * seg(p, 0.6, 1) + mx * 0.2,
      cy: kf(p, K, [1.0, 0.45, 0, 0, -0.1]) + my * 0.12,
      cz: kf(p, K, [5.6, 4.4, 1.55, -0.5, -14.2]),
      lz: 0, tunel: seg(p, 0.46, 0.62),
      gx: 0, gy: 0, s: W / H < 1 ? kf(p, K, [0.56, 0.62, 1, 1, 1]) : 1, rx: kf(p, K, [-1.1, -0.5, 0, 0, 0]) + my * 0.05, ry: mx * 0.12,
      op: kf(p, [0, 0.5, 0.6, 1], [1, 1, 0, 0]),
      pedra: kf(p, K, [0.35, 0.5, 1.2, 3.0, 0.2]),
      luz: 0.1 + seg(p, 0.7, 1) * 0.38,
    };
  }

  const st = { rot: 0, omega: 0.15, audio: 0, braco: 0, brR: 1.3, alt: 0, mx: 0, my: 0, tempo: 0, velS: 0 };
  const alvo = new THREE.Vector3();

  function frame(dt, e) {
    redimensionar(false);
    st.tempo += reduzir ? 0 : dt;
    st.mx = damp(st.mx, e.mx, 4, dt); st.my = damp(st.my, e.my, 4, dt);
    st.velS = damp(st.velS, e.vel, 6, dt);
    st.audio = damp(st.audio, e.audio, 10, dt);

    const A = poseA(e.pA, st.mx, st.my), P = poseP();
    const k = e.k;
    const pz = { cx: st.mx * 0.15, cy: st.my * 0.1, cz: 5.2, rx: -0.1 + st.my * 0.05, ry: 0.2 + st.mx * 0.12, op: 1, pedra: 0.7 };
    const cx = lerp(A.cx, pz.cx, k), cy = lerp(A.cy, pz.cy, k), cz = lerp(A.cz, pz.cz, k);
    camera.position.set(cx, cy, cz);
    // olha para o disco antes da pedra; olha para a frente dentro do túnel
    const lz = lerp(0, cz - 6, A.tunel * (1 - k));
    alvo.set(0, 0, lz); camera.lookAt(alvo);
    camera.rotateZ(Math.sin(e.pA * 7) * 0.025 * A.tunel * (1 - k));

    disco.position.set(lerp(A.gx, P.gx, k), lerp(A.gy, P.gy, k), 0);
    disco.scale.setScalar(lerp(A.s, P.s, k));
    disco.rotation.set(lerp(A.rx, pz.rx, k), lerp(A.ry, pz.ry, k), 0);
    const op = lerp(A.op, 1, k);
    disco.visible = op > 0.01;
    uVinil.uOpacity.value = op; uPedra.uOpacity.value = op;
    lado.material.opacity = op; verso.material.opacity = op;

    // giro do disco: inércia e rotação extra ao rolar a abertura
    const alvoW = e.tocando ? 2.4 : 0.16;
    st.omega = damp(st.omega, alvoW, e.tocando ? 1.6 : 0.9, dt);
    st.rot += st.omega * dt * (reduzir ? 0.25 : 1);
    const rotTotal = st.rot + e.pA * 5.0 * (1 - k);
    vinil.rotation.z = rotTotal; pedra.rotation.z = rotTotal; verso.rotation.z = -rotTotal;
    uVinil.uRot.value = rotTotal; uVinil.uTime.value = st.tempo; uPedra.uTime.value = st.tempo;
    uVinil.uAudio.value = st.audio; uPedra.uAudio.value = st.audio;
    uVinil.uTrackF.value = e.faixa; uVinil.uPlaying.value = damp(uVinil.uPlaying.value, e.tocando ? 1 : 0, 3, dt);
    uPedra.uGlow.value = lerp(A.pedra, pz.pedra, k) + (e.tocando ? 0.3 : 0);

    // agulha: sobe até a faixa; desce no sulco e anda para dentro conforme a música avança
    const d0 = Math.hypot(1.95, 1.35), ph0 = Math.atan2(-1.35, -1.95);
    const angPara = (r) => ph0 + Math.acos(clamp((d0 * d0 + L * L - r * r) / (2 * d0 * L), -1, 1));
    let rAlvo = 1.3; const repouso = angPara(1.3) + 0.5;
    if (e.faixa >= 0) {
      const ext = 0.96 - 0.145 * e.faixa - 0.012, inn = 0.96 - 0.145 * (e.faixa + 1) + 0.012;
      rAlvo = lerp(ext, inn, clamp(e.progresso)) * 1.6;
    }
    const ativa = e.faixa >= 0 && e.tocando ? 1 : 0;
    st.braco = damp(st.braco, ativa, 2.2, dt);
    st.brR = damp(st.brR, rAlvo, 6, dt);
    eixo.rotation.z = lerp(repouso, angPara(st.brR), sm(st.braco));
    braco.position.z = lerp(0.2, 0.052, sm(st.braco));
    led.visible = st.braco > 0.6;

    // retratos, pegadas, partículas
    const showT = 1 - k, showR = showT * sm(seg(e.pA, 0.38, 0.56));
    retratos.forEach(({ u }) => { u.uTime.value = st.tempo; u.uShow.value = showR; u.uCamZ.value = cz; u.uVel.value = clamp(st.velS * 0.0005, -0.45, 0.45); });
    pegU.uCamZ.value = cz; pegU.uShow.value = showT; pegU.uTime.value = st.tempo;
    vgU.uTime.value = st.tempo; vgU.uShow.value = lerp(1, 0.55, k) * (1 - e.dim * 0.5); vgU.uAudio.value = st.audio;
    gU.uS.value = lerp(A.luz, 0, k);
    if (bloom) bloom.strength = 0.5 + st.audio * 0.2 + A.tunel * 0.2;
    renderer.toneMappingExposure = 1.05;

    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  return { frame, redimensionar: () => redimensionar(true), renderer, camera, scene, disco };
}
