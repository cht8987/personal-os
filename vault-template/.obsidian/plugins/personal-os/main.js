/* Personal OS v0.2 — 引导式记录 + 总览看板
 * 输入流：三问卡片 → 01-Inbox/.queue/ → 夜间巡检自动五类分流
 * 看板：网页式 Page（统计卡片 / 消费柱状图 / 任务完成环 / 快捷导航）
 */
const { Plugin, Modal, Notice, ItemView } = require("obsidian");

const VIEW_TYPE = "personal-os-dashboard";

const QUESTIONS = [
  { label: "今天核心进展是什么？", placeholder: "一句话或一段话，可留空" },
  { label: "有产生新的待办或消费吗？", placeholder: "如：记得明天交电费。午饭花了38块" },
  { label: "还有什么随想要记录？", placeholder: "灵感、学到的东西、情绪、碎碎念……" },
];

/* ---------------- 引导式记录弹窗 ---------------- */
class GuidedCaptureModal extends Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.modalEl.addClass("pos-modal");
    const { contentEl } = this;
    const head = contentEl.createDiv({ cls: "pos-head" });
    head.createSpan({ cls: "pos-logo", text: "🧠" });
    head.createEl("h2", { text: "引导式记录" });
    contentEl.createDiv({
      cls: "pos-sub",
      text: "别整理、别分类，想到什么写什么。系统会自动拆分为日记 · 待办 · 账单 · 学习 · 画像。",
    });
    this.inputs = QUESTIONS.map((q, i) => {
      const card = contentEl.createDiv({ cls: "pos-step" });
      const label = card.createDiv({ cls: "pos-step-label" });
      label.createSpan({ cls: "pos-step-num", text: String(i + 1) });
      label.createSpan({ text: q.label });
      const ta = card.createEl("textarea", { attr: { rows: 2, placeholder: q.placeholder } });
      return ta;
    });
    const foot = contentEl.createDiv({ cls: "pos-foot" });
    foot.createDiv({ cls: "pos-hint", text: "⌘+Enter 快速提交 · 全部留空则不提交" });
    const submit = foot.createEl("button", { cls: "pos-submit mod-cta", text: "丢进 Inbox ✓" });
    submit.addEventListener("click", () => this.submit());
    contentEl.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") this.submit();
    });
    this.inputs[0].focus();
  }
  submit() {
    const text = this.inputs.map((t) => t.value.trim()).filter(Boolean).join("\n");
    if (!text) { new Notice("什么都没写哦"); return; }
    this.onSubmit(text);
    this.close();
  }
  onClose() { this.contentEl.empty(); }
}

