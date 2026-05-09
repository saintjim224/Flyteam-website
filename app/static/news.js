const I18N = {
  preview: "\u56fe\u7247\u9884\u89c8",
  untitled: "\u672a\u547d\u540d\u65b0\u95fb",
  noDate: "\u672a\u586b\u5199\u65e5\u671f",
  noBody: "\u6682\u65e0\u65b0\u95fb\u6b63\u6587\u3002",
  noId: "\u7f3a\u5c11\u65b0\u95fb ID",
  loadFailed: "\u65b0\u95fb\u52a0\u8f7d\u5931\u8d25",
};

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
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

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isPinned(item) {
  if (!item) return false;
  if (item.pinned === true || item.pinned === 1) return true;
  return String(item.pinned || "").trim().toLowerCase() === "true";
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

function appendPinBadge(parent, item) {
  if (isPinned(item)) parent.appendChild(createNode("span", "pin-badge public-pin", "置顶"));
}

function openImageLightbox(url, caption = I18N.preview) {
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
    openImageLightbox(img.src, caption || img.alt || I18N.preview);
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

function appendInlineContent(node, text) {
  const value = String(text || "");
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      node.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
    }
    const strong = document.createElement("strong");
    strong.textContent = match[1];
    node.appendChild(strong);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < value.length) {
    node.appendChild(document.createTextNode(value.slice(lastIndex)));
  }
}

function parseRichContent(bodyText) {
  const lines = String(bodyText || "").split(/\r?\n/);
  const blocks = [];
  const imgRegex = /^\s*\[\[img:(.+?)(?:\|(.+?))?\]\]\s*$/i;
  let paragraphLines = [];
  let listBlock = null;

  function flushParagraph() {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
    paragraphLines = [];
  }

  function flushList() {
    if (listBlock && listBlock.items.length) blocks.push(listBlock);
    listBlock = null;
  }

  function pushList(type, text) {
    flushParagraph();
    if (!listBlock || listBlock.type !== type) {
      flushList();
      listBlock = { type, items: [] };
    }
    listBlock.items.push(text);
  }

  lines.forEach((line) => {
    const current = String(line || "");
    const trimmed = current.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const imageMatch = trimmed.match(imgRegex);
    if (imageMatch) {
      flushParagraph();
      flushList();
      const url = normalizeImageUrl(imageMatch[1]);
      if (url) {
        blocks.push({
          type: "image",
          url,
          caption: (imageMatch[2] || "").trim(),
        });
      }
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      return;
    }

    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "divider" });
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", text: quoteMatch[1].trim() });
      return;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      pushList("ul", ulMatch[1].trim());
      return;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      pushList("ol", olMatch[1].trim());
      return;
    }

    flushList();
    paragraphLines.push(current);
  });

  flushParagraph();
  flushList();
  return blocks;
}

function renderRichContent(contentRoot, bodyText, titleText) {
  const usedUrls = new Set();
  const blocks = parseRichContent(bodyText);
  contentRoot.textContent = "";

  blocks.forEach((block, idx) => {
    if (block.type === "paragraph") {
      const p = document.createElement("p");
      p.className = "news-rich-paragraph";
      appendInlineContent(p, block.text);
      contentRoot.appendChild(p);
      return;
    }

    if (block.type === "heading") {
      const tag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
      const h = document.createElement(tag);
      h.className = `news-rich-heading level-${block.level}`;
      appendInlineContent(h, block.text);
      contentRoot.appendChild(h);
      return;
    }

    if (block.type === "quote") {
      const quote = document.createElement("blockquote");
      quote.className = "news-rich-quote";
      appendInlineContent(quote, block.text);
      contentRoot.appendChild(quote);
      return;
    }

    if (block.type === "divider") {
      const hr = document.createElement("hr");
      hr.className = "news-rich-divider";
      contentRoot.appendChild(hr);
      return;
    }

    if (block.type === "ul" || block.type === "ol") {
      const list = document.createElement(block.type);
      list.className = "news-rich-list";
      block.items.forEach((item) => {
        const li = document.createElement("li");
        appendInlineContent(li, item);
        list.appendChild(li);
      });
      contentRoot.appendChild(list);
      return;
    }

    if (block.type === "image") {
      const figure = document.createElement("figure");
      figure.className = "news-rich-image-wrap";

      const img = document.createElement("img");
      img.className = "news-rich-image";
      img.src = block.url;
      img.alt = block.caption || `${titleText || I18N.untitled} #${idx + 1}`;
      img.loading = "lazy";
      bindPreview(img, img.alt);
      figure.appendChild(img);

      if (block.caption) {
        const cap = document.createElement("figcaption");
        cap.className = "news-rich-caption";
        cap.textContent = block.caption;
        figure.appendChild(cap);
      }

      usedUrls.add(block.url);
      contentRoot.appendChild(figure);
    }
  });

  return usedUrls;
}


