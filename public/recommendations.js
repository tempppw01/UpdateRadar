const state = { recommendations: [], chartFilter: "", countryFilter: "" };
const elements = {
  recommendationGrid: document.querySelector("#recommendation-grid"),
  chartFilter: document.querySelector("#chart-filter"),
  countryFilter: document.querySelector("#country-filter"),
  refreshButton: document.querySelector("#refresh-recommendations"),
  resultsCount: document.querySelector("#results-count"),
  themeToggle: document.querySelector("#theme-toggle"),
  settingsButton: document.querySelector("#settings-button")
};

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(response.ok ? "服务返回的数据不完整，请稍后重试" : `请求失败（HTTP ${response.status}`);
  }
  if (!body || typeof body !== "object") throw new Error(response.ok ? "服务返回的数据格式不正确，请稍后重试" : `请求失败（HTTP ${response.status}`);
  if (!response.ok) throw new Error(body.message || body.error || "请求失败");
  return body;
}

async function loadRecommendations() {
  try {
    const recommendations = await requestJson("/v1/recommendations");
    state.recommendations = recommendations;
    renderRecommendations();
  } catch (error) {
    renderEmpty(`无法加载推荐数据：${error.message}`);
  }
}

function renderEmpty(message) {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  elements.recommendationGrid.replaceChildren(empty);
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function recommendationChip(label, className = "") {
  const chip = document.createElement("span");
  chip.className = `chip${className ? ` ${className}` : ""}`;
  chip.textContent = label;
  return chip;
}

function recommendationCard(app) {
  const card = document.createElement("article");
  card.className = "recommendation-card";

  const iconContainer = document.createElement("div");
  iconContainer.className = "recommendation-icon";
  const iconUrl = safeHttpsUrl(app.icon);
  if (iconUrl) {
    const icon = document.createElement("img");
    icon.src = iconUrl;
    icon.alt = String(app.title ?? "");
    icon.loading = "lazy";
    icon.referrerPolicy = "no-referrer";
    icon.addEventListener("error", () => icon.remove(), { once: true });
    iconContainer.append(icon);
  }

  const main = document.createElement("div");
  main.className = "recommendation-main";
  const titleUrl = safeHttpsUrl(app.url);
  const title = document.createElement(titleUrl ? "a" : "span");
  title.className = "recommendation-title";
  title.textContent = String(app.title ?? "");
  if (titleUrl) {
    title.href = titleUrl;
    title.target = "_blank";
    title.rel = "noreferrer";
  }

  const developer = document.createElement("p");
  developer.className = "recommendation-developer";
  developer.textContent = String(app.developer ?? "");

  const meta = document.createElement("div");
  meta.className = "recommendation-meta";
  meta.append(
    recommendationChip(`第 ${app.ordinal} 名`, "rank-chip"),
    recommendationChip(String(app.chartLabel ?? "")),
    recommendationChip(String(app.country ?? "").toUpperCase()),
    recommendationChip(app.platform === "iphone" ? "iPhone" : "iPad")
  );

  main.append(title, developer, meta);
  card.append(iconContainer, main);
  return card;
}

function renderRecommendations() {
  const filtered = state.recommendations.filter((app) => {
    if (state.chartFilter && app.chart !== state.chartFilter) return false;
    if (state.countryFilter && app.country !== state.countryFilter) return false;
    return true;
  });
  
  elements.resultsCount.textContent = `共 ${filtered.length} 个应用`;
  
  if (filtered.length === 0) {
    renderEmpty("没有找到匹配的应用");
    return;
  }

  elements.recommendationGrid.replaceChildren(...filtered.map(recommendationCard));
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  elements.themeToggle.textContent = theme === "dark" ? "☀ 明亮" : "◐ 暗黑";
}

const savedTheme = localStorage.getItem("update-radar-theme");
applyTheme(savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

elements.themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("update-radar-theme", theme);
  applyTheme(theme);
});

elements.settingsButton.addEventListener("click", () => {
  window.location.href = "/?settings=1";
});

elements.chartFilter.addEventListener("change", (event) => {
  state.chartFilter = event.target.value;
  renderRecommendations();
});

elements.countryFilter.addEventListener("change", (event) => {
  state.countryFilter = event.target.value;
  renderRecommendations();
});

elements.refreshButton.addEventListener("click", () => {
  loadRecommendations();
});

loadRecommendations();
