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
    elements.recommendationGrid.innerHTML = `<div class="empty">无法加载推荐数据：${error.message}</div>`;
  }
}

function renderRecommendations() {
  const filtered = state.recommendations.filter((app) => {
    if (state.chartFilter && app.chart !== state.chartFilter) return false;
    if (state.countryFilter && app.country !== state.countryFilter) return false;
    return true;
  });
  
  elements.resultsCount.textContent = `共 ${filtered.length} 个应用`;
  
  if (filtered.length === 0) {
    elements.recommendationGrid.innerHTML = `<div class="empty">没有找到匹配的应用</div>`;
    return;
  }
  
  elements.recommendationGrid.innerHTML = filtered.map((app) => `
    <article class="recommendation-card">
      <div class="recommendation-icon">
        <img src="${app.icon}" alt="${app.title}" onerror="this.style.display='none'">
      </div>
      <div class="recommendation-main">
        <a class="recommendation-title" href="${app.url}" target="_blank" rel="noreferrer">${app.title}</a>
        <p class="recommendation-developer">${app.developer}</p>
        <div class="recommendation-meta">
          <span class="chip rank-chip">第 ${app.ordinal} 名</span>
          <span class="chip">${app.chartLabel}</span>
          <span class="chip">${app.country.toUpperCase()}</span>
          <span class="chip">${app.platform === "iphone" ? "iPhone" : "iPad"}</span>
        </div>
      </div>
    </article>
  `).join("");
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
  window.location.href = "/";
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
