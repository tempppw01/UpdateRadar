const savedCardColumns = Number(localStorage.getItem("update-radar-card-columns"));
const state = { events: [], sources: [], lastSyncedAt: null, tag: "", sourceId: "", search: "", eventPage: 1, visibleEventSourceIds: [], eventView: localStorage.getItem("update-radar-event-view") || "list", eventCardColumns: [1, 2, 3].includes(savedCardColumns) ? savedCardColumns : 3, expandedEventSourceIds: new Set(), editingSourceId: null, selectedSourceIds: new Set(), activeEvent: null, activeTranslation: "", translationView: "original", translationRequestVersion: 0, translating: false, contextSourceId: null, sourceAutoSaveTimer: null, sourceAutoSavePromise: null, sourceEditorSession: 0, sourceChangeVersion: 0, sourceAutoSaveInFlight: false };
const elements = {
  eventCount: document.querySelector("#event-count"),
  sourceCount: document.querySelector("#source-count"),
  tagCount: document.querySelector("#tag-count"),
  lastSync: document.querySelector("#last-sync"),
  tagFilters: document.querySelector("#tag-filters"),
  eventSearch: document.querySelector("#event-search"),
  sourceFilter: document.querySelector("#source-filter"),
  eventList: document.querySelector("#event-list"),
  eventPagination: document.querySelector("#event-pagination"),
  eventViewButtons: [...document.querySelectorAll("[data-event-view]")],
  cardColumnsControl: document.querySelector("#card-columns-control"),
  cardColumns: document.querySelector("#card-columns"),
  resultsCount: document.querySelector("#results-count"),
  syncButton: document.querySelector("#sync-button"),
  syncPageButton: document.querySelector("#sync-page-button"),
  quickAddSource: document.querySelector("#quick-add-source"),
  welcomeDialog: document.querySelector("#welcome-dialog"),
  closeWelcome: document.querySelector("#close-welcome"),
  dismissWelcome: document.querySelector("#dismiss-welcome"),
  welcomeAddSource: document.querySelector("#welcome-add-source"),
  themeToggle: document.querySelector("#theme-toggle"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  closeSettings: document.querySelector("#close-settings"),
  exportBackup: document.querySelector("#export-backup"),
  importBackup: document.querySelector("#import-backup"),
  backupFile: document.querySelector("#backup-file"),
  settingsSourceList: document.querySelector("#settings-source-list"),
  selectAllSources: document.querySelector("#select-all-sources"),
  bulkDeleteSources: document.querySelector("#bulk-delete-sources"),
  sourceForm: document.querySelector("#source-form"),
  sourceKind: document.querySelector("#source-kind"),
  editorMode: document.querySelector("#editor-mode"),
  editorTitle: document.querySelector("#editor-title"),
  resetEditor: document.querySelector("#reset-editor"),
  cancelEdit: document.querySelector("#cancel-edit"),
  deleteSource: document.querySelector("#delete-source"),
  sourceSaveStatus: document.querySelector("#source-save-status"),
  appStoreSearchInput: document.querySelector("#app-store-search-input"),
  appStoreSearchCountry: document.querySelector("#app-store-search-country"),
  appStoreSearchButton: document.querySelector("#app-store-search-button"),
  appStoreResults: document.querySelector("#app-store-results"),
  githubRepositoryInput: document.querySelector("#github-repository-input"),
  githubRepositorySearch: document.querySelector("#github-repository-search"),
  githubRepositoryResults: document.querySelector("#github-repository-results"),
  dockerHubSearchInput: document.querySelector("#docker-hub-search-input"),
  dockerHubSearchButton: document.querySelector("#docker-hub-search-button"),
  dockerHubResults: document.querySelector("#docker-hub-results"),
  qnapSearchInput: document.querySelector("#qnap-search-input"),
  qnapSearchButton: document.querySelector("#qnap-search-button"),
  qnapResults: document.querySelector("#qnap-results"),
  officialWebsiteTemplate: document.querySelector("#official-website-template"),
  applyOfficialWebsiteTemplate: document.querySelector("#apply-official-website-template"),
  nintendoSearchInput: document.querySelector("#nintendo-search-input"),
  nintendoSearchButton: document.querySelector("#nintendo-search-button"),
  nintendoResults: document.querySelector("#nintendo-results"),
  steamSearchInput: document.querySelector("#steam-search-input"),
  steamSearchButton: document.querySelector("#steam-search-button"),
  steamResults: document.querySelector("#steam-results"),
  translationBaseUrl: document.querySelector("#translation-base-url"),
  translationModel: document.querySelector("#translation-model"),
  loadTranslationModels: document.querySelector("#load-translation-models"),
  translationApiKey: document.querySelector("#translation-api-key"),
  translationTargetLanguage: document.querySelector("#translation-target-language"),
  saveTranslationSettings: document.querySelector("#save-translation-settings"),
  eventDialog: document.querySelector("#event-dialog"),
  eventDialogTitle: document.querySelector("#event-dialog-title"),
  eventDialogMeta: document.querySelector("#event-dialog-meta"),
  eventDialogDetails: document.querySelector("#event-dialog-details"),
  eventDialogLink: document.querySelector("#event-dialog-link"),
  eventDialogContent: document.querySelector("#event-dialog-content"),
  eventHistory: document.querySelector("#event-history"),
  eventHistoryToggle: document.querySelector("#event-history-toggle"),
  eventHistoryCount: document.querySelector("#event-history-count"),
  eventHistoryIndicator: document.querySelector("#event-history-indicator"),
  eventHistoryList: document.querySelector("#event-history-list"),
  eventScreenshots: document.querySelector("#event-screenshots"),
  eventScreenshotsList: document.querySelector("#event-screenshots-list"),
  eventHighlights: document.querySelector("#event-highlights"),
  eventHighlightsList: document.querySelector("#event-highlights-list"),
  translationViewToggle: document.querySelector("#translation-view-toggle"),
  viewOriginal: document.querySelector("#view-original"),
  viewTranslated: document.querySelector("#view-translated"),
  viewBilingual: document.querySelector("#view-bilingual"),
  eventAssets: document.querySelector("#event-assets"),
  eventAssetsList: document.querySelector("#event-assets-list"),
  cardContextMenu: document.querySelector("#card-context-menu"),
  cardContextSource: document.querySelector("#card-context-source"),
  cardContextDelete: document.querySelector("#card-context-delete"),
  toast: document.querySelector("#toast"),
  template: document.querySelector("#event-template")
};

const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const relativeFormat = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
const topbar = document.querySelector(".topbar");
let topbarPinned = false;
let topbarStateFrame = 0;
const sourceIcons = {
  "github-releases": { name: "GitHub", slug: "github" },
  "github-commits": { name: "GitHub", slug: "github" },
  "docker-hub": { name: "Docker Hub", slug: "docker" },
  rss: { name: "RSS", slug: "rss" },
  "app-store": { name: "App Store", slug: "appstore" },
  "google-play": { name: "Google Play", slug: "googleplay" },
  "qnap-app": { name: "QNAP", slug: "qnap" },
  "official-website": { name: "官网自定义监控", assetUrl: "/icons/official-website.svg" },
  "nintendo-switch": { name: "Nintendo Switch", slug: "nintendoswitch" },
  steam: { name: "Steam", slug: "steam" },
  playstation: { name: "PlayStation", slug: "playstation" },
  xbox: { name: "Xbox", slug: "xbox" }
};

function sourceIconUrl(kind) {
  const icon = sourceIcons[kind];
  if (!icon) return "";
  if (icon.assetUrl) return icon.assetUrl;
  const color = document.documentElement.dataset.theme === "dark" ? "f0f7f5" : "10232e";
  return `https://cdn.simpleicons.org/${icon.slug}/${color}`;
}

function updateTopbarState() {
  const pinned = window.scrollY > 12;
  if (pinned === topbarPinned) return;
  topbarPinned = pinned;
  topbar.classList.toggle("is-pinned", pinned);
}

function scheduleTopbarStateUpdate() {
  if (topbarStateFrame) return;
  topbarStateFrame = requestAnimationFrame(() => {
    topbarStateFrame = 0;
    updateTopbarState();
  });
}

const tagCategories = {
  "app-store": { label: "App Store", iconKind: "app-store" },
  "github-releases": { label: "GitHub 发布", iconKind: "github-releases" },
  "github-commits": { label: "GitHub 提交", iconKind: "github-commits" },
  github: { label: "GitHub", iconKind: "github-releases" },
  commits: { label: "提交", icon: "↗" },
  "docker-hub": { label: "Docker Hub", iconKind: "docker-hub" },
  "qnap-app": { label: "QNAP App Center", iconKind: "qnap-app" },
  "official-website": { label: "官网自定义监控", iconKind: "official-website" },
  "nintendo-switch": { label: "Nintendo Switch", iconKind: "nintendo-switch" },
  rss: { label: "RSS", iconKind: "rss" },
  steam: { label: "Steam", iconKind: "steam" },
  playstation: { label: "PlayStation", iconKind: "playstation" },
  xbox: { label: "Xbox", iconKind: "xbox" }
};

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  elements.themeToggle.textContent = theme === "dark" ? "☀ 明亮" : "◐ 暗黑";
}

