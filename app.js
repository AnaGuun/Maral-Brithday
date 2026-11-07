const pages = [...document.querySelectorAll(".page")];
const dots = [...document.querySelectorAll(".dot")];
const back = document.getElementById("back");
const next = document.getElementById("next");
const status = document.getElementById("page-status");
const current = document.getElementById("current");
let index = 0;

const photoUrls = {
  "finale-bg": ["media/finale-bg.jpg", "media/finale-bg.jpeg", "media/finale-bg.png", "media/finale-bg.webp"]
};


function render() {
  lastPhotoTap = null;
  document.getElementById("candle-warning").hidden = true;
  if (!pages[index].classList.contains("page-cake")) clearCelebration();
  pages.forEach((page, i) => {
    const on = i === index;
    page.hidden = !on;
    page.classList.toggle("is-active", on);
    if (on) page.scrollTop = 0;
  });
  dots.forEach((dot, i) => dot.classList.toggle("on", i === index));
  current.textContent = String(index + 1);
  back.disabled = index === 0;
  next.disabled = index === pages.length - 1;
  document.querySelector(".love-credit").hidden = index !== 0 && index !== pages.length - 1;
  const title = pages[index].dataset.title;
  status.textContent = `Page ${index + 1} of ${pages.length}. ${title}`;
  document.querySelectorAll("video").forEach((video) => {
    if (!pages[index].contains(video)) video.pause();
  });
  typePageText(pages[index]);
}

let pageTransitioning = false;

async function go(step) {
  const nextIndex = index + step;
  if (pageTransitioning || nextIndex < 0 || nextIndex >= pages.length) return;
  if (step > 0 && pages[index].classList.contains("page-cake") && remainingCandles() > 0) {
    const warning = document.getElementById("candle-warning");
    warning.textContent = "Blow out all three candles before going to the next page. Tap each candle to make your wish!";
    warning.hidden = false;
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    index = nextIndex;
    render();
    return;
  }

  pageTransitioning = true;
  const outgoing = pages[index];
  const origin = step > 0 ? "left center" : "right center";
  const angle = step > 0 ? -90 : 90;
  const turn = outgoing.animate(
    [
      { transform: "perspective(1800px) rotateY(0deg)", transformOrigin: origin, filter: "brightness(1)" },
      { transform: `perspective(1800px) rotateY(${angle}deg)`, transformOrigin: origin, filter: "brightness(0.65)" }
    ],
    { duration: 360, easing: "ease-in", fill: "forwards" }
  );
  try {
    await turn.finished.catch(() => {});
    index = nextIndex;
    render();
    const incoming = pages[index].animate([
      { transform: `perspective(1800px) rotateY(${-angle}deg)`, transformOrigin: origin, filter: "brightness(0.65)" },
      { transform: "perspective(1800px) rotateY(0deg)", transformOrigin: origin, filter: "brightness(1)" }
    ], { duration: 440, easing: "ease-out" });
    await incoming.finished.catch(() => {});
  } finally {
    turn.cancel();
    pageTransitioning = false;
  }
}

back.addEventListener("click", () => go(-1));
next.addEventListener("click", () => go(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") go(1);
  if (event.key === "ArrowLeft") go(-1);
});

let touch = null;
const book = document.getElementById("book");

book.addEventListener("touchstart", (event) => {
  if (event.target.closest("button, input, video, label, a")) return;
  const point = event.changedTouches[0];
  touch = { x: point.clientX, y: point.clientY };
}, { passive: true });

book.addEventListener("touchend", (event) => {
  if (!touch) return;
  const point = event.changedTouches[0];
  const dx = point.clientX - touch.x;
  const dy = point.clientY - touch.y;
  touch = null;
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
  go(dx < 0 ? 1 : -1);
}, { passive: true });

function matchesCandidate(actual, candidate) {
  return actual === candidate || actual.endsWith("/" + candidate) || actual.endsWith(candidate);
}

