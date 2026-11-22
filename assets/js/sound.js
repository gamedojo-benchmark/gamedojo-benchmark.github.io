/* Stream the same background playlist through the opening and the home page. */
(function () {
  "use strict";
  const audio = document.getElementById("backgroundMusic");
  const dialog = document.getElementById("soundChoice");
  const note = document.getElementById("soundChoiceNote");
  const buttons = document.querySelectorAll("[data-sound-toggle]");
  if (!audio || !buttons.length) return;

  const preference = "gd-sound-choice";
  const StrikeAudio = window.AudioContext || window.webkitAudioContext;
  const playlist = [
    "assets/audio/rapid-as-wildfires.mp3",
    "assets/audio/all-conquering-tide.mp3",
  ];
  const musicVolume = 0.34;
  const fadeDuration = 700;
  let trackIndex = 0;
  let choice;
  let playing = false;
  let triedOnClick = false;
  let entryTimer;
  let fadeTimer;
  let musicContext;
  let musicGain;
  let request = 0;
  let strikeContext, strikeGain, strikeBuffer, strikeSource;
  let openingFinished = false;
  try { choice = localStorage.getItem(preference); } catch { /* storage may be disabled */ }
  const ask = typeof dialog?.showModal === "function";
  let enabled = !ask && choice === "on";

  audio.src = playlist[trackIndex];
  audio.volume = 0;
  const canSetVolume = audio.volume === 0;

  function prepareAudio() {
    // Some mobile browsers require Web Audio to change media volume.
    if (!canSetVolume && !musicGain) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        try {
          const context = new AudioContext();
          const gain = context.createGain();
          gain.gain.value = 0;
          gain.connect(context.destination);
          context.createMediaElementSource(audio).connect(gain);
          musicContext = context;
          musicGain = gain.gain;
        } catch { /* use the media element if Web Audio is unavailable */ }
      }
    }
    if (musicContext && musicContext.state !== "running") {
      musicContext.resume().catch(() => {});
    }
  }

  function setVolume(volume) {
    if (musicGain) musicGain.value = volume;
    else if (canSetVolume) audio.volume = volume;
  }

  function fadeVolume(target, complete) {
    clearInterval(fadeTimer);
    const from = musicGain?.value ?? audio.volume;
    if (from === target || (!canSetVolume && !musicGain)) {
      complete?.();
      return;
    }
    const started = performance.now();
    fadeTimer = setInterval(() => {
      const progress = Math.min((performance.now() - started) / fadeDuration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      setVolume(progress === 1 ? target : from + (target - from) * eased);
      if (progress === 1) {
        clearInterval(fadeTimer);
        complete?.();
      }
    }, 16);
  }

  function drawButtons() {
    buttons.forEach(button => {
      const disc = button.id === "musicDisc";
      const canMute = enabled && (!disc || !audio.paused);
      const action = canMute ? "Mute" : disc ? "Play" : "Unmute";
      button.classList.toggle(disc ? "is-playing" : "is-enabled", enabled && (!disc || playing));
      button.setAttribute("aria-label", `${action} ${disc ? "background music" : "sound"}`);
      const label = button.querySelector("[data-sound-label]") || button;
      label.textContent = action;
    });
  }

  function enter() {
    clearTimeout(entryTimer);
    if (dialog?.open) dialog.close();
  }

  function audioFailed() {
    clearInterval(fadeTimer);
    setVolume(0);
    audio.pause();
    playing = false;
    if (dialog?.open && enabled) {
      clearTimeout(entryTimer);
      note.textContent = "Music could not start. Try again or enter muted.";
    }
    drawButtons();
  }

  function play() {
    if (!enabled) return;
    prepareAudio();
    if (!audio.paused) return;
    if (audio.error) audio.load();
    const attempt = ++request;
    audio.play().catch(() => {
      if (request === attempt && enabled) audioFailed();
    });
    drawButtons();
  }

  function prepareStrike() {
    if (!StrikeAudio || openingFinished) return;
    try {
      if (!strikeContext) {
        strikeContext = new StrikeAudio();
        strikeGain = strikeContext.createGain();
        strikeGain.gain.value = 0.68;
        strikeGain.connect(strikeContext.destination);
        fetch("assets/audio/steel-parry.wav?v=2")
          .then(response => {
            if (!response.ok) throw new Error("Could not load steel strike");
            return response.arrayBuffer();
          })
          .then(data => strikeContext.decodeAudioData(data))
          .then(buffer => { strikeBuffer = buffer; })
          .catch(() => {});
      }
      strikeContext.resume().catch(() => {});
    } catch { /* The music player can still run without the optional strike. */ }
  }

  function stopStrike() {
    strikeSource?.stop();
    strikeSource = null;
  }

  window.addEventListener("gd:opening-strike", () => {
    if (!enabled || openingFinished || !strikeBuffer || strikeContext?.state !== "running") return;
    stopStrike();
    const source = strikeContext.createBufferSource();
    source.buffer = strikeBuffer;
    source.connect(strikeGain);
    source.onended = () => {
      source.disconnect();
      if (strikeSource === source) strikeSource = null;
    };
    source.start();
    strikeSource = source;
  });

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(preference, on ? "on" : "off"); } catch { /* optional */ }
    if (on) {
      prepareStrike();
      if (playing && !audio.paused) fadeVolume(musicVolume);
      else clearInterval(fadeTimer);
      play();
    } else {
      ++request;
      stopStrike();
      fadeVolume(0, () => {
        audio.pause();
        playing = false;
        drawButtons();
      });
    }
    drawButtons();
  }

  audio.addEventListener("playing", () => {
    if (!enabled || audio.paused) return;
    playing = true;
    fadeVolume(musicVolume);
    enter();
    drawButtons();
  });
  for (const event of ["pause", "waiting"]) {
    audio.addEventListener(event, () => {
      playing = false;
      drawButtons();
    });
  }
  audio.addEventListener("error", audioFailed);
  audio.addEventListener("ended", () => {
    playing = false;
    trackIndex = (trackIndex + 1) % playlist.length;
    ++request;
    audio.src = playlist[trackIndex];
    play();
    drawButtons();
  });

  // This capture listener runs before the opening's click-to-skip listener.
  window.addEventListener("click", event => {
    if (!event.isTrusted || !enabled || !audio.paused || dialog?.open) return;
    const target = event.target;
    if (target?.closest?.("[data-sound-toggle]")) return;
    if (!triedOnClick && target?.closest?.("#opening") && !target.closest?.("#openingSkip")) {
      event.preventDefault();
    }
    triedOnClick = true;
    prepareStrike();
    play();
  }, true);

  buttons.forEach(button => {
    button.hidden = false;
    button.addEventListener("click", () => {
      setEnabled(!enabled || (button.id === "musicDisc" && audio.paused));
    });
  });

  window.addEventListener("gd:opening-start", play);
  window.addEventListener("gd:opening-done", () => {
    openingFinished = true;
    stopStrike();
    strikeContext?.close().catch(() => {});
    play();
  });
  drawButtons();

  if (ask) {
    dialog.querySelectorAll("button[value]").forEach(button => {
      const preferred = button.value === (choice === "on" ? "on" : "off");
      button.toggleAttribute("autofocus", preferred);
      button.classList.toggle("btn--gold", preferred);
    });
    dialog.addEventListener("submit", event => {
      event.preventDefault();
      const on = event.submitter?.value === "on";
      if (!on) {
        setEnabled(false);
        enter();
        return;
      }
      note.textContent = "Starting music…";
      clearTimeout(entryTimer);
      // Let the animation proceed if the browser is slow to buffer.
      entryTimer = setTimeout(enter, 1800);
      setEnabled(true);
    });
    dialog.addEventListener("cancel", () => {
      clearTimeout(entryTimer);
      setEnabled(false);
    });
    dialog.showModal();
  }
})();
