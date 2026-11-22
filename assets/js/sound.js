/* Audio shared by the intro and the home page. */
(function () {
  "use strict";
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const buttons = document.querySelectorAll("[data-sound-toggle]");
  if (!AudioEngine || !buttons.length) return;

  const preference = "gd-sound-choice";
  const dialog = document.getElementById("soundChoice");
  const playlist = [
    { url: "assets/audio/rapid-as-wildfires.m4a", gain: 0.34, fade: 0.95 },
    { url: "assets/audio/all-conquering-tide.m4a", gain: 0.34, fade: 0.95 },
  ];
  const buffers = new Map();
  let context, current;
  let started = false;
  let trackIndex = 0;
  let ambientOffset = 0;
  let request = 0;
  let choice;
  let triedOnClick = false;
  try { choice = localStorage.getItem(preference); } catch { /* storage may be disabled */ }
  let enabled = choice === "on";

  function musicPlaying() {
    return enabled && context?.state === "running" && Boolean(current);
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

  function load(track) {
    const { url } = track;
    if (!buffers.has(url)) {
      buffers.set(url, fetch(url).then(response => {
        if (!response.ok) throw new Error(`Could not load ${url}`);
        return response.arrayBuffer();
      }).then(data => context.decodeAudioData(data)).catch(error => {
        buffers.delete(url);
        throw error;
      }));
    }
    return buffers.get(url);
  }

  function fadeOut() {
    if (!current) return;
    const { source, volume, offset, startedAt } = current;
    const now = context.currentTime;
    ambientOffset = (offset + now - startedAt) % source.buffer.duration;
    if (volume.gain.cancelAndHoldAtTime) volume.gain.cancelAndHoldAtTime(now);
    else volume.gain.cancelScheduledValues(now);
    volume.gain.setTargetAtTime(0, now, 0.06);
    source.stop(now + 0.28);
    current = null;
  }

  function sync() {
    const nextRequest = ++request;
    if (!enabled || !started || current || context?.state !== "running") return;

    const track = playlist[trackIndex];
    load(track).then(buffer => {
      if (nextRequest !== request || context.state !== "running") return;
      const offset = ambientOffset;
      if (offset >= buffer.duration) return;

      const source = context.createBufferSource();
      const volume = context.createGain();
      const now = context.currentTime;
      source.buffer = buffer;
      source.connect(volume);
      volume.connect(context.destination);
      volume.gain.setValueAtTime(0, now);
      volume.gain.linearRampToValueAtTime(track.gain, now + track.fade);
      source.onended = () => {
        source.disconnect();
        volume.disconnect();
        if (current?.source === source) {
          current = null;
          buffers.delete(track.url);
          ambientOffset = 0;
          trackIndex = (trackIndex + 1) % playlist.length;
          sync();
          drawButtons();
        }
      };
      source.start(now, offset);
      current = { source, volume, offset, startedAt: now };
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
      if (!started) load(playlist[trackIndex]).catch(() => {});
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

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(preference, on ? "on" : "off"); } catch { /* optional */ }
    if (on) unlock();
    else { ++request; fadeOut(); }
    drawButtons();
  }

  buttons.forEach(button => {
    button.hidden = false;
    button.addEventListener("click", () => {
      setEnabled(button.id === "musicDisc" ? !musicPlaying() : !enabled);
    });
  });

  function startMusic() {
    if (started) return;
    started = true;
    sync();
  }

  window.addEventListener("gd:opening-start", startMusic);
  window.addEventListener("gd:opening-done", startMusic);

  drawButtons();
  if (enabled) unlock();
  if (choice !== "on" && choice !== "off" && dialog?.showModal) {
    dialog.addEventListener("submit", event => {
      event.preventDefault();
      setEnabled(event.submitter?.value === "on");
      dialog.close();
    });
    dialog.addEventListener("cancel", () => setEnabled(false));
    dialog.showModal();
  }
})();
