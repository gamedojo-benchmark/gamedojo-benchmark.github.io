/* GameDojo opening sequence.

   A six-second cold open played on a canvas over the hero, before the arena appears:
     0.0  black, a single light opening in the middle
     0.4  six hard cuts through boss fights from the original games, each on the beat with a white flash
     3.6  the camera pulls back hard; the portals of the arena light up one by one
     5.2  the painted logo lands and the page takes over

   The cut-in frames are official store screenshots of the reference titles (assets/opening/), shown full screen
   with a slow push-in; the arena and logo are the page's own art. 2D canvas only: no video, no library.

   Skipped with ?still, on a saved-data connection, and after the first
   visit in a session. Any click, key or scroll ends it at once.  */
(function (g) {
  "use strict";
  const doc = g.document;
  const el = {
    root: doc.getElementById("opening"),
    canvas: doc.getElementById("openingCanvas"),
    skip: doc.getElementById("openingSkip"),
  };
  if (!el.root || !el.canvas) return;

  // Plays whatever the OS reduce-motion setting says (it is the page's introduction; any click skips it).
  // ?still skips it; ?intro replays it on this visit.
  const reduce = /[?&]still\b/.test(location.search);
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  // ?intro replays it on this visit; ?intro=force also overrides the reduced-motion preference (for review)
  const introParam = /[?&]intro(=([^&]*))?/.exec(location.search);
  const force = !!introParam;
  const override = !!introParam && introParam[2] === "force";
  let seen = false;
  try { seen = sessionStorage.getItem("gd-opening") === "1"; } catch (e) { /* private mode */ }

  function finish(immediate) {
    if (el.root.dataset.state === "done") return;
    el.root.dataset.state = "done";
    try { sessionStorage.setItem("gd-opening", "1"); } catch (e) { /* ignore */ }
    doc.documentElement.classList.remove("opening-on");
    doc.documentElement.classList.remove("intro");          // the hero's own entrance plays instead
    g.removeEventListener("keydown", onSkip, true);
    g.removeEventListener("pointerdown", onSkip, true);
    g.removeEventListener("wheel", onSkip, true);
    if (immediate) el.root.remove();
    else setTimeout(() => el.root.remove(), 700);
    g.dispatchEvent(new CustomEvent("gd:opening-done"));
  }
  function onSkip() { finish(false); }

  if ((reduce && !override) || saveData || (seen && !force)) { finish(true); return; }

  doc.documentElement.classList.add("opening-on");
  el.root.dataset.state = "playing";
  el.skip.addEventListener("click", onSkip);
  g.addEventListener("keydown", onSkip, true);
  g.addEventListener("pointerdown", onSkip, true);
  g.addEventListener("wheel", onSkip, true, { passive: true });

  /* ---------- art ---------- */
  let t0 = 0;                                         // set when the sequence starts; read by the load handlers
  const art = {};
  let ready = 0;
  // boss fights from the original games, in cut order (official store screenshots)
  const CUTS = ["sekiro-1", "cuphead-1", "hollow-knight-2", "quake-2-2", "terraria-1", "sekiro-2"];
  const SOURCES = { arena: "assets/img/arena.webp", logo: "assets/img/logo.webp" };
  CUTS.forEach(k => { SOURCES[k] = `assets/opening/${k}.jpg`; });
  const total = Object.keys(SOURCES).length;
  for (const key in SOURCES) {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { if (++ready === total) start(); };
    img.src = SOURCES[key];
    art[key] = img;
  }
  // never wait on a slow connection for longer than this: the sequence starts with whatever has arrived
  setTimeout(() => { if (!t0) start(); }, 1600);

  const ctx = el.canvas.getContext("2d", { alpha: false });
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(g.devicePixelRatio || 1, 2.5);
    W = el.root.clientWidth; H = el.root.clientHeight;
    el.canvas.width = Math.round(W * dpr); el.canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";            // a resize resets the context state
  }
  addEventListener("resize", resize);

  /* ---------- timeline ---------- */
  const T = { dark: 0.0, cuts: 0.4, pull: 3.6, land: 5.15, end: 6.0 };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const span = (t, a, b) => clamp01((t - a) / (b - a));

  // The arena is 3:1 and a screen is about 16:9, so filling by height blew it up ~5x and softened it.
  // Fit by width, the way the page itself shows the arena: on most screens that is a downscale.
  function wide(img, cx, cy, scale, alpha) {
    if (!img.naturalWidth) return;
    const w = W * scale, h = w * img.naturalHeight / img.naturalWidth;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
    ctx.globalAlpha = 1;
  }
  function cover(img, cx, cy, scale, alpha) {
    if (!img.naturalWidth) return;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * scale;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.globalAlpha = 1;
  }

  // 0.0 - 0.4 s: black, with a thin horizontal light opening across the middle
  function drawDark(t) {
    const k = span(t, T.dark, T.cuts);
    ctx.fillStyle = "#06070c";
    ctx.fillRect(0, 0, W, H);
    const w = W * easeOut(k), h = 2 + 3 * k;
    const grad = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    grad.addColorStop(0, "rgba(255,236,190,0)");
    grad.addColorStop(0.5, `rgba(255,236,190,${0.9 * k})`);
    grad.addColorStop(1, "rgba(255,236,190,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
  }

  // 0.4 - 3.6 s: hard cuts through six boss fights, a white flash on each beat and a slow push-in
  function drawCuts(t) {
    const k = span(t, T.cuts, T.pull);
    const n = CUTS.length;
    const beat = Math.min(n - 1, Math.floor(k * n));
    const local = k * n - beat;                        // 0..1 inside this cut
    const img = art[CUTS[beat]];
    ctx.fillStyle = "#06070c";
    ctx.fillRect(0, 0, W, H);
    // alternate the drift direction so consecutive cuts never move the same way
    const dir = beat % 2 ? -1 : 1;
    const shake = (1 - easeOut(local)) * 10;
    ctx.save();
    ctx.translate(Math.sin(t * 90) * shake, Math.cos(t * 77) * shake * 0.6);
    cover(img, W / 2 + dir * W * 0.015 * local, H / 2, 1.06 + 0.05 * local, 1);
    ctx.restore();
    // a soft vignette keeps the eye in the middle
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(6,7,12,0)");
    vg.addColorStop(1, "rgba(6,7,12,0.7)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // impact flash on the beat, then a quick darkening into the next cut
    ctx.fillStyle = `rgba(255,236,190,${0.5 * Math.pow(1 - local, 6)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(6,7,12,${0.35 * easeIn(local)})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPull(t) {
    const k = span(t, T.pull, T.end);
    const out = easeOut(k);
    ctx.fillStyle = "#06070c";
    ctx.fillRect(0, 0, W, H);
    // from a hard push-in all the way out to the full arena
    const scale = 2.6 - 1.6 * out;                // ends at 1.0 = full width, exactly as the hero shows it
    wide(art.arena, W / 2, H * (0.60 - 0.02 * out), scale, Math.min(1, 0.5 + out * 1.4));
    // portals catching light left to right as the camera settles
    const lit = span(t, T.pull + 0.25, T.land);
    if (art.arena.naturalWidth && lit > 0) {
      const aw = W * scale, ah = aw * art.arena.naturalHeight / art.arena.naturalWidth;
      const ax = W / 2 - aw / 2, ay = H * (0.60 - 0.02 * out) - ah / 2;
      const portals = (g.GD_DATA && g.GD_DATA.portals) || [];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      portals.forEach((p, i) => {
        const at = clamp01((lit - (i / portals.length) * 0.75) * 4);
        if (at <= 0) return;
        const cx = ax + (p.center[0] / 2172) * aw, cy = ay + (p.center[1] / 724) * ah;
        const r = (p.bbox[2] - p.bbox[0]) / 2172 * aw * 0.95;
        const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
        const a = 0.5 * at * (1 - 0.45 * span(t, T.land, T.end));
        grad.addColorStop(0, `rgba(255,226,160,${a})`);
        grad.addColorStop(0.55, `rgba(231,177,76,${a * 0.35})`);
        grad.addColorStop(1, "rgba(231,177,76,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fill();
      });
      ctx.restore();
    }
    // the logo drops into place
    const lg = span(t, T.land - 0.35, T.end - 0.1);
    if (lg > 0 && art.logo.naturalWidth) {
      const e = easeOut(lg);
      const lw = Math.min(W * 0.52, 760) * (1.12 - 0.12 * e);
      const lh = lw * art.logo.naturalHeight / art.logo.naturalWidth;
      ctx.globalAlpha = Math.min(1, lg * 2.4);
      ctx.drawImage(art.logo, W / 2 - lw / 2, H * (0.34 - 0.05 * (1 - e)) - lh / 2, lw, lh);
      ctx.globalAlpha = 1;
    }
    // hand over to the page
    const fade = span(t, T.end - 0.45, T.end);
    if (fade > 0) {
      ctx.fillStyle = `rgba(10,12,20,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    if (el.root.dataset.state === "done") return;
    const t = (now - t0) / 1000;
    if (t >= T.end) { finish(false); return; }
    if (t < T.cuts) drawDark(t);
    else if (t < T.pull) drawCuts(t);
    else drawPull(t);
    requestAnimationFrame(frame);
  }

  function start() {
    if (t0) return;                                   // the image loads and the fallback timer can both call this
    resize();
    t0 = performance.now();
    requestAnimationFrame(frame);
  }

  // never leave the page hidden if something goes wrong
  setTimeout(() => finish(false), (T.end + 2.5) * 1000);
})(window);
