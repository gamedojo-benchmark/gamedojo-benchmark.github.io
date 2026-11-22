/* GameDojo opening. Six cuts give way to the live logo and arena. */
(function (g) {
  "use strict";
  const doc = g.document;
  const root = doc.documentElement;
  const opening = doc.getElementById("opening");
  const canvas = doc.getElementById("openingCanvas");
  const skip = doc.getElementById("openingSkip");
  if (!opening || !canvas || !skip) return;

  const ctx = canvas.getContext("2d");
  const still = /[?&]still\b/.test(location.search);
  const force = /(?:^|[?&])intro=force(?:&|$)/.test(location.search);
  const saveData = navigator.connection?.saveData;
  const T = { cuts: 0.42, land: 3.56, impact: 4.58, end: 6 };
  const CUTS = ["sekiro-1", "cuphead-1", "hollow-knight-2", "quake-2-2", "terraria-1", "sekiro-2"];
  const angles = [0.54, -0.58, 0.96, -0.38, 0.38, -0.83];
  const gold = "255,177,73";
  const teal = "78,235,221";
  let width = 0;
  let height = 0;
  let startTime;
  let loadTimer;
  let finishTimer;
  let originalScroll = 0;

  function finish(immediate) {
    if (opening.dataset.state === "done") return;
    const restoreFocus = opening.contains(doc.activeElement);
    opening.dataset.state = "done";
    root.classList.remove("opening-on", "opening-landing", "intro");
    root.style.removeProperty("--opening-landing-duration");
    clearTimeout(loadTimer);
    clearTimeout(finishTimer);
    g.removeEventListener("resize", resize);
    g.removeEventListener("keydown", onSkip, true);
    g.removeEventListener("pointerdown", onSkip, true);
    g.removeEventListener("wheel", onSkip, true);
    if (originalScroll) g.scrollTo({ top: originalScroll, behavior: "instant" });
    if (restoreFocus) doc.querySelector(".nav [data-sound-toggle]:not([hidden])")?.focus({ preventScroll: true });
    if (immediate) opening.remove();
    else setTimeout(() => opening.remove(), 450);
    g.dispatchEvent(new CustomEvent("gd:opening-done"));
  }

  function onSkip(event) {
    const soundControl = event.target?.closest?.("[data-sound-toggle]");
    if (event.type === "pointerdown" && soundControl) return;
    if (event.type === "keydown" &&
        (event.key === "Tab" || (soundControl && (event.key === " " || event.key === "Enter")))) return;
    finish(false);
  }

  if ((still && !force) || saveData || !ctx) { finish(true); return; }

  root.classList.add("opening-on");
  opening.dataset.state = "playing";
  skip.addEventListener("click", onSkip);
  g.addEventListener("keydown", onSkip, true);
  g.addEventListener("pointerdown", onSkip, true);
  g.addEventListener("wheel", onSkip, { capture: true, passive: true });

  function resize() {
    const dpr = Math.min(g.devicePixelRatio || 1, 2);
    width = opening.clientWidth;
    height = opening.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
  }

  const clamp = t => Math.max(0, Math.min(1, t));
  const span = (t, from, to) => clamp((t - from) / (to - from));
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function backdrop() {
    ctx.fillStyle = "#06070c";
    ctx.fillRect(0, 0, width, height);
  }

  function cover(img, x, y, zoom) {
    if (!img.naturalWidth) return;
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight) * zoom;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }

  function slash(life, angle, color, x, y, size = 1) {
    if (life <= 0 || life >= 1) return;
    const length = Math.hypot(width, height) * size;
    const spread = Math.min(26, Math.max(11, length * 0.024));
    const tail = -length * 0.54;
    const tip = tail + length * easeOut(clamp(life * 3.4));
    const glow = (1 - life) ** 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";

    const trail = ctx.createLinearGradient(tail, 0, tip, 0);
    trail.addColorStop(0, `rgba(${color},0)`);
    trail.addColorStop(0.48, `rgba(${color},${0.85 * glow})`);
    trail.addColorStop(0.88, `rgba(255,244,215,${0.94 * glow})`);
    trail.addColorStop(1, `rgba(${color},0)`);
    ctx.beginPath();
    ctx.moveTo(tail, spread * 0.28);
    ctx.quadraticCurveTo((tail + tip) / 2, -spread * (1 + life), tip, 0);
    ctx.quadraticCurveTo((tail + tip) / 2, spread * 0.6, tail, spread * 0.28);
    ctx.fillStyle = trail;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tail, spread * 0.28);
    ctx.quadraticCurveTo((tail + tip) / 2, -spread * 0.5, tip, 0);
    ctx.strokeStyle = trail;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.strokeStyle = `rgba(${color},${glow * 0.92})`;
    for (let i = 0; i < 24; i++) {
      const dx = ((i * 37) % 101) / 100;
      const dy = (((i * 29) % 103) / 51 - 1) * (11 + life * 110);
      const sx = tail + (tip - tail) * (0.22 + dx * 0.69) - life * length * dx * 0.14;
      const streak = (3 + 19 * dx) * (1 - life);
      ctx.lineWidth = i % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(sx, dy);
      ctx.lineTo(sx + streak, dy * 0.87);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOpening(t) {
    backdrop();
    slash(span(t, 0, T.cuts + 0.18), -0.1, gold, width / 2, height / 2, 0.85);
  }

  function drawCut(t) {
    const beat = span(t, T.cuts, T.land) * CUTS.length;
    const index = Math.min(CUTS.length - 1, Math.floor(beat));
    const progress = beat - index;
    const direction = index % 2 === 0 ? 1 : -1;
    const shake = (1 - easeOut(progress)) * 12;

    backdrop();
    ctx.save();
    ctx.translate(Math.sin(t * 96) * shake, Math.cos(t * 81) * shake * 0.6);
    cover(art[index], width / 2 + direction * width * 0.018 * progress, height / 2, 1.06 + 0.055 * progress);
    ctx.restore();

    const radius = Math.max(width, height);
    const vignette = ctx.createRadialGradient(width / 2, height / 2, radius * 0.12, width / 2, height / 2, radius * 0.68);
    vignette.addColorStop(0, "rgba(6,7,12,0.2)");
    vignette.addColorStop(1, "rgba(6,7,12,0.88)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    const color = direction > 0 ? gold : teal;
    slash(progress * 1.75, angles[index], color, width * 0.5, height * 0.49);
    slash((progress - 0.16) * 2.05, angles[index] - direction * 0.23, color, width * 0.53, height * 0.53, 0.72);
  }

  function drawLanding(t) {
    if (opening.dataset.state !== "landing") {
      originalScroll = g.scrollY;
      if (originalScroll) g.scrollTo({ top: 0, behavior: "instant" });
      opening.dataset.state = "landing";
      root.style.setProperty("--opening-landing-duration", `${(T.end - T.land) * 1000}ms`);
      root.classList.remove("intro");
      root.classList.add("opening-landing");
    }

    ctx.clearRect(0, 0, width, height);
    const veil = 1 - easeOut(span(t, T.land, T.land + 0.78));
    ctx.fillStyle = `rgba(6,7,12,${veil})`;
    ctx.fillRect(0, 0, width, height);
    slash(span(t, T.land, T.land + 0.57), 0.37, gold, width / 2, height / 2);
    slash(span(t, T.land + 0.10, T.land + 0.65), -0.47, teal, width / 2, height / 2);

    const hit = span(t, T.impact, T.impact + 0.48);
    if (hit > 0 && hit < 1) {
      const radius = Math.min(width, height) * (0.047 + easeOut(hit) * 0.28);
      ctx.beginPath();
      ctx.ellipse(width / 2, height * 0.65, radius, radius * 0.23, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${gold},${0.58 * (1 - hit) ** 2})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      slash(hit, -0.13, gold, width / 2, height * 0.66, 0.58);
    }
  }

  function frame(now) {
    if (opening.dataset.state === "done") return;
    const t = (now - startTime) / 1000;
    if (t >= T.end) { finish(false); return; }
    if (t < T.cuts) drawOpening(t);
    else if (t < T.land) drawCut(t);
    else drawLanding(t);
    g.requestAnimationFrame(frame);
  }

  function start() {
    if (startTime !== undefined || opening.dataset.state !== "playing") return;
    resize();
    startTime = performance.now();
    g.dispatchEvent(new CustomEvent("gd:opening-start", { detail: { start: startTime } }));
    g.requestAnimationFrame(frame);
  }

  let remaining = CUTS.length;
  const art = CUTS.map(key => {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { if (--remaining === 0) start(); };
    img.src = `assets/opening/${key}.jpg`;
    return img;
  });
  g.addEventListener("resize", resize);

  // A slow image can miss a cut, but it cannot leave the homepage covered.
  loadTimer = setTimeout(start, 1250);
  finishTimer = setTimeout(() => finish(false), (T.end + 2) * 1000);
})(window);
