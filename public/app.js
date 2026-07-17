const state = { events: [], sources: [], tag: "", sourceId: "", sourcePage: 1, sourceSort: "newest", eventView: localStorage.getItem("update-radar-event-view") || "list", expandedEventSourceIds: new Set(), editingSourceId: null, selectedSourceIds: new Set(), activeEvent: null, activeTranslation: "" };
const elements = {
  eventCount: document.querySelector("#event-count"),
  sourceCount: document.querySelector("#source-count"),
  tagCount: document.querySelector("#tag-count"),
  lastSync: document.querySelector("#last-sync"),
  tagFilters: document.querySelector("#tag-filters"),
  sourceFilter: document.querySelector("#source-filter"),
  eventList: document.querySelector("#event-list"),
  sourceList: document.querySelector("#source-list"),
  sourcePagination: document.querySelector("#source-pagination"),
  sourceSort: document.querySelector("#source-sort"),
  eventViewButtons: [...document.querySelectorAll("[data-event-view]")],
  resultsCount: document.querySelector("#results-count"),
  syncButton: document.querySelector("#sync-button"),
  quickAddSource: document.querySelector("#quick-add-source"),
  welcomeDialog: document.querySelector("#welcome-dialog"),
  closeWelcome: document.querySelector("#close-welcome"),
  dismissWelcome: document.querySelector("#dismiss-welcome"),
  welcomeAddSource: document.querySelector("#welcome-add-source"),
  themeToggle: document.querySelector("#theme-toggle"),
  settingsButton: document.querySelector("#settings-button"),
  manageSources: document.querySelector("#manage-sources"),
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
  eventDialogLink: document.querySelector("#event-dialog-link"),
  eventDialogContent: document.querySelector("#event-dialog-content"),
  eventHighlights: document.querySelector("#event-highlights"),
  eventHighlightsList: document.querySelector("#event-highlights-list"),
  translateEvent: document.querySelector("#translate-event"),
  translationViewToggle: document.querySelector("#translation-view-toggle"),
  viewOriginal: document.querySelector("#view-original"),
  viewTranslated: document.querySelector("#view-translated"),
  eventAssets: document.querySelector("#event-assets"),
  eventAssetsList: document.querySelector("#event-assets-list"),
  toast: document.querySelector("#toast"),
  template: document.querySelector("#event-template")
};

