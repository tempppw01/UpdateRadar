const state = { events: [], sources: [], tag: "", sourceId: "", editingSourceId: null };
const elements = {
  eventCount: document.querySelector("#event-count"),
  sourceCount: document.querySelector("#source-count"),
  tagCount: document.querySelector("#tag-count"),
  lastSync: document.querySelector("#last-sync"),
  tagFilters: document.querySelector("#tag-filters"),
  sourceFilter: document.querySelector("#source-filter"),
  eventList: document.querySelector("#event-list"),
  sourceList: document.querySelector("#source-list"),
  resultsCount: document.querySelector("#results-count"),
  syncButton: document.querySelector("#sync-button"),
  settingsButton: document.querySelector("#settings-button"),
  manageSources: document.querySelector("#manage-sources"),
  settingsDialog: document.querySelector("#settings-dialog"),
  closeSettings: document.querySelector("#close-settings"),
  settingsSourceList: document.querySelector("#settings-source-list"),
  sourceForm: document.querySelector("#source-form"),
  sourceKind: document.querySelector("#source-kind"),
  editorMode: document.querySelector("#editor-mode"),
  editorTitle: document.querySelector("#editor-title"),
  resetEditor: document.querySelector("#reset-editor"),
  cancelEdit: document.querySelector("#cancel-edit"),
  deleteSource: document.querySelector("#delete-source"),
  toast: document.querySelector("#toast"),
  template: document.querySelector("#event-template")
};

const dateFormat = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const relativeFormat = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

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

function renderMetrics() {
  const tags = new Set(state.sources.flatMap((source) => source.tags));
  const newest = state.events[0];
  elements.eventCount.textContent = state.events.length;
  elements.sourceCount.textContent = state.sources.filter((source) => source.enabled).length;
  elements.tagCount.textContent = tags.size;
  elements.lastSync.textContent = newest ? relativeTime(newest.detectedAt) : "尚未同步";
}

function renderFilters() {
  const tags = [...new Set(state.sources.flatMap((source) => source.tags))];
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
  state.sources.forEach((source) => elements.sourceFilter.add(new Option(source.name, source.id)));
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
  events.forEach((event) => {
    const card = elements.template.content.cloneNode(true);
    card.querySelector(".event-source").textContent = event.sourceName;
    const time = card.querySelector("time");
    time.dateTime = event.publishedAt;
    time.textContent = `${relativeTime(event.publishedAt)} · ${dateFormat.format(new Date(event.publishedAt))}`;
    card.querySelector("h3").textContent = event.title;
    const summary = card.querySelector(".event-summary");
    summary.textContent = event.summary || "官方未提供本次更新说明。";
    summary.hidden = !event.summary;
    const link = card.querySelector(".event-link");
    link.href = event.url;
    event.tags.forEach((tag) => {
      const pill = document.createElement("span");
      pill.textContent = tag;
      card.querySelector(".event-tags").append(pill);
    });
    elements.eventList.append(card);
  });
}

function renderSources() {
  elements.sourceList.replaceChildren();
  state.sources.forEach((source) => {
    const eventTotal = state.events.filter((event) => event.sourceId === source.id).length;
    const card = document.createElement("article");
    card.className = `source-card ${source.enabled ? "" : "paused"}`;
    const header = document.createElement("div");
    const kind = document.createElement("span");
    kind.className = "source-kind";
    kind.textContent = source.kind.replace("-", " ");
    const status = document.createElement("span");
    status.className = "source-status";
    status.textContent = source.enabled ? "ACTIVE" : "PAUSED";
    header.append(kind, status);
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
}

function showProviderFields() {
  const kind = elements.sourceKind.value;
  document.querySelectorAll(".provider-fields").forEach((fields) => { fields.hidden = fields.dataset.kind !== kind; });
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
  const activeFields = elements.sourceForm.querySelector(`.provider-fields[data-kind="${source.kind}"]`);
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
    const button = document.createElement("button");
    button.type = "button";
    button.className = `saved-source ${state.editingSourceId === source.id ? "selected" : ""}`;
    const status = document.createElement("i");
    status.className = source.enabled ? "" : "paused";
    const name = document.createElement("strong");
    name.textContent = source.name;
    const detail = document.createElement("span");
    detail.textContent = `${source.kind} / ${source.id}`;
    button.append(status, name, detail);
    button.addEventListener("click", () => { editSource(source); renderSettingsSources(); });
    elements.settingsSourceList.append(button);
  });
}

function openSettings() {
  startNewEditor();
  renderSettingsSources();
  elements.settingsDialog.showModal();
}

function sourcePayload() {
  const kind = elements.sourceKind.value;
  const provider = elements.sourceForm.querySelector(`.provider-fields[data-kind="${kind}"]`);
  const value = (name) => provider?.querySelector(`[name="${name}"]`)?.value.trim() || elements.sourceForm.querySelector(`.form-grid [name="${name}"]`)?.value.trim() || "";
  return {
    id: elements.sourceForm.elements.id.value.trim(),
    name: elements.sourceForm.elements.name.value.trim(),
    kind,
    tags: elements.sourceForm.elements.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    enabled: elements.sourceForm.elements.enabled.checked,
    owner: value("owner"), repo: value("repo"), feedUrl: value("feedUrl"), appId: value("appId"),
    packageId: value("packageId"), country: value("country"), language: value("language"),
    includePrereleases: elements.sourceForm.elements.includePrereleases.checked
  };
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || body.error || "请求失败");
  return body;
}

async function load() {
  [state.sources, state.events] = await Promise.all([requestJson("/v1/sources"), requestJson("/v1/events?limit=200")]);
  if (state.sourceId && !state.sources.some((source) => source.id === state.sourceId)) state.sourceId = "";
  renderMetrics(); renderFilters(); renderEvents(); renderSources();
}

elements.sourceFilter.addEventListener("change", (event) => { state.sourceId = event.target.value; renderEvents(); });
elements.settingsButton.addEventListener("click", openSettings);
elements.manageSources.addEventListener("click", openSettings);
elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
elements.cancelEdit.addEventListener("click", startNewEditor);
elements.resetEditor.addEventListener("click", startNewEditor);
elements.sourceKind.addEventListener("change", showProviderFields);
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
  if (!source || !window.confirm(`确定删除“${source.name}”吗？历史更新不会被删除。`)) return;
  try {
    await requestJson(`/v1/sources/${source.id}`, { method: "DELETE" });
    await load(); startNewEditor(); renderSettingsSources(); showToast("数据源已删除");
  } catch (error) { showToast(`无法删除：${error.message}`, "error"); }
});
elements.syncButton.addEventListener("click", async () => {
  elements.syncButton.disabled = true;
  elements.syncButton.innerHTML = '<span class="spin" aria-hidden="true">↻</span> 同步中';
  try {
    const results = await requestJson("/v1/poll", { method: "POST" });
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

load().catch((error) => {
  elements.eventList.innerHTML = `<div class="empty">无法载入雷达数据：${error.message}</div>`;
  showToast("无法连接到 UpdateRadar 服务", "error");
});
