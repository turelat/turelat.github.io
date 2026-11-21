// Shared behaviour for both pages: theme and language switches, custom cursor, magnetic buttons,
// letter-wave text swaps, hiding header, mobile menu, sticky Telegram bar, toast and scroll reveal.
// A page adds its own parts through AG.onLang and then calls AG.init().
window.AG = (() => {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const hooks = [];
  let lang = 'ru';

  /* ---------- theme ---------- */
  const darkQ = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : darkQ.matches;
  function paintTheme() { $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.themeSet === 'dark') === isDark())); }
  $$('[data-theme-set]').forEach(b => b.addEventListener('click', () => { root.dataset.theme = b.dataset.themeSet; store.set('ag-theme', b.dataset.themeSet); paintTheme(); }));
  darkQ.addEventListener && darkQ.addEventListener('change', paintTheme);

  /* ---------- letter wave ---------- */
  const LOW = 'абвгдежзиклмнопрстуфхцчшэюяabcdefghijkmnopqrstuvwxyz', UP = LOW.toUpperCase();
  function scramble(el, to, html, dur = 700, alpha = .75) {
    if (reduce) { if (html) el.innerHTML = html; else el.textContent = to; return; }
    const from = el.textContent, len = Math.max(from.length, to.length), t0 = performance.now();
    const win = Math.min(.45, 6 / Math.max(len, 1)), cur = [];
    let frame = 0; cancelAnimationFrame(el._sc);
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur); let out = '';
      for (let i = 0; i < len; i++) {
        const a = (i / len) * (1 - win), b = a + win, f = from[i] || '', t = to[i] || '';
        if (p >= b) out += t;
        else if (p >= a && t.trim()) {
          if (!cur[i] || frame % 3 === 0) { const set = t === t.toLowerCase() ? LOW : UP; cur[i] = set[Math.random() * set.length | 0]; }
          out += '<span style="color:var(--red);opacity:' + alpha + '">' + cur[i] + '</span>';
        } else out += p >= a ? t : f;
      }
      el.innerHTML = out; frame++;
      if (p < 1) el._sc = requestAnimationFrame(tick); else if (html) el.innerHTML = html; else el.textContent = to;
    };
    el._sc = requestAnimationFrame(tick);
  }
  const plain = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };

  /* ---------- language ---------- */
  $$('[data-en]').forEach(el => { el.dataset.ru = el.innerHTML; });
  $$('[data-en-label]').forEach(el => { el.dataset.ruLabel = el.getAttribute('aria-label') || ''; });
  $$('[data-en-alt]').forEach(el => { el.dataset.ruAlt = el.alt; });
  const fromHash = () => (location.hash === '#en' || location.hash === '#ru') ? location.hash.slice(1) : null;
  function setLang(l, animate) {
    lang = l; root.lang = l;
    $$('[data-lang-set]').forEach(b => b.setAttribute('aria-pressed', b.dataset.langSet === l));
    const onScreen = el => { if (!el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
    $$('[data-en]').forEach(el => {
      const v = l === 'en' ? el.dataset.en : el.dataset.ru;
      if (el.innerHTML === v) return;
      if (!animate || reduce || !onScreen(el)) { cancelAnimationFrame(el._sc); el.innerHTML = v; return; }
      const txt = plain(v);
      if (txt.length <= 90) scramble(el, txt, v, 520 + Math.min(txt.length, 60) * 6);
      else el.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(6px)' }], { duration: 220, easing: 'ease-in' }).finished
        .then(() => { el.innerHTML = v; el.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' }); }, () => { el.innerHTML = v; });
    });
    $$('[data-en-label]').forEach(el => el.setAttribute('aria-label', l === 'en' ? el.dataset.enLabel : el.dataset.ruLabel));
    $$('[data-en-alt]').forEach(el => { el.alt = l === 'en' ? el.dataset.enAlt : el.dataset.ruAlt; });
    $$('[data-cv]').forEach(a => a.href = `assets/Gabaraev_Resume_${l.toUpperCase()}.pdf`);
    // Telegram links open the chat with a greeting already typed in; a link may carry its own text
    $$('[data-tg]').forEach(a => {
      const own = l === 'en' ? a.dataset.tgEn : a.dataset.tgRu;
      const msg = own || (l === 'en' ? "Hello Artur! I'm interested in your services." : 'Здравствуйте, Артур! Меня заинтересовали ваши услуги.');
      a.href = 'https://t.me/turelat?text=' + encodeURIComponent(msg);
    });
    // links between the two pages carry the language along
    $$('a[data-page]').forEach(a => a.href = a.dataset.page + '#' + l);
    document.title = l === 'en' ? (root.dataset.titleEn || document.title) : (root.dataset.titleRu || document.title);
    hooks.forEach(f => f(l));
    store.set('ag-lang', l);
    if (animate) try { history.replaceState(null, '', location.pathname + '#' + l); } catch (e) {}
  }
  $$('[data-lang-set]').forEach(b => b.addEventListener('click', () => { if (b.dataset.langSet !== lang) setLang(b.dataset.langSet, true); }));

  /* ---------- toast + copy ---------- */
  const toast = $('#toast'); let tt;
  const say = msg => { toast.textContent = msg; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 1800); };
  $$('[data-copy]').forEach(el => el.addEventListener('click', () => {
    const ok = () => say(lang === 'en' ? 'Copied' : 'Скопировано');
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); say(lang === 'en' ? 'Press Ctrl+C to copy' : 'Нажмите Ctrl+C, чтобы скопировать'); };
    try { navigator.clipboard.writeText(el.dataset.copy).then(ok, fallback); } catch (e) { fallback(); }
  }));

  /* ---------- cursor + magnetic buttons ---------- */
  const ring = $('.ring'), cur = $('.cur');
  if (fine && !reduce && ring) {
    root.classList.add('has-cursor');
    let rx = mouse.x, ry = mouse.y;
    (function loop() {
      rx += (mouse.x - rx) * .18; ry += (mouse.y - ry) * .18;
      cur.style.transform = `translate3d(${mouse.x}px,${mouse.y}px,0)`; ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointerover', e => {
      const lab = e.target.closest('[data-cursor]'), link = e.target.closest('a, button, summary, input');
      ring.classList.toggle('label', !!lab); ring.classList.toggle('hover', !!link && !lab);
      if (lab) $('b', ring).textContent = lang === 'en' ? lab.dataset.cursorEn : lab.dataset.cursor;
    });
    document.addEventListener('pointerleave', () => ring.classList.add('hide'));
    document.addEventListener('pointerenter', () => ring.classList.remove('hide'));
    // pull starts at zero on the edge of a field round each button, eased every frame, soft-capped
    const mags = $$('.magnetic').map(el => ({ el, x: 0, y: 0, k: parseFloat(el.dataset.mag || 1) }));
    (function mag() {
      for (const m of mags) {
        const r = m.el.getBoundingClientRect(); let tx = 0, ty = 0;
        if (r.bottom > -100 && r.top < innerHeight + 100 && r.width) {
          const dx = mouse.x - (r.left + r.width / 2 - m.x), dy = mouse.y - (r.top + r.height / 2 - m.y);
          const k = Math.max(0, 1 - Math.hypot(dx, dy) / (Math.max(r.width, r.height) / 2 + 80)), s = k * k * (3 - 2 * k);
          const cap = (v, c) => c * Math.tanh(v / c);
          tx = cap(dx * .3 * s * m.k, 10); ty = cap(dy * .4 * s * m.k, 8);
        }
        m.x += (tx - m.x) * .12; m.y += (ty - m.y) * .12;
        if (Math.abs(m.x) < .05 && Math.abs(m.y) < .05 && !tx && !ty) { if (m.el.style.transform) m.el.style.transform = ''; m.x = m.y = 0; }
        else m.el.style.transform = `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
      }
      requestAnimationFrame(mag);
    })();
    // the wave always runs towards the label's real text, so hovering again mid-wave cannot leave it garbled
    $$('[data-scramble]').forEach(el => (el.closest('a, button') || el).addEventListener('mouseenter', () => {
      const h = el.dataset.en ? (lang === 'en' ? el.dataset.en : el.dataset.ru) : (el._html ??= el.innerHTML);
      scramble(el, plain(h), h, 360, .5);
    }));
  }

  /* ---------- header, mobile menu, sticky bar ---------- */
  const nav = $('.nav'), burger = $('#burger'), mm = $('#mmenu'), mbar = $('#mbar'), end = $('#contact');
  function menu(open) {
    burger.setAttribute('aria-expanded', open);
    if (open) { mm.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => mm.classList.add('open'))); document.body.style.overflow = 'hidden'; nav.classList.remove('away'); }
    else { mm.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => { if (!mm.classList.contains('open')) mm.hidden = true; }, 650); }
  }
  burger.addEventListener('click', () => menu(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', mm).forEach(a => a.addEventListener('click', () => menu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY, dy = y - lastY; lastY = y;
    nav.classList.toggle('solid', y > 20);
    if (!mm.classList.contains('open')) { if (dy > 4 && y > innerHeight * .6) nav.classList.add('away'); if (dy < -4) nav.classList.remove('away'); }
    if (mbar) mbar.classList.toggle('show', y > innerHeight * .6 && (!end || end.getBoundingClientRect().top > innerHeight * .7));
  };
  addEventListener('scroll', onScroll, { passive: true });

  /* ---------- reveal ---------- */
  function reveal() {
    if (!('IntersectionObserver' in window) || reduce) return;
    root.classList.add('rv-on');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.rv, .rv-line').forEach(el => io.observe(el));
  }

  function init() {
    paintTheme(); onScroll(); reveal();
    const saved = store.get('ag-lang');
    const geo = root.dataset.geo;
    const ruBrowser = () => {
      const langs = navigator.languages || [navigator.language || ''];
      let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
      return langs.some(l => /^ru\b/i.test(l)) || /^(Europe\/(Moscow|Samara|Volgograd|Kaliningrad|Kirov|Ulyanovsk|Saratov|Astrakhan)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr))$/.test(tz);
    };
    setLang(fromHash() || (saved === 'en' || saved === 'ru' ? saved : geo ? (geo === 'RU' ? 'ru' : 'en') : ruBrowser() ? 'ru' : 'en'), false);
    addEventListener('hashchange', () => { const h = fromHash(); if (h && h !== lang) setLang(h, true); });
  }

  return { $, $$, fine, reduce, mouse, say, scramble, init, onLang: f => hooks.push(f), lang: () => lang };
})();