const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const relativeFormat = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
const sourceIcons = {
  "github-releases": { name: "GitHub", url: "https://cdn.simpleicons.org/github/10232e" },
  "github-commits": { name: "GitHub", url: "https://cdn.simpleicons.org/github/10232e" },
  "docker-hub": { name: "Docker Hub", url: "https://cdn.simpleicons.org/docker/10232e" },
  rss: { name: "RSS", url: "https://cdn.simpleicons.org/rss/10232e" },
  "app-store": { name: "App Store", url: "https://cdn.simpleicons.org/appstore/10232e" },
  "google-play": { name: "Google Play", url: "https://cdn.simpleicons.org/googleplay/10232e" },
  "qnap-app": { name: "QNAP", url: "https://cdn.simpleicons.org/qnap/10232e" },
  "nintendo-switch": { name: "Nintendo Switch", url: "https://cdn.simpleicons.org/nintendoswitch/10232e" },
  steam: { name: "Steam", url: "https://cdn.simpleicons.org/steam/10232e" },
  playstation: { name: "PlayStation", url: "https://cdn.simpleicons.org/playstation/10232e" },
  xbox: { name: "Xbox", url: "https://cdn.simpleicons.org/xbox/10232e" }
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

function showToast(message, type = "success") {
  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 4200);
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

function eventHeading(event) {
  return event.version ? `${event.sourceName} / ${event.version}` : event.title;
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
  elements.eventDialogTitle.textContent = eventHeading(event);
  const region = event.sourceKind === "app-store" && event.metadata?.store ? ` · App Store ${storeRegion(event.metadata.store)}` : "";
  elements.eventDialogMeta.textContent = `${event.sourceName} · ${event.version || "未提供版本"}${region} · ${dateFormat.format(new Date(event.publishedAt))}`;
  elements.eventDialogLink.href = event.url;
  const highlights = releaseHighlights(event.summary);
  elements.eventHighlightsList.replaceChildren(...highlights.map((highlight) => {
    const item = document.createElement("li");
    item.textContent = highlight;
    return item;
  }));
  elements.eventHighlights.hidden = highlights.length === 0;
  renderEventDialogText("original");
  elements.translationViewToggle.hidden = true;
  elements.translateEvent.disabled = false;
  elements.translateEvent.textContent = "翻译为简体中文";
  elements.eventAssetsList.replaceChildren();
  const assets = releaseAssets(event);
  elements.eventAssets.hidden = !assets.length;
  assets.forEach((asset) => elements.eventAssetsList.append(assetLink(asset)));
  elements.eventDialog.showModal();
  elements.eventDialog.scrollTop = 0;
}

function renderEventDialogText(view) {
  const original = state.activeEvent?.summary || "官方未提供本次发布说明。";
  const translated = state.activeTranslation || original;
  elements.eventDialogContent.textContent = view === "translation" ? translated : original;
  elements.viewOriginal.classList.toggle("active", view === "original");
  elements.viewTranslated.classList.toggle("active", view === "translation");
}

function renderMetrics() {
  const tags = new Set(state.sources.flatMap((source) => source.tags));
  const newest = state.events[0];
  elements.eventCount.textContent = state.events.length;
  elements.sourceCount.textContent = state.sources.filter((source) => source.enabled).length;
  elements.tagCount.textContent = tags.size;
  elements.lastSync.textContent = newest ? relativeTime(newest.detectedAt) : "尚未同步";
}

function renderFilters() {
  const activeSourceIds = new Set(state.events.map((event) => event.sourceId));
  const tags = [...new Set(state.events.flatMap((event) => event.tags))];
  if (state.tag && !tags.includes(state.tag)) state.tag = "";
  if (state.sourceId && !activeSourceIds.has(state.sourceId)) state.sourceId = "";
  elements.tagFilters.replaceChildren();
  [{ value: "", label: "全部" }, ...tags.map((tag) => ({ value: tag, label: `# ${tag}` }))].forEach(({ value, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = value === state.tag ? "active" : "";
    button.addEventListener("click", () => { state.tag = value; renderFilters(); renderEvents(); });
    elements.tagFilters.append(button);
  });

  elements.sourceFilter.replaceChildren(new Option("所有来源", ""));
  state.sources.filter((source) => activeSourceIds.has(source.id)).forEach((source) => elements.sourceFilter.add(new Option(source.name, source.id)));
  elements.sourceFilter.value = state.sourceId;
}

function renderEvents() {
  const events = state.events.filter((event) => (!state.tag || event.tags.includes(state.tag)) && (!state.sourceId || event.sourceId === state.sourceId));
  elements.resultsCount.textContent = `DISPLAYING ${events.length} SIGNAL${events.length === 1 ? "" : "S"}`;
  elements.eventList.replaceChildren();
  if (!events.length) {
    elements.eventList.innerHTML = '<div class="empty">这个筛选条件下尚未发现更新。尝试切换来源或标签。</div>';
    return;
  }
  const groups = new Map();
  events.forEach((event) => {
    const key = event.sourceId || event.sourceName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });
  groups.forEach((sourceEvents, sourceId) => {
    const expanded = state.expandedEventSourceIds.has(sourceId);
    const visibleEvents = expanded ? sourceEvents : sourceEvents.slice(0, 1);
    const group = document.createElement("section");
    group.className = `event-source-group ${expanded ? "expanded" : "collapsed"}`;
    visibleEvents.forEach((event) => {
    const card = elements.template.content.cloneNode(true);
    const article = card.querySelector(".event-card");
    const appIcon = card.querySelector(".event-app-icon");
    const source = state.sources.find((candidate) => candidate.id === event.sourceId);
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
      image.src = sourceIcon.url;
      image.alt = `${sourceIcon.name} 图标`;
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      eventSource.append(image);
    }
    eventSource.append(document.createTextNode(event.sourceName));
    const time = card.querySelector("time");
    time.dateTime = event.publishedAt;
    time.textContent = `${relativeTime(event.publishedAt)} · ${dateFormat.format(new Date(event.publishedAt))}`;
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
    if (event.metadata?.inAppPurchase?.price) {
      const purchase = document.createElement("span");
      purchase.textContent = `内购 ${event.metadata.inAppPurchase.name} · ${event.metadata.inAppPurchase.price}`;
      details.append(purchase);
    }
    if (details.childElementCount) card.querySelector(".event-tags").before(details);
    const link = card.querySelector(".event-link");
    link.href = event.url;
    event.tags.forEach((tag) => {
      const pill = document.createElement("span");
      pill.textContent = tag;
      card.querySelector(".event-tags").append(pill);
    });
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
    if (sourceEvents.length > 1) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "event-group-toggle";
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? `收起 ${sourceEvents.length - 1} 条 ${sourceEvents[0].sourceName} 历史更新` : `展开 ${sourceEvents.length - 1} 条 ${sourceEvents[0].sourceName} 历史更新`;
      toggle.addEventListener("click", () => {
        if (state.expandedEventSourceIds.has(sourceId)) state.expandedEventSourceIds.delete(sourceId);
        else state.expandedEventSourceIds.add(sourceId);
        renderEvents();
      });
      group.append(toggle);
    }
    elements.eventList.append(group);
  });
}

function renderSources() {
  elements.sourceList.replaceChildren();
  const sources = state.sources.map((source) => {
    const events = state.events.filter((event) => event.sourceId === source.id);
    return {
      source,
      eventTotal: events.length,
      latestUpdateAt: events.reduce((latest, event) => Math.max(latest, new Date(event.detectedAt || event.publishedAt || 0).getTime()), 0)
    };
  }).filter(({ eventTotal }) => eventTotal);
  sources.sort((left, right) => {
    if (state.sourceSort === "oldest") return left.latestUpdateAt - right.latestUpdateAt || left.source.name.localeCompare(right.source.name, "zh-CN");
    if (state.sourceSort === "popular") return right.eventTotal - left.eventTotal || right.latestUpdateAt - left.latestUpdateAt || left.source.name.localeCompare(right.source.name, "zh-CN");
    return right.latestUpdateAt - left.latestUpdateAt || left.source.name.localeCompare(right.source.name, "zh-CN");
  });
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(sources.length / pageSize));
  state.sourcePage = Math.min(state.sourcePage, pageCount);
  const start = (state.sourcePage - 1) * pageSize;
  sources.slice(start, start + pageSize).forEach(({ source, eventTotal }) => {
    const card = document.createElement("article");
    card.className = `source-card source-row ${source.enabled ? "" : "paused"}`;
    const header = document.createElement("div");
    const provider = document.createElement("span");
    provider.className = "source-provider";
    const icon = source.artworkUrl ? { name: source.name, url: source.artworkUrl } : sourceIcons[source.kind];
    if (icon) {
      const image = document.createElement("img");
      image.src = icon.url;
      image.alt = `${icon.name} 图标`;
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      provider.append(image);
    }
    const kind = document.createElement("span");
    kind.className = "source-kind";
    kind.textContent = source.kind.replaceAll("-", " ");
    const status = document.createElement("span");
    status.className = "source-status";
    status.textContent = source.enabled ? "ACTIVE" : "PAUSED";
    provider.append(kind);
    header.append(provider, status);
    const name = document.createElement("h3");
    name.textContent = source.name;
    const count = document.createElement("p");
    count.textContent = `${eventTotal} signals captured`;
    const tags = document.createElement("div");
    tags.className = "source-tags";
    source.tags.forEach((tag) => { const item = document.createElement("span"); item.textContent = tag; tags.append(item); });
    card.append(header, name, count, tags);
    elements.sourceList.append(card);
  });
  elements.sourcePagination.replaceChildren();
  if (sources.length > pageSize) {
    const previous = document.createElement("button");
    previous.type = "button"; previous.textContent = "← 上一页"; previous.disabled = state.sourcePage === 1;
    previous.addEventListener("click", () => { state.sourcePage -= 1; renderSources(); });
    const status = document.createElement("span");
    status.textContent = `第 ${state.sourcePage} / ${pageCount} 页`;
    const next = document.createElement("button");
    next.type = "button"; next.textContent = "下一页 →"; next.disabled = state.sourcePage === pageCount;
    next.addEventListener("click", () => { state.sourcePage += 1; renderSources(); });
    elements.sourcePagination.append(previous, status, next);
  }
}

function showProviderFields() {
  const kind = elements.sourceKind.value;
  document.querySelectorAll(".provider-fields").forEach((fields) => { fields.hidden = !fields.dataset.kind.split(" ").includes(kind); });
}

function startNewEditor() {
  state.editingSourceId = null;
  elements.sourceForm.reset();
  elements.sourceForm.elements.enabled.checked = true;
  elements.sourceForm.elements.id.readOnly = false;
  elements.sourceForm.elements.id.dataset.touched = "";
  elements.editorMode.textContent = "新增数据源";
  elements.editorTitle.textContent = "开始监控新渠道";
  elements.deleteSource.hidden = true;
  elements.appStoreResults.replaceChildren();
  elements.githubRepositoryResults.replaceChildren();
  elements.dockerHubResults.replaceChildren();
  elements.qnapResults.replaceChildren();
  elements.nintendoResults.replaceChildren();
  elements.steamResults.replaceChildren();
  showProviderFields();
}

function editSource(source) {
  state.editingSourceId = source.id;
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
    const icon = source.artworkUrl || sourceIcons[source.kind]?.url;
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
    qnapAppName: value("qnapAppName"), qnapOs: value("qnapOs"), qnapVersion: value("qnapVersion"), gameName: value("gameName"), nintendoRegion: value("nintendoRegion"), steamAppId: value("steamAppId"), cooldownMinutes: Number(elements.sourceForm.elements.cooldownMinutes.value),
    tagsFilter: value("tagsFilter").split(",").map((tag) => tag.trim()).filter(Boolean), gameAliases: value("gameAliases").split(",").map((item) => item.trim()).filter(Boolean), includePrereleases: elements.sourceForm.elements.includePrereleases.checked
  };
}

