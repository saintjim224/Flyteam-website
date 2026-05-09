const state = {
  gallery: [],
  galleryRandomized: false,
  news: [],
  reviewImages: [],
  reviewAlbums: [],
  awards: [],
  activeAwardType: "team",
  awardTypeInitialized: false,
  seniors: [],
  teamIntro: "",
  teamOverview: "",
  slideIndex: 0,
  slideTimer: null,
  chatBusy: false,
};

const DEFAULT_INTRO =
  "Flyteam 是西南民族大学网络安全方向团队，围绕二进制、Web 与安全开发长期建设。\n团队重视实战竞赛、项目协作与传帮带培养，形成了稳定的学习训练体系。\n欢迎对网络安全有热情的同学加入，在团队中持续打磨技术、拓展视野。";
const DEFAULT_OVERVIEW = "以攻防实战为核心，二进制、Web 与开发三大堂口协同成长。";

const HALL_NAME_MAP = {
  binary: "二进制（RE / PWN）",
  web: "Web（含 Misc / 密码）",
  dev: "开发",
  management: "团队管理",
};

const INTRO_LOGO_HINTS = ["a07be91b2a41d13bb4c064c6283a86a3", "logo", "duihui", "teamlogo"];
const AWARD_TYPE_META = {
  team: {
    label: "团队赛",
    desc: "多人协作、代表团队出战的竞赛荣誉",
    empty: "暂无团队赛奖项，请在后台添加或把历史奖项分类为团队赛。",
  },
  personal: {
    label: "个人赛",
    desc: "成员个人能力与单项赛事成果展示",
    empty: "暂无个人赛奖项，请在后台添加或把历史奖项分类为个人赛。",
  },
};

function normalizeAwardType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "personal" || raw === "individual" || raw === "solo" || raw.includes("个人")) return "personal";
  return "team";
}

function awardTypeLabel(value) {
  const key = normalizeAwardType(value);
  return (AWARD_TYPE_META[key] && AWARD_TYPE_META[key].label) || AWARD_TYPE_META.team.label;
}

function normalizeAwardLevel(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (lower === "national" || raw.includes("国家") || raw.includes("全国")) return "国家级";
  if (lower.includes("prov") || raw.includes("省")) return "省级";
  return "省级";
}

function awardLevelClass(value) {
  return normalizeAwardLevel(value) === "国家级" ? "national" : "provincial";
}

function awardLevelRank(item) {
  return normalizeAwardLevel(item && item.level) === "国家级" ? 1 : 0;
}

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

