const state = {
  seniors: [],
  activeGrade: "all",
  chatBusy: false,
};

const HALL_NAME_MAP = {
  binary: "二进制（RE / PWN）",
  web: "Web（含 Misc / 密码）",
  dev: "开发",
  management: "团队管理",
};

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

function normalizeImageUrl(url) {
  return typeof url === "string" ? url.trim() : "";
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

function compareSeniors(a, b) {
  const pa = isPinned(a) ? 1 : 0;
  const pb = isPinned(b) ? 1 : 0;
  if (pa !== pb) return pb - pa;
  const ga = parseGradeCode(a.grade);
  const gb = parseGradeCode(b.grade);
  if (ga === "leader" && gb !== "leader") return -1;
  if (gb === "leader" && ga !== "leader") return 1;
  return Number(gb || 0) - Number(ga || 0);
}

function parseGradeCode(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (["帮主", "帮主级", "leader"].includes(text.toLowerCase()) || text.includes("帮主")) return "leader";
  const fullYear = text.match(/20(1[3-9]|2[0-9])/);
  if (fullYear) return fullYear[0].slice(-2);
  const shortYear = text.match(/(^|[^0-9])(1[3-9]|2[0-9])([^0-9]|$)/);
  if (shortYear) return shortYear[2];
  return "";
}

function listGradeCodes() {
  const result = ["all", "leader", "responsible"];
  const currentShortYear = Number(String(new Date().getFullYear()).slice(-2)) + 1;
  for (let i = 13; i <= currentShortYear; i += 1) result.push(String(i));
  return result;
}

function gradeLabel(code) {
  if (code === "all") return "全部";
  if (code === "leader") return "帮主";
  if (code === "responsible") return "负责人";
  return `${code}级`;
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

function bindPreview(img, caption) {
  if (!img) return;
  img.title = "双击查看原图";
  img.classList.add("zoomable-image");
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

function filteredSeniors() {
  if (state.activeGrade === "all") return state.seniors;
  if (state.activeGrade === "responsible") return state.seniors.filter(isResponsible);
  return state.seniors.filter((item) => parseGradeCode(item.grade) === state.activeGrade);
}

function renderGradeFilters() {
  const root = document.getElementById("gradeFilters");
  if (!root) return;
  root.innerHTML = "";

  const allCodes = listGradeCodes();
  const counts = new Map();
  state.seniors.forEach((item) => {
    if (isResponsible(item)) counts.set("responsible", (counts.get("responsible") || 0) + 1);
    const code = parseGradeCode(item.grade);
    if (!code) return;
    counts.set(code, (counts.get(code) || 0) + 1);
  });

  allCodes.forEach((code) => {
    const btn = createNode("button", "grade-btn", gradeLabel(code));
    if (code === state.activeGrade) btn.classList.add("on");
    const count = code === "all" ? state.seniors.length : (counts.get(code) || 0);
    const badge = createNode("span", "grade-badge", String(count));
    btn.appendChild(badge);
    btn.addEventListener("click", () => {
      state.activeGrade = code;
      renderGradeFilters();
      renderSeniors();
    });
    root.appendChild(btn);
  });
}

function renderSeniors() {
  const root = document.getElementById("flyteamersGrid");
  const stat = document.getElementById("gradeStat");
  if (!root) return;
  root.innerHTML = "";

  const list = filteredSeniors();
  if (stat) stat.textContent = `${gradeLabel(state.activeGrade)}：${list.length} 人`;

  if (!list.length) {
    root.appendChild(createNode("p", "section-sub", "该级别暂无成员数据。"));
    return;
  }

  list.forEach((item) => {
    const card = createNode("article", "card senior-card");
    const photoUrl = normalizeImageUrl(item.photo_url);
    if (photoUrl) {
      const media = createNode("div", "card-media senior-media");
      const img = document.createElement("img");
      img.src = photoUrl;
      img.alt = item.name || "成员照片";
      img.loading = "lazy";
      img.className = "card-image senior-image";
      bindPreview(img, `${item.name || "Flyteamers"} - ${item.grade || ""}`);
      media.appendChild(img);
      card.appendChild(media);
    }

    const body = createNode("div", "card-body");
    if (isPinned(item)) body.appendChild(createNode("span", "pin-badge public-pin", "置顶"));
    if (isResponsible(item)) body.appendChild(createNode("span", "responsible-badge public-responsible", "负责人"));
    body.appendChild(createNode("h3", "card-title", item.name || "未命名"));
    const hall = HALL_NAME_MAP[item.hall] || item.hall || "";
    const meta = [item.grade, hall, item.direction].filter(Boolean).join(" | ");
    body.appendChild(createNode("p", "card-meta", meta || "信息待完善"));
    if (item.intro) body.appendChild(createNode("p", "card-desc", item.intro));
    if (item.achievements) body.appendChild(createNode("p", "card-meta", `成果：${item.achievements}`));
    if (item.advice) body.appendChild(createNode("p", "card-desc advice", `给后辈：${item.advice}`));
    card.appendChild(body);
    root.appendChild(card);
  });
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
        const src = data.sources
          .slice(0, 2)
          .map((s) => `${s.source} 第${Number(s.page) + 1}页`)
          .join("；");
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
  initChat();
  try {
    const data = await fetchJSON("/api/content");
    state.seniors = Array.isArray(data.seniors) ? data.seniors : [];
    state.seniors.sort(compareSeniors);
    renderGradeFilters();
    renderSeniors();
  } catch (err) {
    const root = document.getElementById("flyteamersGrid");
    if (root) root.appendChild(createNode("p", "section-sub", `加载失败：${err.message}`));
  }
}

init();