function renderAppStoreResults(apps) {
  elements.appStoreResults.replaceChildren();
  if (!apps.length) {
    const empty = document.createElement("p");
    empty.className = "app-search-empty";
    empty.textContent = "没有找到匹配的软件，请换一个名称或地区。";
    elements.appStoreResults.append(empty);
    return;
  }
  apps.forEach((app) => {
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
    add.textContent = "快捷加入";
    add.addEventListener("click", () => addAppStoreSource(app, add));
    result.append(detail, add);
    elements.appStoreResults.append(result);
  });
}

async function addAppStoreSource(app, button) {
  const id = `app-store-${app.appId}`;
  if (state.sources.some((source) => source.id === id)) {
    showToast("该 App Store 软件已经在监控列表中", "error");
    return;
  }
  button.disabled = true;
  button.textContent = "加入中";
  try {
    await requestJson("/v1/sources", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: app.name, kind: "app-store", enabled: true, appId: app.appId, country: app.country, artworkUrl: app.artworkUrl, tags: ["app-store"] })
    });
    await load();
    renderSettingsSources();
    showToast(`已开始监控 ${app.name}`);
    button.textContent = "已加入";
  } catch (error) {
    button.disabled = false;
    button.textContent = "快捷加入";
    showToast(`无法加入：${error.message}`, "error");
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
  showToast(`已填入 ${repository.owner}/${repository.repo}`);
}