function useFirstWorkingImage(img, urls) {
  const frame = img.closest("[data-slot]");
  let cursor = 0;

  function tryNext() {
    if (frame.dataset.preview === "true") return;
    if (cursor >= urls.length) {
      frame.classList.add("empty");
      frame.classList.remove("ready");
      return;
    }
    const candidate = urls[cursor];
    cursor += 1;
    img.onload = () => {
      if (frame.dataset.preview === "true") return;
      if (!matchesCandidate(img.src, candidate)) return;
      frame.classList.add("ready");
      frame.classList.remove("empty");
    };
    img.onerror = () => {
      if (frame.dataset.preview === "true") return;
      if (!matchesCandidate(img.src, candidate) && img.getAttribute("src") !== candidate) return;
      tryNext();
    };
    img.src = candidate;
  }

  tryNext();
}

document.querySelectorAll("img").forEach((img) => {
  const slot = img.closest("[data-slot]");
  if (!slot || !photoUrls[slot.dataset.slot]) return;
  useFirstWorkingImage(img, photoUrls[slot.dataset.slot]);
});

function useFirstWorkingBackground(el, urls) {
  const probe = new Image();
  let cursor = 0;
  probe.onload = () => {
    if (el.dataset.preview === "true") return;
    el.style.backgroundImage = `url("${probe.src}")`;
    el.classList.add("ready");
    el.classList.remove("empty");
  };
  probe.onerror = () => {
    if (el.dataset.preview === "true") return;
    cursor += 1;
    if (cursor >= urls.length) {
      el.classList.add("empty");
      return;
    }
    probe.src = urls[cursor];
  };
  probe.src = urls[0];
}

const finaleBg = document.querySelector('[data-slot="finale-bg"]');
useFirstWorkingBackground(finaleBg, photoUrls["finale-bg"]);

function applyFile(slot, file) {
  if (!file || slot.dataset.locked === "true") return;
  const isVideo = slot.dataset.slot === "video";
  if (!file.type.startsWith(isVideo ? "video/" : "image/")) return;
  const previousUrl = slot.dataset.objectUrl;
  const url = URL.createObjectURL(file);
  slot.dataset.objectUrl = url;
  slot.dataset.preview = "true";
  const markReady = () => {
    slot.classList.add("ready");
    slot.classList.remove("empty");
    slot.querySelector(".upload > span").textContent = isVideo ? "Change video" : "Change photo";
  };
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  if (isVideo) {
    const video = slot.querySelector("video");
    video.onloadeddata = markReady;
    video.onerror = null;
    video.src = url;
    video.load();
    return;
  }
  if (slot.dataset.slot === "finale-bg") {
    slot.style.backgroundImage = `url("${url}")`;
    markReady();
    return;
  }
  const img = slot.querySelector("img");
  if (img) {
    img.onload = markReady;
    img.onerror = null;
    img.src = url;
  }
}

document.querySelectorAll("[data-slot]").forEach((slot) => {
  if (slot.dataset.locked === "true") return;
  const input = slot.querySelector('input[type="file"]');
  if (input) {
    input.addEventListener("change", () => {
      applyFile(slot, input.files && input.files[0]);
    });
  }

  slot.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  slot.addEventListener("drop", (event) => {
    event.preventDefault();
    applyFile(slot, event.dataTransfer.files && event.dataTransfer.files[0]);
  });
});

const candles = [...document.querySelectorAll(".candle")];
const cakeHint = document.getElementById("cake-hint");
const relightButton = document.getElementById("relight");
const celebration = document.getElementById("celebration");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const partyColors = ["#d80621", "#ffffff", "#ffd166", "#ff8fab", "#7bdff2", "#c77dff", "#ff9f1c", "#b9fbc0"];

function remainingCandles() {
  return candles.filter((candle) => !candle.classList.contains("out")).length;
}

