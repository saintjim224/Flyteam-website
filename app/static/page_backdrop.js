(() => {
  const MIN_TILES = 18;
  const MAX_TILES = 32;
  const SWAP_BASE_MS = 2600;
  let swapTimer = null;

  function normalizeImageUrl(url) {
    return typeof url === "string" ? url.trim() : "";
  }

  function randomUnit() {
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] / 0x100000000;
    }
    return Math.random();
  }

  function randomBetween(min, max) {
    return min + (max - min) * randomUnit();
  }

  function shuffledCopy(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(randomUnit() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickImage(images, current = "") {
    if (!images.length) return "";
    if (images.length === 1) return images[0];
    let next = images[Math.floor(randomUnit() * images.length)];
    let guard = 0;
    while (next === current && guard < 6) {
      next = images[Math.floor(randomUnit() * images.length)];
      guard += 1;
    }
    return next;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!res.ok) throw new Error((data && data.detail) || raw || `HTTP ${res.status}`);
    return data || {};
  }

  function decorateTile(fig) {
    const rotate = randomBetween(-3.2, 3.2);
    fig.style.setProperty("--rotate", `${rotate.toFixed(2)}deg`);
    fig.style.setProperty("--rotate-end", `${(-rotate * randomBetween(0.35, 0.9)).toFixed(2)}deg`);
    fig.style.setProperty("--from-x", `${randomBetween(-2.5, 0).toFixed(2)}%`);
    fig.style.setProperty("--from-y", `${randomBetween(-2.2, 0).toFixed(2)}%`);
    fig.style.setProperty("--to-x", `${randomBetween(0.3, 2.6).toFixed(2)}%`);
    fig.style.setProperty("--to-y", `${randomBetween(0.3, 2.4).toFixed(2)}%`);
    fig.style.setProperty("--delay", `${(-randomBetween(0, 12)).toFixed(2)}s`);
    fig.style.setProperty("--duration", `${randomBetween(12, 23).toFixed(2)}s`);
    fig.style.setProperty("--img-duration", `${randomBetween(20, 38).toFixed(2)}s`);
  }

  function swapTile(fig, images) {
    const img = fig.querySelector("img");
    if (!img || !images.length) return;
    const current = img.dataset.url || img.src || "";
    const next = pickImage(images, current);
    if (!next || next === current) return;
    const preloader = new Image();
    preloader.onload = () => {
      fig.classList.add("is-swapping");
      setTimeout(() => {
        img.src = next;
        img.dataset.url = next;
        decorateTile(fig);
        requestAnimationFrame(() => fig.classList.remove("is-swapping"));
      }, 210);
    };
    preloader.src = next;
  }

  function startRandomRolling(wall, images) {
    if (swapTimer) clearInterval(swapTimer);
    if (!images || images.length < 2) return;
    const tiles = Array.from(wall.querySelectorAll(".module-bg-tile"));
    if (!tiles.length) return;
    const tick = () => {
      if (document.hidden) return;
      const batch = Math.max(1, Math.min(4, Math.ceil(tiles.length / 9)));
      const shuffledTiles = shuffledCopy(tiles);
      for (let i = 0; i < batch; i += 1) swapTile(shuffledTiles[i], images);
    };
    swapTimer = setInterval(tick, SWAP_BASE_MS + Math.floor(randomUnit() * 1700));
  }

  function buildBackdrop(images) {
    if (!document.body.classList.contains("module-page")) return;
    if (document.querySelector(".module-bg-wall")) return;

    const wall = document.createElement("div");
    wall.className = "module-bg-wall";
    wall.setAttribute("aria-hidden", "true");
    wall.style.setProperty("--wall-duration", `${randomBetween(42, 68).toFixed(2)}s`);

    if (!images.length) {
      wall.classList.add("empty");
      document.body.prepend(wall);
      return;
    }

    const randomized = shuffledCopy(images);
    const tileCount = Math.max(MIN_TILES, Math.min(MAX_TILES, images.length * 3));
    for (let idx = 0; idx < tileCount; idx += 1) {
      const url = randomized[idx % randomized.length] || pickImage(images);
      const fig = document.createElement("figure");
      fig.className = `module-bg-tile module-bg-tile-${(idx % 12) + 1}`;
      decorateTile(fig);
      const img = document.createElement("img");
      img.src = url;
      img.dataset.url = url;
      img.alt = "Flyteam background";
      img.loading = idx < 6 ? "eager" : "lazy";
      img.decoding = "async";
      fig.appendChild(img);
      wall.appendChild(fig);
    }
    document.body.prepend(wall);
    startRandomRolling(wall, images);
  }

  async function initBackdrop() {
    if (!document.body.classList.contains("module-page")) return;
    try {
      const data = await fetchJSON("/api/content");
      const gallery = Array.isArray(data.gallery) ? data.gallery.map(normalizeImageUrl).filter(Boolean) : [];
      buildBackdrop(gallery);
    } catch {
      buildBackdrop([]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBackdrop, { once: true });
  } else {
    initBackdrop();
  }
})();