function renderNewsList(items) {
  const listView = document.getElementById("newsListView");
  const detailView = document.getElementById("newsDetailView");
  const root = document.getElementById("newsList");
  if (listView) listView.hidden = false;
  if (detailView) detailView.hidden = true;
  if (!root) return;
  root.innerHTML = "";
  root.classList.remove("news-cards");

  const news = Array.isArray(items) ? [...items] : [];
  if (!news.length) {
    root.appendChild(createNode("p", "section-sub", "\u6682\u65e0\u56e2\u961f\u65b0\u95fb\u3002"));
    return;
  }

  root.classList.add("news-cards");
  news.sort(compareNewsRecords);
  news.forEach((item) => {
    const card = createNode("article", "news-card");
    const coverUrl = normalizeImageUrl(item.cover_url);
    if (coverUrl) {
      const img = document.createElement("img");
      img.src = coverUrl;
      img.alt = item.title || I18N.untitled;
      img.loading = "lazy";
      bindPreview(img, img.alt);
      card.appendChild(img);
    }
    const box = createNode("div", "news-card-body");
    appendPinBadge(box, item);
    box.appendChild(createNode("div", "news-date", item.date || I18N.noDate));
    box.appendChild(createNode("div", "news-title", item.title || I18N.untitled));
    box.appendChild(createNode("div", "news-summary", item.summary || "\u70b9\u51fb\u67e5\u770b\u65b0\u95fb\u8be6\u60c5"));
    const more = document.createElement("a");
    more.className = "news-more";
    more.href = `/news?id=${encodeURIComponent(item.id || "")}`;
    more.textContent = "\u67e5\u770b\u8be6\u60c5";
    box.appendChild(more);
    card.appendChild(box);
    root.appendChild(card);
  });
}

function renderNews(item) {
  const listView = document.getElementById("newsListView");
  const detailView = document.getElementById("newsDetailView");
  if (listView) listView.hidden = true;
  if (detailView) detailView.hidden = false;
  const title = document.getElementById("newsTitle");
  const meta = document.getElementById("newsMeta");
  const summary = document.getElementById("newsSummary");
  const cover = document.getElementById("newsCover");
  const content = document.getElementById("newsContent");
  const images = document.getElementById("newsImages");
  if (!title || !meta || !summary || !cover || !content || !images) return;

  const titleText = item.title || I18N.untitled;
  title.textContent = titleText;
  meta.textContent = [isPinned(item) ? "置顶" : "", item.date || I18N.noDate, item.source || "Flyteam"].filter(Boolean).join(" | ");
  summary.textContent = item.summary || "";

  const coverUrl = normalizeImageUrl(item.cover_url);
  if (coverUrl) {
    cover.src = coverUrl;
    cover.style.display = "block";
    bindPreview(cover, titleText);
  } else {
    cover.style.display = "none";
  }

  const body = String(item.content || "").trim();
  const usedUrls = renderRichContent(content, body, titleText);

  images.innerHTML = "";
  const imageUrls = Array.isArray(item.image_urls) ? item.image_urls : [];
  const leftovers = imageUrls.map(normalizeImageUrl).filter((x) => x && !usedUrls.has(x));

  leftovers.forEach((url, idx) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = `${titleText} #${idx + 1}`;
    img.loading = "lazy";
    bindPreview(img, img.alt);
    images.appendChild(img);
  });

  if (!body && !coverUrl && !leftovers.length) {
    content.textContent = "";
    content.appendChild(createNode("p", "news-rich-paragraph", I18N.noBody));
  }
}

async function init() {
  initImageLightbox();
  const newsId = getParam("id");
  if (!newsId) {
    try {
      const data = await fetchJSON("/api/content");
      renderNewsList(Array.isArray(data.news) ? data.news : []);
    } catch (err) {
      const root = document.getElementById("newsList");
      if (root) root.appendChild(createNode("p", "section-sub", `${I18N.loadFailed}：${err.message}`));
    }
    return;
  }
  try {
    const data = await fetchJSON(`/api/news/${encodeURIComponent(newsId)}`);
    renderNews(data.news || {});
  } catch (err) {
    const title = document.getElementById("newsTitle");
    const content = document.getElementById("newsContent");
    if (title) title.textContent = I18N.loadFailed;
    if (content) {
      content.textContent = "";
      content.appendChild(createNode("p", "news-rich-paragraph", err.message));
    }
  }
}

init();