function updateHint() {
  document.getElementById("candle-warning").hidden = true;
  const left = remainingCandles();
  if (left === 3) cakeHint.textContent = "Three candles glowing — tap them to make a wish!";
  else if (left === 2) cakeHint.textContent = "Two candles still glowing";
  else if (left === 1) cakeHint.textContent = "One candle left";
  else cakeHint.textContent = "Make a wish, Maral";
}

function celebrate() {
  if (document.body.classList.contains("is-celebrating")) return;
  document.body.classList.add("is-celebrating");
  celebration.hidden = false;
  celebration.innerHTML = "";
  celebration.setAttribute("aria-label", "Celebration. Happy birthday, Maral.");

  for (let i = 0; i < 56; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    const end = `${8 + Math.random() * 84}%`;
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty("--end", end);
    piece.style.setProperty("--spin", `${180 + Math.random() * 540}deg`);
    piece.style.background = partyColors[i % partyColors.length];
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${9 + Math.random() * 12}px`;
    piece.style.borderRadius = Math.random() > 0.55 ? "2px" : "999px";
    piece.style.animationDuration = `${1.6 + Math.random() * 1.8}s`;
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    if (reduceMotion) {
      piece.style.animation = "none";
      piece.style.top = end;
    }
    celebration.appendChild(piece);
  }

  for (let i = 0; i < 12; i += 1) {
    const balloon = document.createElement("span");
    balloon.className = "balloon";
    const end = `${6 + Math.random() * 58}%`;
    balloon.style.left = `${4 + Math.random() * 88}%`;
    balloon.style.setProperty("--c", partyColors[i % partyColors.length]);
    balloon.style.setProperty("--end", end);
    balloon.style.setProperty("--drift", `${12 + Math.random() * 20}px`);
    balloon.style.animationDuration = `${2.4 + Math.random() * 1.6}s`;
    balloon.style.animationDelay = `${Math.random() * 0.4}s`;
    balloon.addEventListener("animationend", (event) => {
      if (event.animationName !== "balloon-rise") return;
      balloon.style.bottom = end;
      balloon.classList.add("float");
    });
    if (reduceMotion) {
      balloon.style.animation = "none";
      balloon.style.bottom = end;
    }
    celebration.appendChild(balloon);
  }

  for (let i = 0; i < 12; i += 1) {
    const ribbon = document.createElement("span");
    ribbon.className = "ribbon";
    ribbon.style.left = `${Math.random() * 96}%`;
    ribbon.style.setProperty("--c", partyColors[i % partyColors.length]);
    ribbon.style.setProperty("--h", `${28 + Math.random() * 36}vh`);
    ribbon.style.setProperty("--sway", `${10 + Math.random() * 10}deg`);
    ribbon.style.animationDelay = `${Math.random() * 0.25}s`;
    if (reduceMotion) {
      ribbon.style.animation = "none";
      ribbon.style.top = "0";
    }
    celebration.appendChild(ribbon);
  }

  relightButton.hidden = false;
}

candles.forEach((candle) => {
  candle.addEventListener("click", () => {
    if (candle.classList.contains("out")) return;
    candle.classList.add("out");
    candle.setAttribute("aria-pressed", "true");
    updateHint();
    if (remainingCandles() === 0) celebrate();
  });
});

function clearCelebration() {
  document.body.classList.remove("is-celebrating");
  celebration.innerHTML = "";
  celebration.hidden = true;
  celebration.removeAttribute("aria-label");
}

relightButton.addEventListener("click", () => {
  clearCelebration();
  candles.forEach((candle) => {
    candle.classList.remove("out");
    candle.setAttribute("aria-pressed", "false");
  });
  relightButton.hidden = true;
  updateHint();
});

const backgroundMusic = document.getElementById("background-music");
const musicToggle = document.getElementById("music-toggle");
const musicVolume = document.getElementById("music-volume");
const musicStatus = document.getElementById("music-status");
let musicChosen = false;
backgroundMusic.volume = Number(musicVolume.value) / 100;

function updateMusicControl() {
  const playing = !backgroundMusic.paused;
  const label = playing ? "Pause background music" : "Play background music";
  musicToggle.setAttribute("aria-pressed", String(playing));
  musicToggle.setAttribute("aria-label", label);
  musicToggle.title = label;
}

function playMusic() {
  musicStatus.textContent = "";
  backgroundMusic.play().catch(() => {
    musicStatus.textContent = "Music could not start. Press the music button to try again.";
    updateMusicControl();
  });
}

musicToggle.addEventListener("click", () => {
  musicChosen = true;
  if (backgroundMusic.paused) playMusic();
  else backgroundMusic.pause();
});

musicVolume.addEventListener("input", () => {
  backgroundMusic.volume = Number(musicVolume.value) / 100;
});

backgroundMusic.addEventListener("play", updateMusicControl);
backgroundMusic.addEventListener("pause", updateMusicControl);
backgroundMusic.addEventListener("error", () => {
  musicStatus.textContent = "Background music is unavailable.";
  updateMusicControl();
});

function startMusicOnInteraction(event) {
  if (musicChosen || event.target.closest(".music-controls")) return;
  if (event.type === "keydown" && !["Enter", " ", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  musicChosen = true;
  playMusic();
}

document.addEventListener("click", startMusicOnInteraction);
document.addEventListener("keydown", startMusicOnInteraction);

let typingFrame = null;
let typingCharacters = [];
const writingPen = document.getElementById("writing-pen");
let penCharacter = null;

function positionWritingPen() {
  if (!penCharacter || !penCharacter.isConnected) { writingPen.hidden = true; return; }
  const rect = penCharacter.getBoundingClientRect();
  writingPen.hidden = rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth;
  writingPen.style.transform = `translate(${Math.min(rect.right, window.innerWidth - 110) - 3}px, ${rect.bottom - 108}px)`;
}
document.addEventListener("scroll", positionWritingPen, { capture: true, passive: true });
window.addEventListener("resize", positionWritingPen);

function typePageText(page) {
  writingPen.hidden = true;
  penCharacter = null;
  const usePen = page.matches(".page-letter, .page-monglish, .page-station");
  if (typingFrame !== null) cancelAnimationFrame(typingFrame);
  typingCharacters.forEach((character) => character.classList.remove("type-pending"));
  typingFrame = null;
  typingCharacters = [];

  const targets = [...page.querySelectorAll("h1, h2, h3, p, li"), document.querySelector(".love-credit")].filter((element) => element && !element.hidden);
  targets.forEach((element) => {
    if (element.closest(".upload") || (!usePen && element.closest("figcaption")) || element.id === "cake-hint" || element.classList.contains("scroll-reminder")) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement.closest(".type-character")) nodes.push(walker.currentNode);
    }
    nodes.forEach((node) => {
      if (!node.textContent.trim()) return;
      const fragment = document.createDocumentFragment();
      const letters = typeof Intl.Segmenter === "function"
        ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(node.textContent), (part) => part.segment)
        : Array.from(node.textContent);
      letters.forEach((letter) => {
        const span = document.createElement("span");
        span.className = "type-character";
        span.textContent = letter;
        fragment.appendChild(span);
      });
      node.replaceWith(fragment);
    });
    typingCharacters.push(...element.querySelectorAll(".type-character"));
  });
  typingCharacters.forEach((character) => character.classList.add("type-pending"));
  let cursor = 0;
  let started = null;
  function tick(time) {
    if (started === null) started = time;
    const count = Math.min(typingCharacters.length, Math.max(0, Math.floor((time - started - 400) / 28) + 1));
    while (cursor < count) typingCharacters[cursor++].classList.remove("type-pending");
    if (usePen && cursor > 0 && cursor < typingCharacters.length) {
      penCharacter = typingCharacters[cursor - 1];
      positionWritingPen();
    } else {
      penCharacter = null;
      writingPen.hidden = true;
    }
    typingFrame = cursor < typingCharacters.length ? requestAnimationFrame(tick) : null;
  }
  typingFrame = requestAnimationFrame(tick);
}

document.querySelectorAll(".memory-packet").forEach((memory) => {
  const envelope = memory.querySelector(".memory-envelope");
  if (!envelope) return;
  memory.classList.add("is-sealed");
  envelope.hidden = false;
  envelope.addEventListener("click", async () => {
    envelope.disabled = true;
    envelope.setAttribute("aria-expanded", "true");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const artwork = envelope.innerHTML;
      const halves = ["top", "bottom"].map((side) => {
        const half = document.createElement("span");
        half.className = `memory-envelope envelope-half envelope-half-${side}`;
        half.innerHTML = artwork;
        half.setAttribute("aria-hidden", "true");
        envelope.appendChild(half);
        return half;
      });
      memory.classList.add("is-opening");
      await Promise.all(halves.map((half, i) => half.animate([
        { opacity: 1, transform: "translate(0, 0) rotate(0deg)", offset: 0 },
        { opacity: 1, transform: `translate(${i ? 8 : -8}px, ${i ? 12 : -12}px) rotate(${i ? 3 : -3}deg)`, offset: 0.3 },
        { opacity: 0, transform: `translate(${i ? 45 : -45}px, ${i ? 100 : -100}px) rotate(${i ? 16 : -16}deg)`, offset: 1 }
      ], { duration: 1100, easing: "cubic-bezier(.3,0,.2,1)", fill: "forwards" }).finished.catch(() => {})));
      halves.forEach((half) => half.remove());
    }
    envelope.hidden = true;
    memory.classList.remove("is-sealed", "is-opening");
    memory.classList.add("is-open");
    const content = memory.querySelector(".memory-group-content");
    content.tabIndex = -1;
    if (memory.closest(".page").classList.contains("is-active")) content.focus({ preventScroll: true });
  });
});

const kissSplash = document.getElementById("kiss-splash");
let kissSplashRun = 0;

function showKissSplash() {
  const run = ++kissSplashRun;
  kissSplash.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
  kissSplash.hidden = false;
  const lipstick = kissSplash.querySelector(".kiss-lipstick");
  const lipstickAnimation = lipstick.animate([
    { opacity: 0, transform: "translate(-50%, -50%) scale(0.7)", offset: 0 },
    { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.08 },
    { opacity: 0.95, transform: "translate(-50%, -50%) scale(1)", offset: 0.35 },
    { opacity: 0, transform: "translate(-50%, -50%) scale(1.06)", offset: 1 }
  ], { duration: 4000, delay: 0, easing: "ease-out", fill: "both" });
  lipstickAnimation.finished.then(() => {
    if (run === kissSplashRun) kissSplash.hidden = true;
  }).catch(() => {});
}

let photoPress = null;
let lastPhotoTap = null;

document.addEventListener("pointerdown", (event) => {
  const image = event.target instanceof Element ? event.target.closest(".page img") : null;
  if (!image || !event.isPrimary || event.button !== 0) {
    photoPress = null;
    lastPhotoTap = null;
    return;
  }
  photoPress = { image, id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
});

document.addEventListener("pointerup", (event) => {
  const press = photoPress;
  photoPress = null;
  if (!press || press.id !== event.pointerId) return;
  if (event.timeStamp - press.time > 500 || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) {
    lastPhotoTap = null;
    return;
  }
  if (lastPhotoTap && lastPhotoTap.image === press.image && event.timeStamp - lastPhotoTap.time < 380 && Math.hypot(event.clientX - lastPhotoTap.x, event.clientY - lastPhotoTap.y) < 30) {
    lastPhotoTap = null;
    showKissSplash();
  } else {
    lastPhotoTap = { image: press.image, time: event.timeStamp, x: event.clientX, y: event.clientY };
  }
});
document.addEventListener("pointercancel", () => { photoPress = null; lastPhotoTap = null; });

render();
