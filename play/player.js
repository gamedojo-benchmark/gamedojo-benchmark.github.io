/* GameDojo playable encounter: shell shared by every play/<boss>/ page (hand-written).
   The page sets window.GD_PLAY = {id, engine: "bb" | "native", case, label, module?} and loads game.min.js first.
   Talks to the host page with postMessage:
     out: {source: "gd-play", id, type: "ready" | "start" | "pause" | "result", tier, outcome?, progress?, seconds?}
     in:  {source: "gd-host", cmd: "pause"} | {source: "gd-host", cmd: "tier", tier: "easy" | "normal" | "hard"} */
(function () {
  "use strict";
  var P = window.GD_PLAY, doc = document;
  var canvas = doc.getElementById("view"), veil = doc.getElementById("veil");
  var veilTitle = doc.getElementById("veilTitle"), veilSub = doc.getElementById("veilSub");
  var TIERS = ["easy", "normal", "hard"], TIER_NAME = { easy: "Easy", normal: "Medium", hard: "Hard" };
  var q = new URLSearchParams(location.search);
  var tier = TIERS.indexOf(q.get("tier")) >= 0 ? q.get("tier") : "easy";     // first try on Easy
  var mode = "ready";                               // ready | play | paused | result
  var lastResult = null;

  function post(type, extra) {
    var msg = { source: "gd-play", id: P.id, type: type, tier: tier };
    for (var k in extra || {}) msg[k] = extra[k];
    try { window.parent.postMessage(msg, location.origin); } catch (e) { /* opened directly from disk */ }
  }

  /* ---------- engine adapters: reset(seed), enable(bool), step(dt) -> draws, result() ---------- */
  function sharedEngine() {                         // 2D games on the shared engine (window.BB)
    var BB = window.BB, R = new BB.Renderer(canvas), input = new BB.Input(window);
    var PKT = BB.SUBSTEPS * BB.TICKS_PER_SUB, c = null, g = null;
    input.bindMouse(canvas); input.enabled = false;
    return {
      tiers: BB.GAME.tiers, pointerLock: false,
      reset: function (seed) {
        c = new BB.Case(P.case);
        c.reset(seed, BB.GAME.tiers[tier], typeof BB.GAME.resetOptions === "function" ? BB.GAME.resetOptions() : {});
        R.juice.reset(); input.clear();
        g = { acc: 0, hold: 0, keys: {}, mouse: [0, 0, 0], packetMouse: [0, 0, 0] };
        R.draw(c, 0, "");
      },
      enable: function (v) { input.clear(); input.enabled = v; },
      // fixed 60 Hz ticks; keys are sampled every 33 ms sub-step and the aim once per 200 ms, exactly like an agent's action
      step: function (dt) {
        if (g.hold > 0) g.hold -= dt;
        else {
          g.acc += dt;
          while (g.acc >= BB.DT && !c.result) {
            if (typeof c.body.mouse === "function" && c.t % PKT === 0) {
              g.packetMouse = [0, 0, 0];
              if (input.pointer && typeof c.body.pointerDelta === "function") g.packetMouse = c.body.pointerDelta(input.pointer, BB.VIEW);
              g.mouse = g.packetMouse.map(function (v) { return v / PKT; });
            }
            if (c.t % BB.TICKS_PER_SUB === 0) g.keys = input.sample();
            c.tick(g.keys, g.mouse); g.acc -= BB.DT;
          }
        }
        R.draw(c, c.t / BB.FPS, "");
        var hs = R.juice.takeHitstop();
        if (hs > 0) { g.hold = Math.max(g.hold, hs); g.acc = 0; }
      },
      result: function () {
        if (!c.result) return null;
        var v = c.verifier();
        return { outcome: v.outcome, progress: v.boss_damage, seconds: v.seconds };
      }
    };
  }

  function nativeEngine() {                         // games that own their simulation and renderer (window.NativeBench)
    var N = window.NativeBench, M = window[P.module], ctx = canvas.getContext("2d");
    var codeMap = { KeyW: "W", KeyA: "A", KeyS: "S", KeyD: "D", Space: "Space", ShiftLeft: "Shift", ShiftRight: "Shift",
      KeyJ: "J", KeyK: "K", KeyL: "L", KeyQ: "Q", KeyE: "E", KeyR: "R", ArrowUp: "W", ArrowDown: "S", ArrowLeft: "A", ArrowRight: "D" };
    for (var k in M.codeMap || {}) codeMap[k] = M.codeMap[k];
    // a key tapped between two ticks stays held until one tick has seen it
    var held = new Set(), pending = new Set(), releaseAfterTick = new Set();
    var session = null, acc = 0, mouse = [0, 0, 0], enabled = false;
    function press(key) { held.add(key); pending.add(key); releaseAfterTick.delete(key); }
    function release(key) { if (pending.has(key)) releaseAfterTick.add(key); else held.delete(key); }
    function clearKeys() { held.clear(); pending.clear(); releaseAfterTick.clear(); }
    window.addEventListener("keydown", function (e) { var key = codeMap[e.code]; if (enabled && key) { e.preventDefault(); if (!e.repeat) press(key); } });
    window.addEventListener("keyup", function (e) { var key = codeMap[e.code]; if (key) release(key); });
    canvas.addEventListener("pointerdown", function (e) { if (enabled) press(e.button === 2 ? "RMB" : "LMB"); });
    window.addEventListener("pointerup", function () { release("LMB"); release("RMB"); });
    canvas.addEventListener("pointermove", function (e) {
      if (enabled && (doc.pointerLockElement === canvas || e.buttons)) { mouse[0] += e.movementX; mouse[1] += e.movementY; }
    });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    return {
      tiers: M.tiers, pointerLock: M.dimension === "3d" && M.pointerLock !== false,
      reset: function (seed) {
        session = new N.Session(M, P.case, seed, M.tiers[tier]);
        session.recording = false;                  // nothing is recorded or sent anywhere
        acc = 0; mouse = [0, 0, 0]; clearKeys();
        M.draw(session.game, ctx);
      },
      enable: function (v) { enabled = v; clearKeys(); mouse = [0, 0, 0]; },
      step: function (dt) {
        var tick = 1 / M.hz;
        acc += dt;
        while (acc >= tick && !session.game.outcome) {
          acc -= tick;
          var keys = Array.from(held).filter(function (key) { return N.keys.indexOf(key) >= 0; }).slice(0, 4);
          session.tick(keys, mouse.map(function (v, i) { return N.clamp(v, i === 2 ? -5 : -1000, i === 2 ? 5 : 1000); }));
          mouse = [0, 0, 0]; pending.clear();
          releaseAfterTick.forEach(function (key) { held.delete(key); }); releaseAfterTick.clear();
        }
        M.draw(session.game, ctx);
      },
      result: function () {
        var game = session.game;
        if (!game.outcome) return null;
        var h = game.health();                      // [player hp, player max, boss hp, boss max]
        return { outcome: game.outcome, progress: h[3] > 0 ? Math.max(0, 1 - h[2] / h[3]) : 0, seconds: game.t / M.hz };
      }
    };
  }

  var A = P.engine === "bb" ? sharedEngine() : nativeEngine();
  var seed = Math.floor(Math.random() * 1e6), last = performance.now();

  /* ---------- states ---------- */
  function show() {
    doc.body.dataset.mode = mode;
    if (mode === "ready") { veilTitle.textContent = "Click to play"; veilSub.textContent = TIER_NAME[tier] + " · Esc pauses"; }
    else if (mode === "paused") { veilTitle.textContent = "Paused"; veilSub.textContent = "Click to resume"; }
    else if (mode === "result") {
      veilTitle.textContent = { win: "Boss defeated", loss: "You were defeated", timeout: "Time is up" }[lastResult.outcome] || "Finished";
      veilSub.textContent = Math.round(lastResult.progress * 100) + "% of the boss's health removed in " + lastResult.seconds.toFixed(1) + " s · click or press R to play again";
    }
  }
  function lockPointer() {
    if (!A.pointerLock || !canvas.requestPointerLock) return;
    try { var p = canvas.requestPointerLock(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* needs a user gesture */ }
  }
  function unlockPointer() { if (doc.pointerLockElement && doc.exitPointerLock) doc.exitPointerLock(); }
  function ready() { mode = "ready"; lastResult = null; A.enable(false); A.reset(seed); show(); }
  function start() {
    if (mode === "play") return;
    if (mode !== "paused") { seed += 1; A.reset(seed); }
    mode = "play"; A.enable(true); show();
    canvas.focus(); lockPointer(); last = performance.now();
    post("start");
  }
  function pause() {
    if (mode !== "play") return;
    mode = "paused"; A.enable(false); show(); unlockPointer();
    post("pause");
  }
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (mode === "play") {
      A.step(dt);
      var r = A.result();
      if (r) { lastResult = r; mode = "result"; A.enable(false); show(); unlockPointer(); post("result", r); }
    }
    requestAnimationFrame(frame);
  }

  veil.addEventListener("click", start);
  window.addEventListener("keydown", function (e) {
    if (e.code === "Escape" && mode === "play") { e.preventDefault(); pause(); }
    else if (e.code === "KeyR" && mode === "result") { e.preventDefault(); start(); }
  });
  doc.addEventListener("pointerlockchange", function () { if (A.pointerLock && !doc.pointerLockElement && mode === "play") pause(); });
  window.addEventListener("blur", pause);
  doc.addEventListener("visibilitychange", function () { if (doc.hidden) pause(); });
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (e.origin !== location.origin || !m || m.source !== "gd-host") return;
    if (m.cmd === "pause") pause();
    else if (m.cmd === "tier" && TIERS.indexOf(m.tier) >= 0) { tier = m.tier; unlockPointer(); ready(); }
  });

  // standalone page: an Easy / Medium / Hard switch in the top bar (the iframe host sent "tier" messages instead)
  var tierBox = doc.getElementById("tiers");
  if (tierBox) {
    tierBox.innerHTML = TIERS.map(function (t) {
      return '<button type="button" data-t="' + t + '"' + (t === tier ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"') + ">" + TIER_NAME[t] + "</button>";
    }).join("");
    tierBox.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || b.dataset.t === tier) return;
      tier = b.dataset.t;
      Array.prototype.forEach.call(tierBox.children, function (x) { var on = x.dataset.t === tier; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on); });
      unlockPointer(); ready(); b.blur();
    });
  }

  ready();
  post("ready");
  requestAnimationFrame(frame);
})();