/* ---------------- 总览看板（网页式） ---------------- */
class POSDashboardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Personal OS 总览"; }
  getIcon() { return "brain-circuit"; }

  async onOpen() { await this.render(); }

  async readSafe(path) {
    try { return await this.app.vault.adapter.read(path); } catch { return ""; }
  }
  async listSafe(dir) {
    try { return (await this.app.vault.adapter.list(dir)).files; } catch { return []; }
  }

  async collectStats() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    // Inbox 待处理（顶层 md）
    const inboxFiles = (await this.listSafe("01-Inbox")).filter((f) => f.endsWith(".md"));
    const pendingProfile = inboxFiles.filter((f) => f.includes("/profile-")).length;
    // 任务
    const tasksRaw = await this.readSafe("02-Memory/dynamic/ops-log/tasks.md");
    const total = (tasksRaw.match(/^- \[.\]/gm) || []).length;
    const done = (tasksRaw.match(/^- \[x\]/gim) || []).length;
    // 本月账本
    const costRaw = await this.readSafe(`02-Memory/dynamic/ops-log/cost-${ym}.md`);
    const rows = costRaw.split("\n").filter((l) => /^\| \d{4}-/.test(l));
    let spend = 0;
    const byDay = {};
    for (const r of rows) {
      const c = r.split("|").map((s) => s.trim());
      const amt = parseFloat(c[3]) || 0;
      if (amt < 0) {
        spend += -amt;
        byDay[c[1]] = (byDay[c[1]] || 0) + -amt;
      }
    }
    // 本月日记天数
    const journal = await this.listSafe(`02-Memory/dynamic/journal/${now.getFullYear()}`);
    const journalDays = journal.filter((f) => f.includes(`/${ym}-`)).length;
    return { inbox: inboxFiles.length, pendingProfile, total, done, spend, byDay, journalDays, ym };
  }

  barChart(svgNS, byDay) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, val: byDay[key] || 0 });
    }
    const W = 560, H = 150, pad = 24, bw = (W - pad * 2) / 7 - 14;
    const max = Math.max(...days.map((d) => d.val), 1);
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", "100%");
    days.forEach((d, i) => {
      const h = Math.round((d.val / max) * (H - 55));
      const x = pad + i * ((W - pad * 2) / 7) + 7;
      const y = H - 30 - h;
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", x); rect.setAttribute("y", y);
      rect.setAttribute("width", bw); rect.setAttribute("height", Math.max(h, 2));
      rect.setAttribute("class", "pos-bar"); rect.setAttribute("rx", 4);
      svg.appendChild(rect);
      const t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", x + bw / 2); t.setAttribute("y", H - 14);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("class", "pos-axis");
      t.textContent = d.label;
      svg.appendChild(t);
      if (d.val > 0) {
        const v = document.createElementNS(svgNS, "text");
        v.setAttribute("x", x + bw / 2); v.setAttribute("y", y - 5);
        v.setAttribute("text-anchor", "middle"); v.setAttribute("class", "pos-bar-val");
        v.textContent = Math.round(d.val);
        svg.appendChild(v);
      }
    });
    return svg;
  }

  donut(svgNS, done, total) {
    const pct = total ? done / total : 0;
    const R = 34, C = 2 * Math.PI * R;
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90");
    svg.setAttribute("width", "90");
    const bg = document.createElementNS(svgNS, "circle");
    bg.setAttribute("cx", 45); bg.setAttribute("cy", 45); bg.setAttribute("r", R);
    bg.setAttribute("fill", "none");
    bg.setAttribute("stroke", "var(--background-modifier-border)");
    bg.setAttribute("stroke-width", 9);
    const fg = document.createElementNS(svgNS, "circle");
    fg.setAttribute("cx", 45); fg.setAttribute("cy", 45); fg.setAttribute("r", R);
    fg.setAttribute("fill", "none");
    fg.setAttribute("stroke", "var(--interactive-accent)");
    fg.setAttribute("stroke-width", 9);
    fg.setAttribute("stroke-linecap", "round");
    fg.setAttribute("stroke-dasharray", `${C * pct} ${C}`);
    fg.setAttribute("transform", "rotate(-90 45 45)");
    const txt = document.createElementNS(svgNS, "text");
    txt.setAttribute("x", 45); txt.setAttribute("y", 50);
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("style", "font-size:16px;font-weight:800;fill:var(--text-normal)");
    txt.textContent = `${Math.round(pct * 100)}%`;
    svg.append(bg, fg, txt);
    return svg;
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    const s = await this.collectStats();
    const root = el.createDiv({ cls: "pos-dash" });
    const svgNS = "http://www.w3.org/2000/svg";

    // Hero
    const hero = root.createDiv({ cls: "pos-dash-hero" });
    const hl = hero.createDiv();
    hl.createEl("h1", { text: "🧠 Personal OS" });
    hl.createDiv({
      cls: "pos-date",
      text: new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
    });
    const cap = hero.createEl("button", { cls: "pos-capture-btn", text: "＋ 引导式记录" });
    cap.addEventListener("click", () => this.plugin.openCapture(() => this.render()));

    // 统计卡片
    const cards = root.createDiv({ cls: "pos-cards" });
    const card = (icon, num, label, warn) => {
      const c = cards.createDiv({ cls: "pos-card" + (warn ? " pos-warn" : "") });
      c.createDiv({ cls: "pos-card-icon", text: icon });
      c.createDiv({ cls: "pos-card-num", text: String(num) });
      c.createDiv({ cls: "pos-card-label", text: label });
    };
    card("📥", s.inbox, "Inbox 待处理", s.inbox > 5);
    card("⚠️", s.pendingProfile, "画像变更待确认", s.pendingProfile > 0);
    card("💸", `¥${Math.round(s.spend)}`, `本月支出（${s.ym}）`);
    card("📓", s.journalDays, "本月日记天数");

    // 任务完成环 + 消费柱状图
    root.createDiv({ cls: "pos-section-title", text: "任务 & 消费" });
    const grid = root.createDiv({ attr: { style: "display:grid;grid-template-columns:220px 1fr;gap:14px;" } });
    const ringWrap = grid.createDiv({ cls: "pos-chart-wrap pos-ring-wrap" });
    ringWrap.appendChild(this.donut(svgNS, s.done, s.total));
    const rl = ringWrap.createDiv({ cls: "pos-ring-label" });
    rl.createEl("b", { text: `${s.done}/${s.total}` });
    rl.appendText("任务完成");
    const chartWrap = grid.createDiv({ cls: "pos-chart-wrap" });
    chartWrap.appendChild(this.barChart(svgNS, s.byDay));

    // 快捷导航
    root.createDiv({ cls: "pos-section-title", text: "快捷导航" });
    const links = root.createDiv({ cls: "pos-links" });
    const link = (icon, title, desc, path) => {
      const c = links.createDiv({ cls: "pos-link-card" });
      c.createSpan({ text: icon });
      const t = c.createDiv();
      t.createDiv({ cls: "pos-link-title", text: title });
      t.createDiv({ cls: "pos-link-desc", text: desc });
      c.addEventListener("click", () => this.app.workspace.openLinkText(path, "", false));
    };
    link("🏠", "HOME 主页", "全局总览", "HOME");
    link("✅", "任务清单", "打勾的唯一入口", "02-Memory/dynamic/ops-log/tasks.md");
    link("💰", "本月账本", `cost-${s.ym}`, `02-Memory/dynamic/ops-log/cost-${s.ym}.md`);
    link("🌱", "生活看板", "能量与目标", "04-Output/Dashboard/life-dashboard");
    link("📦", "项目看板", "活跃项目状态", "04-Output/Dashboard/project-dashboard");
    link("🚀", "新手引导", "10 分钟上手", "START-HERE");
  }
}

/* ---------------- 插件主体 ---------------- */
module.exports = class PersonalOSPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new POSDashboardView(leaf, this));
    this.addRibbonIcon("brain-circuit", "Personal OS 总览", () => this.activateDashboard());
    this.addRibbonIcon("message-circle-plus", "引导式记录", () => this.openCapture());
    this.addCommand({ id: "guided-capture", name: "引导式记录（丢进 Inbox）", callback: () => this.openCapture() });
    this.addCommand({ id: "open-dashboard", name: "打开总览看板", callback: () => this.activateDashboard() });
  }

  async activateDashboard() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) { this.app.workspace.revealLeaf(existing[0]); return; }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
  }

  openCapture(after) {
    new GuidedCaptureModal(this.app, async (text) => {
      await this.enqueue(text);
      if (after) after();
    }).open();
  }

  async enqueue(text) {
    const adapter = this.app.vault.adapter;
    const dir = "01-Inbox/.queue";
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await adapter.write(`${dir}/q-desktop-${ts}.txt`, text);
    new Notice("✅ 已入队。今晚 23:30 自动归档\n（或终端运行 rtk patrol 立即处理）", 6000);
  }

  onunload() {}
};
