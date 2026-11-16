/* M&F Auto Peças — prévia. Cena por planos: cada capítulo tem seu próprio plano, revelado a partir
   da linha de luz azul, e cada plano tem um leve movimento de câmera. Tudo é função pura da rolagem
   nativa (reversível, sem saltos), com suavização leve. */
(function () {
  'use strict';
  var CONFIG = { whatsapp: null, instagram: 'https://www.instagram.com/mefautopecas/' };
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var sstep = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var listen = function (mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn); };

  /* ---------- Cena ---------- */
  var scene = $('#cena'), stage = $('.stage');
  var plateEls = $$('[data-plate]');
  var copies = $$('[data-copy]');
  var railLinks = $$('.rail a');
  var navLinks = $$('.nav a[data-chapter]');
  var portraitMQ = window.matchMedia('(max-aspect-ratio: 1/1)');
  var motionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* d/m = [largura, altura, altura da linha de luz na imagem (0–1)] em paisagem/retrato.
     rev = janela de revelação [início, fim]. Quadros-chave em coordenadas da imagem:
     fx/fy foco, z zoom sobre o "cover", ax/ay posição do foco na tela. Limitado para nunca mostrar borda. */
  var PLATES = [
    { d: [1672, 941, .421], m: [941, 1672, .602], rev: null,
      land: [{ p: 0, fx: .50, fy: .50, z: 1, ax: .50, ay: .50 }, { p: .08, fx: .50, fy: .50, z: 1, ax: .50, ay: .50 }, { p: .27, fx: .60, fy: .45, z: 1.22, ax: .62, ay: .50 }],
      port: [{ p: 0, fx: .50, fy: .55, z: 1, ax: .50, ay: .55 }, { p: .08, fx: .50, fy: .55, z: 1, ax: .50, ay: .55 }, { p: .27, fx: .40, fy: .62, z: 1.25, ax: .50, ay: .62 }] },
    { d: [1536, 1024, .334], m: [1024, 1536, .558], rev: [.17, .27],
      land: [{ p: .17, fx: .62, fy: .45, z: 1.10, ax: .62, ay: .50 }, { p: .27, fx: .62, fy: .45, z: 1, ax: .62, ay: .50 }, { p: .50, fx: .60, fy: .42, z: 1.08, ax: .62, ay: .50 }],
      port: [{ p: .17, fx: .45, fy: .60, z: 1.10, ax: .50, ay: .64 }, { p: .27, fx: .45, fy: .60, z: 1, ax: .50, ay: .64 }, { p: .50, fx: .42, fy: .60, z: 1.08, ax: .50, ay: .64 }] },
    { d: [1536, 1024, .209], m: [1024, 1536, .553], rev: [.44, .54],
      land: [{ p: .44, fx: .62, fy: .62, z: 1.10, ax: .64, ay: .58 }, { p: .54, fx: .62, fy: .62, z: 1, ax: .64, ay: .58 }, { p: .76, fx: .60, fy: .62, z: 1.08, ax: .64, ay: .58 }],
      port: [{ p: .44, fx: .45, fy: .78, z: 1.10, ax: .50, ay: .72 }, { p: .54, fx: .45, fy: .78, z: 1, ax: .50, ay: .72 }, { p: .76, fx: .45, fy: .78, z: 1.08, ax: .50, ay: .72 }] },
    { d: [1672, 941, .421], m: [941, 1672, .602], rev: [.70, .80],
      land: [{ p: .70, fx: .60, fy: .50, z: 1.30, ax: .62, ay: .50 }, { p: .92, fx: .55, fy: .50, z: 1.04, ax: .52, ay: .50 }, { p: 1, fx: .55, fy: .50, z: 1, ax: .52, ay: .50 }],
      port: [{ p: .70, fx: .50, fy: .62, z: 1.30, ax: .50, ay: .62 }, { p: .92, fx: .50, fy: .60, z: 1.04, ax: .50, ay: .60 }, { p: 1, fx: .50, fy: .60, z: 1, ax: .50, ay: .60 }] },
    { d: [1672, 941, .420], m: [941, 1672, .699], rev: [.91, .995],
      land: [{ p: .91, fx: .50, fy: .50, z: 1.06, ax: .50, ay: .50 }, { p: 1, fx: .50, fy: .50, z: 1, ax: .50, ay: .50 }],
      port: [{ p: .91, fx: .50, fy: .60, z: 1.06, ax: .50, ay: .60 }, { p: 1, fx: .50, fy: .60, z: 1, ax: .50, ay: .60 }] }
  ];
  /* Janelas de texto: entra a→b, fica b→c, sai c→d. */
  var WIN = { hero: [-1, -.5, .05, .15], 1: [.20, .28, .40, .46], 2: [.48, .56, .66, .71], 3: [.75, .83, 2, 3] };
  var CHAPTER_P = [0, .35, .61, .86];

  var active = false, W = 0, H = 0, sceneTop = 0, sceneRange = 1;
  var target = 0, shown = 0, raf = 0, lastT = 0, rendered = -1, chapterNow = -1;
  var plates = plateEls.map(function (el, i) { return { el: el, pic: $('picture', el), cfg: PLATES[i], w: 0, h: 0, line: .5 }; });

  function measure() {
    W = stage.clientWidth || window.innerWidth;
    H = stage.clientHeight || window.innerHeight;
    var port = portraitMQ.matches;
    plates.forEach(function (pl) {
      var dim = port ? pl.cfg.m : pl.cfg.d, aspect = dim[0] / dim[1];
      pl.w = Math.max(W, H * aspect); pl.h = pl.w / aspect; pl.line = dim[2];
      pl.pic.style.width = pl.w + 'px'; pl.pic.style.height = pl.h + 'px';
    });
    sceneTop = scene.getBoundingClientRect().top + window.scrollY;
    sceneRange = Math.max(1, scene.offsetHeight - H);
  }
  function readScroll() { target = clamp((window.scrollY - sceneTop) / sceneRange, 0, 1); }

  function pose(pl, p) {
    var k = portraitMQ.matches ? pl.cfg.port : pl.cfg.land, i = 0;
    while (i < k.length - 2 && p > k[i + 1].p) i++;
    var a = k[i], b = k[i + 1], t = sstep(a.p, b.p, p);
    var z = lerp(a.z, b.z, t);
    var tx = lerp(a.ax, b.ax, t) * W - lerp(a.fx, b.fx, t) * pl.w * z;
    var ty = lerp(a.ay, b.ay, t) * H - lerp(a.fy, b.fy, t) * pl.h * z;
    tx = clamp(tx, W - pl.w * z, 0); ty = clamp(ty, H - pl.h * z, 0);
    return { z: z, tx: tx, ty: ty, lineY: clamp((ty + pl.line * pl.h * z) / H, .08, .92) };
  }
  function trap(w, p) {
    if (p <= w[0] || p >= w[3]) return { o: 0, y: 0 };
    if (p < w[1]) { var t = sstep(w[0], w[1], p); return { o: t, y: (1 - t) * 30 }; }
    if (p <= w[2]) return { o: 1, y: 0 };
    var u = sstep(w[2], w[3], p); return { o: 1 - u, y: -u * 30 };
  }
  function render(p) {
    /* Revelação de cada plano; abaixo do plano mais alto totalmente aberto nada é desenhado. */
    var r = plates.map(function (pl) { return pl.cfg.rev ? sstep(pl.cfg.rev[0], pl.cfg.rev[1], p) : 1; });
    var base = 0; r.forEach(function (v, i) { if (v >= 1) base = i; });
    var beamY = .42, glow = 0;
    plates.forEach(function (pl, i) {
      var visible = i >= base && r[i] > 0;
      pl.el.style.visibility = visible ? 'visible' : 'hidden';
      if (!visible) return;
      var s = pose(pl, p);
      pl.pic.style.transform = 'translate3d(' + s.tx.toFixed(2) + 'px,' + s.ty.toFixed(2) + 'px,0) scale(' + s.z.toFixed(4) + ')';
      if (r[i] < 1) {
        /* o próximo plano se abre como uma fenda a partir da própria linha de luz */
        var open = 1 - r[i];
        pl.el.style.clipPath = 'inset(' + (s.lineY * open * 100).toFixed(3) + '% 0 ' + ((1 - s.lineY) * open * 100).toFixed(3) + '% 0)';
        beamY = s.lineY; glow = Math.max(glow, Math.sin(Math.PI * r[i]));
      } else {
        pl.el.style.clipPath = 'none';
        if (glow === 0) beamY = s.lineY;
      }
    });
    stage.style.setProperty('--beam-top', (beamY * 100).toFixed(3) + '%');
    stage.style.setProperty('--beam', sstep(.03, .25, p).toFixed(3));
    stage.style.setProperty('--beam-o', (sstep(.02, .18, p) * (.45 + .55 * glow)).toFixed(3));
    copies.forEach(function (el) {
      var key = el.getAttribute('data-copy'), v = trap(WIN[key], p);
      el.style.opacity = v.o.toFixed(3);
      el.style.setProperty('--y', v.y.toFixed(1) + 'px');
      el.classList.toggle('on', v.o > .02);
      el.style.pointerEvents = v.o > .5 ? '' : 'none';
    });
    var ch = p < .17 ? 0 : p < .47 ? 1 : p < .72 ? 2 : 3;
    if (ch !== chapterNow) {
      chapterNow = ch;
      railLinks.concat(navLinks).forEach(function (a) {
        if (+a.getAttribute('data-chapter') === ch) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
  }
  function frame(t) {
    raf = 0;
    var dt = Math.min(48, t - (lastT || t)); lastT = t;
    var k = 1 - Math.pow(0.0009, dt / 1000); /* resposta ~150–250 ms, independente da taxa de quadros */
    shown += (target - shown) * k;
    if (Math.abs(target - shown) < .00015) shown = target;
    if (shown !== rendered) { render(shown); rendered = shown; }
    if (shown !== target) raf = requestAnimationFrame(frame); else lastT = 0;
  }
  function kick() { if (!active) return; readScroll(); if (!raf) raf = requestAnimationFrame(frame); }
  function snap() { measure(); readScroll(); shown = target; rendered = -1; render(shown); rendered = shown; }

  function enable() { if (active) return; active = true; chapterNow = -1; snap(); }
  function disable() {
    active = false; if (raf) cancelAnimationFrame(raf); raf = 0;
    plates.forEach(function (pl) { pl.pic.style.transform = ''; pl.el.style.clipPath = ''; pl.el.style.visibility = ''; });
    copies.forEach(function (el) { el.removeAttribute('style'); el.classList.remove('on'); });
  }
  function sync() {
    var wantMotion = !motionMQ.matches;
    root.classList.toggle('motion', wantMotion);
    if (wantMotion) enable(); else disable();
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', function () { if (active) snap(); });
  window.addEventListener('load', function () { if (active) snap(); });
  listen(portraitMQ, function () { if (active) snap(); });
  listen(motionMQ, sync);

  /* Cabeçalho ganha fundo sólido depois da cena, para não sobrepor o conteúdo. */
  var header = $('.site-header');
  function headerState() {
    var limit = active ? sceneTop + sceneRange - 40 : 120;
    header.classList.toggle('solid', window.scrollY > limit);
  }
  window.addEventListener('scroll', headerState, { passive: true });
  window.addEventListener('resize', headerState);
  headerState();

  /* Navegação por capítulos: leva a rolagem ao ponto da cena; a câmera acompanha. */
  $$('a[data-chapter]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var c = +a.getAttribute('data-chapter');
      closeMenu();
      if (!active || c === 3) return; /* estático ou #consulta: âncora normal */
      e.preventDefault();
      window.scrollTo({ top: sceneTop + CHAPTER_P[c] * sceneRange, behavior: 'smooth' });
    });
  });

  /* ---------- Menu ---------- */
  var menuBtn = $('.menu-btn'), menu = $('#menu');
  function closeMenu(restore) {
    if (menu.classList.contains('open')) {
      menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false');
      if (restore) menuBtn.focus();
    }
  }
  menuBtn.addEventListener('click', function () {
    var open = !menu.classList.contains('open');
    menu.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open));
    if (open) { var f = $('a', menu); if (f) requestAnimationFrame(function () { f.focus(); }); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(true); });
  document.addEventListener('click', function (e) { if (!menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { closeMenu(); }); });

  /* ---------- Consulta ---------- */
  var form = $('#form'), result = $('#result'), resumo = $('#resumo'), copyBtn = $('#copiar'), statusEl = $('#copy-status'), wa = $('#wa');
  var F = { veiculo: $('#veiculo-f'), ano: $('#ano-f'), versao: $('#versao-f'), peca: $('#peca-f') };
  var norm = function (v) { return v.replace(/\s+/g, ' ').trim(); };
  function setErr(name, msg) {
    var el = F[name], out = $('#e-' + name);
    out.textContent = msg || '';
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    return !msg;
  }
  function validate() {
    var maxY = new Date().getFullYear() + 1, ano = norm(F.ano.value), ok = [];
    ok.push(setErr('veiculo', norm(F.veiculo.value).length < 2 ? 'Informe a marca e o modelo do veículo.' : ''));
    ok.push(setErr('ano', !/^\d{4}$/.test(ano) ? 'Informe o ano com 4 dígitos, por exemplo 2014.' : (+ano < 1950 || +ano > maxY) ? 'Informe um ano entre 1950 e ' + maxY + '.' : ''));
    ok.push(setErr('peca', norm(F.peca.value).length < 3 ? 'Descreva a peça que você procura.' : ''));
    return ok.every(Boolean);
  }
  function buildText() {
    var l = ['Olá! Gostaria de consultar uma peça na M&F Auto Peças.', '', 'Veículo: ' + norm(F.veiculo.value), 'Ano: ' + norm(F.ano.value)];
    if (norm(F.versao.value)) l.push('Versão: ' + norm(F.versao.value));
    l.push('Peça: ' + norm(F.peca.value));
    return l.join('\n');
  }
  Object.keys(F).forEach(function (k) {
    F[k].addEventListener('input', function () { if (F[k].getAttribute('aria-invalid')) setErr(k, ''); statusEl.textContent = ''; });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) {
      var bad = form.querySelector('[aria-invalid="true"]'); if (bad) bad.focus();
      result.hidden = true; return;
    }
    var text = buildText(); resumo.textContent = text; result.hidden = false; statusEl.textContent = '';
    if (CONFIG.whatsapp) { wa.hidden = false; wa.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text); } else { wa.hidden = true; }
    result.scrollIntoView({ block: 'nearest', behavior: 'auto' }); result.focus({ preventScroll: true });
  });
  copyBtn.addEventListener('click', function () {
    var text = resumo.textContent;
    function done(ok) { statusEl.textContent = ok ? 'Consulta copiada. Cole no canal de atendimento da loja.' : 'Não foi possível copiar automaticamente. Selecione o texto acima e copie.'; }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      document.body.removeChild(ta); done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  });

  sync();
})();