function shuffledCopy(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomUnit() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseSortTimestamp(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const normalized = text.replace(/[年月/.]/g, "-").replace(/日/g, "");
  const match = normalized.match(/(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const ts = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(ts) ? 0 : ts;
  }
  const iso = Date.parse(text);
  if (!Number.isNaN(iso)) return iso;
  const year = text.match(/(20\d{2}|19\d{2})/);
  if (year) {
    const ts = Date.UTC(Number(year[1]), 0, 1);
    return Number.isNaN(ts) ? 0 : ts;
  }
  return 0;
}

function recordSortText(item, fields = ["created_at", "date", "year", "grade"]) {
  for (const field of fields) {
    const value = String((item && item[field]) || "").trim();
    if (value) return value;
  }
  return "";
}

function recordSortValue(item, fields = ["created_at", "date", "year", "grade"]) {
  for (const field of fields) {
    const ts = parseSortTimestamp(item && item[field]);
    if (ts) return ts;
  }
  return 0;
}

function recordSortTime(item) {
  return recordSortText(item);
}

function isPinned(item) {
  if (!item) return false;
  if (item.pinned === true || item.pinned === 1) return true;
  return String(item.pinned || "").trim().toLowerCase() === "true";
}

function isResponsible(item) {
  if (!item) return false;
  const value = item.responsible ?? item.is_responsible ?? item.is_manager ?? false;
  if (value === true || value === 1) return true;
  return String(value || "").trim().toLowerCase() === "true" || String(value || "").trim() === "负责人";
}

function comparePinnedRecords(a, b) {
  const pa = isPinned(a) ? 1 : 0;
  const pb = isPinned(b) ? 1 : 0;
  if (pa !== pb) return pb - pa;
  return recordSortValue(b) - recordSortValue(a) || recordSortText(b).localeCompare(recordSortText(a));
}

function compareNewsRecords(a, b) {
  const pa = isPinned(a) ? 1 : 0;
  const pb = isPinned(b) ? 1 : 0;
  if (pa !== pb) return pb - pa;
  const fields = ["date", "created_at"];
  return recordSortValue(b, fields) - recordSortValue(a, fields)
    || recordSortText(b, fields).localeCompare(recordSortText(a, fields));
}

function compareAwardRecords(a, b) {
  const pa = isPinned(a) ? 1 : 0;
  const pb = isPinned(b) ? 1 : 0;
  if (pa !== pb) return pb - pa;
  const la = awardLevelRank(a);
  const lb = awardLevelRank(b);
  if (la !== lb) return lb - la;
  const fields = ["date", "year", "created_at"];
  return recordSortValue(b, fields) - recordSortValue(a, fields)
    || recordSortText(b, fields).localeCompare(recordSortText(a, fields));
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || raw || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data || {};
}

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendPinBadge(parent, item) {
  if (isPinned(item)) parent.appendChild(createNode("span", "pin-badge public-pin", "置顶"));
}

function openImageLightbox(url, caption = "图片预览") {
  const root = document.getElementById("imgLightbox");
  const image = document.getElementById("imgLightboxImage");
  const text = document.getElementById("imgLightboxCaption");
  if (!root || !image || !text) return;
  image.src = url;
  text.textContent = caption;
  root.classList.add("open");
}

function closeImageLightbox() {
  const root = document.getElementById("imgLightbox");
  const image = document.getElementById("imgLightboxImage");
  if (!root || !image) return;
  root.classList.remove("open");
  image.src = "";
}

function bindPreview(img, caption, options = {}) {
  if (!img) return;
  img.title = "双击查看原图";
  img.classList.add("zoomable-image");
  if (options.preventParentLink) {
    img.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }
  img.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openImageLightbox(img.src, caption || "图片预览");
  });
}

function initImageLightbox() {
  const root = document.getElementById("imgLightbox");
  const close = document.getElementById("imgLightboxClose");
  if (!root || !close) return;

  close.addEventListener("click", closeImageLightbox);
  root.addEventListener("click", (event) => {
    if (event.target === root) closeImageLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.classList.contains("open")) closeImageLightbox();
  });
}


function createWallTileImage(url, idx, active = false) {
  const img = document.createElement("img");
  img.src = url;
  img.dataset.url = url;
  img.alt = "Flyteam photo";
  img.loading = idx < 4 ? "eager" : "lazy";
  img.decoding = "async";
  img.className = `wall-tile-img${active ? " active" : ""}`;
  return img;
}

function crossfadeWallTile(tile, idx, nextUrl) {
  const current = tile.querySelector("img.active") || tile.querySelector("img");
  if (!current || !nextUrl || current.dataset.url === nextUrl || tile.dataset.nextUrl === nextUrl) return;
  tile.dataset.nextUrl = nextUrl;

  const preloader = new Image();
  preloader.decoding = "async";
  preloader.onload = () => {
    if (tile.dataset.nextUrl !== nextUrl) return;
    const nextImg = createWallTileImage(nextUrl, idx, false);
    const shine = tile.querySelector(".wall-tile-shine");
    tile.insertBefore(nextImg, shine || null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nextImg.classList.add("active");
        current.classList.remove("active");
      });
    });

    window.setTimeout(() => {
      Array.from(tile.querySelectorAll("img")).forEach((img) => {
        if (img !== nextImg) img.remove();
      });
      tile.dataset.previewUrl = nextUrl;
      delete tile.dataset.nextUrl;
    }, 1500);
  };
  preloader.onerror = () => {
    delete tile.dataset.nextUrl;
  };
  preloader.src = nextUrl;
}