function renderGithubRepositoryResults(repositories) {
  elements.githubRepositoryResults.replaceChildren();
  if (!repositories.length) {
    elements.githubRepositoryResults.innerHTML = '<p class="app-search-empty">没有找到匹配仓库，请检查链接或关键词。</p>';
    return;
  }
  repositories.forEach((repository) => {
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
    use.textContent = "使用此仓库";
    use.addEventListener("click", () => useGithubRepository(repository));
    result.append(detail, use);
    elements.githubRepositoryResults.append(result);
  });
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

function renderCatalogResults(container, items, toResult) {
  container.replaceChildren();
  if (!items.length) {
    container.innerHTML = '<p class="app-search-empty">没有找到匹配项，请尝试其他关键词。</p>';
    return;
  }
  items.forEach((item) => {
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
    use.textContent = "使用此结果";
    use.addEventListener("click", () => toResult(item));
    result.append(detail, use);
    container.append(result);
  });
}

async function searchCatalog({ input, button, results, endpoint, parameters = {}, toResult, loadingText }) {
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
    renderCatalogResults(results, await requestJson(`${endpoint}?${new URLSearchParams({ query, ...parameters })}`), toResult);
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
    toResult: (item) => {
      useCatalogResult({ repository: item.repository, name: item.repository }, `已填入 ${item.repository}`);
      elements.dockerHubResults.replaceChildren();
    }
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
    toResult: (item) => {
      useCatalogResult({ qnapAppName: item.appName, qnapOs: item.os, name: item.name }, `已填入 ${item.name} v${item.version}`);
      elements.qnapResults.replaceChildren();
    }
  });
}

function searchNintendoSwitch() {
  return searchCatalog({
    input: elements.nintendoSearchInput,
    button: elements.nintendoSearchButton,
    results: elements.nintendoResults,
    endpoint: "/v1/catalog/nintendo-switch",
    loadingText: "正在搜索 Nintendo 官方更新公告…",
    toResult: (item) => {
      useCatalogResult({ gameName: item.gameName, name: item.gameName }, `已填入 ${item.gameName}`);
      elements.nintendoResults.replaceChildren();
    }
  });
}

function searchSteam() {
  return searchCatalog({
    input: elements.steamSearchInput,
    button: elements.steamSearchButton,
    results: elements.steamResults,
    endpoint: "/v1/catalog/steam",
    loadingText: "正在搜索 Steam 官方商店…",
    toResult: (item) => {
      useCatalogResult({ steamAppId: item.appId, name: item.name }, `已填入 ${item.name}`);
      if (!state.editingSourceId) {
        elements.sourceForm.elements.id.value = `steam-${item.appId}`;
        elements.sourceForm.elements.id.dataset.touched = "true";
      }
      elements.steamResults.replaceChildren();
    }
  });
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || body.error || "请求失败");
  return body;
}

