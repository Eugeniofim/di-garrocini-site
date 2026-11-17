// Songbook: letras e cifras para folhear. Páginas calculadas pela altura real do texto.
import { bus } from './player.js';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], FL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
function trans(c, n) {
  if (!n) return c;
  const m = c.match(/^([A-G][#b]?)(.*)$/); if (!m) return c;
  let i = SH.indexOf(m[1]); if (i < 0) i = FL.indexOf(m[1]);
  const j = (i + n + 120) % 12; return (n > 0 ? SH : FL)[j] + m[2];
}
const acordeHtml = (c, n) => `<b class="ac">${esc(trans(c, n))}</b>`;

export function iniciarLivro(dados, player) {
  const faixas = dados.faixas, palco = $('#livro'), ctl = $('#livro-ctl');
  const est = { cur: 0, tom: 0, cifras: true, seguir: false, visivel: false, estreito: false, faixaAtiva: -1 };
  let leaves = [], paginas = [], inicioFaixa = [];

  // ---------- conteúdo ----------
  function blocosDaFaixa(f, fi) {
    const out = [], vistas = new Set();
    f.secoes.forEach((s) => {
      if (s.instrumental) {
        out.push({ h: `<p class="inst"><span>${esc(s.nome)}</span>${s.acordes.map((c) => acordeHtml(c, est.tom)).join('<i> | </i>')}</p>` });
        return;
      }
      const jaVista = vistas.has(s.nome); vistas.add(s.nome);
      if (jaVista) { out.push({ h: `<p class="rep">↻ ${esc(s.nome)}${s.repete ? ` <small>${esc(s.repete)}</small>` : ''}</p>` }); return; }
      const cab = `<h4 class="sec">${esc(s.nome)}${s.repete && s.nome !== 'Refrão' ? '' : ''}</h4>`;
      s.linhas.forEach((l, k) => {
        const un = l.palavras.map((w) => `<span class="u${w.d ? ' duv' : ''}"><span class="c">${w.c ? acordeHtml(w.c, est.tom) : ''}</span><span class="w">${esc(w.p)}</span></span>`).join(' ');
        out.push({ h: `<p class="lin" data-f="${fi}" data-t="${l.t}" role="button" tabindex="0" title="Ouvir a partir daqui">${un}</p>`, cab: k === 0 ? cab : null, junto: k === 0 });
      });
    });
    return out;
  }

  function paginar(blocos, corpo) {
    const max = corpo.clientHeight, pgs = []; let atual = [];
    const cabeEm = (arr) => { corpo.innerHTML = arr.join(''); return corpo.scrollHeight <= max + 1; };
    const unidades = [];
    blocos.forEach((b) => { if (b.cab) unidades.push([b.cab, b.h]); else unidades.push([b.h]); });
    unidades.forEach((u) => {
      if (cabeEm([...atual, ...u])) atual.push(...u);
      else { if (atual.length) pgs.push(atual); atual = [...u]; }
    });
    if (atual.length) pgs.push(atual);
    corpo.innerHTML = '';
    return pgs.map((a) => a.join(''));
  }

  const pagina = (cls, html, num) => `<div class="pg ${cls}"><div class="corpo">${html}</div>${num ? `<span class="folha">${num}</span>` : ''}</div>`;
  const pauta = () => pagina('p-pauta', '<div class="pauta" aria-hidden="true"></div>');

  function montarPaginas() {
    // sonda para medir
    const sonda = document.createElement('div'); sonda.className = 'leaf sonda';
    sonda.innerHTML = pagina('p-letra', ''); palco.querySelector('.livro-in').appendChild(sonda);
    const corpo = sonda.querySelector('.corpo');
    paginas = []; inicioFaixa = [];
    const capa = `<div class="pg p-capa"><div class="capa-in"><span class="capa-art">Di Garrocini</span><h3>Pegadas<br>na Trilha</h3><span class="capa-sub">letras e cifras</span><i class="selo" aria-hidden="true"></i></div></div>`;
    paginas.push(capa);
    faixas.forEach((f, fi) => {
      if (paginas.length % 2 === 0) paginas.push(pauta());       // título sempre na página da esquerda
      const n = String(fi + 1).padStart(2, '0');
      inicioFaixa[fi] = paginas.length;
      if (f.lacrada) {
        paginas.push(pagina('p-lacrada', `<span class="faixa-n">Faixa ${n}</span><i class="selo grande" aria-hidden="true"></i><p>Lacrada.</p><small>Esta canção ainda não foi revelada.</small>`));
        paginas.push(pauta());
        return;
      }
      const tomTxt = f.tom ? f.tom.replace(/^(\S+)/, (m) => trans(m, est.tom)) : '';
      paginas.push(pagina('p-titulo', `<span class="faixa-n">Faixa ${n}</span><h3>${esc(f.titulo)}</h3>
        <dl><dt>Tom</dt><dd>${esc(tomTxt)}${est.tom ? ` <small>(original ${esc(f.tom)})</small>` : ''}</dd><dt>Duração</dt><dd>${(f.duracao / 60) | 0}:${String(Math.round(f.duracao % 60)).padStart(2, '0')}</dd></dl>
        <div class="acoes"><button class="bt b-ouvir" data-i="${fi}">Ouvir</button><a class="bt" href="${f.arquivo}" download="Di Garrocini - ${esc(f.titulo)}.mp3">Baixar MP3</a><button class="bt b-imprimir" data-i="${fi}">Imprimir cifra</button></div>
        ${f.revisao ? '<p class="nota">Letra transcrita da gravação e cifra sugerida pela análise do áudio. Em revisão com a artista.</p>' : ''}`));
      const pgs = paginar(blocosDaFaixa(f, fi), corpo);
      pgs.forEach((h, k) => paginas.push(pagina('p-letra', h, k + 1)));
    });
    if (paginas.length % 2 === 0) paginas.push(pauta());
    paginas.push(pagina('p-fim', `<span class="faixa-n">Fim</span><p class="fim-t">Obrigada por caminhar junto.</p><small>Di Garrocini · Pegadas na Trilha · 2026</small><button class="bt b-inicio">Voltar ao começo</button>`));
    if (paginas.length % 2 === 1) paginas.push(pauta());
    sonda.remove();
  }

  function montarLeaves() {
    const livro = palco.querySelector('.livro-in');
    livro.querySelectorAll('.leaf').forEach((n) => n.remove());
    leaves = [];
    const vazio = '<div class="pg p-verso"><i class="selo" aria-hidden="true"></i></div>';
    if (est.estreito) paginas.forEach((p, i) => leaves.push([p, vazio]));
    else for (let i = 0; i < paginas.length; i += 2) leaves.push([paginas[i], paginas[i + 1] || vazio]);
    leaves.forEach(([f, v], i) => {
      const el = document.createElement('div'); el.className = 'leaf';
      el.innerHTML = `<div class="face frente">${f}</div><div class="face verso">${v}</div>`;
      livro.appendChild(el);
    });
    leaves = [...livro.querySelectorAll('.leaf')];
    est.cur = Math.min(est.cur, leaves.length);
    aplicar(false);
  }

  // ---------- virar ----------
  let tmr;
  function aplicar(anim = true) {
    const L = leaves.length;
    palco.classList.toggle('sem-anim', !anim);
    leaves.forEach((el, i) => {
      const feita = i < est.cur;
      const mudou = el.classList.contains('virada') !== feita;
      el.classList.toggle('virada', feita);
      if (mudou && anim) { el.classList.add('virando'); el.style.zIndex = L + 5; setTimeout(() => { el.classList.remove('virando'); el.style.zIndex = feita ? i : L - i; }, 900); }
      else if (!el.classList.contains('virando')) el.style.zIndex = feita ? i : L - i;
    });
    const fim = est.cur >= L, ini = est.cur === 0;
    palco.dataset.pos = ini ? 'ini' : fim ? 'fim' : 'meio';
    $('#lv-ant').disabled = ini; $('#lv-prox').disabled = fim;
    const f = faixaDaPagina();
    $('#lv-pos').textContent = est.cur === 0 ? 'Capa' : est.cur >= L ? 'Fim' : (f != null && faixas[f].titulo ? faixas[f].titulo : (f != null ? `Faixa ${String(f + 1).padStart(2, '0')}` : ''));
    if (!anim) requestAnimationFrame(() => palco.classList.remove('sem-anim'));
  }
  function faixaDaPagina() {
    const pagVisivel = est.estreito ? est.cur : est.cur * 2;      // índice da página da direita (ou única)
    let r = null; inicioFaixa.forEach((p, i) => { if (pagVisivel + 1 >= p) r = i; });
    return r;
  }
  const ir = (n) => { est.cur = Math.max(0, Math.min(leaves.length, n)); aplicar(true); };
  const prox = () => ir(est.cur + 1), ant = () => ir(est.cur - 1);
  const irParaPagina = (p) => ir(est.estreito ? p : Math.floor((p + 1) / 2));

  $('#lv-ant').addEventListener('click', ant); $('#lv-prox').addEventListener('click', prox);
  window.addEventListener('keydown', (e) => { if (!est.visivel || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return; if (e.key === 'ArrowRight') prox(); if (e.key === 'ArrowLeft') ant(); });

  // arrastar / tocar na borda
  let ini = null;
  palco.addEventListener('pointerdown', (e) => { if (e.target.closest('button,a,.lin')) return; ini = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  palco.addEventListener('pointerup', (e) => {
    if (!ini) return; const dx = e.clientX - ini.x, dy = e.clientY - ini.y; const r = palco.getBoundingClientRect(); const rel = (e.clientX - r.left) / r.width; const i0 = ini; ini = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { dx < 0 ? prox() : ant(); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) { if (rel > 0.68) prox(); else if (rel < 0.32) ant(); else if (est.cur === 0) prox(); }
  });
  palco.addEventListener('pointercancel', () => (ini = null));

  // ações dentro das páginas
  palco.addEventListener('click', (e) => {
    const o = e.target.closest('.b-ouvir'); if (o) { est.seguir = true; sincControles(); const i = +o.dataset.i; player.estado.i === i && !player.audio.paused ? null : player.escolher(i, true); return; }
    const im = e.target.closest('.b-imprimir'); if (im) { imprimir(+im.dataset.i); return; }
    if (e.target.closest('.b-inicio')) { ir(0); return; }
    const l = e.target.closest('.lin'); if (l) player.irPara(+l.dataset.f, +l.dataset.t);
  });
  palco.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('lin')) { e.preventDefault(); player.irPara(+e.target.dataset.f, +e.target.dataset.t); } });

  // ---------- controles ----------
  function sincControles() {
    const f0 = faixas.find((f) => f.tom && !f.lacrada);
    $('#tom-txt').textContent = est.tom === 0 ? 'Tom original' : `${est.tom > 0 ? '+' : ''}${est.tom} ${Math.abs(est.tom) === 1 ? 'semitom' : 'semitons'}`;
    $('#cifras-alt').setAttribute('aria-pressed', String(est.cifras)); $('#acompanhar').setAttribute('aria-pressed', String(est.seguir));
    palco.classList.toggle('sem-cifra', !est.cifras);
    $('#tom-menos').disabled = $('#tom-mais').disabled = !est.cifras;
  }
  function refazer() { const p = est.estreito ? est.cur : est.cur * 2; montarPaginas(); montarLeaves(); sincControles(); }
  $('#tom-menos').addEventListener('click', () => { est.tom = Math.max(-11, est.tom - 1); refazer(); });
  $('#tom-mais').addEventListener('click', () => { est.tom = Math.min(11, est.tom + 1); refazer(); });
  $('#cifras-alt').addEventListener('click', () => { est.cifras = !est.cifras; sincControles(); });
  $('#acompanhar').addEventListener('click', () => { est.seguir = !est.seguir; sincControles(); });

  // acompanhar a música
  bus.addEventListener('linha', (e) => {
    const { faixa, t } = e.detail;
    palco.querySelectorAll('.lin.ativa').forEach((n) => n.classList.remove('ativa'));
    if (t == null) return;
    const el = palco.querySelector(`.lin[data-f="${faixa}"][data-t="${t}"]`); if (!el) return;
    el.classList.add('ativa');
    if (est.seguir && est.visivel) {
      const folha = el.closest('.leaf'); const i = leaves.indexOf(folha); const virada = folha.classList.contains('virada');
      const alvo = est.estreito ? i : (virada ? i + 1 : i);
      if (est.cur !== alvo && !(virada === false && est.cur === i) && !(virada && est.cur === i + 1)) ir(alvo);
    }
  });
  bus.addEventListener('faixa', (e) => { est.faixaAtiva = e.detail; });

  // ---------- imprimir ----------
  function imprimir(i) {
    const f = faixas[i]; const alvo = $('#impressao');
    const blocos = blocosDaFaixa(f, i);
    alvo.innerHTML = `<header><small>Di Garrocini · Pegadas na Trilha</small><h1>${esc(f.titulo)}</h1><p>Tom: ${esc(f.tom ? f.tom.replace(/^(\S+)/, (m) => trans(m, est.tom)) : '')}</p></header><section class="${est.cifras ? '' : 'sem-cifra'}">${blocos.map((b) => (b.cab || '') + b.h).join('')}</section><footer>${f.revisao ? 'Letra transcrita da gravação e cifra sugerida pela análise do áudio. ' : ''}Baixe as faixas em ${esc(location.host || 'o site do disco')}.</footer>`;
    document.body.classList.add('imprimindo');
    const fim = () => { document.body.classList.remove('imprimindo'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim); setTimeout(() => window.print(), 60);
  }

  // ---------- início ----------
  function medidas() {
    const larg = palco.parentElement.clientWidth, alt = innerHeight;
    est.estreito = larg < 760; palco.classList.toggle('single', est.estreito);
    const pw = est.estreito ? Math.min(larg - 36, 440, (alt * 0.78) / 1.34) : Math.min((larg - 40) / 2, 520, (alt * 0.8) / 1.34);
    palco.style.setProperty('--pw', pw + 'px'); palco.style.setProperty('--ph', pw * 1.34 + 'px');
  }
  let ultLarg = 0;
  function construir() { medidas(); ultLarg = palco.parentElement.clientWidth; montarPaginas(); montarLeaves(); sincControles(); }
  (document.fonts?.ready || Promise.resolve()).then(construir);
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(palco.parentElement.clientWidth - ultLarg) > 30) construir(); }, 250); });
  new IntersectionObserver(([e]) => (est.visivel = e.isIntersecting), { threshold: 0.35 }).observe(palco);
  return { ir, irParaPagina, est, imprimir, inicioFaixa: () => inicioFaixa };
}
