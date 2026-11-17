import Lenis from '../vendor/lenis/lenis.mjs';
import * as THREE from 'three';
import { criarCena } from './scene.js';
import { iniciarPlayer, bus } from './player.js';
import { iniciarLivro } from './book.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (x) => x * x * (3 - 2 * x);
const seg = (x, a, b) => clamp((x - a) / (b - a));
const sino = (x) => Math.sin(Math.PI * clamp(x));
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
const estreito = innerWidth < 820;
const toque = matchMedia('(hover: none)').matches;

// ---------- player e livro ----------
const player = iniciarPlayer(window.DISCO);
const livro = iniciarLivro(window.DISCO, player);
document.body.classList.add('no-player');

// ---------- rolagem suave ----------
let lenis = null;
if (!reduzir) { lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true }); }
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href'); if (id.length < 2) return; const alvo = document.querySelector(id); if (!alvo) return;
  e.preventDefault(); lenis ? lenis.scrollTo(alvo, { duration: 1.6 }) : alvo.scrollIntoView();
}));

// ---------- carga: retratos, fontes ----------
const fotosUrl = ['img/retrato-galhos.jpg', 'img/retrato-flores.jpg', 'img/retrato-flor-boca.jpg'];
const gerente = new THREE.LoadingManager();
const barraCarga = $('#carga-b');
gerente.onProgress = (_, a, b) => (barraCarga.style.width = (a / b) * 100 + '%');
const loader = new THREE.TextureLoader(gerente);
const fotos = await Promise.all(fotosUrl.map((u) => new Promise((ok, no) => loader.load(u, ok, undefined, no)))).catch(() => []);
await (document.fonts?.ready || Promise.resolve());

const canvas = $('#gl');
let cena = null;
try { cena = criarCena(canvas, { fotos, estreito, reduzir }); }
catch (e) { console.warn('WebGL indisponível', e); document.body.classList.add('sem-webgl'); }

// ---------- medidas das seções ----------
const sec = { ab: $('#abertura'), ro: $('#roda'), di: $('#disco'), ci: $('#cifras') };
const M = {};
function medir() {
  const y = scrollY;
  M.vh = innerHeight;
  M.abTop = sec.ab.getBoundingClientRect().top + y; M.abH = sec.ab.offsetHeight;
  M.roTop = sec.ro.getBoundingClientRect().top + y; M.roH = sec.ro.offsetHeight;
  M.ciTop = sec.ci.getBoundingClientRect().top + y;
}
medir(); addEventListener('resize', medir); addEventListener('load', medir);
new ResizeObserver(medir).observe(document.body);

// ---------- abertura: texto ----------
const el = {
  tit: $('.a-titulo'), frase: $('#frase1'), cue: $('#cue'),
  p: [$('.pal.p1'), $('.pal.p2'), $('.pal.p3')],
};
const flash = document.createElement('div'); flash.className = 'flash'; $('.abertura .fixo').appendChild(flash);
// letras do título
$('.a-h1').querySelectorAll('span').forEach((s) => { s.innerHTML = [...s.textContent].map((c, i) => `<i style="--d:${i}">${c === ' ' ? '&nbsp;' : c}</i>`).join(''); });

function textoAbertura(p) {
  const sai = sm(seg(p, 0.02, 0.17));
  el.tit.style.opacity = 1 - sai;
  el.tit.style.transform = `translate3d(0,${-sai * 70}px,0) scale(${1 + sai * 0.1})`;
  el.tit.style.filter = sai > 0.01 ? `blur(${sai * 14}px)` : '';
  el.cue.style.opacity = 1 - seg(p, 0.01, 0.06);
  const f = sm(seg(p, 0.23, 0.3)) * (1 - sm(seg(p, 0.4, 0.47)));
  el.frase.style.opacity = f; el.frase.style.transform = `translate3d(0,${(1 - f) * 30}px,0)`; el.frase.style.letterSpacing = `${0.02 + (1 - f) * 0.1}em`;
  flash.style.opacity = sino(seg(p, 0.5, 0.62)) * 0.85;
  const janelas = [[0.6, 0.78], [0.69, 0.87], [0.79, 0.98]];
  const pos = [[-14, -4], [12, 8], [-3, -2]];
  el.p.forEach((n, i) => {
    const t = seg(p, janelas[i][0], janelas[i][1]);
    const z = lerp(-2600, 650, t), op = Math.pow(sino(t), 0.55);
    n.style.opacity = op; n.style.transform = `translate3d(${pos[i][0]}vw,${pos[i][1]}vh,${z}px)`;
    n.style.filter = t > 0.78 ? `blur(${(t - 0.78) * 40}px)` : '';
    n.style.visibility = t > 0 && t < 1 ? 'visible' : 'hidden';
  });
}

