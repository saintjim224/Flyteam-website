const state = {
  halls: {
    binary: "二进制（RE / PWN）",
    web: "Web（含 Misc / 密码）",
    dev: "开发",
    management: "团队管理",
  },
  hallDescriptions: {
    binary: "适合喜欢逆向、漏洞利用、底层攻防的同学。",
    web: "适合喜欢 Web 安全、应用漏洞分析、脚本工具与密码方向的同学。",
    dev: "适合喜欢工程化、平台开发、安全产品与自动化建设的同学。",
    management: "适合愿意参与团队组织、宣传运营、活动协调与项目管理的同学。",
  },
  hallCounts: { binary: 0, web: 0, dev: 0, management: 0 },
  activeHall: "binary",
  captchaToken: "",
  chatBusy: false,
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

function hallOrder() {
  return ["binary", "web", "dev", "management"].filter((k) => state.halls[k]);
}

function updateHallInput() {
  const hallInput = document.getElementById("hallInput");
  const hallDisplay = document.getElementById("hallDisplay");
  const hallHint = document.getElementById("hallHint");
  if (hallInput) hallInput.value = state.activeHall;
  if (hallDisplay) hallDisplay.value = state.halls[state.activeHall] || state.activeHall;
  if (hallHint) hallHint.textContent = `${state.halls[state.activeHall]}：${state.hallDescriptions[state.activeHall] || ""}`;
}

async function loadCaptcha() {
  const tokenEl = document.getElementById("captchaToken");
  const questionEl = document.getElementById("captchaQuestion");
  const answerEl = document.getElementById("captchaAnswer");
  if (questionEl) questionEl.textContent = "加载中...";
  try {
    const data = await fetchJSON("/api/recruit/captcha", { cache: "no-store" });
    state.captchaToken = data.token || "";
    if (tokenEl) tokenEl.value = state.captchaToken;
    if (questionEl) questionEl.textContent = data.challenge || "请刷新验证码";
    if (answerEl) answerEl.value = "";
  } catch (err) {
    state.captchaToken = "";
    if (tokenEl) tokenEl.value = "";
    if (questionEl) questionEl.textContent = `验证码加载失败：${err.message}`;
  }
}

function initCaptchaRefresh() {
  const btn = document.getElementById("captchaRefresh");
  if (!btn) return;
  btn.addEventListener("click", () => loadCaptcha());
}

function renderHallFilters() {
  const root = document.getElementById("hallFilters");
  if (!root) return;
  root.innerHTML = "";

  hallOrder().forEach((key) => {
    const btn = createNode("button", "grade-btn", state.halls[key]);
    if (key === state.activeHall) btn.classList.add("on");
    const badge = createNode("span", "grade-badge", String(state.hallCounts[key] || 0));
    btn.appendChild(badge);
    btn.addEventListener("click", () => {
      state.activeHall = key;
      renderHallFilters();
      updateHallInput();
    });
    root.appendChild(btn);
  });
}

async function initRecruitForm() {
  const form = document.getElementById("recruitForm");
  const msg = document.getElementById("recruitMsg");
  if (!form || !msg) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : "提交报名";
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.hall = state.activeHall;
    payload.captcha_token = state.captchaToken || payload.captcha_token || "";

    if (!payload.captcha_token || !String(payload.captcha_answer || "").trim()) {
      msg.textContent = "请先完成动态验证码。";
      await loadCaptcha();
      return;
    }

    msg.textContent = "正在提交...";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "提交中";
    }
    try {
      await fetchJSON("/api/recruit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      msg.textContent = "提交成功，我们会尽快联系你。";
      form.reset();
      updateHallInput();
      await loadCaptcha();
      await loadHallStats();
      renderHallFilters();
    } catch (err) {
      msg.textContent = `提交失败：${err.message}`;
      await loadCaptcha();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

async function loadHalls() {
  try {
    const halls = await fetchJSON("/api/recruit/halls");
    if (halls && typeof halls === "object") {
      state.halls = halls;
      if (!state.halls[state.activeHall]) {
        state.activeHall = Object.keys(state.halls)[0] || "binary";
      }
    }
  } catch {
    // fallback to default halls
  }
}

async function loadHallStats() {
  try {
    const data = await fetchJSON("/api/recruit/stats");
    const stats = data.stats || {};
    state.hallCounts = {
      binary: Number(stats.binary || 0),
      web: Number(stats.web || 0),
      dev: Number(stats.dev || 0),
      management: Number(stats.management || 0),
    };
  } catch {
    state.hallCounts = { binary: 0, web: 0, dev: 0, management: 0 };
  }
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

  appendChat("assistant", "你好，我是 Flyteam 助手。你可以先选择堂口再提交报名。");
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
  await loadHalls();
  await loadHallStats();
  renderHallFilters();
  updateHallInput();
  initCaptchaRefresh();
  await loadCaptcha();
  await initRecruitForm();
  initChat();
}

init();