function updateHomePhotoWallTiles(images) {
  const wall = document.getElementById("homePhotoWall");
  if (!wall || !images.length) return;
  const offset = state.slideIndex % images.length;
  Array.from(wall.querySelectorAll(".wall-tile")).forEach((tile, idx) => {
    const nextUrl = images[(offset + idx * 2 + Math.floor(idx / 3)) % images.length];
    window.setTimeout(() => crossfadeWallTile(tile, idx, nextUrl), (idx % 6) * 110);
  });
}

function renderHomePhotoWall() {
  const wall = document.getElementById("homePhotoWall");
  if (!wall) return;

  const images = state.gallery.map(normalizeImageUrl).filter(Boolean);
  const signature = images.join("|");
  if (wall.dataset.signature === signature && wall.children.length) {
    updateHomePhotoWallTiles(images);
    return;
  }
  wall.dataset.signature = signature;
  wall.innerHTML = "";

  if (!images.length) {
    wall.classList.add("empty");
    return;
  }
  wall.classList.remove("empty");

  const tileCount = Math.max(10, Math.min(16, images.length * 3));
  for (let idx = 0; idx < tileCount; idx += 1) {
    const url = images[(state.slideIndex + idx * 2 + Math.floor(idx / 3)) % images.length];
    const tile = document.createElement("figure");
    tile.className = `wall-tile wall-tile-${(idx % 12) + 1}`;
    tile.style.setProperty("--delay", `${(idx % 6) * -1.7}s`);
    tile.dataset.previewUrl = url;

    const img = createWallTileImage(url, idx, true);
    tile.addEventListener("dblclick", () => openImageLightbox(tile.dataset.previewUrl || img.src, "Flyteam"));

    const shine = document.createElement("span");
    shine.className = "wall-tile-shine";

    tile.appendChild(img);
    tile.appendChild(shine);
    wall.appendChild(tile);
  }
}

function renderHero() {
  const bg = document.getElementById("heroBg");
  const dots = document.getElementById("heroDots");
  renderHomePhotoWall();
  if (!bg || !dots) return;

  if (!state.gallery.length) {
    bg.style.backgroundImage = "linear-gradient(120deg,#0a2a72,#1f69d9)";
    dots.innerHTML = "";
    return;
  }

  bg.style.backgroundImage = `url(${state.gallery[state.slideIndex]})`;
  dots.innerHTML = "";
  state.gallery.forEach((_, idx) => {
    const b = document.createElement("button");
    if (idx === state.slideIndex) b.classList.add("on");
    b.addEventListener("click", () => {
      state.slideIndex = idx;
      renderHero();
      restartHeroTimer();
    });
    dots.appendChild(b);
  });
}

function restartHeroTimer() {
  if (state.slideTimer) clearInterval(state.slideTimer);
  if (state.gallery.length <= 1) return;
  state.slideTimer = setInterval(() => {
    state.slideIndex = (state.slideIndex + 1) % state.gallery.length;
    renderHero();
  }, 5200);
}

function renderNews() {
  const root = document.getElementById("newsList");
  if (!root) return;
  root.innerHTML = "";
  root.classList.remove("news-cards");

  if (!state.news.length) {
    const empty = createNode("p", "section-sub", "暂无团队新闻，请在后台新增。");
    root.appendChild(empty);
    return;
  }

  root.classList.add("news-cards");
  const sorted = [...state.news].sort(compareNewsRecords);
  sorted.forEach((item) => {
    const card = createNode("article", "news-card");
    const coverUrl = normalizeImageUrl(item.cover_url);
    if (coverUrl) {
      const img = document.createElement("img");
      img.src = coverUrl;
      img.alt = item.title || "新闻封面";
      img.loading = "lazy";
      bindPreview(img, item.title || "团队新闻");
      card.appendChild(img);
    }

    const box = createNode("div", "news-card-body");
    appendPinBadge(box, item);
    box.appendChild(createNode("div", "news-date", item.date || "未填写日期"));
    box.appendChild(createNode("div", "news-title", item.title || "未命名新闻"));
    box.appendChild(createNode("div", "news-summary", item.summary || "点击查看新闻详情"));
    const more = document.createElement("a");
    more.className = "news-more";
    more.href = `/news?id=${encodeURIComponent(item.id || "")}`;
    more.textContent = "查看详情";
    box.appendChild(more);
    card.appendChild(box);
    root.appendChild(card);
  });
}

