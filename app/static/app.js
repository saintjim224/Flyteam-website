const { createApp } = Vue;

const CURRENT_YEAR = new Date().getFullYear();
const SPECIAL_SENIOR_GRADE = "帮主";
const SENIOR_GRADE_OPTIONS = (() => {
  const list = [SPECIAL_SENIOR_GRADE];
  for (let year = 2013; year <= CURRENT_YEAR + 1; year += 1) {
    list.push(`${year}级`);
  }
  return list;
})();
const DEFAULT_SENIOR_GRADE = `${CURRENT_YEAR}级`;
const AWARD_TYPE_OPTIONS = [
  { value: "team", label: "团队赛" },
  { value: "personal", label: "个人赛" },
];
const AWARD_LEVEL_OPTIONS = [
  { value: "国家级", label: "国家级" },
  { value: "省级", label: "省级" },
];

createApp({
  data() {
    return {
      featureTabs: [
        { key: "overview", label: "团队概况", desc: "团队定位、数据概览、整体介绍" },
        { key: "gallery", label: "轮播管理", desc: "上传并实时更新首页轮播图片" },
        { key: "news", label: "团队新闻", desc: "维护前台新闻列表与时间" },
        { key: "review", label: "团队回顾", desc: "按团建、会议、比赛等栏目管理多图回顾" },
        { key: "intro", label: "团队简介", desc: "维护前台底部团队介绍文案" },
        { key: "awards", label: "奖项展示", desc: "新增/删除奖项，统一对外展示" },
        { key: "seniors", label: "前辈墙", desc: "展示学长学姐风采，支持照片管理" },
        { key: "recruit", label: "报名管理", desc: "查看、搜索、删除报名信息，也可手动补录" },
        { key: "admins", label: "Admin", desc: "Admin login and user management" },
        { key: "knowledge", label: "知识库", desc: "PDF 入库与重建，服务问答系统" },
      ],
      activeFeature: "overview",
      isAdmin: false,
      adminToken: "",
      adminCsrfToken: sessionStorage.getItem("flyteam_admin_csrf") || "",
      adminLastActiveAt: 0,
      adminSessionTimeoutMs: 30 * 60 * 1000,
      adminTimeoutTimer: null,
      adminActivityHandler: null,
      currentAdmin: null,
      loginForm: {
        username: "admin",
        password: "",
      },
      loginText: "请使用管理员账号和密码登录。",
      adminUsers: [],
      adminUserForm: {
        username: "",
        display_name: "",
        password: "",
        role: "admin",
      },
      adminUserText: "登录后可添加、删除或重置管理员用户。",

      heroImages: [],
      currentSlide: 0,
      slideTimer: null,
      pollTimer: null,

      imageText: "可上传多张图片，上传后将立即更新首页轮播。",
      statusText: "等待查询...",
      uploadPdfText: "支持多个 PDF，自动切分并向量化。",
      selectedPdfs: [],

      awards: [],
      seniors: [],
      newsList: [],
      reviewImages: [],
      reviewAlbums: [],
      selectedReviewAlbumFiles: [],
      reviewAlbumForm: {
        title: "",
        date: "",
        category: "",
        summary: "",
        content: "",
        pinned: false,
      },
      reviewEditDrafts: {},
      teamIntro: "",
      teamOverview: "",
      overviewText: "编辑后保存，前台首页概况会实时更新。",
      newsText: "新增后会实时展示在前台“团队新闻”模块。",
      newsImageText: "可上传新闻封面与正文配图；正文图可点击“插入正文”放到正文任意位置。",
      reviewText: "回顾按栏目/相册展示；每个栏目可维护摘要、正文与多张照片。",
      introText: "编辑后保存，前台底部会实时更新。",
      awardImageText: "可上传奖项配图，支持 jpg/png/webp。",
      awardTypeOptions: AWARD_TYPE_OPTIONS,
      awardLevelOptions: AWARD_LEVEL_OPTIONS,
      seniorImageText: "可上传前辈照片，建议 4:5 或 1:1。",
      seniorEditDrafts: {},
      seniorEditingState: {},
      seniorGradeOptions: SENIOR_GRADE_OPTIONS,
      newsForm: {
        title: "",
        date: "",
        source: "",
        summary: "",
        content: "",
        cover_url: "",
        image_urls: [],
        pinned: false,
      },
      editingNewsId: "",
      newsEditForm: {
        id: "",
        title: "",
        date: "",
        source: "",
        summary: "",
        content: "",
        cover_url: "",
        image_urls: [],
        pinned: false,
      },
      newsEditImageText: "编辑已上传的新闻时，可更换封面、追加正文配图并插入到正文。",
      awardForm: {
        title: "",
        award_type: "team",
        year: "",
        level: "省级",
        organizer: "",
        description: "",
        image_url: "",
        pinned: false,
      },
      seniorForm: {
        name: "",
        grade: DEFAULT_SENIOR_GRADE,
        hall: "binary",
        direction: "",
        intro: "",
        achievements: "",
        advice: "",
        photo_url: "",
        pinned: false,
        responsible: false,
      },

      recruitText: "报名信息仅管理员可见，进入后台后可查看与管理。",
      recruitList: [],
      recruitKeyword: "",
      hallNameMap: {
        binary: "二进制（RE / PWN）",
        web: "Web（含 Misc / 密码）",
        dev: "开发",
        management: "团队管理",
      },
      recruitForm: {
        name: "",
        student_id: "",
        college: "",
        grade: "",
        phone: "",
        wechat: "",
        email: "",
        hall: "binary",
        direction_detail: "",
        experience: "",
        weekly_hours: "",
        note: "",
        pinned: false,
      },

      chatOpen: false,
      assistantInput: "",
      assistantBusy: false,
      assistantMessages: [
        {
          role: "assistant",
          text: "你好，我是 Flyteam 信息助手。可以问我：团队方向、成员、奖项、招新流程等。",
          sources: [],
        },
      ],
    };
  },
  computed: {
    groupedRecruit() {
      const keyword = String(this.recruitKeyword || "").trim().toLowerCase();
      const base = keyword
        ? this.recruitList.filter((x) => JSON.stringify(x).toLowerCase().includes(keyword))
        : this.recruitList;
      const list = [...base].sort((a, b) => this.comparePinnedRecords(a, b));
      return {
        binary: list.filter((x) => x.hall === "binary"),
        web: list.filter((x) => x.hall === "web"),
        dev: list.filter((x) => x.hall === "dev"),
        management: list.filter((x) => x.hall === "management"),
      };
    },
    heroStyle() {
      if (!this.heroImages.length) {
        return {
          backgroundImage:
            "linear-gradient(120deg, #7f0f1d 0%, #18273f 54%, #0d355b 100%)",
        };
      }
      return {
        backgroundImage: `url(${this.heroImages[this.currentSlide]})`,
      };
    },
    isSuperAdmin() {
      return !!(this.currentAdmin && this.currentAdmin.role === "superadmin");
    },
    visibleFeatureTabs() {
      return this.featureTabs.filter((item) => item.key !== "admins" || this.isSuperAdmin);
    },
  },
  mounted() {
    this.init();
  },
  unmounted() {
    this.stopSlideTimer();
    this.stopPollTimer();
    this.stopAdminTimeoutWatcher();
  },
  methods: {
    getAdminTokenKey() {
      return "flyteam_admin_token";
    },

    getAdminLastActiveKey() {
      return "flyteam_admin_last_active_at";
    },

    getAdminCsrfKey() {
      return "flyteam_admin_csrf";
    },

    isAdminSessionExpired(lastActiveAt) {
      const last = Number(lastActiveAt || 0);
      if (!last) return false;
      return Date.now() - last > this.adminSessionTimeoutMs;
    },

    clearAdminSession() {
      this.isAdmin = false;
      this.adminToken = "";
      this.adminCsrfToken = "";
      this.adminLastActiveAt = 0;
      this.currentAdmin = null;
      this.adminUsers = [];
      localStorage.removeItem(this.getAdminTokenKey());
      localStorage.removeItem(this.getAdminLastActiveKey());
      sessionStorage.removeItem(this.getAdminCsrfKey());
    },

    async init() {
      this.adminToken = localStorage.getItem(this.getAdminTokenKey()) || "";
      this.adminLastActiveAt = Number(localStorage.getItem(this.getAdminLastActiveKey()) || "0");
      if (this.adminToken) {
        if (this.isAdminSessionExpired(this.adminLastActiveAt)) {
          this.clearAdminSession();
        } else {
          await this.tryAdminPing();
        }
      } else {
        await this.tryAdminPing();
      }
      await Promise.all([this.loadContent(), this.refreshStatus(), this.isAdmin ? this.fetchRecruitList() : Promise.resolve()]);
      this.startSlideTimer();
      this.startPollTimer();
      this.startAdminTimeoutWatcher();
    },

    async fetchJSON(url, options = {}) {
      if (!options.headers) {
        options.headers = {};
      }
      if (this.isAdmin && this.adminToken && !options.headers["X-Admin-Token"]) {
        options.headers["X-Admin-Token"] = this.adminToken;
      }
      const method = String(options.method || "GET").toUpperCase();
      if (this.isAdmin && this.adminCsrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method) && !options.headers["X-CSRF-Token"]) {
        options.headers["X-CSRF-Token"] = this.adminCsrfToken;
      }
      options.credentials = options.credentials || "same-origin";
      const res = await fetch(url, options);
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const detail = (data && (data.detail || data.message)) || raw || `请求失败（HTTP ${res.status}）`;
        throw new Error(detail);
      }
      return data || {};
    },

    async tryAdminPing() {
      try {
        const headers = this.adminToken ? { "X-Admin-Token": this.adminToken } : {};
        const data = await fetch("/api/admin/ping", {
          headers,
          credentials: "same-origin",
        }).then(async (r) => {
          const raw = await r.text();
          let parsed = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = {};
          }
          if (!r.ok) throw new Error("invalid token");
          return parsed;
        });
        this.isAdmin = true;
        this.currentAdmin = data.user || { username: "admin", role: "admin" };
        this.adminCsrfToken = data.csrf_token || this.adminCsrfToken || "";
        if (this.adminCsrfToken) sessionStorage.setItem(this.getAdminCsrfKey(), this.adminCsrfToken);
        this.touchAdminActivity();
        await this.fetchAdminUsers();
      } catch {
        this.clearAdminSession();
      }
    },

    adminLogin() {
      this.activeFeature = "admins";
      this.scrollToModules();
    },

    async adminSubmitLogin() {
      const username = String(this.loginForm.username || "").trim();
      const password = String(this.loginForm.password || "");
      if (!username || !password) {
        this.loginText = "请输入用户名和密码。";
        return;
      }
      this.loginText = "正在登录...";
      try {
        const data = await this.fetchJSON("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        this.adminToken = "";
        this.adminCsrfToken = data.csrf_token || "";
        this.currentAdmin = data.user || { username, role: "admin" };
        this.isAdmin = true;
        localStorage.removeItem(this.getAdminTokenKey());
        if (this.adminCsrfToken) sessionStorage.setItem(this.getAdminCsrfKey(), this.adminCsrfToken);
        this.touchAdminActivity();
        this.loginForm.password = "";
        this.loginText = "后台登录成功。";
        await Promise.all([this.fetchRecruitList(), this.fetchAdminUsers()]);
      } catch (err) {
        this.clearAdminSession();
        this.loginForm.password = "";
        this.loginText = `登录失败： ${err.message}`;
      }
    },

    async adminLogout() {
      try {
        await this.fetchJSON("/api/admin/logout", { method: "POST" });
      } catch {
        // Ignore logout API errors and clear local state anyway.
      }
      this.clearAdminSession();
      window.location.href = "/login";
    },

    touchAdminActivity() {
      if (!this.isAdmin) return;
      const now = Date.now();
      // Limit write frequency to reduce localStorage churn.
      if (now - this.adminLastActiveAt < 8000) return;
      this.adminLastActiveAt = now;
      localStorage.setItem(this.getAdminLastActiveKey(), String(now));
    },

    onUserActivity() {
      this.touchAdminActivity();
    },

    bindAdminActivityListeners() {
      if (this.adminActivityHandler) return;
      this.adminActivityHandler = () => this.onUserActivity();
      ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((evt) => {
        window.addEventListener(evt, this.adminActivityHandler, { passive: true });
      });
    },

    startAdminTimeoutWatcher() {
      this.bindAdminActivityListeners();
      if (this.adminTimeoutTimer) clearInterval(this.adminTimeoutTimer);
      this.adminTimeoutTimer = setInterval(() => {
        if (!this.isAdmin) return;
        const now = Date.now();
        const last = Number(localStorage.getItem(this.getAdminLastActiveKey()) || this.adminLastActiveAt || "0");
        if (!last) {
          this.touchAdminActivity();
          return;
        }
        if (now - last > this.adminSessionTimeoutMs) {
          this.adminLogout();
          alert("后台登录已超时，已自动退出。");
        }
      }, 15000);
    },

    stopAdminTimeoutWatcher() {
      if (this.adminTimeoutTimer) {
        clearInterval(this.adminTimeoutTimer);
        this.adminTimeoutTimer = null;
      }
      if (this.adminActivityHandler) {
        ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((evt) => {
          window.removeEventListener(evt, this.adminActivityHandler);
        });
        this.adminActivityHandler = null;
      }
    },

    setActiveFeature(key) {
      if (key === "admins" && !this.isSuperAdmin) {
        this.activeFeature = "overview";
        return;
      }
      if (key !== "seniors" && this.hasSeniorEditing()) {
        this.seniorEditingState = {};
        this.seniorEditDrafts = {};
      }
      this.activeFeature = key;
      this.scrollToModules();
    },

    scrollToModules() {
      const el = document.getElementById("modules");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },

    async loadContent() {
      const data = await this.fetchJSON("/api/content");
      this.awards = Array.isArray(data.awards)
        ? data.awards
            .map((x) => ({
              ...x,
              award_type: this.normalizeAwardType(x && (x.award_type || x.category || x.type)),
              level: this.normalizeAwardLevel(x && x.level),
            }))
            .sort((a, b) => this.compareAwardRecords(a, b))
        : [];
      const incomingSeniors = Array.isArray(data.seniors)
        ? data.seniors
            .map((x) => ({
              ...x,
              grade: this.normalizeSeniorGrade(x && x.grade),
              pinned: this.isPinned(x),
              responsible: this.isResponsible(x),
            }))
            .sort((a, b) => this.comparePinnedRecords(a, b))
        : [];
      if (!this.hasSeniorEditing()) {
        this.seniors = incomingSeniors;
        this.seniorEditDrafts = {};
        this.seniorEditingState = {};
      } else {
        this.seniorImageText = "你正在编辑前辈资料，已暂停自动覆盖本地输入。";
      }
      this.newsList = Array.isArray(data.news)
        ? [...data.news].sort((a, b) => this.compareNewsRecords(a, b))
        : [];
      this.reviewAlbums = Array.isArray(data.review_albums)
        ? data.review_albums
            .map((item) => this.normalizeReviewAlbum(item))
            .filter(Boolean)
            .sort((a, b) => this.comparePinnedRecords(a, b))
        : [];
      this.reviewImages = Array.isArray(data.review_images)
        ? data.review_images
            .map((item) => {
              if (typeof item === "string") {
                const clean = item.trim();
                return clean ? { id: clean, url: clean, title: this.getFileName(clean), description: "" } : null;
              }
              if (!item || typeof item !== "object") return null;
              const cleanUrl = String(item.url || "").trim();
              if (!cleanUrl) return null;
              return {
                id: String(item.id || cleanUrl),
                url: cleanUrl,
                title: String(item.title || ""),
                description: String(item.description || ""),
              };
            })
            .filter(Boolean)
        : [];
      if (!this.reviewAlbums.length && this.reviewImages.length) {
        this.reviewAlbums = [
          {
            id: "legacy-review",
            title: "团队回顾照片",
            date: "",
            category: "历史回顾",
            summary: "历史团队回顾照片合集。",
            content: "",
            cover_url: this.reviewImages[0].url,
            image_urls: this.reviewImages.map((x) => x.url),
          },
        ];
      }
      this.teamIntro = typeof data.team_intro === "string" ? data.team_intro : "";
      this.teamOverview = typeof data.team_overview === "string" ? data.team_overview : "";
      const nextGallery = Array.isArray(data.gallery) ? data.gallery : [];
      this.heroImages = [...new Set(nextGallery)];
      if (this.currentSlide >= this.heroImages.length) {
        this.currentSlide = 0;
      }
      this.reviewEditDrafts = {};
      this.startSlideTimer();
    },

    startPollTimer() {
      this.stopPollTimer();
      this.pollTimer = setInterval(async () => {
        if (this.hasSeniorEditing()) return;
        try {
          await this.loadContent();
        } catch {
          // Keep silent in background polling.
        }
      }, 12000);
    },

    stopPollTimer() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },

    startSlideTimer() {
      this.stopSlideTimer();
      // Admin page uses compact layout by default; skip timer when hero banner is absent.
      if (!document.querySelector(".hero")) return;
      if (this.heroImages.length <= 1) return;
      this.slideTimer = setInterval(() => {
        this.nextSlide();
      }, 5200);
    },

    stopSlideTimer() {
      if (this.slideTimer) {
        clearInterval(this.slideTimer);
        this.slideTimer = null;
      }
    },

    nextSlide() {
      if (!this.heroImages.length) return;
      this.currentSlide = (this.currentSlide + 1) % this.heroImages.length;
    },

    goSlide(idx) {
      this.currentSlide = idx;
      this.startSlideTimer();
    },

    getFileName(url) {
      return (url || "").split("/").pop() || url;
    },

    parseSortTimestamp(value) {
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
    },

    recordSortText(item, fields = ["created_at", "date", "year", "grade"]) {
      for (const field of fields) {
        const value = String((item && item[field]) || "").trim();
        if (value) return value;
      }
      return "";
    },

    recordSortValue(item, fields = ["created_at", "date", "year", "grade"]) {
      for (const field of fields) {
        const ts = this.parseSortTimestamp(item && item[field]);
        if (ts) return ts;
      }
      return 0;
    },

    recordSortTime(item) {
      return this.recordSortText(item);
    },

    isPinned(item) {
      if (!item) return false;
      if (item.pinned === true || item.pinned === 1) return true;
      return String(item.pinned || "").trim().toLowerCase() === "true";
    },

    isResponsible(item) {
      if (!item) return false;
      const value = item.responsible ?? item.is_responsible ?? item.is_manager ?? false;
      if (value === true || value === 1) return true;
      return String(value || "").trim().toLowerCase() === "true" || String(value || "").trim() === "负责人";
    },

    normalizeAwardType(value) {
      const raw = String(value || "").trim().toLowerCase();
      if (raw === "personal" || raw === "individual" || raw === "solo" || raw.includes("个人")) return "personal";
      return "team";
    },

    awardTypeLabel(itemOrValue) {
      const value = itemOrValue && typeof itemOrValue === "object"
        ? itemOrValue.award_type || itemOrValue.category || itemOrValue.type
        : itemOrValue;
      const key = this.normalizeAwardType(value);
      const found = this.awardTypeOptions.find((item) => item.value === key);
      return found ? found.label : "团队赛";
    },

    normalizeAwardLevel(value) {
      const raw = String(value || "").trim();
      const lower = raw.toLowerCase();
      if (lower === "national" || raw.includes("国家") || raw.includes("全国")) return "国家级";
      if (lower.includes("prov") || raw.includes("省")) return "省级";
      return "省级";
    },

    awardLevelClass(itemOrValue) {
      const value = itemOrValue && typeof itemOrValue === "object" ? itemOrValue.level : itemOrValue;
      return this.normalizeAwardLevel(value) === "国家级" ? "national" : "provincial";
    },

    awardLevelRank(item) {
      return this.normalizeAwardLevel(item && item.level) === "国家级" ? 1 : 0;
    },

    comparePinnedRecords(a, b) {
      const pa = this.isPinned(a) ? 1 : 0;
      const pb = this.isPinned(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return this.recordSortValue(b) - this.recordSortValue(a)
        || this.recordSortText(b).localeCompare(this.recordSortText(a));
    },

    compareNewsRecords(a, b) {
      const pa = this.isPinned(a) ? 1 : 0;
      const pb = this.isPinned(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const fields = ["date", "created_at"];
      return this.recordSortValue(b, fields) - this.recordSortValue(a, fields)
        || this.recordSortText(b, fields).localeCompare(this.recordSortText(a, fields));
    },

    compareAwardRecords(a, b) {
      const pa = this.isPinned(a) ? 1 : 0;
      const pb = this.isPinned(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const la = this.awardLevelRank(a);
      const lb = this.awardLevelRank(b);
      if (la !== lb) return lb - la;
      const fields = ["date", "year", "created_at"];
      return this.recordSortValue(b, fields) - this.recordSortValue(a, fields)
        || this.recordSortText(b, fields).localeCompare(this.recordSortText(a, fields));
    },

    formatDateTime(value) {
      if (!value) return "";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("zh-CN", { hour12: false });
    },

    normalizeReviewAlbum(item) {
      if (!item || typeof item !== "object") return null;
      const imageUrls = Array.isArray(item.image_urls)
        ? item.image_urls.map((url) => String(url || "").trim()).filter(Boolean)
        : [];
      const cover = String(item.cover_url || imageUrls[0] || "").trim();
      if (cover && !imageUrls.includes(cover)) imageUrls.unshift(cover);
      return {
        id: String(item.id || cover || Date.now()),
        title: String(item.title || "团队回顾").trim(),
        date: String(item.date || "").trim(),
        category: String(item.category || "").trim(),
        summary: String(item.summary || "").trim(),
        content: String(item.content || "").trim(),
        cover_url: cover || imageUrls[0] || "",
        image_urls: imageUrls,
        pinned: this.isPinned(item),
        created_at: String(item.created_at || ""),
        updated_at: String(item.updated_at || ""),
      };
    },

    getReviewAlbumCover(album) {
      if (!album) return "";
      return String(album.cover_url || (Array.isArray(album.image_urls) ? album.image_urls[0] : "") || "").trim();
    },

    hasSeniorEditing() {
      return Object.values(this.seniorEditingState || {}).some(Boolean);
    },

    normalizeSeniorGrade(raw) {
      const text = String(raw || "").trim();
      if (!text) return DEFAULT_SENIOR_GRADE;
      if (["帮主", "帮主级", "leader", "Leader"].includes(text)) return SPECIAL_SENIOR_GRADE;
      if (this.seniorGradeOptions.includes(text)) return text;
      const match = text.match(/20\d{2}/);
      if (match) {
        const candidate = `${match[0]}级`;
        if (this.seniorGradeOptions.includes(candidate)) return candidate;
      }
      return DEFAULT_SENIOR_GRADE;
    },

    getSeniorDraft(item) {
      const id = String(item.id);
      if (!this.seniorEditDrafts[id]) {
        this.seniorEditDrafts[id] = {
          id,
          name: item.name || "",
          grade: this.normalizeSeniorGrade(item.grade),
          hall: item.hall || "binary",
          direction: item.direction || "",
          intro: item.intro || "",
          achievements: item.achievements || "",
          advice: item.advice || "",
          photo_url: item.photo_url || "",
          pinned: this.isPinned(item),
          responsible: this.isResponsible(item),
        };
      }
      return this.seniorEditDrafts[id];
    },

    buildSeniorPayload(source = {}, overrides = {}) {
      const merged = { ...(source || {}), ...(overrides || {}) };
      return {
        name: String(merged.name || "").trim(),
        grade: this.normalizeSeniorGrade(merged.grade),
        hall: merged.hall || "binary",
        direction: String(merged.direction || "").trim(),
        intro: String(merged.intro || "").trim(),
        achievements: String(merged.achievements || "").trim(),
        advice: String(merged.advice || "").trim(),
        photo_url: String(merged.photo_url || "").trim(),
        pinned: !!merged.pinned,
        responsible: !!merged.responsible,
      };
    },

    replaceSeniorLocal(id, patch) {
      const sid = String(id || "");
      if (!sid) return;
      this.seniors = this.seniors.map((item) => (
        String(item.id) === sid ? { ...item, ...(patch || {}) } : item
      ));
      if (this.seniorEditDrafts[sid]) {
        this.seniorEditDrafts[sid] = { ...this.seniorEditDrafts[sid], ...(patch || {}) };
      }
    },

    startSeniorEdit(item) {
      if (!item || !item.id) return;
      const id = String(item.id);
      this.getSeniorDraft(item);
      this.seniorEditingState[id] = true;
      this.seniorImageText = `正在编辑：${item.name || "未命名成员"}`;
    },

    cancelSeniorEdit(itemId) {
      const id = String(itemId || "");
      if (!id) return;
      delete this.seniorEditingState[id];
      delete this.seniorEditDrafts[id];
      this.seniorImageText = "已取消编辑。";
    },

    async onHeroImagePick(e) {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.imageText = "请先后台登录后再上传轮播图";
        e.target.value = "";
        return;
      }
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const form = new FormData();
      files.forEach((f) => form.append("files", f));

      this.imageText = "正在上传轮播图...";
      try {
        const data = await this.fetchJSON("/api/upload/images", {
          method: "POST",
          body: form,
        });
        this.imageText = `上传成功：${(data.saved_images || []).length} 张`;
        await this.loadContent();
        if (this.heroImages.length) {
          this.currentSlide = this.heroImages.length - 1;
        }
      } catch (err) {
        this.imageText = `上传失败：${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    async deleteHeroImage(url) {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      if (!url) return;
      try {
        await this.fetchJSON("/api/content/gallery/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        await this.loadContent();
      } catch (err) {
        this.imageText = `删除失败：${err.message}`;
      }
    },

    blankNewsForm() {
      return {
        title: "",
        date: "",
        source: "",
        summary: "",
        content: "",
        cover_url: "",
        image_urls: [],
        pinned: false,
      };
    },

    cloneNewsForm(item = {}) {
      return {
        id: String(item.id || ""),
        title: String(item.title || ""),
        date: String(item.date || ""),
        source: String(item.source || ""),
        summary: String(item.summary || ""),
        content: String(item.content || ""),
        cover_url: String(item.cover_url || ""),
        image_urls: Array.isArray(item.image_urls)
          ? item.image_urls.map((url) => String(url || "").trim()).filter(Boolean)
          : [],
        pinned: this.isPinned(item),
      };
    },

    getEditorRef(refName) {
      const raw = this.$refs[refName];
      return Array.isArray(raw) ? raw[0] : raw;
    },

    async uploadNewsImages(files) {
      const picked = Array.from(files || []);
      if (!picked.length) return [];
      const form = new FormData();
      picked.forEach((f) => form.append("files", f));
      const data = await this.fetchJSON("/api/upload/news/images", {
        method: "POST",
        body: form,
      });
      return Array.isArray(data.saved_images) ? data.saved_images : [];
    },

    insertNewsTokenIntoForm(form, refName, token, inline = false) {
      if (!form) return;
      const source = String(form.content || "");
      const editor = this.getEditorRef(refName);
      if (!editor) {
        form.content = inline ? `${source}${token}` : (source ? `${source}\n${token}\n` : `${token}\n`);
        return;
      }

      const start = Number.isInteger(editor.selectionStart) ? editor.selectionStart : source.length;
      const end = Number.isInteger(editor.selectionEnd) ? editor.selectionEnd : start;
      const before = source.slice(0, start);
      const selected = source.slice(start, end);
      const after = source.slice(end);

      let insert = token;
      let prefix = "";
      let suffix = "";
      if (!inline) {
        prefix = before && !before.endsWith("\n") ? "\n" : "";
        suffix = after && !after.startsWith("\n") ? "\n" : "";
      }
      if (inline && selected) {
        insert = token.replace("加粗文字", selected);
      }

      form.content = `${before}${prefix}${insert}${suffix}${after}`;
      this.$nextTick(() => {
        const nextEditor = this.getEditorRef(refName) || editor;
        try {
          nextEditor.focus();
          const pos = (before + prefix + insert).length;
          nextEditor.setSelectionRange(pos, pos);
        } catch {
          // ignore cursor restore issues
        }
      });
    },

    insertNewsFormat(form, refName, type) {
      const map = {
        h1: "# 一级标题",
        h2: "## 二级标题",
        h3: "### 小标题",
        quote: "> 引用内容",
        ul: "- 列表项",
        ol: "1. 列表项",
        hr: "---",
      };
      if (type === "bold") {
        this.insertNewsTokenIntoForm(form, refName, "**加粗文字**", true);
        return;
      }
      const token = map[type] || "";
      if (token) this.insertNewsTokenIntoForm(form, refName, token, false);
    },

    async addNews() {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      if (!String(this.newsForm.title || "").trim()) {
        this.newsText = "请先填写新闻标题";
        return;
      }
      try {
        await this.fetchJSON("/api/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.newsForm),
        });
        this.newsForm = this.blankNewsForm();
        this.newsText = "新闻新增成功";
        this.newsImageText = "可上传新闻封面与正文配图；正文图可点击“插入正文”放到正文任意位置。";
        await this.loadContent();
      } catch (err) {
        this.newsText = `新增失败：${err.message}`;
      }
    },

    async onNewsCoverPick(e) {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.newsImageText = "请先登录管理员账号再上传新闻封面。";
        e.target.value = "";
        return;
      }
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      this.newsImageText = "正在上传新闻封面...";
      try {
        const saved = await this.uploadNewsImages([files[0]]);
        if (saved.length) {
          this.newsForm.cover_url = saved[0];
          this.newsImageText = "新闻封面上传成功。";
        } else {
          this.newsImageText = "没有保存任何图片。";
        }
      } catch (err) {
        this.newsImageText = `上传失败：${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    async onNewsBodyImagesPick(e) {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.newsImageText = "请先登录管理员账号再上传正文配图。";
        e.target.value = "";
        return;
      }
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      this.newsImageText = "正在上传正文配图...";
      try {
        const saved = await this.uploadNewsImages(files);
        if (saved.length) {
          this.newsForm.image_urls = [...this.newsForm.image_urls, ...saved];
          this.newsImageText = `正文配图已上传 ${saved.length} 张，可点击“插入正文”放到光标位置。`;
        } else {
          this.newsImageText = "没有保存任何图片。";
        }
      } catch (err) {
        this.newsImageText = `上传失败：${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    removeNewsBodyImage(url) {
      this.newsForm.image_urls = this.newsForm.image_urls.filter((x) => x !== url);
      this.newsImageText = "已从待选正文配图中移除。";
    },

    insertNewsTokenAtCursor(token) {
      this.insertNewsTokenIntoForm(this.newsForm, "newsContentRef", token, false);
    },

    insertNewsImageAtCursor(url) {
      const safeUrl = String(url || "").trim();
      if (!safeUrl) return;
      this.insertNewsTokenAtCursor(`[[img:${safeUrl}]]`);
      this.newsImageText = "已插入图片标记到正文光标位置。";
    },

    insertNewsImageWithCaption(url) {
      const safeUrl = String(url || "").trim();
      if (!safeUrl) return;
      const captionRaw = window.prompt("请输入图注（可留空）", "");
      if (captionRaw === null) return;
      const caption = String(captionRaw).replace(/\]\]/g, "").trim();
      const token = caption ? `[[img:${safeUrl}|${caption}]]` : `[[img:${safeUrl}]]`;
      this.insertNewsTokenAtCursor(token);
      this.newsImageText = "已插入图片与图注标记到正文光标位置。";
    },

    startNewsEdit(item) {
      if (!item || !item.id) return;
      this.editingNewsId = String(item.id);
      this.newsEditForm = this.cloneNewsForm(item);
      this.newsEditImageText = "正在编辑已上传新闻，可修改标题、正文、封面和配图。";
      this.$nextTick(() => {
        const editor = this.getEditorRef("newsEditContentRef");
        if (editor) editor.focus();
      });
    },

    cancelNewsEdit() {
      this.editingNewsId = "";
      this.newsEditForm = { id: "", ...this.blankNewsForm() };
      this.newsEditImageText = "编辑已上传的新闻时，可更换封面、追加正文配图并插入到正文。";
    },

    async updateNews() {
      this.touchAdminActivity();
      if (!this.isAdmin || !this.editingNewsId) return;
      if (!String(this.newsEditForm.title || "").trim()) {
        this.newsEditImageText = "请先填写新闻标题。";
        return;
      }
      try {
        const payload = this.cloneNewsForm(this.newsEditForm);
        delete payload.id;
        await this.fetchJSON(`/api/news/${encodeURIComponent(this.editingNewsId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        this.newsText = "新闻修改已保存。";
        this.cancelNewsEdit();
        await this.loadContent();
      } catch (err) {
        this.newsEditImageText = `保存失败：${err.message}`;
      }
    },

    async onNewsEditCoverPick(e) {
      this.touchAdminActivity();
      if (!this.isAdmin || !this.editingNewsId) return;
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      this.newsEditImageText = "正在上传新的新闻封面...";
      try {
        const saved = await this.uploadNewsImages([files[0]]);
        if (saved.length) {
          this.newsEditForm.cover_url = saved[0];
          this.newsEditImageText = "新的新闻封面已上传，点击“保存修改”后生效。";
        } else {
          this.newsEditImageText = "没有保存任何图片。";
        }
      } catch (err) {
        this.newsEditImageText = `上传失败：${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    async onNewsEditBodyImagesPick(e) {
      this.touchAdminActivity();
      if (!this.isAdmin || !this.editingNewsId) return;
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      this.newsEditImageText = "正在上传正文配图...";
      try {
        const saved = await this.uploadNewsImages(files);
        if (saved.length) {
          this.newsEditForm.image_urls = [...this.newsEditForm.image_urls, ...saved];
          this.newsEditImageText = `已追加 ${saved.length} 张正文配图，点击“保存修改”后生效。`;
        } else {
          this.newsEditImageText = "没有保存任何图片。";
        }
      } catch (err) {
        this.newsEditImageText = `上传失败：${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    removeNewsEditBodyImage(url) {
      this.newsEditForm.image_urls = this.newsEditForm.image_urls.filter((x) => x !== url);
      this.newsEditImageText = "已从该新闻正文配图中移除，点击“保存修改”后生效。";
    },

    insertNewsEditImageAtCursor(url) {
      const safeUrl = String(url || "").trim();
      if (!safeUrl) return;
      this.insertNewsTokenIntoForm(this.newsEditForm, "newsEditContentRef", `[[img:${safeUrl}]]`, false);
      this.newsEditImageText = "已插入图片标记到编辑正文光标位置。";
    },

    insertNewsEditImageWithCaption(url) {
      const safeUrl = String(url || "").trim();
      if (!safeUrl) return;
      const captionRaw = window.prompt("请输入图注（可留空）", "");
      if (captionRaw === null) return;
      const caption = String(captionRaw).replace(/\]\]/g, "").trim();
      const token = caption ? `[[img:${safeUrl}|${caption}]]` : `[[img:${safeUrl}]]`;
      this.insertNewsTokenIntoForm(this.newsEditForm, "newsEditContentRef", token, false);
      this.newsEditImageText = "已插入图片与图注标记到编辑正文光标位置。";
    },

    async removeNews(id) {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      if (!window.confirm("确认删除这条新闻吗？")) return;
      try {
        await this.fetchJSON(`/api/news/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (String(this.editingNewsId) === String(id)) this.cancelNewsEdit();
        this.newsText = "新闻已删除。";
        await this.loadContent();
      } catch (err) {
        this.newsText = `删除失败：${err.message}`;
      }
    },

    async uploadReviewFiles(files) {
      const picked = Array.from(files || []);
      if (!picked.length) return [];
      const form = new FormData();
      picked.forEach((f) => form.append("files", f));
      const data = await this.fetchJSON("/api/upload/review/images", {
        method: "POST",
        body: form,
      });
      return Array.isArray(data.saved_images) ? data.saved_images : [];
    },

    onReviewAlbumFilesPick(e) {
      this.selectedReviewAlbumFiles = Array.from(e.target.files || []);
      this.reviewText = this.selectedReviewAlbumFiles.length
        ? `已选择 ${this.selectedReviewAlbumFiles.length} 张照片，提交栏目后会上传。`
        : "未选择照片。";
    },

    async addReviewAlbum() {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      const payload = {
        title: String(this.reviewAlbumForm.title || "").trim(),
        date: String(this.reviewAlbumForm.date || "").trim(),
        category: String(this.reviewAlbumForm.category || "").trim(),
        summary: String(this.reviewAlbumForm.summary || "").trim(),
        content: String(this.reviewAlbumForm.content || "").trim(),
        pinned: !!this.reviewAlbumForm.pinned,
        cover_url: "",
        image_urls: [],
      };
      if (!payload.title) {
        this.reviewText = "请先填写回顾栏目标题。";
        return;
      }
      this.reviewText = "正在创建回顾栏目...";
      try {
        const urls = await this.uploadReviewFiles(this.selectedReviewAlbumFiles);
        payload.image_urls = urls;
        payload.cover_url = urls[0] || "";
        await this.fetchJSON("/api/review/albums", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        this.reviewAlbumForm = { title: "", date: "", category: "", summary: "", content: "", pinned: false };
        this.selectedReviewAlbumFiles = [];
        this.reviewText = "回顾栏目创建成功。";
        await this.loadContent();
      } catch (err) {
        this.reviewText = `创建失败：${err.message}`;
      }
    },

    async onReviewAlbumAppendImages(album, e) {
      this.touchAdminActivity();
      if (!this.isAdmin || !album || !album.id) return;
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      this.reviewText = "正在追加栏目照片...";
      try {
        const urls = await this.uploadReviewFiles(files);
        album.image_urls = [...new Set([...(album.image_urls || []), ...urls])];
        if (!album.cover_url && album.image_urls.length) album.cover_url = album.image_urls[0];
        await this.updateReviewAlbum(album, false);
        this.reviewText = `已追加 ${urls.length} 张照片。`;
      } catch (err) {
        this.reviewText = `追加失败：${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    async updateReviewAlbum(album, showMessage = true) {
      this.touchAdminActivity();
      if (!this.isAdmin || !album || !album.id) return;
      const payload = {
        title: String(album.title || "").trim(),
        date: String(album.date || "").trim(),
        category: String(album.category || "").trim(),
        summary: String(album.summary || "").trim(),
        content: String(album.content || "").trim(),
        pinned: this.isPinned(album),
        cover_url: this.getReviewAlbumCover(album),
        image_urls: Array.isArray(album.image_urls) ? album.image_urls : [],
      };
      if (!payload.title) {
        this.reviewText = "栏目标题不能为空。";
        return;
      }
      try {
        const data = await this.fetchJSON(`/api/review/albums/${album.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const next = this.normalizeReviewAlbum(data.album || album);
        const idx = this.reviewAlbums.findIndex((x) => String(x.id) === String(album.id));
        if (idx >= 0 && next) this.reviewAlbums[idx] = next;
        if (showMessage) this.reviewText = "回顾栏目保存成功。";
      } catch (err) {
        this.reviewText = `保存失败：${err.message}`;
      }
    },

    async setReviewAlbumCover(album, url) {
      if (!album || !url) return;
      album.cover_url = url;
      await this.updateReviewAlbum(album);
    },

    async removeReviewAlbumImage(album, url) {
      this.touchAdminActivity();
      if (!this.isAdmin || !album || !album.id || !url) return;
      try {
        const data = await this.fetchJSON(`/api/review/albums/${album.id}/image/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const next = this.normalizeReviewAlbum(data.album || album);
        const idx = this.reviewAlbums.findIndex((x) => String(x.id) === String(album.id));
        if (idx >= 0 && next) this.reviewAlbums[idx] = next;
        this.reviewText = "照片已从栏目移除。";
      } catch (err) {
        this.reviewText = `移除失败：${err.message}`;
      }
    },

    async deleteReviewAlbum(album) {
      this.touchAdminActivity();
      if (!this.isAdmin || !album || !album.id) return;
      if (!window.confirm(`确认删除回顾栏目「${album.title || album.id}」吗？`)) return;
      try {
        await this.fetchJSON(`/api/review/albums/${album.id}`, { method: "DELETE" });
        this.reviewAlbums = this.reviewAlbums.filter((x) => String(x.id) !== String(album.id));
        this.reviewText = "回顾栏目已删除。";
      } catch (err) {
        this.reviewText = `删除失败：${err.message}`;
      }
    },

    async saveTeamOverview() {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      try {
        await this.fetchJSON("/api/content/overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overview: this.teamOverview || "" }),
        });
        this.overviewText = "团队概况保存成功";
      } catch (err) {
        this.overviewText = `保存失败：${err.message}`;
      }
    },

    async saveTeamIntro() {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      try {
        await this.fetchJSON("/api/content/intro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intro: this.teamIntro || "" }),
        });
        this.introText = "团队简介保存成功";
      } catch (err) {
        this.introText = `保存失败：${err.message}`;
      }
    },

    async refreshStatus() {
      this.statusText = "正在查询...";
      try {
        const data = await this.fetchJSON("/api/status");
        if (data.ready === false) {
          this.statusText = `服务未就绪：${data.error}`;
          return;
        }
        this.statusText = `当前知识块数量：${data.chunks}`;
      } catch (err) {
        this.statusText = `状态查询失败：${err.message}`;
      }
    },

    async ingestDefault() {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.statusText = "请先后台登录后再操作知识库";
        return;
      }
      this.statusText = "正在导入默认资料...";
      try {
        const data = await this.fetchJSON("/api/ingest/default", { method: "POST" });
        this.statusText = `导入完成，新增知识块：${data.added_chunks}`;
        await this.refreshStatus();
      } catch (err) {
        this.statusText = `导入失败：${err.message}`;
      }
    },

    async rebuildDefault() {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.statusText = "请先后台登录后再操作知识库";
        return;
      }
      this.statusText = "正在重建默认知识库...";
      try {
        const data = await this.fetchJSON("/api/ingest/rebuild/default", { method: "POST" });
        this.statusText = `重建完成，新增知识块：${data.added_chunks}`;
        await this.refreshStatus();
      } catch (err) {
        this.statusText = `重建失败：${err.message}`;
      }
    },

    onPdfChange(e) {
      this.selectedPdfs = Array.from(e.target.files || []);
    },

    async uploadPdf() {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.uploadPdfText = "请先后台登录后再上传 PDF";
        return;
      }
      if (!this.selectedPdfs.length) {
        this.uploadPdfText = "请先选择 PDF 文件";
        return;
      }
      const form = new FormData();
      this.selectedPdfs.forEach((f) => form.append("files", f));
      this.uploadPdfText = "正在上传并入库...";

      try {
        const data = await this.fetchJSON("/api/upload", { method: "POST", body: form });
        this.uploadPdfText = `上传成功：${data.saved_files.join(", ")}，新增知识块：${data.added_chunks}`;
        this.selectedPdfs = [];
        await this.refreshStatus();
      } catch (err) {
        this.uploadPdfText = `上传失败：${err.message}`;
      }
    },

    async onAwardImagePick(e) {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.awardImageText = "请先后台登录后再上传奖项配图";
        e.target.value = "";
        return;
      }
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      this.awardImageText = "正在上传奖项配图...";
      try {
        const data = await this.fetchJSON("/api/upload/awards/images", {
          method: "POST",
          body: form,
        });
        const saved = data.saved_images || [];
        if (saved.length) {
          this.awardForm.image_url = saved[0];
          this.awardImageText = "奖项配图上传成功";
        } else {
          this.awardImageText = "未检测到有效图片";
        }
      } catch (err) {
        this.awardImageText = `上传失败：${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    async addAward() {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      if (!this.awardForm.title) return;
      try {
        await this.fetchJSON("/api/awards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...this.awardForm, level: this.normalizeAwardLevel(this.awardForm.level) }),
        });
        this.awardForm = {
          title: "",
          award_type: "team",
          year: "",
          level: "省级",
          organizer: "",
          description: "",
          image_url: "",
          pinned: false,
        };
        this.awardImageText = "可上传奖项配图，支持 jpg/png/webp。";
        await this.loadContent();
      } catch (err) {
        alert(`新增奖项失败：${err.message}`);
      }
    },

    async editAward(item) {
      this.touchAdminActivity();
      if (!this.isAdmin || !item || !item.id) return;
      const title = window.prompt("奖项名称", item.title || "");
      if (title === null) return;
      const typeInput = window.prompt("奖项分类：团队赛 / 个人赛", this.awardTypeLabel(item));
      if (typeInput === null) return;
      const award_type = this.normalizeAwardType(typeInput || item.award_type);
      const year = window.prompt("年份", item.year || "");
      if (year === null) return;
      const level = window.prompt("级别：国家级 / 省级", this.normalizeAwardLevel(item.level));
      if (level === null) return;
      const organizer = window.prompt("主办方", item.organizer || "");
      if (organizer === null) return;
      const description = window.prompt("备注", item.description || "");
      if (description === null) return;
      const pinned = window.confirm("是否置顶这条奖项？\n确定=置顶，取消=不置顶");
      try {
        await this.fetchJSON(`/api/awards/${encodeURIComponent(item.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            award_type,
            year: year || "",
            level: this.normalizeAwardLevel(level),
            organizer: organizer || "",
            description: description || "",
            image_url: item.image_url || "",
            pinned,
          }),
        });
        this.awardImageText = "奖项历史信息已保存。";
        await this.loadContent();
      } catch (err) {
        alert(`编辑奖项失败：${err.message}`);
      }
    },

    async toggleAwardPinned(item) {
      if (!item || !item.id) return;
      try {
        await this.fetchJSON(`/api/awards/${encodeURIComponent(item.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, pinned: !this.isPinned(item) }),
        });
        await this.loadContent();
      } catch (err) {
        alert(`置顶操作失败：${err.message}`);
      }
    },

    async removeAward(id) {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      try {
        await this.fetchJSON(`/api/awards/${id}`, { method: "DELETE" });
        await this.loadContent();
      } catch (err) {
        alert(`删除奖项失败：${err.message}`);
      }
    },

    async onSeniorImagePick(e) {
      this.touchAdminActivity();
      if (!this.isAdmin) {
        this.seniorImageText = "Please log in before uploading senior photos.";
        e.target.value = "";
        return;
      }
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      this.seniorImageText = "Uploading senior photo...";
      try {
        const data = await this.fetchJSON("/api/upload/seniors/images", {
          method: "POST",
          body: form,
        });
        const saved = data.saved_images || [];
        if (saved.length) {
          this.seniorForm = { ...this.seniorForm, photo_url: saved[0] };
          this.seniorImageText = "Senior photo uploaded. It will be used for the new senior.";
        } else {
          this.seniorImageText = "No valid image detected.";
        }
      } catch (err) {
        this.seniorImageText = `Upload failed: ${err.message}`;
      } finally {
        e.target.value = "";
      }
    },

    async onSeniorCardImagePick(itemId, e) {
      this.touchAdminActivity();
      const id = String(itemId || "");
      if (!this.isAdmin || !id) {
        if (e && e.target) e.target.value = "";
        return;
      }
      const files = Array.from((e && e.target && e.target.files) || []);
      if (!files.length) return;

      const form = new FormData();
      form.append("files", files[0]);
      const target = this.seniors.find((s) => String(s.id) === id);
      const draft = this.seniorEditDrafts[id] || (target ? this.getSeniorDraft(target) : null);
      const displayName = (draft && draft.name) || (target && target.name) || "this member";
      this.seniorImageText = `Uploading new photo for ${displayName}...`;

      try {
        const data = await this.fetchJSON("/api/upload/seniors/images", {
          method: "POST",
          body: form,
        });
        const saved = data.saved_images || [];
        if (saved.length) {
          const newPhotoUrl = saved[0];
          this.replaceSeniorLocal(id, { photo_url: newPhotoUrl });
          this.seniorImageText = `${displayName} new photo uploaded, saving...`;

          // Save the uploaded photo URL immediately. Keep unsaved text edits untouched.
          const base = target || draft || {};
          const payload = this.buildSeniorPayload(base, { photo_url: newPhotoUrl });
          if (!payload.name) {
            this.seniorImageText = "Photo uploaded, but member name is empty. Fill the name and save manually.";
            return;
          }
          const updatedData = await this.fetchJSON(`/api/seniors/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const updated = updatedData.senior || { ...base, ...payload, id };
          this.seniors = this.seniors.map((item) => (
            String(item.id) === id ? { ...item, ...updated } : item
          ));
          if (this.seniorEditDrafts[id]) {
            this.seniorEditDrafts[id] = { ...this.seniorEditDrafts[id], photo_url: newPhotoUrl };
          }
          this.seniorImageText = `${displayName} new photo has been uploaded and saved. Refresh frontend to view.`;
        } else {
          this.seniorImageText = "No valid image detected.";
        }
      } catch (err) {
        this.seniorImageText = `Upload failed: ${err.message}`;
      } finally {
        if (e && e.target) e.target.value = "";
      }
    },

    async addSenior() {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      if (!this.seniorForm.name) return;
      const payload = {
        ...this.seniorForm,
        grade: this.normalizeSeniorGrade(this.seniorForm.grade),
        responsible: !!this.seniorForm.responsible,
      };
      try {
        await this.fetchJSON("/api/seniors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        this.seniorForm = {
          name: "",
          grade: DEFAULT_SENIOR_GRADE,
          hall: "binary",
          direction: "",
          intro: "",
          achievements: "",
          advice: "",
          photo_url: "",
          pinned: false,
          responsible: false,
        };
        this.seniorImageText = "可上传前辈照片，建议 4:5 或 1:1。";
        await this.loadContent();
      } catch (err) {
        alert(`新增前辈失败：${err.message}`);
      }
    },

    async finishSeniorEdit(itemId) {
      this.touchAdminActivity();
      const id = String(itemId || "");
      if (!this.isAdmin || !id) return;
      const draft = this.seniorEditDrafts[id];
      if (!draft || !String(draft.name || "").trim()) {
        this.seniorImageText = "Please enter a name before saving.";
        return;
      }
      try {
        const updatedData = await this.fetchJSON(`/api/seniors/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.buildSeniorPayload(draft)),
        });
        this.replaceSeniorLocal(id, updatedData.senior || draft);
        delete this.seniorEditingState[id];
        delete this.seniorEditDrafts[id];
        this.seniorImageText = "Senior profile saved.";
        await this.loadContent();
      } catch (err) {
        this.seniorImageText = `Save failed: ${err.message}`;
      }
    },

    async removeSenior(id) {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      try {
        await this.fetchJSON(`/api/seniors/${id}`, { method: "DELETE" });
        delete this.seniorEditingState[String(id)];
        delete this.seniorEditDrafts[String(id)];
        await this.loadContent();
      } catch (err) {
        alert(`删除前辈失败：${err.message}`);
      }
    },

    async fetchRecruitList() {
      if (!this.isAdmin) {
        this.recruitList = [];
        return;
      }
      try {
        const data = await this.fetchJSON("/api/recruit/list");
        this.recruitList = Array.isArray(data.items)
          ? data.items.sort((a, b) => this.comparePinnedRecords(a, b))
          : [];
      } catch (err) {
        this.recruitText = `招新列表获取失败：${err.message}`;
      }
    },



    async fetchAdminUsers() {
      if (!this.isAdmin || !this.isSuperAdmin) {
        this.adminUsers = [];
        if (this.isAdmin && !this.isSuperAdmin) this.adminUserText = "只有超级管理员可以管理管理员账号。";
        return;
      }
      try {
        const data = await this.fetchJSON("/api/admin/users");
        this.adminUsers = Array.isArray(data.users) ? data.users : [];
      } catch (err) {
        this.adminUserText = `管理员列表获取失败： ${err.message}`;
      }
    },

    async addAdminUser() {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      const payload = {
        username: String(this.adminUserForm.username || "").trim(),
        display_name: String(this.adminUserForm.display_name || "").trim(),
        password: String(this.adminUserForm.password || ""),
        role: this.adminUserForm.role || "admin",
      };
      if (!payload.username || !payload.password) {
        this.adminUserText = "请填写用户名和初始密码。";
        return;
      }
      this.adminUserText = "正在添加管理员...";
      try {
        await this.fetchJSON("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        this.adminUserForm = { username: "", display_name: "", password: "", role: "admin" };
        this.adminUserText = "管理员添加成功。";
        await this.fetchAdminUsers();
      } catch (err) {
        this.adminUserText = `操作失败： ${err.message}`;
      }
    },


    async changeAdminRole(user, role) {
      this.touchAdminActivity();
      if (!this.isAdmin || !user || !user.id) return;
      const nextRole = role === "superadmin" ? "superadmin" : "admin";
      try {
        await this.fetchJSON(`/api/admin/users/${user.id}/role`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        });
        this.adminUserText = "Admin role updated.";
        await this.fetchAdminUsers();
      } catch (err) {
        this.adminUserText = `Operation failed: ${err.message}`;
        await this.fetchAdminUsers();
      }
    },

    async promptResetAdminPassword(user) {
      this.touchAdminActivity();
      if (!this.isAdmin || !user || !user.id) return;
      const password = window.prompt(`请输入 ${user.username} 的新密码（至少 6 位）`);
      if (!password) return;
      try {
        await this.fetchJSON(`/api/admin/users/${user.id}/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        this.adminUserText = "密码已重置。";
        await this.fetchAdminUsers();
      } catch (err) {
        this.adminUserText = `操作失败： ${err.message}`;
      }
    },

    async deleteAdminUser(id) {
      this.touchAdminActivity();
      if (!this.isAdmin || !id) return;
      if (!window.confirm("确认删除该管理员用户？")) return;
      try {
        await this.fetchJSON(`/api/admin/users/${id}`, { method: "DELETE" });
        this.adminUserText = "管理员已删除。";
        await this.fetchAdminUsers();
      } catch (err) {
        this.adminUserText = `操作失败： ${err.message}`;
      }
    },

    async submitRecruit() {
      if (!this.recruitForm.name || !this.recruitForm.student_id) {
        this.recruitText = "请填写姓名和学号后再提交";
        return;
      }
      this.recruitText = "正在提交...";
      const shouldPin = !!this.recruitForm.pinned;
      try {
        const data = await this.fetchJSON("/api/recruit/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.recruitForm),
        });
        if (this.isAdmin && shouldPin && data.item && data.item.id) {
          await this.fetchJSON(`/api/recruit/${encodeURIComponent(data.item.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data.item, pinned: true }),
          });
        }
        this.recruitForm = {
          name: "",
          student_id: "",
          college: "",
          grade: "",
          phone: "",
          wechat: "",
          email: "",
          hall: "binary",
          direction_detail: "",
          experience: "",
          weekly_hours: "",
          note: "",
          pinned: false,
        };
        this.recruitText = "报名提交成功";
        await this.fetchRecruitList();
      } catch (err) {
        this.recruitText = `提交失败：${err.message}`;
      }
    },

    async editRecruit(item) {
      this.touchAdminActivity();
      if (!this.isAdmin || !item || !item.id) return;
      const name = window.prompt("姓名", item.name || "");
      if (name === null) return;
      const student_id = window.prompt("学号", item.student_id || "");
      if (student_id === null) return;
      const college = window.prompt("学院 / 专业", item.college || "");
      if (college === null) return;
      const grade = window.prompt("年级", item.grade || "");
      if (grade === null) return;
      const phone = window.prompt("手机号", item.phone || "");
      if (phone === null) return;
      const wechat = window.prompt("微信", item.wechat || "");
      if (wechat === null) return;
      const email = window.prompt("邮箱", item.email || "");
      if (email === null) return;
      const direction_detail = window.prompt("意向方向", item.direction_detail || "");
      if (direction_detail === null) return;
      const weekly_hours = window.prompt("每周可投入时间", item.weekly_hours || "");
      if (weekly_hours === null) return;
      const experience = window.prompt("基础经历 / 项目 / 比赛经验", item.experience || "");
      if (experience === null) return;
      const note = window.prompt("备注", item.note || "");
      if (note === null) return;
      const pinned = window.confirm("是否置顶这条报名？\n确定=置顶，取消=不置顶");
      try {
        await this.fetchJSON(`/api/recruit/${encodeURIComponent(item.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            student_id,
            college: college || "",
            grade: grade || "",
            phone: phone || "",
            wechat: wechat || "",
            email: email || "",
            hall: item.hall || "binary",
            direction_detail: direction_detail || "",
            experience: experience || "",
            weekly_hours: weekly_hours || "",
            note: note || "",
            pinned,
          }),
        });
        this.recruitText = "报名历史信息已保存。";
        await this.fetchRecruitList();
      } catch (err) {
        this.recruitText = `编辑失败：${err.message}`;
      }
    },

    async toggleRecruitPinned(item) {
      if (!item || !item.id) return;
      try {
        await this.fetchJSON(`/api/recruit/${encodeURIComponent(item.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, pinned: !this.isPinned(item) }),
        });
        await this.fetchRecruitList();
      } catch (err) {
        this.recruitText = `置顶操作失败：${err.message}`;
      }
    },

    async deleteRecruit(id) {
      this.touchAdminActivity();
      if (!this.isAdmin) return;
      try {
        await this.fetchJSON(`/api/recruit/${id}`, { method: "DELETE" });
        await this.fetchRecruitList();
      } catch (err) {
        this.recruitText = `删除失败：${err.message}`;
      }
    },

    toggleAssistant() {
      this.chatOpen = !this.chatOpen;
      this.$nextTick(() => this.scrollAssistantToBottom());
    },

    scrollAssistantToBottom() {
      const box = this.$refs.msgBox;
      if (!box) return;
      box.scrollTop = box.scrollHeight;
    },

    async sendAssistantQuestion() {
      const q = this.assistantInput.trim();
      if (!q || this.assistantBusy) return;

      this.assistantMessages.push({ role: "user", text: q, sources: [] });
      this.assistantInput = "";
      this.assistantBusy = true;
      this.$nextTick(() => this.scrollAssistantToBottom());

      try {
        const data = await this.fetchJSON("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, top_k: 10 }),
        });
        this.assistantMessages.push({
          role: "assistant",
          text: data.answer || "暂无回答",
          sources: data.sources || [],
        });
      } catch (err) {
        this.assistantMessages.push({
          role: "assistant",
          text: `提问失败：${err.message}`,
          sources: [],
        });
      } finally {
        this.assistantBusy = false;
        this.$nextTick(() => this.scrollAssistantToBottom());
      }
    },
  },
}).mount("#app");




