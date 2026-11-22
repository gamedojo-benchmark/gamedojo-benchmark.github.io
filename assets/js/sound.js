/* Audio shared by the intro and the home page. */
(function () {
  "use strict";
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const buttons = document.querySelectorAll("[data-sound-toggle]");
  if (!AudioEngine || !buttons.length) return;

  const preference = "gd-sound";
  const tracks = {
    intro: { url: "assets/audio/opening.m4a?v=2", gain: 0.66, fade: 0.08 },
    ambient: { url: "assets/audio/arena.m4a?v=2", gain: 0.34, fade: 0.95 },
  };
  const buffers = new Map();
  let context, current, scene;
  let introStart = 0;
  let ambientOffset = 0;
  let request = 0;
  let enabled = true;
  let triedOnClick = false;
  try { enabled = localStorage.getItem(preference) !== "off"; } catch { /* storage may be disabled */ }

  function musicPlaying() {
    return enabled && context?.state === "running" && current?.name === "ambient";
  }

  function drawButtons() {
    buttons.forEach(button => {
      const disc = button.id === "musicDisc";
      const active = disc ? musicPlaying() : enabled;
      const action = active ? "Mute" : disc ? "Play" : "Unmute";
      button.classList.toggle(disc ? "is-playing" : "is-enabled", active);
      button.setAttribute("aria-label", `${action} ${disc ? "background music" : "sound"}`);
      const label = button.querySelector("[data-sound-label]") || button;
      label.textContent = action;
    });
  }

  function load(name) {
    if (!buffers.has(name)) {
      buffers.set(name, fetch(tracks[name].url).then(response => {
        if (!response.ok) throw new Error(`Could not load ${name} audio`);
        return response.arrayBuffer();
      }).then(data => context.decodeAudioData(data)).catch(error => {
        buffers.delete(name);
        throw error;
      }));
    }
    return buffers.get(name);
  }

  function fadeOut() {
    if (!current) return;
    const { source, volume, name, offset, startedAt } = current;
    const now = context.currentTime;
    if (name === "ambient") ambientOffset = (offset + now - startedAt) % source.buffer.duration;
    if (volume.gain.cancelAndHoldAtTime) volume.gain.cancelAndHoldAtTime(now);
    else volume.gain.cancelScheduledValues(now);
    volume.gain.setTargetAtTime(0, now, 0.06);
    source.stop(now + 0.28);
    current = null;
  }

  function sync() {
    const nextRequest = ++request;
    if (!enabled || !context || !scene || current?.name === scene) return;

    const name = scene;
    if (context.state !== "running") {
      // Have the short intro ready while waiting for the browser to allow audio.
      if (name === "intro") load(name).catch(() => {});
      return;
    }
    const loading = load(name);
    if (name === "intro") load("ambient").catch(() => {});
    loading.then(buffer => {
      if (nextRequest !== request || context.state !== "running") return;
      const loop = name === "ambient";
      const offset = loop ? ambientOffset : Math.max(0, (performance.now() - introStart) / 1000);
      if (offset >= buffer.duration) return;

      const source = context.createBufferSource();
      const volume = context.createGain();
      const now = context.currentTime;
      source.buffer = buffer;
      source.loop = loop;
      source.connect(volume);
      volume.connect(context.destination);
      volume.gain.setValueAtTime(0, now);
      volume.gain.linearRampToValueAtTime(tracks[name].gain, now + tracks[name].fade);
      source.onended = () => {
        source.disconnect();
        volume.disconnect();
        if (current?.source === source) {
          current = null;
          drawButtons();
        }
      };
      source.start(now, offset);
      fadeOut();
      current = { name, source, volume, offset, startedAt: now };
      drawButtons();
    }).catch(() => {
      if (nextRequest !== request) return;
      enabled = false;
      fadeOut();
      drawButtons();
    });
  }

  function unlock() {
    try {
      if (!context) {
        context = new AudioEngine();
        context.addEventListener("statechange", () => { drawButtons(); sync(); });
      }
      context.resume().then(() => { drawButtons(); sync(); }).catch(() => drawButtons());
    } catch {
      drawButtons();
    }
  }

  // This capture listener runs before the opening's click-to-skip listener.
  window.addEventListener("click", event => {
    if (!event.isTrusted || !enabled || context?.state === "running") return;
    const target = event.target;
    if (target?.closest?.("[data-sound-toggle]")) return;
    if (!triedOnClick && target?.closest?.("#opening") && !target.closest?.("#openingSkip")) {
      event.preventDefault();
    }
    triedOnClick = true;
    unlock();
  }, true);

  buttons.forEach(button => {
    button.hidden = false;
    button.addEventListener("click", () => {
      enabled = button.id === "musicDisc" ? !musicPlaying() : !enabled;
      try { localStorage.setItem(preference, enabled ? "on" : "off"); } catch { /* optional */ }
      if (enabled) unlock();
      else { ++request; fadeOut(); }
      drawButtons();
    });
  });

  window.addEventListener("gd:opening-start", event => {
    introStart = event.detail.start;
    scene = "intro";
    sync();
  });
  window.addEventListener("gd:opening-done", () => {
    scene = "ambient";
    sync();
  });

  drawButtons();
  if (enabled) unlock();
})();