const savedTheme = localStorage.getItem("update-radar-theme");
applyTheme(savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

function applyEventView(view) {
  state.eventView = ["compact", "list", "cards"].includes(view) ? view : "list";
  elements.eventList.dataset.view = state.eventView;
  elements.eventList.dataset.cardColumns = String(state.eventCardColumns);
  elements.cardColumnsControl.hidden = state.eventView !== "cards";
  elements.cardColumns.value = String(state.eventCardColumns);
  elements.eventViewButtons.forEach((button) => {
    const active = button.dataset.eventView === state.eventView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

applyEventView(state.eventView);

function dismissWelcome() {
  localStorage.setItem("update-radar-welcome-dismissed", "true");
  elements.welcomeDialog.close();
}

function showWelcomeOnFirstVisit() {
  if (localStorage.getItem("update-radar-welcome-dismissed") !== "true") elements.welcomeDialog.showModal();
}

function relativeTime(value) {
  const minutes = Math.round((new Date(value) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormat.format(hours, "hour");
  return relativeFormat.format(Math.round(hours / 24), "day");
}

function publishedDateLabel(event) {
  const unavailableLabel = event.sourceKind === "qnap-app" ? "QNAP 官方尚未公布发布日期" : "官方未提供发布日期";
  if (!event.publishedAt) return unavailableLabel;
  const date = new Date(event.publishedAt);
  return Number.isNaN(date.getTime()) ? unavailableLabel : dateFormat.format(date);
}

function showToast(message, type = "success") {
  const activeDialog = [elements.eventDialog, elements.settingsDialog, elements.welcomeDialog].find((dialog) => dialog.open);
  const container = activeDialog ?? document.body;
  if (elements.toast.parentElement !== container) container.append(elements.toast);
  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 4200);
}

function restoreToastToPage() {
  if (elements.toast.parentElement !== document.body) document.body.append(elements.toast);
}

async function exportBackup() {
  try {
    const backup = await requestJson("/v1/backup");
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `update-radar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("设置备份已导出（不含 API Key）");
  } catch (error) { showToast(`无法导出备份：${error.message}`, "error"); }
}

async function importBackup(file) {
  try {
    const backup = JSON.parse(await file.text());
    if (!window.confirm("导入将替换当前全部数据源配置，并清理已删除来源的历史更新，是否继续？")) return;
    const result = await requestJson("/v1/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup) });
    state.selectedSourceIds.clear();
    await load(); startNewEditor(); renderSettingsSources();
    showToast(`已导入 ${result.sources} 个数据源`);
  } catch (error) { showToast(`无法导入备份：${error.message}`, "error"); }
}

function releaseAssets(event) {
  return Array.isArray(event.metadata?.assets) ? event.metadata.assets.filter((asset) => asset?.url && asset?.name) : [];
}

function eventRepositoryLabel(event, source) {
  if (event.metadata?.repository) return event.metadata.repository;
  if (event.metadata?.owner && event.metadata?.repo) return `${event.metadata.owner}/${event.metadata.repo}`;
  if (source?.owner && source?.repo) return `${source.owner}/${source.repo}`;
  if (event.sourceName && event.sourceName.includes("/")) return event.sourceName;
  return event.sourceName || "";
}

function eventHeading(event) {
  if (event.version) return `${event.sourceName} / ${event.version}`;
  if (event.sourceKind === "github-commits") {
    const source = state.sources.find((candidate) => candidate.id === event.sourceId);
    const repo = eventRepositoryLabel(event, source);
    const title = event.title || "";
    if (repo && title && !title.startsWith(`${repo} `) && !title.startsWith(`${repo}·`) && !title.startsWith(`${repo} ·`)) {
      return `${repo} · ${title}`;
    }
    return title || repo;
  }
  return event.title;
}

function storeRegion(value) {
  const country = String(value || "").toUpperCase();
  const labels = { CN: "中国大陆", US: "美国", JP: "日本", GB: "英国", HK: "中国香港", TW: "中国台湾", KR: "韩国", SG: "新加坡", CA: "加拿大", AU: "澳大利亚" };
  return labels[country] || country;
}

function releaseHighlights(summary = "") {
  const lines = String(summary).split(/\r?\n/).map((line) => line.replace(/^\s*[-*#]+\s*/, "").trim()).filter(Boolean);
  const priority = /(security|critical|high|urgent|cve|bug fix|hotfix|漏洞|安全|高优先级|紧急|错误修复)/i;
  return lines.filter((line) => priority.test(line)).slice(0, 3);
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 1) return "";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}

function assetLink(asset) {
  const link = document.createElement("a");
  link.href = asset.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.className = "download-button";
  link.textContent = `下载 ${asset.name}${asset.size ? ` · ${formatBytes(asset.size)}` : ""}`;
  return link;
}

function screenshotCard(url, appName, index) {
  const link = document.createElement("a");
  link.className = "event-screenshot-card";
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  const image = document.createElement("img");
  image.src = url;
  image.alt = `${appName} App Store 截图 ${index + 1}`;
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => link.remove());
  link.append(image);
  return link;
}

function setTranslationModels(models, selected = "") {
  const options = [...new Set([selected, ...models].filter(Boolean))];
  elements.translationModel.replaceChildren(new Option(options.length ? "选择模型" : "未找到模型", ""));
  options.forEach((model) => elements.translationModel.add(new Option(model, model)));
  elements.translationModel.value = selected || "";
}

async function loadTranslationModels() {
  elements.loadTranslationModels.disabled = true;
  elements.loadTranslationModels.textContent = "加载中";
  try {
    const result = await requestJson("/v1/translation/models", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: elements.translationBaseUrl.value, apiKey: elements.translationApiKey.value })
    });
    setTranslationModels(result.models, elements.translationModel.value);
    showToast(`已加载 ${result.models.length} 个模型`);
  } catch (error) { showToast(`无法加载模型：${error.message}`, "error"); }
  finally { elements.loadTranslationModels.disabled = false; elements.loadTranslationModels.textContent = "加载模型"; }
}

function openEventDetails(event) {
  state.activeEvent = event;
  state.activeTranslation = "";
  state.translationView = "original";
  state.translationRequestVersion += 1;
  state.translating = false;
  elements.eventDialogTitle.textContent = eventHeading(event);
  const region = event.sourceKind === "app-store" && event.metadata?.store ? ` · App Store ${storeRegion(event.metadata.store)}` : "";
  const versionOrCommit = event.version
    || (event.sourceKind === "github-commits" && event.metadata?.commit
      ? `提交 ${event.metadata.commit}${event.metadata.branch && event.metadata.branch !== "default" ? ` · ${event.metadata.branch}` : ""}`
      : "")
    || "未提供版本";
  elements.eventDialogMeta.textContent = `${event.sourceName} · ${versionOrCommit}${region} · ${publishedDateLabel(event)}`;
  elements.eventDialogDetails.replaceChildren();
  const purchase = event.metadata?.inAppPurchase;
  const storePrice = event.metadata?.storePrice;
  if (storePrice?.price) {
    const price = document.createElement("span");
    price.textContent = `App Store 售价 · ${storePrice.price}${storePrice.country ? ` · ${storeRegion(storePrice.country)}` : ""}`;
    elements.eventDialogDetails.append(price);
  }
  if (purchase?.price) {
    const price = document.createElement("span");
    price.textContent = `App Store 内购价格 · ${purchase.name || "未命名套餐"} · ${purchase.price}${purchase.country ? ` · ${storeRegion(purchase.country)}` : ""}`;
    elements.eventDialogDetails.append(price);
  }
  elements.eventDialogDetails.hidden = elements.eventDialogDetails.childElementCount === 0;
  elements.eventDialogLink.href = event.url;
  const highlights = releaseHighlights(event.summary);
  elements.eventHighlightsList.replaceChildren(...highlights.map((highlight) => {
    const item = document.createElement("li");
    item.textContent = highlight;
    return item;
  }));
  elements.eventHighlights.hidden = highlights.length === 0;
  renderEventDialogText("original");
  setTranslationLoading(false);
  const screenshots = event.sourceKind === "app-store" ? event.metadata?.screenshots ?? [] : [];
  elements.eventScreenshotsList.replaceChildren(...screenshots.map((url, index) => screenshotCard(url, event.sourceName, index)));
  elements.eventScreenshots.hidden = screenshots.length === 0;
  elements.eventAssetsList.replaceChildren();
  const assets = releaseAssets(event);
  elements.eventAssets.hidden = !assets.length;
  assets.forEach((asset) => elements.eventAssetsList.append(assetLink(asset)));
  loadEventHistory(event);
  if (!elements.eventDialog.open) elements.eventDialog.showModal();
  elements.eventDialog.scrollTop = 0;
}

function setEventHistoryExpanded(expanded) {
  elements.eventHistoryToggle.setAttribute("aria-expanded", String(expanded));
  elements.eventHistoryList.hidden = !expanded;
  elements.eventHistoryIndicator.textContent = expanded ? "收起 ↑" : "展开 ↓";
}

function historySummary(event) {
  const summary = String(event.summary || "官方未提供更新说明。").replace(/\s+/g, " ").trim();
  return summary.length > 96 ? `${summary.slice(0, 96)}…` : summary;
}

function renderEventHistory(events, activeEventId) {
  const history = events.filter((event) => event.id !== activeEventId);
  elements.eventHistoryList.replaceChildren();
  elements.eventHistory.hidden = history.length === 0;
  if (!history.length) return;
  elements.eventHistoryCount.textContent = `${history.length} 个历史版本`;
  history.forEach((event) => {
    const item = document.createElement("li");
    const select = document.createElement("button");
    select.type = "button";
    select.className = "event-history-item";
    const version = document.createElement("strong");
    version.textContent = event.version || event.title || "未提供版本";
    const time = document.createElement("time");
    time.dateTime = event.publishedAt || "";
    time.textContent = publishedDateLabel(event);
    const summary = document.createElement("span");
    summary.textContent = historySummary(event);
    select.append(version, time, summary);
    select.addEventListener("click", () => openEventDetails(event));
    item.append(select);
    elements.eventHistoryList.append(item);
  });
  setEventHistoryExpanded(false);
}

async function loadEventHistory(event) {
  elements.eventHistory.hidden = true;
  elements.eventHistoryList.replaceChildren();
  setEventHistoryExpanded(false);
  if (!event.sourceId) return;
  try {
    const events = await requestJson(`/v1/events?${new URLSearchParams({ sourceId: event.sourceId, limit: "200" })}`);
    if (state.activeEvent?.id !== event.id) return;
    renderEventHistory(events, event.id);
  } catch {
    elements.eventHistory.hidden = true;
  }
}

function renderEventDialogText(view) {
  const original = state.activeEvent?.summary || "官方未提供本次发布说明。";
  const translated = state.activeTranslation || original;
  state.translationView = view;
  if (view === "bilingual") {
    const bilingual = document.createElement("div");
    bilingual.className = "event-bilingual-content";
    [
      ["原文", original],
      ["译文", translated]
    ].forEach(([label, text]) => {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      const content = document.createElement("div");
      heading.textContent = label;
      content.textContent = text;
      section.append(heading, content);
      bilingual.append(section);
    });
    elements.eventDialogContent.replaceChildren(bilingual);
  } else {
    elements.eventDialogContent.textContent = view === "translation" ? translated : original;
  }
  elements.viewOriginal.classList.toggle("active", view === "original");
  elements.viewTranslated.classList.toggle("active", view === "translation");
  elements.viewBilingual.classList.toggle("active", view === "bilingual");
}

function setTranslationLoading(loading) {
  elements.viewTranslated.disabled = loading;
  elements.viewBilingual.disabled = loading;
}

async function showTranslation(view) {
  if (!state.activeEvent) return;
  if (state.activeTranslation) return renderEventDialogText(view);
  if (state.translating) return;
  const event = state.activeEvent;
  const requestVersion = ++state.translationRequestVersion;
  state.translating = true;
  state.translationView = view;
  setTranslationLoading(true);
  showToast("正在翻译更新说明");
  try {
    const result = await requestJson("/v1/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: event.summary || event.title }) });
    if (requestVersion !== state.translationRequestVersion) return;
    state.activeTranslation = result.text;
    renderEventDialogText(state.translationView);
  } catch (error) {
    if (requestVersion !== state.translationRequestVersion) return;
    state.translationView = "original";
    renderEventDialogText("original");
    showToast(`翻译失败：${error.message}`, "error");
  } finally {
    if (requestVersion !== state.translationRequestVersion) return;
    state.translating = false;
    setTranslationLoading(false);
  }
}

function categoryLabel(category) {
  return tagCategories[category]?.label ?? category;
}

const detailOnlyTags = new Set(["in-app-purchase", "pricing"]);

function eventCategories(event) {
  return [...new Set([event.sourceKind, ...(event.tags ?? [])].filter((tag) => tag && !detailOnlyTags.has(tag)))];
}

function sourceCategories(source) {
  return [...new Set([source.kind, ...(source.tags ?? [])].filter((tag) => tag && !detailOnlyTags.has(tag)))];
}

function renderMetrics() {
  const tags = new Set(state.events.flatMap(eventCategories));
  const newest = state.events[0];
  elements.eventCount.textContent = state.events.length;
  elements.sourceCount.textContent = state.sources.filter((source) => source.enabled).length;
  elements.tagCount.textContent = tags.size;
  elements.lastSync.textContent = state.lastSyncedAt ? relativeTime(state.lastSyncedAt) : (newest ? relativeTime(newest.detectedAt) : "尚未同步");
}

function renderFilters() {
  const activeSourceIds = new Set(state.events.map((event) => event.sourceId));
  const tagCounts = new Map();
  state.events.forEach((event) => eventCategories(event).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)));
  const tags = [...tagCounts.keys()];
  if (state.tag && !tags.includes(state.tag)) state.tag = "";
  if (state.sourceId && !activeSourceIds.has(state.sourceId)) state.sourceId = "";
  elements.tagFilters.replaceChildren();
  [{ value: "", label: "全部", icon: "◉", count: state.events.length }, ...tags.map((tag) => ({
    value: tag,
    label: categoryLabel(tag),
    icon: tagCategories[tag]?.icon ?? "#",
    iconUrl: sourceIconUrl(tagCategories[tag]?.iconKind),
    count: tagCounts.get(tag)
  }))].forEach(({ value, label, icon, iconUrl, count }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = value === state.tag ? "active" : "";
    button.title = value ? `筛选 ${label}` : "显示全部更新";
    const categoryIcon = document.createElement(iconUrl ? "img" : "span");
    categoryIcon.className = "tag-filter-icon";
    if (iconUrl) {
      categoryIcon.src = iconUrl;
      categoryIcon.alt = "";
      categoryIcon.referrerPolicy = "no-referrer";
      categoryIcon.addEventListener("error", () => { categoryIcon.replaceWith(Object.assign(document.createElement("span"), { className: "tag-filter-icon", textContent: "#" })); });
    } else categoryIcon.textContent = icon;
    const categoryLabel = document.createElement("span");
    categoryLabel.textContent = label;
    const categoryCount = document.createElement("small");
    categoryCount.textContent = String(count);
    button.append(categoryIcon, categoryLabel, categoryCount);
    button.addEventListener("click", () => { state.tag = value; state.eventPage = 1; renderFilters(); renderEvents(); });
    elements.tagFilters.append(button);
  });

  elements.sourceFilter.replaceChildren(new Option("所有来源", ""));
  state.sources.filter((source) => activeSourceIds.has(source.id)).forEach((source) => elements.sourceFilter.add(new Option(source.name, source.id)));
  elements.sourceFilter.value = state.sourceId;
}

function matchesEventSearch(event) {
  const query = state.search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [event.sourceName, event.title, event.version, event.summary, ...eventCategories(event), ...eventCategories(event).map(categoryLabel)]
    .some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
}

function groupToggle(sourceEvents, sourceId, expanded) {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "event-group-toggle";
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.textContent = expanded ? `收起 ${sourceEvents.length - 1} 条历史更新` : `展开 ${sourceEvents.length - 1} 条历史更新`;
  toggle.addEventListener("click", () => {
    if (state.expandedEventSourceIds.has(sourceId)) state.expandedEventSourceIds.delete(sourceId);
    else state.expandedEventSourceIds.add(sourceId);
    renderEvents();
  });
  return toggle;
}

function closeCardContextMenu() {
  state.contextSourceId = null;
  elements.cardContextMenu.hidden = true;
}

function openCardContextMenu(source, event) {
  event.preventDefault();
  state.contextSourceId = source.id;
  elements.cardContextSource.textContent = source.name;
  elements.cardContextMenu.hidden = false;
  const left = Math.min(event.clientX, window.innerWidth - elements.cardContextMenu.offsetWidth - 12);
  const top = Math.min(event.clientY, window.innerHeight - elements.cardContextMenu.offsetHeight - 12);
  elements.cardContextMenu.style.left = `${Math.max(12, left)}px`;
  elements.cardContextMenu.style.top = `${Math.max(12, top)}px`;
}

function renderEventPagination(pageCount, groupCount) {
  elements.eventPagination.replaceChildren();
  if (pageCount <= 1) return;
  const first = document.createElement("button");
  first.type = "button";
  first.textContent = "|← 第一页";
  first.disabled = state.eventPage === 1;
  first.addEventListener("click", () => { state.eventPage = 1; renderEvents(); });
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "← 上一页";
  previous.disabled = state.eventPage === 1;
  previous.addEventListener("click", () => { state.eventPage -= 1; renderEvents(); });
  const status = document.createElement("span");
  status.textContent = `第 ${state.eventPage} / ${pageCount} 页 · ${groupCount} 个监控项目`;
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "下一页 →";
  next.disabled = state.eventPage === pageCount;
  next.addEventListener("click", () => { state.eventPage += 1; renderEvents(); });
  const last = document.createElement("button");
  last.type = "button";
  last.textContent = "最后一页 →|";
  last.disabled = state.eventPage === pageCount;
  last.addEventListener("click", () => { state.eventPage = pageCount; renderEvents(); });
  elements.eventPagination.append(first, previous, status, next, last);
}

function eventDisplayTags(event) {
  return [...new Set(event.tags ?? [])].filter((tag) => tag && tag !== event.sourceKind && !detailOnlyTags.has(tag));
}

function renderEvents() {
  const events = state.events.filter((event) => (!state.tag || eventCategories(event).includes(state.tag)) && (!state.sourceId || event.sourceId === state.sourceId) && matchesEventSearch(event));
  elements.resultsCount.textContent = `DISPLAYING ${events.length} SIGNAL${events.length === 1 ? "" : "S"}`;
  elements.eventList.replaceChildren();
  elements.eventPagination.replaceChildren();
  if (!events.length) {
    state.visibleEventSourceIds = [];
    elements.eventList.innerHTML = '<div class="empty">这个筛选条件下尚未发现更新。尝试切换来源或标签。</div>';
    return;
  }
  const groups = new Map();
  events.forEach((event) => {
    const key = event.sourceId || event.sourceName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });
  const groupEntries = [...groups.entries()];
  const pageSize = state.eventView === "cards" ? 9 : 10;
  const pageCount = Math.max(1, Math.ceil(groupEntries.length / pageSize));
  state.eventPage = Math.min(state.eventPage, pageCount);
  const pageGroups = groupEntries.slice((state.eventPage - 1) * pageSize, state.eventPage * pageSize);
  state.visibleEventSourceIds = pageGroups.map(([sourceId]) => sourceId);
  if (pageCount > 1) elements.resultsCount.textContent += ` · PAGE ${state.eventPage}/${pageCount}`;
  pageGroups.forEach(([sourceId, sourceEvents]) => {
    const expanded = state.expandedEventSourceIds.has(sourceId);
    const visibleEvents = expanded ? sourceEvents : sourceEvents.slice(0, 1);
    const group = document.createElement("section");
    group.className = `event-source-group ${expanded ? "expanded" : "collapsed"}`;
    visibleEvents.forEach((event, index) => {
    const card = elements.template.content.cloneNode(true);
    const article = card.querySelector(".event-card");
    const appIcon = card.querySelector(".event-app-icon");
    const source = state.sources.find((candidate) => candidate.id === event.sourceId);
    if (source) article.addEventListener("contextmenu", (clickEvent) => openCardContextMenu(source, clickEvent));
    if (source && index === 0) {
      article.classList.add("event-card-has-sync");
      const syncSource = document.createElement("button");
      syncSource.type = "button";
      syncSource.className = "event-sync-button";
      syncSource.textContent = "↻ 同步";
      syncSource.title = `同步 ${source.name}`;
      syncSource.addEventListener("click", () => syncSources([source.id], syncSource));
      article.append(syncSource);
    }
    const artworkUrl = event.metadata?.artworkUrl || source?.artworkUrl || "";
    if (artworkUrl) {
      article.classList.add("event-with-app-icon");
      const image = document.createElement("img");
      image.src = artworkUrl;
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => { article.classList.remove("event-with-app-icon"); appIcon.remove(); });
      appIcon.append(image);
    } else {
      appIcon.remove();
    }
    const eventSource = card.querySelector(".event-source");
    const sourceIcon = sourceIcons[event.sourceKind];
    if (sourceIcon) {
      eventSource.classList.add("event-source-with-icon");
      const image = document.createElement("img");
      image.src = sourceIconUrl(event.sourceKind);
      image.alt = `${sourceIcon.name} 图标`;
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      eventSource.append(image);
    }
    const repositoryLabel = eventRepositoryLabel(event, source);
    eventSource.title = repositoryLabel || event.sourceName;
    if (sourceIcon) {
      eventSource.append(document.createTextNode(categoryLabel(event.sourceKind)));
      if (event.sourceKind === "github-commits" && repositoryLabel) {
        const repoBadge = document.createElement("span");
        repoBadge.className = "event-source-repo";
        repoBadge.textContent = repositoryLabel;
        eventSource.append(repoBadge);
      }
    } else {
      eventSource.append(document.createTextNode(event.sourceName));
    }
    const time = card.querySelector("time");
    time.dateTime = event.publishedAt || "";
    time.textContent = !event.publishedAt || Number.isNaN(new Date(event.publishedAt).getTime()) ? publishedDateLabel(event) : `${relativeTime(event.publishedAt)} · ${publishedDateLabel(event)}`;
    const title = card.querySelector(".event-title-button");
    title.textContent = eventHeading(event);
    title.addEventListener("click", () => openEventDetails(event));
    const summary = card.querySelector(".event-summary");
    summary.textContent = event.summary || "官方未提供本次更新说明。";
    summary.hidden = !event.summary;
    const details = document.createElement("div");
    details.className = "event-details";
    if (event.version) {
      const version = document.createElement("span");
      version.textContent = `版本 ${event.version}`;
      details.append(version);
    }
    if (event.sourceKind === "app-store" && event.metadata?.store) {
      const region = document.createElement("span");
      region.textContent = `App Store ${storeRegion(event.metadata.store)}`;
      details.append(region);
    }
    if (event.metadata?.storePrice?.price) {
      const price = document.createElement("span");
      price.textContent = `售价 ${event.metadata.storePrice.price}`;
      details.append(price);
    }
    if (event.metadata?.inAppPurchase?.price) {
      const purchase = document.createElement("span");
      purchase.textContent = `内购价格 ${event.metadata.inAppPurchase.name} · ${event.metadata.inAppPurchase.price}`;
      details.append(purchase);
    }
    if (details.childElementCount) card.querySelector(".event-tags").before(details);
    const link = card.querySelector(".event-link");
    link.href = event.url;
    if (index === 0 && sourceEvents.length > 1) card.querySelector(".event-card-actions").prepend(groupToggle(sourceEvents, sourceId, expanded));
    const eventTags = card.querySelector(".event-tags");
    eventDisplayTags(event).forEach((tag) => {
      const pill = document.createElement("span");
      pill.textContent = categoryLabel(tag);
      eventTags.append(pill);
    });
    if (!eventTags.childElementCount) eventTags.remove();
    const assets = releaseAssets(event);
    if (assets.length) {
      const downloads = document.createElement("details");
      downloads.className = "release-downloads";
      const summary = document.createElement("summary");
      summary.textContent = assets.length === 1 ? "下载发布包" : `下载发布包（${assets.length}）`;
      const list = document.createElement("div");
      list.className = "release-download-list";
      assets.forEach((asset) => list.append(assetLink(asset)));
      downloads.append(summary, list);
      card.querySelector(".event-main").append(downloads);
    }
    group.append(card);
    });
    elements.eventList.append(group);
  });
  renderEventPagination(pageCount, groupEntries.length);
}

function showProviderFields() {
  const kind = elements.sourceKind.value;
  document.querySelectorAll(".provider-fields").forEach((fields) => { fields.hidden = !fields.dataset.kind.split(" ").includes(kind); });
  if (!state.editingSourceId && kind === "qnap-app" && !elements.sourceForm.elements.cooldownMinutes.dataset.touched) elements.sourceForm.elements.cooldownMinutes.value = "1440";
}

function setSourceSaveStatus(message, stateName = "") {
  elements.sourceSaveStatus.textContent = message;
  elements.sourceSaveStatus.dataset.state = stateName;
}

function cancelSourceAutoSave() {
  window.clearTimeout(state.sourceAutoSaveTimer);
  state.sourceAutoSaveTimer = null;
  state.sourceEditorSession += 1;
}

function scheduleSourceAutoSave() {
  if (!state.editingSourceId) return;
  window.clearTimeout(state.sourceAutoSaveTimer);
  const sourceId = state.editingSourceId;
  const session = state.sourceEditorSession;
  const version = ++state.sourceChangeVersion;
  setSourceSaveStatus("将在停止输入后自动保存", "pending");
  state.sourceAutoSaveTimer = window.setTimeout(() => autoSaveEditedSource(sourceId, session, version), 800);
}

async function autoSaveEditedSource(sourceId, session, version) {
  if (state.sourceAutoSaveInFlight) return;
  if (state.editingSourceId !== sourceId || state.sourceEditorSession !== session) return;
  if (!elements.sourceForm.checkValidity()) {
    setSourceSaveStatus("待补全必填项后自动保存", "pending");
    return;
  }
  state.sourceAutoSaveInFlight = true;
  const payload = sourcePayload();
  setSourceSaveStatus("正在自动保存…", "saving");
  try {
    const save = requestJson(`/v1/sources/${sourceId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    state.sourceAutoSavePromise = save;
    await save;
    if (state.editingSourceId !== sourceId || state.sourceEditorSession !== session) return;
    await load();
    if (state.editingSourceId !== sourceId || state.sourceEditorSession !== session) return;
    elements.editorTitle.textContent = payload.name;
    renderSettingsSources();
    setSourceSaveStatus("已自动保存", "saved");
  } catch {
    if (state.editingSourceId === sourceId && state.sourceEditorSession === session) setSourceSaveStatus("自动保存未完成，请补全后重试", "error");
  } finally {
    state.sourceAutoSaveInFlight = false;
    state.sourceAutoSavePromise = null;
    if (state.editingSourceId === sourceId && state.sourceEditorSession === session && state.sourceChangeVersion > version) {
      state.sourceAutoSaveTimer = window.setTimeout(() => autoSaveEditedSource(sourceId, session, state.sourceChangeVersion), 0);
    }
  }
}

function startNewEditor() {
  cancelSourceAutoSave();
  state.editingSourceId = null;
  state.sourceChangeVersion = 0;
  elements.sourceForm.reset();
  elements.sourceForm.elements.enabled.checked = true;
  elements.sourceForm.elements.cooldownMinutes.dataset.touched = "";
  elements.sourceForm.elements.id.readOnly = false;
  elements.sourceForm.elements.id.dataset.touched = "";
  elements.editorMode.textContent = "新增数据源";
  elements.editorTitle.textContent = "开始监控新渠道";
  elements.deleteSource.hidden = true;
  elements.sourceForm.querySelector('[type="submit"]').textContent = "保存数据源";
  setSourceSaveStatus("新增数据源需填写完成后保存", "pending");
  elements.appStoreResults.replaceChildren();
  elements.githubRepositoryResults.replaceChildren();
  elements.dockerHubResults.replaceChildren();
  elements.qnapResults.replaceChildren();
  elements.nintendoResults.replaceChildren();
  elements.steamResults.replaceChildren();
  showProviderFields();
}

function editSource(source) {
  cancelSourceAutoSave();
  state.editingSourceId = source.id;
  state.sourceChangeVersion = 0;
  elements.sourceForm.reset();
  for (const [key, value] of Object.entries(source)) {
    const field = elements.sourceForm.querySelector(`[name="${key}"]`);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = value === true;
    else if (Array.isArray(value)) field.value = value.join(", ");
    else field.value = value;
  }
  elements.sourceKind.value = source.kind;
  showProviderFields();
  const activeFields = [...elements.sourceForm.querySelectorAll(".provider-fields")].find((fields) => fields.dataset.kind.split(" ").includes(source.kind));
  for (const [key, value] of Object.entries(source)) {
    const field = activeFields?.querySelector(`[name="${key}"]`);
    if (field && field.type !== "checkbox") field.value = value;
  }
  elements.sourceForm.elements.id.readOnly = true;
  elements.editorMode.textContent = `编辑 / ${source.id}`;
  elements.editorTitle.textContent = source.name;
  elements.deleteSource.hidden = false;
  elements.sourceForm.querySelector('[type="submit"]').textContent = "立即保存";
  setSourceSaveStatus("自动保存已开启", "saved");
}

function renderSettingsSources() {
  elements.settingsSourceList.replaceChildren();
  state.sources.forEach((source) => {
    const row = document.createElement("div");
    row.className = `saved-source ${state.editingSourceId === source.id ? "selected" : ""}`;
    const select = document.createElement("input");
    select.type = "checkbox";
    select.checked = state.selectedSourceIds.has(source.id);
    select.setAttribute("aria-label", `选择 ${source.name}`);
    select.addEventListener("change", () => {
      if (select.checked) state.selectedSourceIds.add(source.id);
      else state.selectedSourceIds.delete(source.id);
      renderSettingsSources();
    });
    const button = document.createElement("button");
    button.type = "button";
    button.className = "saved-source-button";
    const status = document.createElement("i");
    status.className = source.enabled ? "" : "paused";
    const provider = document.createElement("img");
    const icon = source.artworkUrl || sourceIconUrl(source.kind);
    if (icon) { provider.src = icon; provider.alt = ""; provider.referrerPolicy = "no-referrer"; provider.addEventListener("error", () => provider.remove()); }
    const name = document.createElement("strong");
    name.textContent = source.name;
    const detail = document.createElement("span");
    detail.textContent = `${source.kind} / ${source.id}`;
    button.append(status, provider, name, detail);
    button.addEventListener("click", () => { editSource(source); renderSettingsSources(); });
    row.append(select, button);
    elements.settingsSourceList.append(row);
  });
  const selectedCount = state.selectedSourceIds.size;
  elements.selectAllSources.checked = selectedCount === state.sources.length && state.sources.length > 0;
  elements.selectAllSources.indeterminate = selectedCount > 0 && selectedCount < state.sources.length;
  elements.bulkDeleteSources.disabled = selectedCount === 0;
  elements.bulkDeleteSources.textContent = selectedCount ? `删除所选（${selectedCount}）` : "删除所选";
}

function openSettings() {
  startNewEditor();
  renderSettingsSources();
  requestJson("/v1/settings/translation").then((config) => {
    elements.translationBaseUrl.value = config.baseUrl || "";
    setTranslationModels([], config.model || "");
    elements.translationTargetLanguage.value = config.targetLanguage || "简体中文";
    elements.translationApiKey.value = "";
  }).catch(() => showToast("无法读取翻译设置", "error"));
  elements.settingsDialog.showModal();
}

function sourcePayload() {
  const kind = elements.sourceKind.value;
  const provider = [...elements.sourceForm.querySelectorAll(".provider-fields")].find((fields) => fields.dataset.kind.split(" ").includes(kind));
  const value = (name) => provider?.querySelector(`[name="${name}"]`)?.value.trim() || elements.sourceForm.querySelector(`.form-grid [name="${name}"]`)?.value.trim() || "";
  return {
    id: elements.sourceForm.elements.id.value.trim(),
    name: elements.sourceForm.elements.name.value.trim(),
    kind,
    tags: elements.sourceForm.elements.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    enabled: elements.sourceForm.elements.enabled.checked,
    owner: value("owner"), repo: value("repo"), branch: value("branch"), repository: value("repository"), feedUrl: value("feedUrl"), appId: value("appId"),
    packageId: value("packageId"), country: value("country"), language: value("language"),
    subscriptionId: value("subscriptionId"), planName: value("planName"), storefrontId: value("storefrontId"),
    qnapAppName: value("qnapAppName"), qnapOs: value("qnapOs"), qnapVersion: value("qnapVersion"), officialUrl: value("officialUrl"), homepageUrl: value("homepageUrl"), officialFormat: value("officialFormat"), versionPath: value("versionPath"), publishedAtPath: value("publishedAtPath"), downloadPath: value("downloadPath"), summaryPath: value("summaryPath"), gameName: value("gameName"), nintendoRegion: value("nintendoRegion"), steamAppId: value("steamAppId"), cooldownMinutes: Number(elements.sourceForm.elements.cooldownMinutes.value),
    tagsFilter: value("tagsFilter").split(",").map((tag) => tag.trim()).filter(Boolean), gameAliases: value("gameAliases").split(",").map((item) => item.trim()).filter(Boolean), includePrereleases: elements.sourceForm.elements.includePrereleases.checked
  };
}

function renderAppStoreResults(apps) {
  elements.appStoreResults.replaceChildren();
  const availableApps = apps.filter((app) => !isCatalogSourceTracked(appStoreSource(app)));
  if (!availableApps.length) {
    renderCatalogEmpty(elements.appStoreResults, apps.length ? "匹配的软件均已在监控中，移除后可再次搜索添加。" : "没有找到匹配的软件，请换一个名称或地区。");
    return;
  }
  availableApps.forEach((app) => {
    const result = document.createElement("article");
    result.className = "app-result";
    if (app.artworkUrl) {
      const artwork = document.createElement("img");
      artwork.src = app.artworkUrl;
      artwork.alt = "";
      artwork.referrerPolicy = "no-referrer";
      result.append(artwork);
    }
    const detail = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = app.name;
    const meta = document.createElement("span");
    meta.textContent = `${app.developer} · v${app.version} · ${app.genre}`;
    detail.append(name, meta);
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "添加并保存";
    add.addEventListener("click", async () => {
      if (await addAppStoreSource(app, add)) removeTrackedCatalogResult(result, elements.appStoreResults);
    });
    result.append(detail, add);
    elements.appStoreResults.append(result);
  });
}

function appStoreSource(app) {
  return { id: `app-store-${app.appId}`, name: app.name, kind: "app-store", enabled: true, appId: app.appId, country: app.country, artworkUrl: app.artworkUrl, tags: ["app-store"] };
}

async function addAppStoreSource(app, button) {
  return addCatalogSource(appStoreSource(app), button);
}

function catalogSourceId(prefix, value) {
  const suffix = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${prefix}-${suffix}`.slice(0, 63).replace(/-+$/g, "");
}

async function addCatalogSource(source, button) {
  const id = source.id;
  if (state.sources.some((source) => source.id === id)) {
    showToast("该监控源已经在监控列表中", "error");
    return false;
  }
  button.disabled = true;
  button.textContent = "添加中…";
  try {
    await requestJson("/v1/sources", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source)
    });
    await load();
    renderSettingsSources();
    showToast(`已开始监控 ${source.name}`);
    button.textContent = "已添加";
    return true;
  } catch (error) {
    button.disabled = false;
    button.textContent = "添加并保存";
    showToast(`无法加入：${error.message}`, "error");
    return false;
  }
}

async function searchForAppStoreApps() {
  const term = elements.appStoreSearchInput.value.trim();
  if (term.length < 2) {
    showToast("请至少输入两个字符来搜索 App Store", "error");
    elements.appStoreSearchInput.focus();
    return;
  }
  elements.appStoreSearchButton.disabled = true;
  elements.appStoreSearchButton.textContent = "搜索中";
  elements.appStoreResults.innerHTML = '<p class="app-search-empty">正在搜索 Apple 官方目录…</p>';
  try {
    const query = new URLSearchParams({ term, country: elements.appStoreSearchCountry.value });
    renderAppStoreResults(await requestJson(`/v1/catalog/app-store?${query}`));
  } catch (error) {
    elements.appStoreResults.innerHTML = '<p class="app-search-empty">搜索暂时不可用，请稍后重试。</p>';
    showToast(`搜索失败：${error.message}`, "error");
  } finally {
    elements.appStoreSearchButton.disabled = false;
    elements.appStoreSearchButton.textContent = "搜索";
  }
}

function useGithubRepository(repository) {
  const form = elements.sourceForm.elements;
  form.owner.value = repository.owner;
  form.repo.value = repository.repo;
  if (!form.name.value.trim()) form.name.value = repository.name || `${repository.owner}/${repository.repo}`;
  if (!state.editingSourceId) form.name.dispatchEvent(new Event("input"));
  elements.githubRepositoryResults.replaceChildren();
  elements.githubRepositoryInput.value = `https://github.com/${repository.owner}/${repository.repo}`;
  scheduleSourceAutoSave();
  showToast(`已填入 ${repository.owner}/${repository.repo}`);
}

function renderGithubRepositoryResults(repositories) {
  elements.githubRepositoryResults.replaceChildren();
  const availableRepositories = repositories.filter((repository) => !isCatalogSourceTracked(githubRepositorySource(repository)));
  if (!availableRepositories.length) {
    renderCatalogEmpty(elements.githubRepositoryResults, repositories.length ? "匹配的仓库均已在监控中，移除后可再次搜索添加。" : "没有找到匹配仓库，请检查链接或关键词。");
    return;
  }
  availableRepositories.forEach((repository) => {
    const result = document.createElement("article");
    result.className = "github-repository-result";
    const detail = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = repository.name;
    const meta = document.createElement("span");
    meta.textContent = `${repository.description || "无描述"} · ★ ${repository.stars}`;
    detail.append(name, meta);
    const use = document.createElement("button");
    use.type = "button";
    use.textContent = "添加并保存";
    use.addEventListener("click", async () => {
      if (await addGithubRepositorySource(repository, use)) removeTrackedCatalogResult(result, elements.githubRepositoryResults);
    });
    result.append(detail, use);
    elements.githubRepositoryResults.append(result);
  });
}

function githubRepositorySource(repository) {
  const kind = ["github-releases", "github-commits"].includes(elements.sourceKind.value) ? elements.sourceKind.value : "github-releases";
  return {
    id: catalogSourceId(kind, `${repository.owner}-${repository.repo}`),
    name: repository.name || `${repository.owner}/${repository.repo}`,
    kind,
    enabled: true,
    owner: repository.owner,
    repo: repository.repo,
    tags: [kind]
  };
}

function addGithubRepositorySource(repository, button) {
  return addCatalogSource(githubRepositorySource(repository), button);
}

async function searchGithubRepositories() {
  const value = elements.githubRepositoryInput.value.trim();
  const match = value.match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)\/?(?:[?#].*)?$/i) || value.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (match) {
    useGithubRepository({ owner: match[1], repo: match[2].replace(/\.git$/i, ""), name: `${match[1]}/${match[2].replace(/\.git$/i, "")}` });
    return;
  }
  if (value.length < 2) {
    showToast("请输入 GitHub 仓库链接或至少两个字符的关键词", "error");
    elements.githubRepositoryInput.focus();
    return;
  }
  elements.githubRepositorySearch.disabled = true;
  elements.githubRepositorySearch.textContent = "搜索中";
  elements.githubRepositoryResults.innerHTML = '<p class="app-search-empty">正在搜索 GitHub 官方目录…</p>';
  try {
    renderGithubRepositoryResults(await requestJson(`/v1/catalog/github?${new URLSearchParams({ query: value })}`));
  } catch (error) {
    elements.githubRepositoryResults.innerHTML = '<p class="app-search-empty">GitHub 搜索暂时不可用，请稍后重试。</p>';
    showToast(`GitHub 搜索失败：${error.message}`, "error");
  } finally {
    elements.githubRepositorySearch.disabled = false;
    elements.githubRepositorySearch.textContent = "搜索";
  }
}

function useCatalogResult(values, message) {
  const form = elements.sourceForm.elements;
  const shouldSetName = !form.name.value.trim() && values.name;
  for (const [name, value] of Object.entries(values)) {
    if (name === "name") continue;
    const field = form[name];
    if (field && value !== undefined && value !== null) field.value = value;
  }
  if (shouldSetName) {
    form.name.value = values.name;
    if (!state.editingSourceId) form.name.dispatchEvent(new Event("input"));
  }
  showToast(message);
}

function isCatalogSourceTracked(source) {
  return state.sources.some((candidate) => candidate.id === source.id);
}

function renderCatalogEmpty(container, message) {
  container.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "app-search-empty";
  empty.textContent = message;
  container.append(empty);
}

function removeTrackedCatalogResult(result, container) {
  result.remove();
  if (!container.querySelector("article")) renderCatalogEmpty(container, "匹配项均已在监控中，移除后可再次搜索添加。");
}

function renderCatalogResults(container, items, sourceForItem) {
  const availableItems = items.map((item) => ({ item, source: sourceForItem(item) })).filter(({ source }) => !isCatalogSourceTracked(source));
  container.replaceChildren();
  if (!availableItems.length) {
    renderCatalogEmpty(container, items.length ? "匹配项均已在监控中，移除后可再次搜索添加。" : "没有找到匹配项，请尝试其他关键词。");
    return;
  }
  availableItems.forEach(({ item, source }) => {
    const result = document.createElement("article");
    result.className = "catalog-result";
    if (item.artworkUrl) {
      const image = document.createElement("img");
      image.src = item.artworkUrl;
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      result.append(image);
    }
    const detail = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name || item.gameName || item.repository;
    const meta = document.createElement("span");
    meta.textContent = item.meta || item.description || item.title || "官方目录结果";
    detail.append(name, meta);
    const use = document.createElement("button");
    use.type = "button";
    use.textContent = "添加并保存";
    use.addEventListener("click", async () => {
      if (await addCatalogSource(source, use)) removeTrackedCatalogResult(result, container);
    });
    result.append(detail, use);
    container.append(result);
  });
}

async function searchCatalog({ input, button, results, endpoint, parameters = {}, sourceForItem, loadingText }) {
  const query = input.value.trim();
  if (query.length < 2) {
    showToast("请至少输入两个字符后再搜索", "error");
    input.focus();
    return;
  }
  button.disabled = true;
  button.textContent = "搜索中…";
  results.innerHTML = `<p class="app-search-empty">${loadingText}</p>`;
  try {
    renderCatalogResults(results, await requestJson(`${endpoint}?${new URLSearchParams({ query, ...parameters })}`), sourceForItem);
  } catch (error) {
    results.innerHTML = '<p class="app-search-empty">搜索暂时不可用，请稍后重试。</p>';
    showToast(`搜索失败：${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = "搜索";
  }
}

function searchDockerHub() {
  return searchCatalog({
    input: elements.dockerHubSearchInput,
    button: elements.dockerHubSearchButton,
    results: elements.dockerHubResults,
    endpoint: "/v1/catalog/docker-hub",
    loadingText: "正在搜索 Docker Hub 官方目录…",
    sourceForItem: (item) => ({ id: catalogSourceId("docker", item.repository), name: item.repository, kind: "docker-hub", enabled: true, repository: item.repository, tags: ["docker-hub"] })
  });
}

function searchQnapApps() {
  const os = elements.sourceForm.elements.qnapOs.value;
  return searchCatalog({
    input: elements.qnapSearchInput,
    button: elements.qnapSearchButton,
    results: elements.qnapResults,
    endpoint: "/v1/catalog/qnap",
    parameters: { os },
    loadingText: "正在搜索 QNAP 官方 App Center…",
    sourceForItem: (item) => ({ id: catalogSourceId("qnap", item.appName), name: item.name, kind: "qnap-app", enabled: true, qnapAppName: item.appName, qnapOs: item.os || os, tags: ["qnap-app"] })
  });
}

const officialWebsiteTemplates = {
  "qq-windows": { name: "QQ Windows 官网版", id: "qq-windows-official", officialUrl: "https://qq-web.cdn-go.cn/im.qq.com_new/latest/rainbow/pcConfig.json", homepageUrl: "https://im.qq.com/index/", officialFormat: "json", versionPath: "Windows.version", publishedAtPath: "Windows.updateDate", downloadPath: "Windows" },
  "qq-macos": { name: "QQ macOS 官网版", id: "qq-macos-official", officialUrl: "https://qq-web.cdn-go.cn/im.qq.com_new/latest/rainbow/pcConfig.json", homepageUrl: "https://im.qq.com/index/", officialFormat: "json", versionPath: "macOS.version", publishedAtPath: "macOS.updateDate", downloadPath: "macOS" },
  "qq-linux": { name: "QQ Linux 官网版", id: "qq-linux-official", officialUrl: "https://qq-web.cdn-go.cn/im.qq.com_new/latest/rainbow/pcConfig.json", homepageUrl: "https://im.qq.com/index/", officialFormat: "json", versionPath: "Linux.version", publishedAtPath: "Linux.updateDate", downloadPath: "Linux" }
};

function applyOfficialWebsiteTemplate() {
  const template = officialWebsiteTemplates[elements.officialWebsiteTemplate.value];
  if (!template) {
    showToast("请选择一个官网监控模板", "error");
    return;
  }
  Object.entries(template).forEach(([name, value]) => {
    const field = elements.sourceForm.elements[name];
    if (field) field.value = value;
  });
  elements.sourceForm.elements.id.dataset.touched = "true";
  scheduleSourceAutoSave();
  showToast("官网监控模板已填入，可按需调整后保存");
}

function searchNintendoSwitch() {
  return searchCatalog({
    input: elements.nintendoSearchInput,
    button: elements.nintendoSearchButton,
    results: elements.nintendoResults,
    endpoint: "/v1/catalog/nintendo-switch",
    loadingText: "正在搜索 Nintendo 官方更新公告…",
    sourceForItem: (item) => ({ id: catalogSourceId("switch", item.gameName), name: item.gameName, kind: "nintendo-switch", enabled: true, gameName: item.gameName, nintendoRegion: "us", tags: ["nintendo-switch"] })
  });
}

function searchSteam() {
  return searchCatalog({
    input: elements.steamSearchInput,
    button: elements.steamSearchButton,
    results: elements.steamResults,
    endpoint: "/v1/catalog/steam",
    loadingText: "正在搜索 Steam 官方商店…",
    sourceForItem: (item) => ({ id: `steam-${item.appId}`, name: item.name, kind: "steam", enabled: true, steamAppId: String(item.appId), tags: ["steam"] })
  });
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || body.error || "请求失败");
  return body;
}

async function load() {
  const [sources, events, syncStatus] = await Promise.all([requestJson("/v1/sources"), requestJson("/v1/events?limit=200"), requestJson("/v1/sync-status")]);
  state.sources = sources;
  state.events = events;
  state.lastSyncedAt = syncStatus.lastSyncedAt ?? null;
  state.selectedSourceIds = new Set([...state.selectedSourceIds].filter((id) => state.sources.some((source) => source.id === id)));
  if (state.sourceId && !state.sources.some((source) => source.id === state.sourceId)) state.sourceId = "";
  renderMetrics(); renderFilters(); renderEvents();
}

elements.sourceFilter.addEventListener("change", (event) => { state.sourceId = event.target.value; state.eventPage = 1; renderEvents(); });
elements.eventSearch.addEventListener("input", (event) => { state.search = event.target.value; state.eventPage = 1; renderEvents(); });
document.addEventListener("click", (event) => {
  if (!elements.cardContextMenu.hidden && !elements.cardContextMenu.contains(event.target)) closeCardContextMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCardContextMenu();
});
window.addEventListener("scroll", closeCardContextMenu, true);
window.addEventListener("scroll", scheduleTopbarStateUpdate, { passive: true });
updateTopbarState();
elements.cardContextDelete.addEventListener("click", async () => {
  const source = state.sources.find((item) => item.id === state.contextSourceId);
  if (!source) return closeCardContextMenu();
  if (!window.confirm(`确定删除“${source.name}”及其全部历史更新吗？`)) return;
  closeCardContextMenu();
  try {
    const result = await requestJson(`/v1/sources/${source.id}`, { method: "DELETE" });
    await load();
    showToast(`已删除监控及 ${result.eventsRemoved} 条历史更新`);
  } catch (error) { showToast(`无法删除监控：${error.message}`, "error"); }
});
elements.eventViewButtons.forEach((button) => button.addEventListener("click", () => {
  localStorage.setItem("update-radar-event-view", button.dataset.eventView);
  state.eventPage = 1;
  applyEventView(button.dataset.eventView);
  renderEvents();
}));
elements.cardColumns.addEventListener("change", (event) => {
  state.eventCardColumns = Number(event.target.value);
  localStorage.setItem("update-radar-card-columns", String(state.eventCardColumns));
  applyEventView(state.eventView);
});
elements.settingsButton.addEventListener("click", openSettings);
elements.quickAddSource.addEventListener("click", openSettings);
elements.closeWelcome.addEventListener("click", dismissWelcome);
elements.dismissWelcome.addEventListener("click", dismissWelcome);
elements.welcomeAddSource.addEventListener("click", () => { dismissWelcome(); openSettings(); });
elements.welcomeDialog.addEventListener("click", (event) => {
  const bounds = elements.welcomeDialog.getBoundingClientRect();
  const clickedBackdrop = event.target === elements.welcomeDialog && (
    event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
  );
  if (clickedBackdrop) dismissWelcome();
});
elements.themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("update-radar-theme", theme);
  applyTheme(theme);
  renderFilters(); renderEvents();
  if (elements.settingsDialog.open) renderSettingsSources();
});
elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
elements.settingsDialog.addEventListener("click", (event) => {
  const bounds = elements.settingsDialog.getBoundingClientRect();
  const clickedBackdrop = event.target === elements.settingsDialog && (
    event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
  );
  if (clickedBackdrop) elements.settingsDialog.close();
});
elements.exportBackup.addEventListener("click", exportBackup);
elements.importBackup.addEventListener("click", () => elements.backupFile.click());
elements.backupFile.addEventListener("change", async () => {
  const [file] = elements.backupFile.files;
  if (file) await importBackup(file);
  elements.backupFile.value = "";
});
elements.eventDialog.addEventListener("click", (event) => {
  const bounds = elements.eventDialog.getBoundingClientRect();
  const clickedBackdrop = event.target === elements.eventDialog && (
    event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
  );
  if (clickedBackdrop) elements.eventDialog.close();
});
[elements.eventDialog, elements.settingsDialog, elements.welcomeDialog].forEach((dialog) => dialog.addEventListener("close", restoreToastToPage));
elements.selectAllSources.addEventListener("change", () => {
  state.selectedSourceIds = elements.selectAllSources.checked ? new Set(state.sources.map((source) => source.id)) : new Set();
  renderSettingsSources();
});
elements.bulkDeleteSources.addEventListener("click", async () => {
  const ids = [...state.selectedSourceIds];
  if (!ids.length || !window.confirm(`确定删除选中的 ${ids.length} 个数据源及其全部历史更新吗？`)) return;
  try {
    const result = await requestJson("/v1/sources", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    state.selectedSourceIds.clear();
    await load(); startNewEditor(); renderSettingsSources(); showToast(`已删除 ${result.removed} 个数据源及 ${result.eventsRemoved} 条历史更新`);
  } catch (error) { showToast(`无法批量删除：${error.message}`, "error"); }
});
elements.saveTranslationSettings.addEventListener("click", async () => {
  try {
    await requestJson("/v1/settings/translation", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: elements.translationBaseUrl.value, model: elements.translationModel.value, apiKey: elements.translationApiKey.value, targetLanguage: elements.translationTargetLanguage.value })
    });
    elements.translationApiKey.value = "";
    showToast("翻译设置已保存");
  } catch (error) { showToast(`无法保存翻译设置：${error.message}`, "error"); }
});
elements.loadTranslationModels.addEventListener("click", loadTranslationModels);
elements.translationModel.addEventListener("focus", () => {
  if (elements.translationModel.options.length <= 1 && !elements.loadTranslationModels.disabled) loadTranslationModels();
});
elements.viewOriginal.addEventListener("click", () => renderEventDialogText("original"));
elements.viewTranslated.addEventListener("click", () => showTranslation("translation"));
elements.viewBilingual.addEventListener("click", () => showTranslation("bilingual"));
elements.eventHistoryToggle.addEventListener("click", () => setEventHistoryExpanded(elements.eventHistoryList.hidden));
elements.cancelEdit.addEventListener("click", startNewEditor);
elements.resetEditor.addEventListener("click", startNewEditor);
elements.sourceKind.addEventListener("change", showProviderFields);
elements.sourceForm.addEventListener("input", (event) => {
  if (event.target.name) scheduleSourceAutoSave();
});
elements.sourceForm.addEventListener("change", (event) => {
  if (event.target.name) scheduleSourceAutoSave();
});
elements.appStoreSearchButton.addEventListener("click", searchForAppStoreApps);
elements.githubRepositorySearch.addEventListener("click", searchGithubRepositories);
elements.dockerHubSearchButton.addEventListener("click", searchDockerHub);
elements.qnapSearchButton.addEventListener("click", searchQnapApps);
elements.applyOfficialWebsiteTemplate.addEventListener("click", applyOfficialWebsiteTemplate);
elements.nintendoSearchButton.addEventListener("click", searchNintendoSwitch);
elements.steamSearchButton.addEventListener("click", searchSteam);
elements.appStoreSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); searchForAppStoreApps(); }
});
elements.githubRepositoryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); searchGithubRepositories(); }
});
elements.dockerHubSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); searchDockerHub(); }
});
elements.qnapSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); searchQnapApps(); }
});
elements.nintendoSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); searchNintendoSwitch(); }
});
elements.steamSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); searchSteam(); }
});
elements.sourceForm.elements.name.addEventListener("input", () => {
  const id = elements.sourceForm.elements.id;
  if (!state.editingSourceId && !id.dataset.touched) id.value = elements.sourceForm.elements.name.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
});
elements.sourceForm.elements.id.addEventListener("input", () => { elements.sourceForm.elements.id.dataset.touched = "true"; });
elements.sourceForm.elements.cooldownMinutes.addEventListener("input", () => { elements.sourceForm.elements.cooldownMinutes.dataset.touched = "true"; });
elements.sourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const isEditing = Boolean(state.editingSourceId);
  const sourceId = state.editingSourceId;
  cancelSourceAutoSave();
  if (!elements.sourceForm.checkValidity()) {
    elements.sourceForm.reportValidity();
    return;
  }
  if (isEditing) setSourceSaveStatus("正在保存…", "saving");
  try {
    if (state.sourceAutoSavePromise) await state.sourceAutoSavePromise.catch(() => undefined);
    const payload = sourcePayload();
    await requestJson(isEditing ? `/v1/sources/${sourceId}` : "/v1/sources", {
      method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    await load();
    if (isEditing) {
      elements.editorTitle.textContent = payload.name;
      renderSettingsSources();
      setSourceSaveStatus("已保存", "saved");
    } else {
      showToast("数据源已加入监控列表");
      startNewEditor(); renderSettingsSources();
    }
  } catch (error) {
    if (isEditing) setSourceSaveStatus("保存未完成，请检查设置", "error");
    else showToast(`无法保存：${error.message}`, "error");
  }
});
elements.deleteSource.addEventListener("click", async () => {
  const source = state.sources.find((item) => item.id === state.editingSourceId);
  if (!source || !window.confirm(`确定删除“${source.name}”及其全部历史更新吗？`)) return;
  try {
    const result = await requestJson(`/v1/sources/${source.id}`, { method: "DELETE" });
    await load(); startNewEditor(); renderSettingsSources(); showToast(`数据源及 ${result.eventsRemoved} 条历史更新已删除`);
  } catch (error) { showToast(`无法删除：${error.message}`, "error"); }
});
async function syncSources(sourceIds, button) {
  const originalContent = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spin" aria-hidden="true">↻</span> 同步中';
  try {
    const query = new URLSearchParams({ force: "true" });
    (sourceIds ?? []).forEach((sourceId) => query.append("sourceId", sourceId));
    const results = await requestJson(`/v1/poll?${query}`, { method: "POST" });
    const inserted = results.reduce((total, result) => total + (result.inserted || 0), 0);
    const failed = results.filter((result) => !result.ok).length;
    await load();
    showToast(failed ? `同步完成，新增 ${inserted} 条；${failed} 个渠道暂不可用` : `同步完成，新增 ${inserted} 条更新`);
  } catch (error) {
    showToast(`同步失败：${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}

elements.syncButton.addEventListener("click", () => syncSources(null, elements.syncButton));
elements.syncPageButton.addEventListener("click", () => {
  if (!state.visibleEventSourceIds.length) return showToast("当前页没有可同步的监控源", "error");
  return syncSources(state.visibleEventSourceIds, elements.syncPageButton);
});

showWelcomeOnFirstVisit();

load().catch((error) => {
  elements.eventList.innerHTML = `<div class="empty">无法载入雷达数据：${error.message}</div>`;
  showToast("无法连接到 UpdateRadar 服务", "error");
});