async function load() {
  [state.sources, state.events] = await Promise.all([requestJson("/v1/sources"), requestJson("/v1/events?limit=200")]);
  state.selectedSourceIds = new Set([...state.selectedSourceIds].filter((id) => state.sources.some((source) => source.id === id)));
  if (state.sourceId && !state.sources.some((source) => source.id === state.sourceId)) state.sourceId = "";
  renderMetrics(); renderFilters(); renderEvents(); renderSources();
}

elements.sourceFilter.addEventListener("change", (event) => { state.sourceId = event.target.value; renderEvents(); });
elements.eventViewButtons.forEach((button) => button.addEventListener("click", () => {
  localStorage.setItem("update-radar-event-view", button.dataset.eventView);
  applyEventView(button.dataset.eventView);
}));
elements.sourceSort.addEventListener("change", (event) => { state.sourceSort = event.target.value; state.sourcePage = 1; renderSources(); });
elements.settingsButton.addEventListener("click", openSettings);
elements.manageSources.addEventListener("click", openSettings);
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
elements.translateEvent.addEventListener("click", async () => {
  if (!state.activeEvent) return;
  elements.translateEvent.disabled = true;
  elements.translateEvent.textContent = "翻译中";
  try {
    const result = await requestJson("/v1/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: state.activeEvent.summary || state.activeEvent.title }) });
    state.activeTranslation = result.text;
    elements.translationViewToggle.hidden = false;
    renderEventDialogText("translation");
  } catch (error) { showToast(`翻译失败：${error.message}`, "error"); }
  finally { elements.translateEvent.disabled = false; elements.translateEvent.textContent = "翻译为简体中文"; }
});
elements.viewOriginal.addEventListener("click", () => renderEventDialogText("original"));
elements.viewTranslated.addEventListener("click", () => renderEventDialogText("translation"));
elements.cancelEdit.addEventListener("click", startNewEditor);
elements.resetEditor.addEventListener("click", startNewEditor);
elements.sourceKind.addEventListener("change", showProviderFields);
elements.appStoreSearchButton.addEventListener("click", searchForAppStoreApps);
elements.githubRepositorySearch.addEventListener("click", searchGithubRepositories);
elements.dockerHubSearchButton.addEventListener("click", searchDockerHub);
elements.qnapSearchButton.addEventListener("click", searchQnapApps);
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
elements.sourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const isEditing = Boolean(state.editingSourceId);
  try {
    await requestJson(isEditing ? `/v1/sources/${state.editingSourceId}` : "/v1/sources", {
      method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sourcePayload())
    });
    await load();
    showToast(isEditing ? "数据源设置已保存" : "数据源已加入监控列表");
    startNewEditor(); renderSettingsSources();
  } catch (error) { showToast(`无法保存：${error.message}`, "error"); }
});
elements.deleteSource.addEventListener("click", async () => {
  const source = state.sources.find((item) => item.id === state.editingSourceId);
  if (!source || !window.confirm(`确定删除“${source.name}”及其全部历史更新吗？`)) return;
  try {
    const result = await requestJson(`/v1/sources/${source.id}`, { method: "DELETE" });
    await load(); startNewEditor(); renderSettingsSources(); showToast(`数据源及 ${result.eventsRemoved} 条历史更新已删除`);
  } catch (error) { showToast(`无法删除：${error.message}`, "error"); }
});
elements.syncButton.addEventListener("click", async () => {
  elements.syncButton.disabled = true;
  elements.syncButton.innerHTML = '<span class="spin" aria-hidden="true">↻</span> 同步中';
  try {
    const results = await requestJson("/v1/poll?force=true", { method: "POST" });
    const inserted = results.reduce((total, result) => total + (result.inserted || 0), 0);
    const failed = results.filter((result) => !result.ok).length;
    await load();
    showToast(failed ? `同步完成，新增 ${inserted} 条；${failed} 个渠道暂不可用` : `同步完成，新增 ${inserted} 条更新`);
  } catch (error) {
    showToast(`同步失败：${error.message}`, "error");
  } finally {
    elements.syncButton.disabled = false;
    elements.syncButton.innerHTML = '<span aria-hidden="true">↻</span> 立即同步';
  }
});

showWelcomeOnFirstVisit();

load().catch((error) => {
  elements.eventList.innerHTML = `<div class="empty">无法载入雷达数据：${error.message}</div>`;
  showToast("无法连接到 UpdateRadar 服务", "error");
});
