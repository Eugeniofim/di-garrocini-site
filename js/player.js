// Player do disco: toca, pausa, pula, busca, baixa. Fala com a cena e com o livro por eventos.
export const bus = new EventTarget();
const fmt = (s) => { s = Math.max(0, s | 0); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };
const $ = (s, r = document) => r.querySelector(s);

export function iniciarPlayer(dados) {
  const faixas = dados.faixas;
  const audio = new Audio(); audio.preload = 'metadata';
  const estado = { i: -1, tocando: false, nivel: 0 };
  let ctx, analisador, buf;

  const lista = $('#faixas'), btnPlay = $('#tocar'), btnProx = $('#proxima'), btnAnt = $('#anterior');
  const barra = $('#barra'), pico = $('#picos'), tAtual = $('#t-atual'), tTotal = $('#t-total');
  const nome = $('#tocando-nome'), letraViva = $('#letra-viva'), baixar = $('#baixar');
  const pill = $('#pill'), pillNome = $('#pill-nome');

  // lista de faixas
  faixas.forEach((f, i) => {
    const li = document.createElement('li');
    li.className = 'faixa' + (f.lacrada ? ' lacrada' : '');
    const num = String(i + 1).padStart(2, '0');
    if (f.lacrada) {
      li.innerHTML = `<span class="f-num">${num}</span><span class="f-nome"><i class="selo" aria-hidden="true"></i><span>Faixa lacrada</span><small>ainda não foi revelada</small></span><span class="f-dur">––:––</span>`;
      li.setAttribute('aria-disabled', 'true');
    } else {
      li.innerHTML = `<button class="f-btn" data-i="${i}" aria-label="Tocar ${f.titulo}"><span class="f-num">${num}</span><span class="f-nome"><span>${f.titulo}</span><small>${f.tom || ''}</small></span><span class="f-dur">${fmt(f.duracao)}</span><span class="f-eq" aria-hidden="true"><b></b><b></b><b></b></span></button>
      <a class="f-baixar" href="${f.arquivo}" download="Di Garrocini - ${f.titulo}.mp3" aria-label="Baixar ${f.titulo} em MP3" title="Baixar MP3"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg></a>`;
    }
    lista.appendChild(li);
  });
  lista.addEventListener('click', (e) => { const b = e.target.closest('.f-btn'); if (b) escolher(+b.dataset.i, true); });

  // forma de onda
  function desenharPicos(f) {
    pico.innerHTML = '';
    const p = f?.picos || Array.from({ length: 120 }, (_, k) => 0.2 + 0.15 * Math.sin(k * 0.4));
    p.forEach((v) => { const b = document.createElement('i'); b.style.setProperty('--h', Math.max(0.06, v)); pico.appendChild(b); });
    barras = [...pico.children]; ultN = -1;
  }
  let barras = [], ultN = -1;
  function pintarBarras(p) {
    const n = Math.floor(p * barras.length);
    if (n === ultN) return;
    barras.forEach((b, k) => b.classList.toggle('on', k < n)); ultN = n;
  }

  function montarAnalisador() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(audio);
      analisador = ctx.createAnalyser(); analisador.fftSize = 512; analisador.smoothingTimeConstant = 0.82;
      src.connect(analisador); analisador.connect(ctx.destination); buf = new Uint8Array(analisador.frequencyBinCount);
    } catch (e) { ctx = null; }
  }

  function escolher(i, tocar) {
    const f = faixas[i]; if (!f || f.lacrada) return;
    if (estado.i !== i) {
      estado.i = i; audio.src = f.arquivo; audio.load();
      nome.textContent = f.titulo; tTotal.textContent = fmt(f.duracao);
      baixar.href = f.arquivo; baixar.setAttribute('download', `Di Garrocini - ${f.titulo}.mp3`); baixar.hidden = false;
      desenharPicos(f); pillNome.textContent = f.titulo;
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: f.titulo, artist: dados.artista, album: dados.disco, artwork: [{ src: 'img/retrato-flores.jpg', sizes: '1600x1200', type: 'image/jpeg' }] });
      bus.dispatchEvent(new CustomEvent('faixa', { detail: i }));
    }
    document.querySelectorAll('.faixa').forEach((li, k) => li.classList.toggle('atual', k === i));
    if (tocar) tocarAgora();
  }
  function tocarAgora() { montarAnalisador(); ctx?.resume(); audio.play().catch(() => {}); }
  function alternar() {
    if (estado.i < 0) { const p = faixas.findIndex((f) => !f.lacrada); if (p >= 0) escolher(p, true); return; }
    audio.paused ? tocarAgora() : audio.pause();
  }
  const reveladas = () => faixas.map((f, i) => (f.lacrada ? -1 : i)).filter((i) => i >= 0);
  function vizinha(d) { const r = reveladas(); const k = r.indexOf(estado.i); escolher(r[(k + d + r.length) % r.length], true); }

  btnPlay.addEventListener('click', alternar);
  btnProx.addEventListener('click', () => vizinha(1));
  btnAnt.addEventListener('click', () => { if (audio.currentTime > 3) audio.currentTime = 0; else vizinha(-1); });
  audio.addEventListener('play', () => sync(true));
  audio.addEventListener('pause', () => sync(false));
  audio.addEventListener('ended', () => { if (reveladas().length > 1) vizinha(1); else sync(false); });
  function sync(t) {
    estado.tocando = t;
    document.body.classList.toggle('tocando', t);
    btnPlay.setAttribute('aria-label', t ? 'Pausar' : 'Tocar'); btnPlay.setAttribute('aria-pressed', String(t));
    pill.hidden = estado.i < 0;
    bus.dispatchEvent(new CustomEvent('estado', { detail: t }));
  }

  // busca (clique e arrasto na forma de onda)
  let arrastando = false;
  const irPara = (ev) => { if (estado.i < 0) return; const r = barra.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); audio.currentTime = p * (audio.duration || faixas[estado.i].duracao); };
  barra.addEventListener('pointerdown', (e) => { arrastando = true; barra.setPointerCapture(e.pointerId); irPara(e); });
  barra.addEventListener('pointermove', (e) => arrastando && irPara(e));
  barra.addEventListener('pointerup', () => (arrastando = false));
  barra.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') audio.currentTime += 5; if (e.key === 'ArrowLeft') audio.currentTime -= 5; });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON|A|SELECT/.test(document.activeElement?.tagName || '') && document.body.classList.contains('no-player')) { e.preventDefault(); alternar(); } });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', alternar); navigator.mediaSession.setActionHandler('pause', alternar);
    navigator.mediaSession.setActionHandler('nexttrack', () => vizinha(1)); navigator.mediaSession.setActionHandler('previoustrack', () => vizinha(-1));
  }
  pill.addEventListener('click', () => document.getElementById('disco').scrollIntoView({ behavior: 'smooth' }));

  // letra ao vivo
  let linhaAtual = null;
  function letraEm(t) {
    const f = faixas[estado.i]; if (!f?.secoes) return null;
    for (const s of f.secoes) for (const l of s.linhas || []) if (t >= l.t - 0.2 && t < l.e) return l;
    return null;
  }

  function tick() {
    const f = faixas[estado.i];
    if (f) {
      const d = audio.duration || f.duracao, t = audio.currentTime, p = d ? t / d : 0;
      barra.style.setProperty('--p', p); barra.setAttribute('aria-valuenow', Math.round(p * 100));
      tAtual.textContent = fmt(t); pintarBarras(p);
      const l = letraEm(t);
      if (l !== linhaAtual) {
        linhaAtual = l;
        letraViva.classList.remove('entra'); void letraViva.offsetWidth;
        letraViva.textContent = l ? l.palavras.map((w) => w.p).join(' ') : (t < 16 ? '· · ·' : '· · ·');
        letraViva.classList.add('entra');
        bus.dispatchEvent(new CustomEvent('linha', { detail: { faixa: estado.i, t: l ? l.t : null } }));
      }
      estado.progresso = p;
    }
    if (analisador && estado.tocando) {
      analisador.getByteFrequencyData(buf);
      let s = 0; for (let k = 1; k < 18; k++) s += buf[k]; estado.nivel = Math.min(1, (s / 17 / 255) * 1.35);
    } else estado.nivel = estado.nivel * 0.9;
  }

  desenharPicos(null);
  return {
    estado, tick, escolher, audio, alternar,
    irPara: (i, t) => { escolher(i, false); const go = () => { audio.currentTime = t; tocarAgora(); }; audio.readyState >= 1 ? go() : audio.addEventListener('loadedmetadata', go, { once: true }); },
  };
}
