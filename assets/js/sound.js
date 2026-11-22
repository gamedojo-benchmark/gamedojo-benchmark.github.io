/* Optional audio shared by the intro and the home page. */
(function () {
  "use strict";
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const buttons = document.querySelectorAll("[data-sound-toggle]");
  if (!AudioEngine || !buttons.length) return;

  const preference = "gd-sound";
  const tracks = {
    intro: { url: "assets/audio/opening.m4a", gain: 0.66, fade: 0.08 },
    ambient: { url: "assets/audio/arena.m4a", gain: 0.46, fade: 0.95 },
  };
  const buffers = new Map();
  let context, current, scene;
  let introStart = 0;
  let request = 0;
  let enabled = false;
  try { enabled = localStorage.getItem(preference) === "on"; } catch { /* storage may be disabled */ }

  function drawButtons() {
    const on = enabled && context?.state === "running";
    buttons.forEach(button => {
      button.setAttribute("aria-pressed", String(Boolean(on)));
      button.textContent = on ? "Sound on" : "Sound off";
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
    const { source, volume } = current;
    const now = context.currentTime;
    if (volume.gain.cancelAndHoldAtTime) volume.gain.cancelAndHoldAtTime(now);
    else volume.gain.cancelScheduledValues(now);
    volume.gain.setTargetAtTime(0, now, 0.06);
    source.stop(now + 0.28);
    current = null;
  }

  function sync() {
    const nextRequest = ++request;
    if (!enabled || context?.state !== "running" || !scene || current?.name === scene) return;

    const name = scene;
    if (name === "intro") load("ambient").catch(() => {});
    load(name).then(buffer => {
      if (nextRequest !== request || context.state !== "running") return;
      const loop = name === "ambient";
      const offset = loop ? 0 : Math.max(0, (performance.now() - introStart) / 1000);
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
        if (current?.source === source) current = null;
      };
      source.start(now, offset);
      fadeOut();
      current = { name, source, volume };
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

  buttons.forEach(button => {
    button.hidden = false;
    button.addEventListener("click", () => {
      enabled = !enabled || context?.state !== "running";
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

  if (enabled) unlock();
})();