function normalizeReviewAlbum(item) {
  if (!item || typeof item !== "object") return null;
  const imageUrls = Array.isArray(item.image_urls)
    ? item.image_urls.map(normalizeImageUrl).filter(Boolean)
    : [];
  const cover = normalizeImageUrl(item.cover_url || imageUrls[0] || "");
  if (cover && !imageUrls.includes(cover)) imageUrls.unshift(cover);
  return {
    id: String(item.id || cover || ""),
    title: String(item.title || "团队回顾").trim(),
    date: String(item.date || "").trim(),
    category: String(item.category || "").trim(),
    summary: String(item.summary || "").trim(),
    content: String(item.content || "").trim(),
    cover_url: cover || imageUrls[0] || "",
    image_urls: imageUrls,
    pinned: isPinned(item),
    created_at: String(item.created_at || ""),
    updated_at: String(item.updated_at || ""),
  };
}

function getReviewAlbumCover(album) {
  return normalizeImageUrl(album && (album.cover_url || (album.image_urls || [])[0]));
}

function renderReview() {
  const root = document.getElementById("reviewGrid");
  if (!root) return;
  root.innerHTML = "";

  if (!state.reviewAlbums.length) {
    root.appendChild(createNode("p", "section-sub", "暂无团队回顾栏目，请在后台新增。"));
    return;
  }

  const sorted = [...state.reviewAlbums].sort(comparePinnedRecords);
  sorted.forEach((album) => {
    const card = createNode("article", "review-card review-album-card");
    const link = document.createElement("a");
    link.className = "review-card-link";
    link.href = `/review/${encodeURIComponent(album.id)}`;
    const cover = getReviewAlbumCover(album);
    if (cover) {
      const img = document.createElement("img");
      img.src = cover;
      img.alt = album.title || "团队回顾";
      img.loading = "lazy";
      bindPreview(img, album.title || "团队回顾", { preventParentLink: true });
      link.appendChild(img);
    } else {
      const empty = createNode("div", "review-empty-cover", "Flyteam");
      link.appendChild(empty);
    }
    const body = createNode("div", "review-body");
    appendPinBadge(body, album);
    const meta = [album.date, album.category, `${(album.image_urls || []).length} 张照片`].filter(Boolean).join(" | ");
    if (meta) body.appendChild(createNode("p", "review-meta", meta));
    body.appendChild(createNode("h3", "review-title", album.title || "团队回顾"));
    body.appendChild(createNode("p", "review-desc", album.summary || "点击查看本次活动的图文回顾。"));
    body.appendChild(createNode("span", "review-more", "进入回顾详情 →"));
    link.appendChild(body);
    card.appendChild(link);
    root.appendChild(card);
  });
}

function renderReviewDetail() {
  const root = document.getElementById("reviewDetail");
  if (!root) return;
  const albumId = decodeURIComponent((location.pathname.split("/").filter(Boolean).pop() || "").trim());
  const album = state.reviewAlbums.find((item) => String(item.id) === albumId);
  const titleEl = document.getElementById("reviewDetailTitle");
  const metaEl = document.getElementById("reviewDetailMeta");
  const summaryEl = document.getElementById("reviewDetailSummary");
  const contentEl = document.getElementById("reviewDetailContent");
  const grid = document.getElementById("reviewDetailGrid");

  if (!album) {
    if (titleEl) titleEl.textContent = "未找到该团队回顾";
    if (summaryEl) summaryEl.textContent = "该回顾栏目可能已被删除或链接不正确。";
    if (grid) grid.innerHTML = "";
    return;
  }

  document.title = `${album.title || "团队回顾"} - Flyteam`;
  if (titleEl) titleEl.textContent = album.title || "团队回顾";
  if (metaEl) metaEl.textContent = [album.date, album.category, `${(album.image_urls || []).length} 张照片`].filter(Boolean).join(" | ");
  if (summaryEl) summaryEl.textContent = album.summary || "记录 Flyteam 的重要时刻。";
  if (contentEl) contentEl.textContent = album.content || "暂无更多文字记录。";
  if (!grid) return;
  grid.innerHTML = "";
  if (!album.image_urls.length) {
    grid.appendChild(createNode("p", "section-sub", "该栏目暂无照片。"));
    return;
  }
  album.image_urls.forEach((url, idx) => {
    const safeUrl = normalizeImageUrl(url);
    if (!safeUrl) return;
    const fig = document.createElement("figure");
    fig.className = "review-photo-card";
    const img = document.createElement("img");
    img.src = safeUrl;
    img.loading = idx < 2 ? "eager" : "lazy";
    img.alt = `${album.title || "团队回顾"} ${idx + 1}`;
    bindPreview(img, album.title || "团队回顾");
    fig.appendChild(img);
    fig.appendChild(createNode("figcaption", "review-photo-caption", `${album.title || "团队回顾"} · ${idx + 1}`));
    grid.appendChild(fig);
  });
}

