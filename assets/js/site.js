/* GameDojo project page */
(function () {
  "use strict";
  const D = window.GD_DATA, R = window.GD_RESULTS;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  // The showcase motion (portal push-in, parallax, embers, intro, logo sway, bars) is part of what the page is
  // demonstrating, so it runs whatever the OS "reduce animations" setting says - many Windows machines report
  // reduce-motion just because animation effects are off system-wide. ?still turns all of it off on request.
  const reduce = params.has("still");
  const coarse = matchMedia("(hover: none), (pointer: coarse)").matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const IMG_W = 2172, IMG_H = 724;
  const TIERS = [["e", "Easy"], ["m", "Medium"], ["h", "Hard"]];
  const TIER_NAME = { e: "Easy", m: "Medium", h: "Hard" };
  const pct = v => (v * 100).toFixed(3) + "%";
  const store = {                                   // sessionStorage can be unavailable (privacy modes, file://)
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MODEL_ICONS = {
    GPT: "openai.svg", Claude: "claude.svg", Gemini: "gemini.svg", DeepSeek: "deepseek.svg",
    GLM: "zai.svg", MiniMax: "minimax.svg", Qwen: "qwen.svg",
    GameDojo: "gamedojo.svg?v=2", GameScaling: "gamescaling.svg", Gamer: "gamer.svg",
  };
  function modelIcon(name) {
    const family = name.split(/[\d-]/, 1)[0];
    const icon = MODEL_ICONS[family];
    return icon ? `assets/icons/models/${icon}` : "";
  }

  /* ---------- data index ---------- */
  const bosses = [], byId = {};
  D.games.forEach(g => g.bosses.forEach(b => { b.game = g; b.index = bosses.length; bosses.push(b); byId[b.id] = b; }));
  const clip = (b, t) => `assets/clips/${b.id}-${t}.mp4?v=en1`;
  const poster = b => `assets/posters/${b.id}.jpg?v=en1`;
  const playIds = new Set((window.GD_PLAYABLE || []).map(p => p.boss));     // bosses with a playable build
  // game id -> its standalone play page (one playable boss per game)
  const PLAY_PAGES = {};
  (window.GD_PLAYABLE || []).forEach(p => { const b = (D.games || []).find(g => g.bosses.some(x => x.id === p.boss)); if (b) PLAY_PAGES[b.id] = p.src; });

  /* ---------- video helpers ---------- */
  function newVideo(src) {
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    if (src) v.dataset.src = src;
    return v;
  }
  function play(v) {
    if (!v.getAttribute("src") && v.dataset.src) v.setAttribute("src", v.dataset.src);
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }
  // hover-to-play card: poster first, the clip is only requested after a short dwell
  function hoverPlay(card, v) {
    if (coarse) return;
    let t = 0;
    card.addEventListener("mouseenter", () => {
      t = setTimeout(() => { card.classList.add("is-playing"); play(v); }, 110);
    });
    card.addEventListener("mouseleave", () => { clearTimeout(t); card.classList.remove("is-playing"); v.pause(); });
  }

  /* ---------- nav + reading progress (a boss bar that drains) ---------- */
  const nav = $("#nav"), navHp = $("#navHp");
  function onScroll() {
    nav.classList.toggle("is-solid", window.scrollY > 40);
    const max = document.documentElement.scrollHeight - innerHeight;
    if (navHp) navHp.style.transform = `scaleX(${max > 0 ? Math.max(0, 1 - window.scrollY / max).toFixed(4) : 1})`;
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- embers ---------- */
  (function embers() {
    const canvas = $("#embers"), hero = $(".hero");
    if (!canvas || reduce) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 1.5), N = coarse ? 34 : 80;
    let w = 0, h = 0, parts = [], visible = true, raf = 0;
    function resize() {
      w = hero.clientWidth; h = hero.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(p, fresh) {
      p.x = Math.random() * w; p.y = fresh ? Math.random() * h : h + 10;
      p.r = 0.8 + Math.random() * 1.8; p.vy = 0.12 + Math.random() * 0.35;
      p.sway = Math.random() * 6.28; p.sv = 0.004 + Math.random() * 0.01;
      p.teal = Math.random() < 0.16; p.a = 0.25 + Math.random() * 0.55;
      return p;
    }
    function frame() {
      raf = 0;
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy; p.sway += p.sv; p.x += Math.sin(p.sway) * 0.25;
        if (p.y < -10) spawn(p, false);
        const fade = Math.min(1, (h - p.y) / (h * 0.25)) * Math.min(1, p.y / (h * 0.3));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = p.teal ? `rgba(63,217,198,${p.a * fade})` : `rgba(255,205,120,${p.a * fade})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    resize();
    parts = Array.from({ length: N }, () => spawn({}, true));
    addEventListener("resize", resize);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { threshold: 0.02 }).observe(hero);
    document.addEventListener("visibilitychange", kick);
    kick();
  })();

  /* ---------- hero: the living Figure 1 ---------- */
  let modalOpen = false;
  const hero = $(".hero"), stage = $("#stage"), zoom = $("#zoom"), pan = $("#pan");
  const beamPath = $("#beamPath"), beamSpark = $("#beamSpark"), beamGrad = $("#beamGrad");
  const items = D.portals.map(p => {
    const b = byId[p.boss], [x0, y0, x1, y1] = p.bbox;
    const el = document.createElement("button");
    el.type = "button"; el.className = "portal";
    el.style.cssText = `left:${pct(x0 / IMG_W)};top:${pct(y0 / IMG_H)};width:${pct((x1 - x0) / IMG_W)};height:${pct((y1 - y0) / IMG_H)}`;
    el.style.clipPath = `polygon(${p.clip.map(([x, y]) => `${x}% ${y}%`).join(",")})`;
    el.setAttribute("aria-label", `${b.name}, ${b.game.name}: watch the fight`);
    const v = newVideo(clip(b, "m"));
    v.addEventListener("playing", () => el.classList.add("is-ready"));
    el.appendChild(v);
    $("#portals").appendChild(el);

    const halo = document.createElement("i");
    const hw = (x1 - x0) * 1.5, hh = (y1 - y0) * 1.42;
    halo.className = "halo";
    halo.style.cssText = `left:${pct((p.center[0] - hw / 2) / IMG_W)};top:${pct((p.center[1] - hh / 2) / IMG_H)};width:${pct(hw / IMG_W)};height:${pct(hh / IMG_H)}`;
    $("#halos").appendChild(halo);

    const lab = document.createElement("div");
    lab.className = "plabel";
    lab.innerHTML = `<b>${esc(b.name)}</b>${esc(b.game.name)} · ${esc(b.game.pattern)}`;
    lab.style.left = pct(p.top[0] / IMG_W); lab.style.top = pct(p.top[1] / IMG_H);
    if (p.top[0] < IMG_W * 0.14) lab.dataset.edge = "l";
    if (p.top[0] > IMG_W * 0.86) lab.dataset.edge = "r";
    $("#portalLabels").appendChild(lab);
    return { p, b, el, v, halo, lab, on: false, user: false, timer: 0 };
  });
  if (params.get("debug") === "portals") root.classList.add("debug-portals");

  let userIt = null, quietUntil = 0, heroVisible = true, lastAmbient = null;
  function drawBeam(it) {
    // aim at the lower third of the portal so the spark does not sit on the action
    const [x0, y0] = D.player, x1 = it.p.center[0], y1 = it.p.bbox[3] - (it.p.bbox[3] - it.p.bbox[1]) * 0.2;
    const dx = x1 - x0;
    const cx = x0 + dx * 0.5 + (Math.abs(dx) < 60 ? 46 : 0), cy = Math.min(y0, y1) - 46 - Math.abs(dx) * 0.07;
    beamGrad.setAttribute("x1", x0); beamGrad.setAttribute("y1", y0);
    beamGrad.setAttribute("x2", x1); beamGrad.setAttribute("y2", y1);
    beamPath.classList.remove("is-on"); beamSpark.classList.remove("is-on");
    beamPath.setAttribute("d", `M${x0} ${y0} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1} ${y1}`);
    beamSpark.setAttribute("cx", x1); beamSpark.setAttribute("cy", y1);
    void beamPath.getBoundingClientRect();           // restart the draw-on transition
    beamPath.classList.add("is-on"); beamSpark.classList.add("is-on");
  }
  function hideBeam() { beamPath.classList.remove("is-on"); beamSpark.classList.remove("is-on"); }
  function showLabel(it) {
    items.forEach(o => o.lab.classList.toggle("is-on", o === it));
    const lab = it.lab;                               // keep the label inside the visible part of the arena
    lab.style.marginLeft = "";
    const r = lab.getBoundingClientRect(), box = pan.getBoundingClientRect();
    const lo = Math.max(box.left, 0) + 8, hi = Math.min(box.right, innerWidth) - 8;
    if (r.left < lo) lab.style.marginLeft = (lo - r.left).toFixed(0) + "px";
    else if (r.right > hi) lab.style.marginLeft = (hi - r.right).toFixed(0) + "px";
  }

  function on(it, user) {
    clearTimeout(it.timer);
    if (user) {
      if (userIt && userIt !== it) off(userIt);
      userIt = it; it.user = true;
      it.halo.classList.add("is-user");
      $("#arenaHint").classList.add("is-used");
      drawBeam(it); showLabel(it);
    } else {
      lastAmbient = it;
      if (!userIt) showLabel(it);
    }
    if (it.on) return;
    it.on = true;
    it.el.classList.add("is-on"); it.halo.classList.add("is-on");
    if (it.v.readyState > 0) { try { it.v.currentTime = 0; } catch (e) { /* not seekable yet */ } }
    play(it.v);
  }
  function off(it) {
    clearTimeout(it.timer);
    if (it.user) { it.user = false; it.halo.classList.remove("is-user"); }
    if (userIt === it) { userIt = null; hideBeam(); quietUntil = performance.now() + 2200; }
    it.lab.classList.remove("is-on");
    if (!it.on) return;
    it.on = false;
    it.el.classList.remove("is-on"); it.halo.classList.remove("is-on");
    it.timer = setTimeout(() => { if (!it.on) it.v.pause(); }, 550);
  }

  items.forEach(it => {
    if (!coarse) {
      it.el.addEventListener("mouseenter", () => on(it, true));
      it.el.addEventListener("mouseleave", () => { if (document.activeElement !== it.el) off(it); });
    }
    it.el.addEventListener("focus", () => on(it, true));
    it.el.addEventListener("blur", () => off(it));
    it.el.addEventListener("click", () => {
      if (coarse && userIt !== it) { on(it, true); return; }
      enter(it);
    });
  });

  // the arena lives on its own: up to two portals are open at a time while nobody is choosing
  // Reduced motion keeps this (clips cross-fade inside fixed frames) but drops parallax, zoom, embers and sweeps.
  const alive = params.has("alive"), toggle = $("#arenaToggle");
  let paused = saveData || store.get("gd-arena") === "paused";
  function setPaused(v) {
    paused = v;
    toggle.textContent = v ? "Play arena" : "Pause arena";
    toggle.setAttribute("aria-pressed", String(v));
    store.set("gd-arena", v ? "paused" : "playing");
    if (v) items.forEach(it => { if (it.on && !it.user) off(it); });
  }
  toggle.addEventListener("click", () => setPaused(!paused));
  setPaused(paused);
  function ambientTick() {
    if (alive || paused || !heroVisible || document.hidden || modalOpen || userIt) return;
    if (performance.now() < quietUntil) return;
    const open = items.filter(it => it.on);
    if (open.length >= (reduce ? 1 : 2)) return;
    const pool = items.filter(it => !it.on && it !== lastAmbient);
    const it = pool[Math.floor(Math.random() * pool.length)];
    on(it, false);
    it.timer = setTimeout(() => { if (!it.user) off(it); }, 4700);
  }
  setInterval(ambientTick, 2300);
  new IntersectionObserver(([e]) => {
    heroVisible = e.isIntersecting;
    if (!heroVisible && !alive) items.forEach(it => { if (it.on) off(it); });
  }, { threshold: 0.2 }).observe(stage);

  // keyboard: left / right walk along the wall of portals
  const order = items.slice().sort((a, b) => a.p.center[0] - b.p.center[0]);
  const middle = order.reduce((a, b) => (Math.abs(b.p.center[0] - D.player[0]) < Math.abs(a.p.center[0] - D.player[0]) ? b : a));
  document.addEventListener("keydown", e => {
    if (modalOpen || e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (!heroVisible || scrollY > innerHeight * 0.6) return;
    e.preventDefault();
    let next = middle;
    if (userIt) {
      const i = order.indexOf(userIt), n = order.length;
      next = order[(i + (e.key === "ArrowRight" ? 1 : -1) + n) % n];
    }
    next.el.focus({ preventScroll: true });
  });

  // click: the camera pushes into the portal, then the fight card opens
  function enter(it) {
    if (reduce) { openFight(it.b, { tier: "m" }); return; }
    zoom.style.transformOrigin = `${pct(it.p.center[0] / IMG_W)} ${pct(it.p.center[1] / IMG_H)}`;
    zoom.classList.add("is-zoom"); hero.classList.add("is-entering");
    setTimeout(() => openFight(it.b, { tier: "m" }), 300);
  }
  function leaveZoom() { zoom.classList.remove("is-zoom"); hero.classList.remove("is-entering"); }

  // pointer parallax (fine pointers only)
  if (!reduce && !coarse) {
    const title = $("#heroTitle"), canvas = $("#embers");
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const step = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      stage.style.transform = `translate3d(${(-cx * 10).toFixed(2)}px,${(-cy * 5).toFixed(2)}px,0)`;
      title.style.transform = `translate3d(${(cx * 6).toFixed(2)}px,${(cy * 3).toFixed(2)}px,0)`;
      canvas.style.transform = `translate3d(${(-cx * 18).toFixed(2)}px,${(-cy * 9).toFixed(2)}px,0)`;
      raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(step) : 0;
    };
    hero.addEventListener("mousemove", e => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener("mouseleave", () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  }

  // small screens: the arena is wider than the viewport, start centred on the player
  function centrePan() { if (pan.scrollWidth > pan.clientWidth + 4) pan.scrollLeft = (pan.scrollWidth - pan.clientWidth) * (D.player[0] / IMG_W); }
  addEventListener("resize", centrePan);

  // page-load sequence: title, then the arena, then a sweep of light across the portals
  (function intro() {
    const img = $("#arenaImg");
    if (params.get("title") === "logo") {           // alternative hero: the painted logo instead of type
      $(".title__type").hidden = true; $(".title__logo").hidden = false; $(".title__type").style.display = "none";
    }
    let done = false;
    const start = () => {
      if (done) return; done = true;
      centrePan();
      const first = !store.get("gd-intro");
      root.classList.remove("intro");
      if (alive) { items.forEach(it => on(it, false)); return; }
      if (reduce || !first) return;
      store.set("gd-intro", "1");
      quietUntil = performance.now() + 2600;
      order.forEach((it, i) => setTimeout(() => {
        it.halo.classList.add("is-flash");
        setTimeout(() => it.halo.classList.remove("is-flash"), 800);
      }, 650 + i * 45));
    };
    if (img.complete && img.naturalWidth) start(); else { img.addEventListener("load", start); img.addEventListener("error", start); }
    setTimeout(start, 1500);
  })();

  /* ---------- boss wall ---------- */
  (function wall() {
    const wall = $("#wall"), filters = $("#filters"), count = $("#wallCount");
    const frag = document.createDocumentFragment();
    D.games.forEach(g => {
      const row = document.createElement("div");
      row.className = "game-row"; row.dataset.dim = g.dim; row.dataset.pattern = g.pattern; row.dataset.game = g.id;
      // first cell: the game's own cover, framed apart from the six bosses; hover blurs it and shows name + Play
      const pl = PLAY_PAGES[g.id];
      const tag = pl ? "a" : "div";
      row.innerHTML = `<${tag} class="game-cover${pl ? " is-playable" : ""}"${pl ? ` href="${pl}" aria-label="Play ${esc(g.name)}"` : ""}>`
        + `<img src="assets/covers/${g.id}.jpg?v=3" alt="${esc(g.full || g.name)}" loading="lazy" width="460" height="215">`
        + `<span class="game-cover__over"><b>${esc(g.name)}</b><span>${esc(g.pattern)} · ${g.dim}</span>`
        + (pl ? `<i class="game-cover__play">▶ Play</i>` : "") + `</span>`
        + (pl ? `<span class="game-cover__badge" aria-hidden="true">▶</span>` : "")
        + `</${tag}>`;
      g.bosses.forEach(b => {
        const card = document.createElement("button");
        card.className = "boss"; card.type = "button";
        card.setAttribute("aria-label", `${b.name}, ${g.name}`);
        card.innerHTML = `<img src="${poster(b)}" alt="" loading="lazy" width="640" height="360"><span class="boss__name">${esc(b.name)}</span>`;
        const v = newVideo(clip(b, "m"));
        card.insertBefore(v, card.lastChild);
        if (playIds.has(b.id)) card.insertAdjacentHTML("beforeend", '<span class="boss__tag">Playable</span>');
        hoverPlay(card, v);
        card.addEventListener("click", () => openFight(b, { tier: "m" }));
        row.appendChild(card);
      });
      frag.appendChild(row);
    });
    wall.appendChild(frag);

    const short = { "Action platforming": "Platforming", "Run-and-gun combat": "Run-and-gun", "Fighting": "Fighting",
      "Top-down combat": "Top-down", "Bullet-hell dodging": "Bullet hell", "First-person shooting": "FPS",
      "Action adventure & RPG": "Action RPG", "Sandbox survival combat": "Sandbox", "Racing": "Racing" };
    const patterns = [...new Set(D.games.map(g => g.pattern))];
    const chips = [["all", "All"], ["2D", "2D"], ["3D", "3D"], null, ...patterns.map(p => [p, short[p] || p])];
    filters.innerHTML = chips.map(c => c ? `<button type="button" class="chip${c[0] === "all" ? " is-on" : ""}" data-f="${esc(c[0])}" aria-pressed="${c[0] === "all"}">${esc(c[1])}</button>` : `<span class="filters__gap"></span>`).join("");
    function apply(f) {
      let n = 0;
      $$(".game-row", wall).forEach(r => {
        const show = f === "all" || r.dataset.dim === f || r.dataset.pattern === f;
        r.hidden = !show; if (show) n += 6;
      });
      count.textContent = `${n} / ${bosses.length} bosses`;
      $$(".chip", filters).forEach(c => { const a = c.dataset.f === f; c.classList.toggle("is-on", a); c.setAttribute("aria-pressed", a); });
    }
    filters.addEventListener("click", e => { const c = e.target.closest(".chip"); if (c) apply(c.dataset.f); });
    apply("all");
  })();

  /* ---------- playing happens on each game's own page (play/<boss>/index.html) ---------- */
  const playSrc = {};
  (window.GD_PLAYABLE || []).forEach(p => { playSrc[p.boss] = p.src; });
  function playBoss(id, tier) {
    const src = playSrc[id];
    if (src) location.href = `${src}?tier=${({ e: "easy", m: "normal", h: "hard" })[tier] || tier || "easy"}`;
  }

  /* ---------- the same fight, three models: GameDojo-4B next to the strongest GPT and Claude ---------- */
  // GD_SHOWCASE rows: {game, boss, dim, cond, ours, gpt, claude}; each side is {src, poster, win, verdict} or
  // {missing: "<why there is no clip>"}. An empty slot says why, and is never filled with a stand-in.
  (function vs() {
    const host = $("#vsRows"), rows = (window.GD_SHOWCASE || []);
    if (!host || !rows.length) { const s = $("#models"); if (s) s.hidden = true; return; }
    const captionLabel = label => `<span class="vs__who"><img class="model-icon" src="${modelIcon(label)}" alt="">${esc(label)}</span>`;
    const cell = (side, label, cls) => side && side.src
      ? `<figure class="vs__cell ${cls}${side.win ? " is-win" : ""}"><div class="vs__frame" data-src="${esc(side.src)}" data-poster="${esc(side.poster)}">`
        + `<img src="${esc(side.poster)}" alt="" loading="lazy"></div>`
        + `<figcaption>${captionLabel(label)}<b>${esc(side.verdict)}</b>`
        + (side.after ? `<span class="vs__after">${esc(side.after)}</span>` : "") + `</figcaption></figure>`
      : `<figure class="vs__cell ${cls} is-empty"><div class="vs__frame"><span class="vs__slot">${esc((side && side.missing) || "No recording")}</span></div>`
        + `<figcaption>${captionLabel(label)}<b>—</b></figcaption></figure>`;
    host.innerHTML = rows.map(r =>
      `<article class="vs__row">`
      + `<header class="vs__label"><span class="vs__game">${esc(r.game)} · ${esc(r.dim)}</span>`
      + `<h3>${esc(r.boss)}</h3><span class="vs__cond">${esc(r.cond)}</span></header>`
      + cell(r.ours, "GameDojo-4B", "vs__cell--a") + cell(r.gpt, "GPT-6.1-Sol", "vs__cell--b")
      + cell(r.claude, "Claude-Opus-5.5", "vs__cell--c")
      + `</article>`).join("");

    // every filled cell of a row plays together while the row is on screen. All clips of a row have the same
    // length (each is the same 60 s of game time), and they restart TOGETHER at the end of every loop, so a
    // clip that buffered a little later can never drift out of step with its neighbours.
    const groups = $$(".vs__row", host).map(row => {
      const vids = $$(".vs__frame[data-src]", row).map(f => {
        const v = newVideo(f.dataset.src);
        v.poster = f.dataset.poster;
        v.loop = false;
        f.appendChild(v);
        return v;
      });
      return { row, vids, on: false, done: 0 };
    });
    const restart = g => { g.done = 0; g.vids.forEach(v => { v.currentTime = 0; play(v); }); };
    groups.forEach(g => g.vids.forEach(v => v.addEventListener("ended", () => {
      if (!g.on) return;
      if (++g.done >= g.vids.length) restart(g);       // wait for the slowest clip, then all go again from 0
    })));
    const start = g => { if (g.on || saveData) return; g.on = true; restart(g); g.row.classList.add("is-playing"); };
    const stop = g => { if (!g.on) return; g.on = false; g.vids.forEach(v => v.pause()); g.row.classList.remove("is-playing"); };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        const g = groups.find(x => x.row === e.target);
        if (g) (e.isIntersecting ? start : stop)(g);
      }), { rootMargin: "120px 0px" });
      groups.forEach(g => io.observe(g.row));
    } else groups.forEach(start);
    document.addEventListener("visibilitychange", () => {
      groups.forEach(g => { if (g.on) g.vids.forEach(v => (document.hidden ? v.pause() : play(v))); });
    });
  })();

  /* ---------- the painted logo breathes: each character sways around its own footing ---------- */
  (function logo() {
    const host = $("#titleLogo"), L = window.GD_LOGO;
    if (!host || !L) return;
    const layers = L.layers.map(l => {
      const el = document.createElement("span");
      el.className = "title__layer";
      el.style.cssText = `left:${l.box[0]}%;top:${l.box[1]}%;width:${l.box[2]}%`;
      el.innerHTML = `<img src="assets/img/logo-${l.key}.webp" alt="" loading="lazy" decoding="async">`;
      host.appendChild(el);
      return Object.assign({ el }, l);
    });
    if (reduce) return;                            // the logo is already complete without the drift
    let raf = 0, visible = true;
    const tick = t => {
      raf = 0;
      if (!visible || document.hidden) return;
      const s = t / 1000, w = host.clientWidth / 1800;   // amplitudes are authored at 1800 px wide
      for (const l of layers) {
        const k = Math.sin((s / l.period + l.phase) * 6.2832);
        const rot = (l.rot * k).toFixed(3), rise = (-l.rise * w * (0.5 + 0.5 * Math.cos((s / l.period + l.phase) * 6.2832))).toFixed(2);
        l.el.style.transform = `translate3d(0,${rise}px,0) rotate(${rot}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { threshold: 0.05 }).observe(host);
    document.addEventListener("visibilitychange", kick);
    kick();
  })();

  /* ---------- fight card ---------- */
  const dlg = $("#fight"), fv = $("#fightVideo");
  let cur = null, curTier = "m", override = null;
  function renderFight() {
    $("#fightGame").textContent = `${cur.game.full} · ${cur.game.pattern} · ${cur.game.dim}`;
    $("#fightTitle").textContent = cur.name;
    $("#fightCount").textContent = `Boss ${cur.index + 1} / ${bosses.length}`;
    const max = Math.max(...cur.t);
    $("#fightTiers").innerHTML = TIERS.map(([k, name], i) =>
      `<button type="button" class="tier${k === curTier ? " is-on" : ""}" data-tier="${k}" aria-pressed="${k === curTier}"><span>${name}</span><span class="tier__bar"><i style="width:${Math.max(5, cur.t[i] / max * 100).toFixed(1)}%"></i></span><span class="tier__sec">${Math.round(cur.t[i])} s</span></button>`).join("");
    fv.poster = poster(cur);
    $("#fightPlay").hidden = coarse || !playIds.has(cur.id);
    fv.src = (override && override.tier === curTier && override.boss === cur) ? override.src : clip(cur, curTier);
    const p = fv.play(); if (p && p.catch) p.catch(() => {});
  }
  function openFight(b, opt) {
    cur = b; curTier = (opt && opt.tier) || "m";
    override = opt && opt.src ? { boss: b, tier: curTier, src: opt.src } : null;
    renderFight();
    if (!dlg.open) dlg.showModal();
    modalOpen = true;
    try { history.replaceState(null, "", "#boss/" + b.id); } catch (e) { /* file:// */ }
  }
  dlg.addEventListener("close", () => {
    modalOpen = false;
    fv.pause(); fv.removeAttribute("src"); fv.load();
    leaveZoom();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* file:// */ }
  });
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  $("#fightClose").addEventListener("click", () => dlg.close());
  $("#fightTiers").addEventListener("click", e => {
    const t = e.target.closest(".tier");
    if (t) { curTier = t.dataset.tier; renderFight(); $(`.tier[data-tier="${curTier}"]`, dlg).focus(); }
  });
  const stepBoss = d => openFight(bosses[(cur.index + d + bosses.length) % bosses.length], { tier: curTier });
  $("#fightPrev").addEventListener("click", () => stepBoss(-1));
  $("#fightPlay").addEventListener("click", () => {
    const id = cur.id, t = { e: "easy", m: "normal", h: "hard" }[curTier];
    dlg.close();
    playBoss(id, t);
  });
  $("#fightNext").addEventListener("click", () => stepBoss(1));
  dlg.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); stepBoss(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); stepBoss(1); }
    else if (e.key >= "1" && e.key <= "3") { curTier = TIERS[+e.key - 1][0]; renderFight(); }
  });
  function fromHash() {
    const m = location.hash.match(/^#boss\/([\w-]+)$/);
    if (m && byId[m[1]] && !dlg.open) openFight(byId[m[1]], { tier: "m" });
  }
  addEventListener("hashchange", fromHash);
  fromHash();

  /* ---------- charts ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const C = { paused: "#e7b14c", real: "#3fa7d6" };
  function svgEl(tag, attrs, text) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = text;
    return el;
  }
  const f1 = v => v.toFixed(1);
  const cell = c => (c ? `${f1(c[0])} / ${f1(c[1])}` : "–");
  function tipFor(box) {
    let tip = $(".tip", box);
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; box.appendChild(tip); }
    return {
      bind(hit, html) {
        hit.addEventListener("mousemove", e => {
          const r = box.getBoundingClientRect();
          tip.innerHTML = html;
          tip.style.left = Math.min(Math.max(e.clientX - r.left, 110), r.width - 110) + "px";
          tip.style.top = (e.clientY - r.top) + "px";
          tip.classList.add("is-on");
        });
        hit.addEventListener("mouseleave", () => tip.classList.remove("is-on"));
      }
    };
  }
  // one row = a label and two thin bars (time-paused over real-time) on a shared 0-100 % axis.
  // `metric` picks which half of each [win rate, progress] pair is drawn: 1 = progress, 0 = win rate.
  function barRow(svg, o) {
    const { y, left, plotW, name, cls, paused, real, dim, delay, metric, labelStart = 0 } = o;
    const icon = modelIcon(name);
    if (icon) {
      const size = name === "GameDojo-4B" ? 22 : 17;
      const inset = (17 - size) / 2;
      svg.appendChild(svgEl("image", { href: icon, x: labelStart + inset, y: y + 3 + inset, width: size, height: size, "aria-hidden": "true" }));
    }
    svg.appendChild(svgEl("text", { x: labelStart + 23, y: y + 15, class: "label " + (cls || "") }, name));
    [[paused, C.paused, 2, 0], [real, C.real, 13, 0.45]].forEach(([c, color, dy, d]) => {
      if (!c) return;
      const v = c[metric];
      const w = Math.max(1.5, v / 100 * plotW);
      const bar = svgEl("rect", { x: left, y: y + dy, width: w.toFixed(1), height: 9, rx: 2, fill: color, class: "bar" });
      if (dim) bar.setAttribute("opacity", 0.42);
      bar.style.transitionDelay = (d + delay).toFixed(2) + "s";
      svg.appendChild(bar);
      const val = svgEl("text", { x: (left + w + 6).toFixed(1), y: y + dy + 8.5, class: "val" }, f1(v));
      val.style.transitionDelay = (d + delay + 0.55).toFixed(2) + "s";
      svg.appendChild(val);
    });
  }
  const revealed = new WeakSet();
  function finish(box) {                              // bars grow in once, the first time the chart is seen
    if (revealed.has(box) || reduce) { box.classList.remove("is-pending"); return; }
    box.classList.add("is-pending");
  }

  let iface = "cua", metric = 1;
  function displayedResults(rows) {
    return rows.filter(row => !/^(GameScaling|Gamer)(-|$)/.test(row.name));
  }
  // GameDojo-4B is evaluated in Table 4 only, which uses the CUA interface; Table 3 and Table 4 agree on every
  // model they share in that column, so its Medium row is added to the CUA view and labelled as such elsewhere.
  function mediumRows() {
    const rows = displayedResults(R.medium).filter(r => r.name !== "Idle" && r.name !== "Random");
    const ours = (R.tiers || []).find(r => r.name === "GameDojo-4B");
    if (ours) rows.push({ name: "GameDojo-4B", group: ours.group, ours: true,
      paused: { cua: ours.paused.medium }, realtime: { cua: ours.realtime.medium } });
    return rows.filter(r => r.paused[iface]);
  }
  function renderMedium() {
    const box = $("#chartMedium");
    if (!box || !R) return;
    $$("svg", box).forEach(s => s.remove());
    const W = Math.max(300, Math.round(box.clientWidth)), narrow = W < 560;
    const rows = mediumRows();
    const script = rows.find(r => r.group === "Baselines");
    const models = rows.filter(r => r !== script).sort((a, b) => b.paused[iface][metric] - a.paused[iface][metric]
      || b.paused[iface][1] - a.paused[iface][1]);
    const random = R.medium.find(r => r.name === "Random");
    const left = narrow ? 154 : 196, right = narrow ? 44 : 70, top = 28, rowH = 30;
    const H = top + (models.length + 1) * rowH + 30, plotW = W - left - right;
    const x = v => left + v / 100 * plotW;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    [0, 25, 50, 75, 100].forEach(v => {
      svg.appendChild(svgEl("line", { x1: x(v), x2: x(v), y1: top - 6, y2: H - 28, class: "axis" }));
      svg.appendChild(svgEl("text", { x: x(v), y: H - 12, "text-anchor": "middle", class: "axis-label" }, v + "%"));
    });
    const tip = tipFor(box);
    [script, ...models].forEach((r, i) => {
      const y = top + i * rowH, ref = r === script;
      if (!ref && !narrow) svg.appendChild(svgEl("text", { x: 8, y: y + 15, class: "rank" }, String(i).padStart(2, "0")));
      barRow(svg, { y, left, plotW, labelStart: narrow ? 0 : 36, name: ref ? "Scripts (reference)" : r.name,
        cls: ref ? "label--muted" : (r.ours ? "label--ours" : ""),
        paused: r.paused[iface], real: r.realtime[iface], dim: ref, delay: i * 0.03, metric });
      const hit = svgEl("rect", { x: 0, y, width: W, height: rowH, class: "bar-hit" });
      svg.appendChild(hit);
      tip.bind(hit, `<b>${esc(r.name)}</b> · ${esc(r.group.replace(/s$/, ""))}<br>Time-paused &nbsp;WR ${f1(r.paused[iface][0])}% · PG ${f1(r.paused[iface][1])}%<br>Real-time &nbsp;&nbsp;&nbsp;WR ${f1(r.realtime[iface][0])}% · PG ${f1(r.realtime[iface][1])}%`);
    });
    const rnd = random.paused[iface][metric];
    svg.appendChild(svgEl("line", { x1: x(rnd), x2: x(rnd), y1: top - 6, y2: H - 28, class: "ref" }));
    svg.appendChild(svgEl("text", { x: x(rnd) + 5, y: top - 11, class: "ref-label" }, `Random ${f1(rnd)}%`));
    box.insertBefore(svg, box.firstChild);
    finish(box);
  }

  const TIER_ORDER = ["GameDojo-4B", "GPT-6.1-Sol", "GPT-6-Luna", "Qwen3.5-4B", "GameScaling-9B-S3", "Gamer-35B-A3B", "Random", "Boss-specific script"];
  function renderTiers() {
    const box = $("#chartTiers");
    if (!box || !R) return;
    $$(".chart__panel", box).forEach(s => s.remove());
    const full = Math.round(box.clientWidth), stacked = full < 720;
    box.classList.toggle("is-stacked", stacked);
    const W = Math.max(280, stacked ? full : Math.floor((full - 44) / 3));
    const available = displayedResults(R.tiers);
    const rows = TIER_ORDER.map(n => available.find(r => r.name === n)).filter(Boolean);
    const tip = tipFor(box);
    ["easy", "medium", "hard"].forEach((k, ti) => {
      const panel = document.createElement("div");
      panel.className = "chart__panel";
      const left = 154, right = 40, top = 30, rowH = 30;
      const H = top + rows.length * rowH + 28, plotW = W - left - right;
      const x = v => left + v / 100 * plotW;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
      svg.appendChild(svgEl("text", { x: left, y: 14, class: "group-title" }, k[0].toUpperCase() + k.slice(1)));
      [0, 50, 100].forEach(v => {
        svg.appendChild(svgEl("line", { x1: x(v), x2: x(v), y1: top - 4, y2: H - 26, class: "axis" }));
        svg.appendChild(svgEl("text", { x: x(v), y: H - 10, "text-anchor": "middle", class: "axis-label" }, v + "%"));
      });
      rows.forEach((r, i) => {
        const y = top + i * rowH, ref = r.group === "Baselines";
        const name = r.name === "Boss-specific script" ? "Scripts (ref.)" : r.name;
        barRow(svg, { y, left, plotW, name, cls: ref ? "label--muted" : (r.name === "GameDojo-4B" ? "label--ours" : ""),
          paused: r.paused[k], real: r.realtime[k], dim: ref, delay: ti * 0.12 + i * 0.03, short: true });
        const hit = svgEl("rect", { x: 0, y, width: W, height: rowH, class: "bar-hit" });
        svg.appendChild(hit);
        tip.bind(hit, `<b>${esc(r.name)}</b> · ${k[0].toUpperCase() + k.slice(1)}<br>Time-paused &nbsp;WR ${f1(r.paused[k][0])}% · PG ${f1(r.paused[k][1])}%<br>Real-time &nbsp;&nbsp;&nbsp;WR ${f1(r.realtime[k][0])}% · PG ${f1(r.realtime[k][1])}%`);
      });
      panel.appendChild(svg);
      box.insertBefore(panel, $(".tip", box));
    });
    finish(box);
  }

  function table(rows, cols, labels, groupsTitle) {
    const head = `<tr><th></th><th colspan="${cols.length}" class="split">${groupsTitle[0]}</th><th colspan="${cols.length}" class="split">${groupsTitle[1]}</th></tr>`
      + `<tr><th>Model</th>${["paused", "realtime"].map(() => cols.map((c, i) => `<th${i ? "" : ' class="split"'}>${labels[i]}</th>`).join("")).join("")}</tr>`;
    let body = "", g = "";
    displayedResults(rows).forEach(r => {
      if (r.group !== g) { g = r.group; body += `<tr class="grp"><td colspan="${cols.length * 2 + 1}">${esc(g)}</td></tr>`; }
      body += `<tr${r.name === "GameDojo-4B" ? ' class="ours"' : ""}><td>${esc(r.name)}</td>`
        + ["paused", "realtime"].map(m => cols.map((c, i) => `<td${i ? "" : ' class="split"'}>${cell(r[m][c])}</td>`).join("")).join("") + "</tr>";
    });
    return `<table class="ptable"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }
  // the tier table and chart only exist when the page carries that section
  if (R && $("#tableMedium")) {
    $("#tableMedium").innerHTML = table(R.medium, ["semantic", "cua", "average"], ["Semantic", "CUA", "Average"], ["Time-paused · WR / PG", "Real-time · WR / PG"]);
  }
  if (R && $("#tableTiers")) {
    $("#tableTiers").innerHTML = table(R.tiers, ["easy", "medium", "hard", "average"], ["Easy", "Medium", "Hard", "Average"], ["Time-paused · WR / PG", "Real-time · WR / PG"]);
  }
  if ($("#segInterface")) $("#segInterface").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    iface = b.dataset.v;
    $$("#segInterface button").forEach(x => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", x === b); });
    renderMedium();
  });
  // bottom-right switch: draw progress (PG) or win rate (WR) - one number per bar, never both
  if ($("#segMetric")) $("#segMetric").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    metric = b.dataset.m === "wr" ? 0 : 1;
    $$("#segMetric button").forEach(x => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", x === b); });
    renderMedium();
  });
  renderMedium(); renderTiers();
  let rw = innerWidth, rt = 0;
  addEventListener("resize", () => {
    if (Math.abs(innerWidth - rw) < 8) return;
    rw = innerWidth; clearTimeout(rt);
    rt = setTimeout(() => { renderMedium(); renderTiers(); }, 160);
  });

  /* ---------- reveal on scroll, count-up, bibtex ---------- */
  $$(".figure, .chart-card, .callouts, .facts, .duo, .featured, .triptych, .bibtex").forEach(el => el.classList.add("reveal"));
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-in");
    $$(".chart", e.target).forEach(c => { revealed.add(c); requestAnimationFrame(() => c.classList.remove("is-pending")); });
    $$(".num[data-count]", e.target).forEach(countUp);
    io.unobserve(e.target);
  }), { threshold: 0.18 });
  $$(".reveal").forEach(el => io.observe(el));
  function countUp(el) {
    const target = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length;
    if (reduce || !(target > 0)) { el.textContent = target.toFixed(dec); return; }
    const t0 = performance.now(), dur = 1100;
    (function f(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }
  const copyBtn = $("#copyBib");
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#bibtex").textContent); copyBtn.textContent = "Copied"; }
    catch (e) { copyBtn.textContent = "Select and copy"; }
    setTimeout(() => (copyBtn.textContent = "Copy"), 1800);
  });
  // links that still need a destination before publishing
  $$("a[data-todo]").forEach(a => a.addEventListener("click", e => {
    if (a.getAttribute("href") === "#") { e.preventDefault(); a.title = "Available after review"; }
  }));
})();