// ---------- roda ----------
const video = $('#roda-cv'), roDisco = $('.roda-disco'), aro = $('.aro'), sulcos = $('.sulcos');
const rt = [$('.rt1'), $('.rt2'), $('.rt3')];
let tVid = 0, durVid = 0;
const prontoVid = () => { durVid = video.duration || 0; if (durVid) $('#roda-carga').classList.add('ok'); };
video.addEventListener('loadedmetadata', prontoVid); video.addEventListener('canplay', prontoVid);
if (video.readyState >= 1) prontoVid();
let ultSeek = -1;
function rodaFrame(p, dt) {
  const s = lerp(0.46, 1, sm(seg(p, 0, 0.2)));
  tVid = damp(tVid, p, 7, dt);
  const rx = Math.sin(p * 6.28) * 7, ry = Math.cos(p * 5.1) * 9;
  roDisco.style.transform = `scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)`;
  aro.style.transform = `translate(-50%,-50%) scale(${s}) rotate(${p * 420}deg)`;
  sulcos.style.transform = `translate(-50%,-50%) rotate(${p * 120}deg)`;
  sulcos.style.opacity = 0.4 + sm(seg(p, 0, 0.2)) * 0.6;
  if (durVid) {
    const t = clamp(tVid * 0.999) * durVid;
    if (Math.abs(t - ultSeek) > 0.02) { video.currentTime = t; ultSeek = t; }
  }
  const wins = [[0.1, 0.34], [0.4, 0.64], [0.7, 0.94]];
  rt.forEach((n, i) => { const t = seg(p, wins[i][0], wins[i][1]); const o = sm(seg(t, 0, 0.2)) * (1 - sm(seg(t, 0.8, 1))); n.style.opacity = o; n.style.transform = `translate3d(0,${(1 - o) * 26}px,0)`; });
}

// ---------- cursor ----------
const cur = $('.cursor');
let cx = innerWidth / 2, cy = innerHeight / 2, mx = cx, my = cy, nx = 0, ny = 0;
if (!toque) {
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; nx = (e.clientX / innerWidth - 0.5) * 2; ny = (e.clientY / innerHeight - 0.5) * 2; cur.classList.add('on'); });
  document.addEventListener('pointerover', (e) => cur.classList.toggle('grande', !!e.target.closest('a,button,.lin,.barra,.faixa,.leaf')));
}

// ---------- cartões que inclinam ----------
document.querySelectorAll('.tilt').forEach((c) => {
  c.addEventListener('pointermove', (e) => {
    if (toque) return; const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.setProperty('--rx', `${-y * 10}deg`); c.style.setProperty('--ry', `${x * 12}deg`);
  });
  c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
});
const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('in', e.isIntersecting)), { threshold: 0.18 });
document.querySelectorAll('.tilt, .sobre, .painel, .cifras-topo, .livro-cena').forEach((n) => io.observe(n));

// ---------- vídeo da banda: só carrega do YouTube se a pessoa clicar ----------
$('#video-bt').addEventListener('click', () => {
  $('#video').innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/NPCf22SojLU?autoplay=1&rel=0" title="Tarja Verde no YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  if (!player.audio.paused) player.audio.pause();
});

// ---------- laço principal ----------
let ultY = 0, ultT = performance.now(), velS = 0;
const tick = (tempoMs) => {
  lenis?.raf(tempoMs);
  const agora = performance.now(), dt = Math.min(0.05, (agora - ultT) / 1000); ultT = agora;
  const y = lenis ? lenis.scroll : scrollY, vh = M.vh;
  velS = damp(velS, (y - ultY) / Math.max(dt, 0.001), 8, dt); ultY = y;
  player.tick();

  const pA = clamp((y - M.abTop) / (M.abH - vh)), pR = clamp((y - M.roTop) / (M.roH - vh));
  const k = sm(seg(y, M.roTop + vh * 0.1, M.roTop + vh * 0.5));
  const dim = sm(seg(y, M.ciTop - vh * 0.9, M.ciTop - vh * 0.1));
  textoAbertura(pA);
  if (y > M.roTop - vh && y < M.roTop + M.roH) rodaFrame(pR, dt);

  cx = damp(cx, mx, 14, dt); cy = damp(cy, my, 14, dt);
  cur.style.transform = `translate3d(${cx}px,${cy}px,0)`;

  const encoberto = y >= M.roTop + 4 && y <= M.roTop + M.roH - vh - 4;     // a roda cobre a cena inteira
  canvas.style.opacity = 1 - dim * 0.88;
  if (cena && !encoberto && !document.hidden) {
    const pe = player.estado;
    cena.frame(dt, { pA, k, dim, vel: velS, mx: nx, my: -ny, audio: pe.nivel, tocando: pe.tocando, faixa: pe.i, progresso: pe.progresso || 0 });
  }
};
requestAnimationFrame(function loop(t) { tick(t); requestAnimationFrame(loop); });

// ---------- entrada ----------
setTimeout(() => {
  document.body.classList.remove('carregando'); document.body.classList.add('pronto');
  setTimeout(() => $('#carga')?.remove(), 1400);
  setTimeout(() => { el.cue.style.transition = 'none'; }, 4200);
}, 900);

window.__disco = { player, livro, cena };