function renderAwards() {
  const root = document.getElementById("awardGrid");
  if (!root) return;
  root.innerHTML = "";

  if (!state.awardTypeInitialized) {
    const hashType = normalizeAwardType((location.hash || "").replace("#", ""));
    state.activeAwardType = hashType;
    state.awardTypeInitialized = true;
  }

  const switchRoot = document.getElementById("awardTypeSwitch");
  const hint = document.getElementById("awardTypeHint");
  if (switchRoot) {
    const counts = state.awards.reduce(
      (acc, item) => {
        const key = normalizeAwardType(item && (item.award_type || item.category || item.type));
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { team: 0, personal: 0 }
    );
    switchRoot.querySelectorAll("[data-award-type]").forEach((button) => {
      const key = normalizeAwardType(button.dataset.awardType);
      const active = key === state.activeAwardType;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      const countEl = button.querySelector(".award-switch-count");
      if (countEl) countEl.textContent = `${counts[key] || 0} 项`;
      if (!button.dataset.boundAwardSwitch) {
        button.dataset.boundAwardSwitch = "1";
        button.addEventListener("click", () => {
          state.activeAwardType = normalizeAwardType(button.dataset.awardType);
          if (history.replaceState) history.replaceState(null, "", `#${state.activeAwardType}`);
          renderAwards();
        });
      }
    });
  }

  const activeMeta = AWARD_TYPE_META[state.activeAwardType] || AWARD_TYPE_META.team;
  if (hint) hint.textContent = `${activeMeta.label} · ${activeMeta.desc}`;

  if (!state.awards.length) {
    root.appendChild(createNode("p", "section-sub", "暂无奖项数据，请在后台添加。"));
    return;
  }

  const filtered = state.awards
    .filter((item) => normalizeAwardType(item && (item.award_type || item.category || item.type)) === state.activeAwardType)
    .sort(compareAwardRecords);

  if (!filtered.length) {
    root.appendChild(createNode("p", "section-sub", activeMeta.empty));
    return;
  }

  filtered.forEach((item) => {
    const card = createNode("article", "card award-card");
    const imageUrl = normalizeImageUrl(item.image_url);
    if (imageUrl) {
      const media = createNode("div", "card-media award-media");
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = item.title || "奖项图片";
      img.loading = "lazy";
      img.className = "card-image award-image";
      bindPreview(img, item.title || "奖项荣誉");
      media.appendChild(img);
      card.appendChild(media);
    }
    const body = createNode("div", "card-body");
    appendPinBadge(body, item);
    const badgeRow = createNode("div", "award-badge-row");
    badgeRow.appendChild(createNode("span", "award-type-badge", awardTypeLabel(item.award_type || item.category || item.type)));
    badgeRow.appendChild(createNode("span", `award-level-badge ${awardLevelClass(item.level)}`, normalizeAwardLevel(item.level)));
    body.appendChild(badgeRow);
    body.appendChild(createNode("h3", "card-title", item.title || "未命名奖项"));
    const meta = [item.year, item.organizer].filter(Boolean).join(" | ");
    body.appendChild(createNode("p", "card-meta", meta || "信息待完善"));
    if (item.description) body.appendChild(createNode("p", "card-desc", item.description));
    card.appendChild(body);
    root.appendChild(card);
  });
}

function renderSeniors() {
  const root = document.getElementById("seniorGrid");
  if (!root) return;
  root.innerHTML = "";

  if (!state.seniors.length) {
    root.appendChild(createNode("p", "section-sub", "暂无前辈墙数据，请在后台添加。"));
    return;
  }

  [...state.seniors].sort(comparePinnedRecords).forEach((item) => {
    const card = createNode("article", "card senior-card");
    const photoUrl = normalizeImageUrl(item.photo_url);
    if (photoUrl) {
      const media = createNode("div", "card-media senior-media");
      const img = document.createElement("img");
      img.src = photoUrl;
      img.alt = item.name || "前辈照片";
      img.loading = "lazy";
      img.className = "card-image senior-image";
      bindPreview(img, item.name ? `${item.name} - 前辈墙` : "前辈墙");
      media.appendChild(img);
      card.appendChild(media);
    }
    const body = createNode("div", "card-body");
    appendPinBadge(body, item);
    if (isResponsible(item)) body.appendChild(createNode("span", "responsible-badge public-responsible", "负责人"));
    body.appendChild(createNode("h3", "card-title", item.name || "未命名"));
    const hall = HALL_NAME_MAP[item.hall] || item.hall || "";
    const meta = [item.grade, hall, item.direction].filter(Boolean).join(" | ");
    body.appendChild(createNode("p", "card-meta", meta || "信息待完善"));
    body.appendChild(createNode("p", "card-desc", item.intro || "-"));
    if (item.advice) body.appendChild(createNode("p", "card-desc advice", `给后辈：${item.advice}`));
    if (item.achievements) body.appendChild(createNode("p", "card-meta", `成果：${item.achievements}`));
    card.appendChild(body);
    root.appendChild(card);
  });
}

function renderIntro() {
  const textEl = document.getElementById("introText");
  const imageEl = document.getElementById("introImage");
  if (textEl) textEl.textContent = state.teamIntro || DEFAULT_INTRO;
  if (imageEl) {
    if (state.gallery.length) {
      const normalized = state.gallery.map(normalizeImageUrl).filter(Boolean);
      const logoImage =
        normalized.find((url) =>
          INTRO_LOGO_HINTS.some((hint) => url.toLowerCase().includes(hint)),
        ) || normalized[0];
      imageEl.src = logoImage;
      imageEl.title = "点击查看原图";
      imageEl.onclick = () => openImageLightbox(logoImage, "Flyteam 队徽");
      imageEl.style.display = "block";
    } else {
      imageEl.style.display = "none";
      imageEl.onclick = null;
    }
  }
}

async function initRecruitForm() {
  const form = document.getElementById("recruitForm");
  const msg = document.getElementById("recruitMsg");
  const hallSelect = document.getElementById("hallSelect");
  if (!form || !msg || !hallSelect) return;

  try {
    const halls = await fetchJSON("/api/recruit/halls");
    hallSelect.innerHTML = "";
    Object.entries(halls).forEach(([key, value]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = value;
      hallSelect.appendChild(opt);
    });
  } catch {
    hallSelect.innerHTML = "<option value=\"binary\">二进制</option><option value=\"web\">Web</option><option value=\"dev\">开发</option>";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    msg.textContent = "正在提交...";
    try {
      await fetchJSON("/api/recruit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      msg.textContent = "提交成功，我们会尽快联系你。";
      form.reset();
    } catch (err) {
      msg.textContent = `提交失败：${err.message}`;
    }
  });
}

async function loadContent() {
  const data = await fetchJSON("/api/content");
  const incomingGallery = Array.isArray(data.gallery) ? data.gallery.map(normalizeImageUrl).filter(Boolean) : [];
  if (document.body.classList.contains("home-only")) {
    if (!state.galleryRandomized || incomingGallery.join("|") !== state.gallerySourceSignature) {
      state.gallery = shuffledCopy(incomingGallery);
      state.gallerySourceSignature = incomingGallery.join("|");
      state.slideIndex = state.gallery.length ? Math.floor(randomUnit() * state.gallery.length) : 0;
      state.galleryRandomized = true;
    }
  } else {
    state.gallery = incomingGallery;
  }
  state.news = Array.isArray(data.news) ? data.news : [];
  state.reviewAlbums = Array.isArray(data.review_albums)
    ? data.review_albums.map(normalizeReviewAlbum).filter(Boolean)
    : [];
  state.reviewImages = Array.isArray(data.review_images)
    ? data.review_images
        .map((item) => {
          if (typeof item === "string") {
            const clean = normalizeImageUrl(item);
            return clean ? { id: clean, url: clean, title: "团队回顾", description: "" } : null;
          }
          if (!item || typeof item !== "object") return null;
          const url = normalizeImageUrl(item.url);
          if (!url) return null;
          return {
            id: String(item.id || url),
            url,
            title: String(item.title || "").trim(),
            description: String(item.description || "").trim(),
          };
        })
        .filter(Boolean)
    : [];
  if (!state.reviewAlbums.length && state.reviewImages.length) {
    state.reviewAlbums = [
      {
        id: "legacy-review",
        title: "团队回顾照片",
        date: "",
        category: "历史回顾",
        summary: "历史团队回顾照片合集。",
        content: "",
        cover_url: state.reviewImages[0].url,
        image_urls: state.reviewImages.map((item) => item.url),
      },
    ];
  }
  state.awards = Array.isArray(data.awards)
    ? data.awards.map((item) => ({
        ...item,
        award_type: normalizeAwardType(item && (item.award_type || item.category || item.type)),
        level: normalizeAwardLevel(item && item.level),
      }))
    : [];
  state.seniors = Array.isArray(data.seniors) ? data.seniors : [];
  state.teamIntro = typeof data.team_intro === "string" ? data.team_intro : "";
  state.teamOverview = typeof data.team_overview === "string" ? data.team_overview : "";

  if (state.slideIndex >= state.gallery.length) state.slideIndex = 0;
  const heroOverviewEl = document.getElementById("heroOverview");
  if (heroOverviewEl) heroOverviewEl.textContent = state.teamOverview || DEFAULT_OVERVIEW;
  renderHero();
  restartHeroTimer();
  renderNews();
  renderReview();
  renderReviewDetail();
  renderAwards();
  renderSeniors();
  renderIntro();
}

function appendChat(role, text) {
  const root = document.getElementById("chatMessages");
  if (!root) return;
  const item = createNode("div", `bubble ${role}`, text);
  root.appendChild(item);
  root.scrollTop = root.scrollHeight;
}

function initChat() {
  const fab = document.getElementById("chatFab");
  const panel = document.getElementById("chatPanel");
  const closeBtn = document.getElementById("chatClose");
  const sendBtn = document.getElementById("chatSend");
  const chatText = document.getElementById("chatText");
  if (!fab || !panel || !closeBtn || !sendBtn || !chatText) return;

  appendChat("assistant", "你好，我是 Flyteam 助手。可以问我成员、堂口、赛事和招新信息。");

  fab.addEventListener("click", () => panel.classList.toggle("open"));
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  sendBtn.addEventListener("click", async () => {
    const question = chatText.value.trim();
    if (!question || state.chatBusy) return;
    state.chatBusy = true;
    appendChat("user", question);
    chatText.value = "";

    try {
      const data = await fetchJSON("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, top_k: 10 }),
      });
      let answer = data.answer || "暂无回答";
      if (Array.isArray(data.sources) && data.sources.length) {
        const src = data.sources.slice(0, 2).map((s) => `${s.source} 第${Number(s.page) + 1}页`).join("；");
        answer += `\n\n来源：${src}`;
      }
      appendChat("assistant", answer);
    } catch (err) {
      appendChat("assistant", `提问失败：${err.message}`);
    } finally {
      state.chatBusy = false;
    }
  });
}

async function init() {
  initImageLightbox();
  try {
    await loadContent();
  } catch (err) {
    console.error(err);
  }
  await initRecruitForm();
  initChat();
}

init();

