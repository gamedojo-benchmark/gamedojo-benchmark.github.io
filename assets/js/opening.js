/* Play the battle reel once per visit, then reveal the live logo and arena. */
(function () {
  "use strict";
  const root = document.documentElement;
  const opening = document.getElementById("opening");
  const video = document.getElementById("openingFilm");
  const skip = document.getElementById("openingSkip");
  if (!opening || !video || !skip) return;

  const query = new URLSearchParams(location.search);
  const still = query.has("still") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const skipFilm = navigator.connection?.saveData || (still && query.get("intro") !== "force");
  const landingMs = 600;
  let timer;
  let originalScroll = 0;

  function finish() {
    if (opening.dataset.state === "done") return;
    const restoreFocus = opening.contains(document.activeElement);
    opening.dataset.state = "done";
    clearTimeout(timer);
    window.removeEventListener("keydown", onSkip, true);
    window.removeEventListener("click", onSkip, true);
    window.removeEventListener("wheel", onSkip, true);
    root.classList.remove("opening-on", "opening-landing", "intro");
    root.style.removeProperty("--opening-landing-duration");
    video.pause();
    video.replaceChildren();
    video.load();
    opening.remove();
    if (originalScroll) window.scrollTo({ top: originalScroll, behavior: "instant" });
    if (restoreFocus) document.getElementById("musicDisc")?.focus({ preventScroll: true });
    window.dispatchEvent(new Event("gd:opening-done"));
  }

  function onSkip(event) {
    if (event.defaultPrevented) return;
    const soundControl = event.target?.closest?.("[data-sound-toggle]");
    if (event.type === "click" && soundControl) return;
    if (event.type === "keydown" && (event.key === "Tab" ||
        (soundControl && (event.key === "Enter" || event.key === " ")))) return;
    finish();
  }

  function land() {
    if (opening.dataset.state !== "playing") return;
    clearTimeout(timer);
    originalScroll = window.scrollY;
    if (originalScroll) window.scrollTo({ top: 0, behavior: "instant" });
    opening.dataset.state = "landing";
    root.classList.remove("intro");
    root.style.setProperty("--opening-landing-duration", `${landingMs}ms`);
    root.classList.add("opening-landing");
    timer = setTimeout(finish, landingMs);
  }

  function guardPlayback() {
    if (opening.dataset.state !== "playing") return;
    clearTimeout(timer);
    // Leave the page accessible if buffering stops making progress.
    timer = setTimeout(finish, 3200);
  }

  function begin() {
    if (skipFilm || video.error) { finish(); return; }
    opening.dataset.state = "playing";
    root.classList.add("opening-on");
    window.addEventListener("keydown", onSkip, true);
    window.addEventListener("click", onSkip, true);
    window.addEventListener("wheel", onSkip, { capture: true, passive: true });
    video.addEventListener("timeupdate", guardPlayback);
    video.addEventListener("ended", land, { once: true });
    video.addEventListener("error", finish, { once: true });
    skip.focus({ preventScroll: true });
    guardPlayback();
    video.play().catch(finish);
    window.dispatchEvent(new Event("gd:opening-start"));
  }

  if (!skipFilm) video.preload = "auto";
  const dialog = document.getElementById("soundChoice");
  if (dialog?.open) dialog.addEventListener("close", begin, { once: true });
  else begin();
})();
