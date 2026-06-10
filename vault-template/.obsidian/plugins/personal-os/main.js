/* Personal OS v0.3 — 多页看板 + 全套引导式输入
 * 页面：总览 / 财务 / 目标任务 / 项目 / 知识 / 产出 / 运维 / 设置
 * 数据层 = 纯 Markdown；本插件只是可替换的显示层。
 */
const { Plugin, Modal, Notice, ItemView, PluginSettingTab, Setting, MarkdownRenderer, requestUrl } = require("obsidian");

const VIEW_TYPE = "personal-os-dashboard";
const DEFAULTS = {
  currency: "RM",
  autoOpen: true,
  lang: "zh",
  llmUrl: "https://api.siliconflow.com/v1",
  llmModel: "nex-agi/Nex-N2-Pro",
};

const slug = (s) => (s || "untitled").trim().toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "untitled";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const thisYM = () => today().slice(0, 7);
const nowStamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

/* ================= 通用引导式表单弹窗 ================= */
class FormModal extends Modal {
  constructor(app, opts, onSubmit) {
    super(app);
    this.opts = opts;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.modalEl.addClass("pos-modal");
    const c = this.contentEl;
    const head = c.createDiv({ cls: "pos-head" });
    head.createSpan({ cls: "pos-logo", text: this.opts.icon || "🧠" });
    head.createEl("h2", { text: this.opts.title });
    if (this.opts.sub) c.createDiv({ cls: "pos-sub", text: this.opts.sub });
    this.widgets = {};
    (this.opts.fields || []).forEach((f, i) => {
      const card = c.createDiv({ cls: "pos-step" });
      const label = card.createDiv({ cls: "pos-step-label" });
      label.createSpan({ cls: "pos-step-num", text: String(i + 1) });
      label.createSpan({ text: f.label });
      let w;
      if (f.type === "select") {
        w = card.createEl("select");
        (f.options || []).forEach((o) => w.createEl("option", { text: o, value: o }));
        if (f.value) w.value = f.value;
      } else if (f.type === "textarea") {
        w = card.createEl("textarea", { attr: { rows: f.rows || 3, placeholder: f.placeholder || "" } });
        if (f.value) w.value = f.value;
      } else {
        w = card.createEl("input", { attr: { type: f.type || "text", placeholder: f.placeholder || "" } });
        if (f.value) w.value = f.value;
      }
      this.widgets[f.key] = w;
    });
    const foot = c.createDiv({ cls: "pos-foot" });
    foot.createDiv({ cls: "pos-hint", text: this.opts.hint || "⌘+Enter 快速提交" });
    const btns = foot.createDiv({ cls: "pos-actions" });
    if (this.opts.secondary) {
      const sec = btns.createEl("button", { cls: "pos-submit pos-btn-ghost", text: this.opts.secondary.text });
      sec.addEventListener("click", () => this.submit(this.opts.secondary.handler));
    }
    const btn = btns.createEl("button", { cls: "pos-submit mod-cta", text: this.opts.submitText || "确认 ✓" });
    btn.addEventListener("click", () => this.submit());
    c.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") this.submit();
    });
    const first = Object.values(this.widgets)[0];
    if (first) first.focus();
  }
  submit(handler) {
    const v = {};
    for (const k in this.widgets) v[k] = this.widgets[k].value.trim();
    if (this.opts.require && !v[this.opts.require]) { new Notice("必填项还没填哦"); return; }
    (handler || this.onSubmit)(v);
    this.close();
  }
  onClose() { this.contentEl.empty(); }
}

/* ================= 选择卡片弹窗 ================= */
class ChoiceModal extends Modal {
  constructor(app, opts, onPick) {
    super(app);
    this.opts = opts;
    this.onPick = onPick;
  }
  onOpen() {
    this.modalEl.addClass("pos-modal");
    const c = this.contentEl;
    const head = c.createDiv({ cls: "pos-head" });
    head.createSpan({ cls: "pos-logo", text: this.opts.icon || "🧠" });
    head.createEl("h2", { text: this.opts.title });
    if (this.opts.sub) c.createDiv({ cls: "pos-sub", text: this.opts.sub });
    const grid = c.createDiv({ cls: "pos-choice-grid" });
    (this.opts.choices || []).forEach((ch) => {
      const card = grid.createEl("button", { cls: "pos-choice" });
      card.createDiv({ cls: "pos-choice-icon", text: ch.icon });
      card.createDiv({ cls: "pos-choice-title", text: ch.title });
      if (ch.desc) card.createDiv({ cls: "pos-choice-desc", text: ch.desc });
      card.addEventListener("click", () => { this.close(); this.onPick(ch); });
    });
  }
  onClose() { this.contentEl.empty(); }
}

/* ================= 画像向导配置（吸收旧 OS Structure 细节） ================= */
const PROFILE_ASPECTS = [
  { id: "identity", icon: "🪪", title: "身份 Identity", desc: "我是谁、角色、定位", dir: "identity",
    prompts: "你如何介绍自己？现在扮演哪些角色（职业/家庭/社群）？想成为什么样的人？" },
  { id: "values", icon: "💎", title: "价值观 Values", desc: "原则与判断标准", dir: "values",
    prompts: "你做决定时最看重什么？绝不妥协的底线？你欣赏什么样的人？" },
  { id: "relationships", icon: "🤝", title: "关系 Relationship", desc: "重要的人与关系动态", dir: "relationships",
    prompts: "谁对你最重要？各关系现状如何？想改善或投入哪段关系？" },
  { id: "milestones", icon: "🏁", title: "里程碑 Milestone", desc: "人生关键节点", dir: "milestones",
    prompts: "影响你人生走向的关键事件？最自豪的成就？转折点是什么？" },
  { id: "portfolio", icon: "💼", title: "作品集 Portfolio", desc: "项目与资产沉淀", dir: "portfolio",
    prompts: "做过哪些拿得出手的作品/项目？各自的链接与状态？" },
  { id: "skills", icon: "🛠", title: "技能 Skill", desc: "能力图谱与等级", dir: "skills",
    prompts: "你的核心技能？熟练度如何？正在学/想学什么？" },
  { id: "religion", icon: "🕊", title: "信仰 Religion", desc: "信仰与精神实践", dir: "religion",
    prompts: "你的信仰/灵性实践？它如何影响你的生活方式与决策？" },
  { id: "life", icon: "🌱", title: "生活 Life", desc: "习惯、健康、节奏", dir: "life",
    prompts: "日常作息？健康状况与习惯？理想的生活节奏？" },
  { id: "resources", icon: "📦", title: "资源 Resources", desc: "可调用的人脉/工具/资产", dir: "resources",
    prompts: "你拥有哪些资源（设备/人脉/渠道/资金面概况，不写具体数字）？" },
  { id: "constraints", icon: "⛓", title: "约束 Constraints", desc: "当前限制与边界", dir: "constraints",
    prompts: "时间/资源/健康上的限制？哪些是暂时的、哪些要长期共处？" },
];

const OUTPUT_TYPES = [
  { id: "report", icon: "📊", title: "Report 周/月报", desc: "进展盘点+消费分析+下一步", dir: "04-Output/Report", tpl: ".system/templates/report.template.md" },
  { id: "summary", icon: "🧭", title: "Summary 摘要", desc: "高维信息消化沉淀", dir: "04-Output/Summary", tpl: ".system/templates/summary.template.md" },
  { id: "content", icon: "✍️", title: "Content 创作", desc: "文章/技术沉淀/结构化输出", dir: "04-Output/Content", tpl: "" },
];

/* ================= 主视图：多页看板 ================= */
const PAGES = [
  { id: "home", icon: "🏠", label: "总览" },
  { id: "finance", icon: "💰", label: "财务" },
  { id: "goals", icon: "🎯", label: "目标与任务" },
  { id: "projects", icon: "📦", label: "项目" },
  { id: "knowledge", icon: "📚", label: "知识" },
  { id: "output", icon: "📤", label: "产出" },
  { id: "agents", icon: "🤖", label: "Agents" },
  { id: "ops", icon: "🛡", label: "运维" },
  { id: "settings", icon: "⚙️", label: "设置" },
];

class POSView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.page = "home";
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Personal OS"; }
  getIcon() { return "brain-circuit"; }
  /* hermes-console 兼容：它魔改了 workspace，要求所有视图实现这两个方法 */
  allowNoWorkspaceClose() { return true; }
  updateObsidianContextHeader() {}
  async onOpen() {
    await this.render();
    /* 挂载兜底：若被第三方插件的事件异常打断，可见时自动补渲染 */
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf === this.leaf && !this.contentEl.querySelector(".pos-app")) this.render();
    }));
  }

  /* ---------- 文件工具 ---------- */
  async readSafe(p) { try { return await this.app.vault.adapter.read(p); } catch { return ""; } }
  async listSafe(d) { try { return await this.app.vault.adapter.list(d); } catch { return { files: [], folders: [] }; } }
  async exists(p) { try { return await this.app.vault.adapter.exists(p); } catch { return false; } }
  async ensureDir(d) {
    const parts = d.split("/");
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!(await this.exists(cur))) await this.app.vault.adapter.mkdir(cur);
    }
  }
  async writeNote(p, content, open = true) {
    await this.ensureDir(p.split("/").slice(0, -1).join("/"));
    await this.app.vault.adapter.write(p, content);
    if (open) this.app.workspace.openLinkText(p, "", true);
  }
  async appendTo(p, text, header = "") {
    if (!(await this.exists(p))) {
      await this.ensureDir(p.split("/").slice(0, -1).join("/"));
      await this.app.vault.adapter.write(p, header);
    }
    const cur = await this.readSafe(p);
    await this.app.vault.adapter.write(p, cur + text);
  }
  openNote(p) { this.app.workspace.openLinkText(p, "", false); }
  fm(title, type, extra = "") {
    return `---\ntitle: ${title}\ntype: ${type}\nstatus: active\ncreated: ${today()}\nupdated: ${today()}\n${extra}---\n\n`;
  }

  /* ---------- 渲染骨架 ---------- */
  async render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "pos-app" });
    const nav = root.createDiv({ cls: "pos-nav" });
    nav.createDiv({ cls: "pos-nav-brand", text: "🧠 Personal OS" });
    PAGES.forEach((p) => {
      const item = nav.createEl("button", { cls: "pos-nav-item" + (this.page === p.id ? " active" : "") });
      item.createSpan({ text: p.icon });
      item.createSpan({ text: p.label });
      item.addEventListener("click", () => { this.page = p.id; this.render(); });
    });
    nav.createDiv({ cls: "pos-nav-spacer" });
    const cap = nav.createEl("button", { cls: "pos-btn", text: "＋ 记录" });
    cap.addEventListener("click", () => this.plugin.openCapture(() => this.render()));
    this.main = root.createDiv({ cls: "pos-main" });
    this.body = this.main.createDiv({ cls: "pos-page" });
    const r = {
      home: () => this.renderHome(), finance: () => this.renderFinance(),
      goals: () => this.renderGoals(), projects: () => this.renderProjects(),
      knowledge: () => this.renderKnowledge(), output: () => this.renderOutput(),
      agents: () => this.renderAgents(),
      ops: () => this.renderOps(), settings: () => this.renderSettings(),
    }[this.page];
    await r();
  }

  hero(title, sub, actions = []) {
    const h = this.body.createDiv({ cls: "pos-dash-hero" });
    const left = h.createDiv();
    left.createEl("h1", { text: title });
    if (sub) left.createDiv({ cls: "pos-date", text: sub });
    const act = h.createDiv({ cls: "pos-actions" });
    actions.forEach((a) => {
      const b = act.createEl("button", { cls: "pos-btn" + (a.ghost ? " pos-btn-ghost" : ""), text: a.text });
      b.addEventListener("click", a.fn);
    });
    return h;
  }
  card(parent, icon, num, label, cls = "") {
    const c = parent.createDiv({ cls: "pos-card " + cls });
    c.createDiv({ cls: "pos-card-icon", text: icon });
    c.createDiv({ cls: "pos-card-num", text: String(num) });
    c.createDiv({ cls: "pos-card-label", text: label });
  }
  section(title, btns = []) {
    const t = this.body.createDiv({ cls: "pos-section-title" });
    t.createSpan({ text: title });
    const right = t.createDiv({ cls: "pos-actions" });
    btns.forEach((b) => {
      const e = right.createEl("button", { cls: "pos-btn pos-btn-ghost", text: b.text });
      e.addEventListener("click", b.fn);
    });
  }
  linkCard(parent, icon, title, desc, fn) {
    const c = parent.createDiv({ cls: "pos-link-card" });
    c.createSpan({ text: icon });
    const t = c.createDiv();
    t.createDiv({ cls: "pos-link-title", text: title });
    if (desc) t.createDiv({ cls: "pos-link-desc", text: desc });
    c.addEventListener("click", fn);
  }

  /* ---------- 数据采集 ---------- */
  parseCostRows(raw) {
    return raw.split("\n").filter((l) => /^\| \d{4}-/.test(l)).map((l) => {
      const c = l.split("|").map((s) => s.trim());
      return { date: c[1], item: c[2], amount: parseFloat(c[3]) || 0, cur: c[4], cat: c[5], chan: c[6] };
    });
  }
  async getFinance() {
    const ym = thisYM();
    const raw = await this.readSafe(`02-Memory/dynamic/ops-log/cost-${ym}.md`);
    const rows = this.parseCostRows(raw);
    let spend = 0, income = 0;
    const byCat = {}, byDay = {};
    rows.forEach((r) => {
      if (r.amount < 0) {
        spend += -r.amount;
        byCat[r.cat] = (byCat[r.cat] || 0) + -r.amount;
        byDay[r.date] = (byDay[r.date] || 0) + -r.amount;
      } else income += r.amount;
    });
    return { ym, rows, spend, income, byCat, byDay };
  }
  parseTasks(raw) {
    const out = [];
    raw.split("\n").forEach((line, idx) => {
      const m = line.match(/^- \[([ xX-])\] (.*)$/);
      if (!m) return;
      const due = (m[2].match(/📅 (\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      out.push({
        idx, done: m[1].toLowerCase() === "x", cancelled: m[1] === "-",
        text: m[2].replace(/\s*\^task-[\w-]+$/, "").replace(/📅 \d{4}-\d{2}-\d{2}/, "").trim(),
        due, raw: line,
      });
    });
    return out;
  }
  async getTasks() { return this.parseTasks(await this.readSafe("02-Memory/dynamic/ops-log/tasks.md")); }

  barChart(byDay, days = 7) {
    const svgNS = "http://www.w3.org/2000/svg";
    const list = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      list.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, val: byDay[key] || 0 });
    }
    const W = 560, H = 150, pad = 24, bw = (W - pad * 2) / days - 14;
    const max = Math.max(...list.map((d) => d.val), 1);
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", "100%");
    list.forEach((d, i) => {
      const h = Math.round((d.val / max) * (H - 55));
      const x = pad + i * ((W - pad * 2) / days) + 7, y = H - 30 - h;
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
  donut(done, total) {
    const svgNS = "http://www.w3.org/2000/svg";
    const pct = total ? done / total : 0, R = 34, C = 2 * Math.PI * R;
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90"); svg.setAttribute("width", "88");
    const mk = (stroke, dash) => {
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", 45); c.setAttribute("cy", 45); c.setAttribute("r", R);
      c.setAttribute("fill", "none"); c.setAttribute("stroke", stroke); c.setAttribute("stroke-width", 9);
      if (dash) { c.setAttribute("stroke-dasharray", dash); c.setAttribute("stroke-linecap", "round"); c.setAttribute("transform", "rotate(-90 45 45)"); }
      return c;
    };
    svg.appendChild(mk("var(--background-modifier-border)"));
    svg.appendChild(mk("var(--interactive-accent)", `${C * pct} ${C}`));
    const txt = document.createElementNS(svgNS, "text");
    txt.setAttribute("x", 45); txt.setAttribute("y", 50); txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("style", "font-size:15px;font-weight:800;fill:var(--text-normal)");
    txt.textContent = `${Math.round(pct * 100)}%`;
    svg.appendChild(txt);
    return svg;
  }

  /* ================= 页面：总览 ================= */
  async renderHome() {
    const cur = this.plugin.settings.currency;
    this.hero("总览", new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }), [
      { text: "＋ 引导式记录", fn: () => this.plugin.openCapture(() => this.render()) },
    ]);
    const inbox = (await this.listSafe("01-Inbox")).files.filter((f) => f.endsWith(".md"));
    const pendingProfile = inbox.filter((f) => f.includes("/profile-")).length;
    const tasks = await this.getTasks();
    const fin = await this.getFinance();
    const jr = (await this.listSafe(`02-Memory/dynamic/journal/${new Date().getFullYear()}`)).files
      .filter((f) => f.includes(`/${fin.ym}-`)).length;
    const cards = this.body.createDiv({ cls: "pos-cards" });
    this.card(cards, "📥", inbox.length, "Inbox 待处理", inbox.length > 5 ? "pos-warn" : "");
    this.card(cards, "⚠️", pendingProfile, "画像变更待确认", pendingProfile ? "pos-warn" : "");
    this.card(cards, "💸", `${cur} ${Math.round(fin.spend)}`, `本月支出（${fin.ym}）`);
    this.card(cards, "📓", jr, "本月日记天数");

    this.section("任务 & 消费");
    const grid = this.body.createDiv({ attr: { style: "display:grid;grid-template-columns:215px 1fr;gap:13px;" } });
    const ring = grid.createDiv({ cls: "pos-chart-wrap pos-ring-wrap" });
    const open = tasks.filter((t) => !t.done && !t.cancelled).length;
    ring.appendChild(this.donut(tasks.length - open, tasks.length));
    const rl = ring.createDiv({ cls: "pos-ring-label" });
    rl.createEl("b", { text: `${tasks.length - open}/${tasks.length}` });
    rl.appendText("任务完成");
    grid.createDiv({ cls: "pos-chart-wrap" }).appendChild(this.barChart(fin.byDay));

    this.section("快速创建（引导式）");
    const links = this.body.createDiv({ cls: "pos-links" });
    this.linkCard(links, "🪪", "Profile 设定", "关系/价值观/里程碑/技能…", () => this.plugin.profileWizard(() => this.render()));
    this.linkCard(links, "💰", "记一笔", "实时更新财务看板", () => this.plugin.addExpense(this, () => { this.page = "finance"; this.render(); }));
    this.linkCard(links, "🎯", "设定目标", "写入目标库可链接", () => this.plugin.createGoal(this, () => { this.page = "goals"; this.render(); }));
    this.linkCard(links, "✅", "新任务", "进入集中任务清单", () => this.plugin.createTask(this, () => { this.page = "goals"; this.render(); }));
    this.linkCard(links, "📦", "创建项目", "引导式项目描述", () => this.plugin.createProject(this, () => { this.page = "projects"; this.render(); }));
    this.linkCard(links, "📚", "学习笔记", "Learning Knowledge", () => this.plugin.createLearning(this, () => { this.page = "knowledge"; this.render(); }));
    this.linkCard(links, "🌐", "Wiki 条目", "沉淀进知识体系", () => this.plugin.createWiki(this, () => { this.page = "knowledge"; this.render(); }));
    this.linkCard(links, "📤", "生成产出", "Report / Summary / Content", () => { this.page = "output"; this.render(); });
    this.linkCard(links, "🤖", "Agents 协作", "常用指令 + 工作流指南", () => { this.page = "agents"; this.render(); });
    this.linkCard(links, "🛡", "Ops-Log 巡检", "自动化与日志", () => { this.page = "ops"; this.render(); });
    this.linkCard(links, "⚙️", "系统设置", "LLM / 语言 / 币种 / 手机端", () => { this.page = "settings"; this.render(); });
  }

  /* ================= 页面：财务 ================= */
  async renderFinance() {
    const cur = this.plugin.settings.currency;
    const fin = await this.getFinance();
    this.hero("财务", `账期 ${fin.ym} · 实时读取账本`, [
      { text: "＋ 记一笔", fn: () => this.plugin.addExpense(this, () => this.render()) },
      { text: "打开账本", ghost: true, fn: () => this.openNote(`02-Memory/dynamic/ops-log/cost-${fin.ym}.md`) },
    ]);
    const cards = this.body.createDiv({ cls: "pos-cards" });
    this.card(cards, "💸", `${cur} ${fin.spend.toFixed(2)}`, "本月支出");
    this.card(cards, "💵", `${cur} ${fin.income.toFixed(2)}`, "本月收入", fin.income ? "pos-good" : "");
    this.card(cards, "🧾", fin.rows.length, "记账笔数");
    const top = Object.entries(fin.byCat).sort((a, b) => b[1] - a[1])[0];
    this.card(cards, "🏷", top ? top[0] : "—", "最大支出分类");

    this.section("近 14 天支出");
    this.body.createDiv({ cls: "pos-chart-wrap" }).appendChild(this.barChart(fin.byDay, 14));

    this.section("分类占比");
    const catWrap = this.body.createDiv({ cls: "pos-chart-wrap" });
    const cats = Object.entries(fin.byCat).sort((a, b) => b[1] - a[1]);
    if (!cats.length) catWrap.createDiv({ cls: "pos-empty", text: "本月还没有支出记录" });
    cats.forEach(([name, val]) => {
      const row = catWrap.createDiv({ cls: "pos-cat-row" });
      row.createDiv({ cls: "pos-cat-name", text: name });
      const track = row.createDiv({ cls: "pos-cat-track" });
      track.createDiv({ cls: "pos-cat-fill", attr: { style: `width:${Math.round((val / fin.spend) * 100)}%` } });
      row.createDiv({ cls: "pos-cat-val", text: `${cur} ${val.toFixed(2)}` });
    });

    this.section("明细（最近 15 笔）");
    const tw = this.body.createDiv({ cls: "pos-chart-wrap" });
    const table = tw.createEl("table", { cls: "pos-table" });
    const hr = table.createEl("tr");
    ["日期", "项目", "分类", "渠道", "金额"].forEach((h) => hr.createEl("th", { text: h }));
    fin.rows.slice(-15).reverse().forEach((r) => {
      const tr = table.createEl("tr");
      tr.createEl("td", { text: r.date.slice(5) });
      tr.createEl("td", { text: r.item });
      tr.createEl("td").createSpan({ cls: "pos-pill", text: r.cat || "—" });
      tr.createEl("td", { text: r.chan || "—" });
      tr.createEl("td", { cls: "pos-amt " + (r.amount < 0 ? "neg" : "pos"), text: `${cur} ${r.amount.toFixed(2)}` });
    });
    if (!fin.rows.length) tw.createDiv({ cls: "pos-empty", text: "用「＋记一笔」或引导式记录开始记账" });
  }

  /* ================= 页面：目标与任务 ================= */
  async renderGoals() {
    this.hero("目标与任务", "目标库 → Active-Context → 任务清单，全链路可双链", [
      { text: "🎯 设定目标", fn: () => this.plugin.createGoal(this, () => this.render()) },
      { text: "＋ 新任务", fn: () => this.plugin.createTask(this, () => this.render()) },
      { text: "写入 Active-Context", ghost: true, fn: () => this.writeActiveContext() },
    ]);
    this.section("目标库", [{ text: "打开目录", fn: () => this.openNote("02-Memory/static/os/profile/goals") }]);
    const gWrap = this.body.createDiv({ cls: "pos-links" });
    const goals = (await this.listSafe("02-Memory/static/os/profile/goals")).files.filter((f) => f.endsWith(".md"));
    if (!goals.length) gWrap.createDiv({ cls: "pos-empty", text: "还没有目标——点右上「设定目标」" });
    for (const g of goals) {
      const name = g.split("/").pop().replace(".md", "");
      this.linkCard(gWrap, "🎯", name, "", () => this.openNote(g));
    }
    this.section("任务清单（点击勾选，实时写回）", [{ text: "打开文件", fn: () => this.openNote("02-Memory/dynamic/ops-log/tasks.md") }]);
    const tWrap = this.body.createDiv({ cls: "pos-chart-wrap pos-task-list" });
    const tasks = await this.getTasks();
    if (!tasks.length) tWrap.createDiv({ cls: "pos-empty", text: "清单是空的——丢一句「记得明天…」进 Inbox 试试" });
    tasks.forEach((t) => {
      const row = tWrap.createDiv({ cls: "pos-task" + (t.done ? " done" : "") });
      const cb = row.createEl("input", { attr: { type: "checkbox" } });
      cb.checked = t.done;
      row.createSpan({ text: t.text });
      if (t.due) row.createSpan({ cls: "pos-task-due", text: `📅 ${t.due}` });
      cb.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.toggleTask(t);
        this.render();
      });
    });
  }
  async toggleTask(t) {
    const p = "02-Memory/dynamic/ops-log/tasks.md";
    const lines = (await this.readSafe(p)).split("\n");
    if (lines[t.idx] !== t.raw) { new Notice("任务文件已变化，请重试"); return; }
    lines[t.idx] = t.done
      ? t.raw.replace(/^- \[[xX]\]/, "- [ ]")
      : t.raw.replace(/^- \[ \]/, "- [x]") + (t.raw.includes("✅") ? "" : ` ✅ ${today()}`);
    await this.app.vault.adapter.write(p, lines.join("\n"));
  }
  async writeActiveContext() {
    const tasks = (await this.getTasks()).filter((t) => !t.done && !t.cancelled);
    const goals = (await this.listSafe("02-Memory/static/os/profile/goals")).files.filter((f) => f.endsWith(".md"));
    const focus = await this.readSafe("02-Memory/static/os/profile/goals/30-day-focus.md");
    const focusBody = focus.split("---").slice(2).join("---").trim();
    let md = this.fm("Active Context", "memory", "tags: [active-context]\n");
    md += `# 🧭 Active Context（${today()} 由看板生成）\n\n## 当前聚焦\n\n${focusBody || "（未设定 30 天聚焦）"}\n\n## 活跃目标\n\n`;
    md += goals.filter((g) => !g.endsWith("active-context.md")).map((g) => `- [[${g.replace(".md", "")}]]`).join("\n") || "（无）";
    md += `\n\n## 未完成任务（${tasks.length}）\n\n`;
    md += tasks.map((t) => `- [ ] ${t.text}${t.due ? ` 📅 ${t.due}` : ""}`).join("\n") || "（无）";
    md += "\n";
    await this.writeNote("02-Memory/static/os/profile/goals/active-context.md", md);
    new Notice("✅ Active-Context 已更新");
  }

  /* ================= 页面：项目 ================= */
  async renderProjects() {
    this.hero("项目", "static/projects 实时扫描", [
      { text: "＋ 创建项目", fn: () => this.plugin.createProject(this, () => this.render()) },
      { text: "打开目录", ghost: true, fn: () => this.openNote("02-Memory/static/projects") },
    ]);
    const dir = "02-Memory/static/projects";
    const l = await this.listSafe(dir);
    const files = [...l.files];
    for (const sub of l.folders) files.push(...(await this.listSafe(sub)).files);
    const mds = files.filter((f) => f.endsWith(".md"));
    const wrap = this.body.createDiv({ cls: "pos-links" });
    if (!mds.length) wrap.createDiv({ cls: "pos-empty", text: "还没有项目——点「创建项目」开始" });
    for (const f of mds.slice(0, 30)) {
      const raw = await this.readSafe(f);
      const get = (k) => (raw.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1] || "";
      const name = get("title") || f.split("/").pop().replace(".md", "");
      const status = get("status") || get("project-phase") || "";
      this.linkCard(wrap, "📦", name, status ? `状态：${status}` : "", () => this.openNote(f));
    }
  }

  /* ================= 页面：知识 ================= */
  async renderKnowledge() {
    this.hero("知识", "Learning 原始层 + Wiki 知识体系", [
      { text: "📚 学习笔记", fn: () => this.plugin.createLearning(this, () => this.render()) },
      { text: "🌐 Wiki 条目", fn: () => this.plugin.createWiki(this, () => this.render()) },
    ]);
    this.section("最近学习", [{ text: "打开目录", fn: () => this.openNote("02-Memory/dynamic/raw/learning") }]);
    const y = String(new Date().getFullYear());
    const learn = (await this.listSafe(`02-Memory/dynamic/raw/learning/${y}`)).files.filter((f) => f.endsWith(".md"));
    const lw = this.body.createDiv({ cls: "pos-links" });
    if (!learn.length) lw.createDiv({ cls: "pos-empty", text: "今年还没有学习记录" });
    learn.slice(-9).reverse().forEach((f) => {
      this.linkCard(lw, "📖", f.split("/").pop().replace(".md", ""), "", () => this.openNote(f));
    });
    this.section("Wiki 分类", [{ text: "打开 Wiki", fn: () => this.openNote("02-Memory/static/learning/wiki") }]);
    const cats = (await this.listSafe("02-Memory/static/learning/wiki")).folders;
    const ww = this.body.createDiv({ cls: "pos-links" });
    for (const c of cats) {
      const n = (await this.listSafe(c)).files.filter((f) => f.endsWith(".md")).length;
      this.linkCard(ww, "🗂", c.split("/").pop(), `${n} 篇`, () => this.openNote(c));
    }
  }

  /* ================= 页面：产出 ================= */
  async renderOutput() {
    this.hero("产出生成器", "选择类型 → 引导填写 → 按模版生成到 04-Output");
    const grid = this.body.createDiv({ cls: "pos-choice-grid" });
    OUTPUT_TYPES.forEach((t) => {
      const card = grid.createEl("button", { cls: "pos-choice" });
      card.createDiv({ cls: "pos-choice-icon", text: t.icon });
      card.createDiv({ cls: "pos-choice-title", text: t.title });
      card.createDiv({ cls: "pos-choice-desc", text: t.desc });
      card.addEventListener("click", () => this.plugin.generateOutput(this, t, () => this.render()));
    });
    this.section("最近产出");
    const wrap = this.body.createDiv({ cls: "pos-links" });
    for (const d of ["04-Output/Report", "04-Output/Summary", "04-Output/Content"]) {
      const fs = (await this.listSafe(d)).files.filter((f) => f.endsWith(".md") && !f.includes("legacy"));
      fs.slice(-4).forEach((f) => this.linkCard(wrap, "📄", f.split("/").pop().replace(".md", ""), d.split("/").pop(), () => this.openNote(f)));
    }
  }

  /* ================= 页面：Agents ================= */
  async renderAgents() {
    this.hero("与 Agents 协作", "这套 OS 的精髓：你做决定，Agents 干活", [
      { text: "打开完整指南", ghost: true, fn: () => this.openNote("03-Agents/AGENTS-GUIDE.md") },
    ]);
    this.section("常用指令（点卡片复制，粘贴给 Hermes Console / Claude）");
    const prompts = [
      ["📊", "生成本周报告", "读取本周的 02-Memory/dynamic/ops-log/ 日报与账本，按 .system/templates/report.template.md 的结构，把 04-Output/Report/ 中最新的 report 草稿补写完整。数据必须可溯源，不得编造。"],
      ["🧹", "整理这篇笔记", "读取当前打开的笔记，优化结构与措辞（保留全部事实），为相关概念添加 [[双链]]，更新 updated 日期。改动前先告诉我你的修改计划。"],
      ["🔍", "本月花销分析", "读取 02-Memory/dynamic/ops-log/ 本月账本，按分类汇总并指出异常支出，用一张表格回答。金额属敏感数据，仅在对话中展示，不要写入任何文件。"],
      ["📦", "推进项目", "读取 02-Memory/static/projects/ 下我指定的项目笔记，根据「下一步」与决策记录，给出本周可执行的三步行动，并把它们追加为任务（带 #project 标签）写入 02-Memory/dynamic/ops-log/tasks.md。"],
      ["🪪", "确认画像变更", "读取 01-Inbox/ 顶层的 profile-*.md 待确认条目，逐条向我复述并询问是否合入；我确认后写入 02-Memory/static/os/profile/ 对应维度并删除原文件。"],
      ["🧬", "固化本周记忆", "从本周 ops-log 和日记中提取关键决策与教训，retain 进 Hindsight 对应 bank（os/projects/learning），private 内容只存抽象模式不存数字。"],
    ];
    const grid = this.body.createDiv({ cls: "pos-links" });
    prompts.forEach(([icon, title, text]) => {
      this.linkCard(grid, icon, title, "点击复制指令", async () => {
        await navigator.clipboard.writeText(text);
        new Notice("✅ 已复制，粘贴给 Hermes Console 或 Claude 即可");
      });
    });
    this.section("协作指南（完整版）");
    const wrap = this.body.createDiv({ cls: "pos-chart-wrap pos-md" });
    const md = await this.readSafe("03-Agents/AGENTS-GUIDE.md");
    if (md) await MarkdownRenderer.render(this.app, md.replace(/^---[\s\S]*?---/, ""), wrap, "03-Agents/AGENTS-GUIDE.md", this);
  }

  /* ================= 页面：运维 ================= */
  async renderOps() {
    this.hero("运维 · Ops-Log 与自动化", "Hermes 每晚 23:30 巡检；这里随时手动触发", [
      { text: "▶️ 立即巡检", fn: () => this.runPatrol() },
      { text: "打开今日报告", ghost: true, fn: () => this.openNote(`02-Memory/dynamic/ops-log/${today()}.md`) },
    ]);
    const q = (await this.listSafe("01-Inbox/.queue")).files.filter((f) => f.endsWith(".txt")).length;
    const inbox = (await this.listSafe("01-Inbox")).files.filter((f) => f.endsWith(".md")).length;
    const patrolLog = await this.readSafe(".system/logs/patrol.log");
    const lastLine = patrolLog.trim().split("\n").pop() || "从未运行";
    const cards = this.body.createDiv({ cls: "pos-cards" });
    this.card(cards, "📨", q, "队列积压", q ? "pos-warn" : "pos-good");
    this.card(cards, "📥", inbox, "Inbox 待分发", inbox > 5 ? "pos-warn" : "");
    this.card(cards, "🕐", lastLine.includes("完成") ? lastLine.slice(5, 16) : "—", "上次巡检");

    this.section("今日 Ops-Log");
    const mdWrap = this.body.createDiv({ cls: "pos-chart-wrap pos-md" });
    const md = await this.readSafe(`02-Memory/dynamic/ops-log/${today()}.md`);
    if (md) await MarkdownRenderer.render(this.app, md.replace(/^---[\s\S]*?---/, ""), mdWrap, "/", this);
    else mdWrap.createDiv({ cls: "pos-empty", text: "今天还没有巡检报告——点「立即巡检」生成" });

    this.section("巡检日志（最近 12 行）");
    this.body.createDiv({ cls: "pos-log", text: patrolLog.trim().split("\n").slice(-12).join("\n") || "（空）" });
  }
  runPatrol() {
    try {
      const { execFile } = require("child_process");
      const base = this.app.vault.adapter.basePath;
      new Notice("巡检运行中…");
      execFile(`${base}/03-Agents/automation/bin/rtk`, ["patrol"], { timeout: 120000 }, (err) => {
        if (err) new Notice("巡检失败：" + err.message, 6000);
        else new Notice("✅ 巡检完成");
        this.render();
      });
    } catch (e) { new Notice("当前环境不支持直接执行（请在终端运行 rtk patrol）"); }
  }

  /* ================= 页面：设置 ================= */
  async renderSettings() {
    const S = this.plugin.settings;
    this.hero("设置", "LLM · 币种 · 路径 · 手机端");
    const envPath = this.plugin.envFilePath();
    const env = this.plugin.readEnvFile();

    this.section("LLM 智能分流（写入库外 " + envPath + "，符合隐私铁律）");
    const llmWrap = this.body.createDiv({ cls: "pos-chart-wrap" });
    const row = (parent, name, desc, value, type = "text") => {
      const r = parent.createDiv({ cls: "pos-set-row" });
      const info = r.createDiv({ cls: "pos-set-info" });
      info.createDiv({ cls: "pos-set-name", text: name });
      if (desc) info.createDiv({ cls: "pos-set-desc", text: desc });
      const input = r.createEl("input", { attr: { type, placeholder: desc || "" } });
      input.value = value || "";
      return input;
    };
    const urlIn = row(llmWrap, "API 地址", "OpenAI 兼容接口", env.SILICONFLOW_API_URL || S.llmUrl);
    const modelIn = row(llmWrap, "模型", "如 nex-agi/Nex-N2-Pro / deepseek-chat", env.SILICONFLOW_MODEL || S.llmModel);
    const keyIn = row(llmWrap, "API Key", env.SILICONFLOW_API_KEY ? "已配置（重新输入可覆盖）" : "sk-…", "", "password");
    const st = llmWrap.createDiv({ cls: "pos-set-row" });
    st.createDiv({ cls: "pos-set-info" }).createDiv({
      cls: env.SILICONFLOW_API_KEY ? "pos-ok" : "pos-bad",
      text: env.SILICONFLOW_API_KEY ? "● 已配置 — 夜间巡检与入流将使用 LLM 分流" : "● 未配置 — 当前为离线规则引擎",
    });
    const btns = st.createDiv({ cls: "pos-actions" });
    const testBtn = btns.createEl("button", { cls: "pos-btn pos-btn-ghost", text: "测试连接" });
    testBtn.addEventListener("click", async () => {
      const key = keyIn.value.trim() || env.SILICONFLOW_API_KEY;
      if (!key) { new Notice("先填 API Key"); return; }
      try {
        const r = await requestUrl({ url: urlIn.value.replace(/\/$/, "") + "/models", headers: { Authorization: `Bearer ${key}` } });
        new Notice(r.status === 200 ? "✅ 连接成功" : `状态码 ${r.status}`);
      } catch (e) { new Notice("❌ 连接失败：" + e.message, 5000); }
    });
    const saveBtn = btns.createEl("button", { cls: "pos-btn", text: "保存" });
    saveBtn.addEventListener("click", async () => {
      const next = { ...env };
      next.SILICONFLOW_API_URL = urlIn.value.trim() || S.llmUrl;
      next.SILICONFLOW_MODEL = modelIn.value.trim() || S.llmModel;
      if (keyIn.value.trim()) next.SILICONFLOW_API_KEY = keyIn.value.trim();
      next.POS_CURRENCY = env.POS_CURRENCY || "MYR";
      this.plugin.writeEnvFile(next);
      S.llmUrl = next.SILICONFLOW_API_URL; S.llmModel = next.SILICONFLOW_MODEL;
      await this.plugin.saveSettings();
      new Notice("✅ 已保存到 " + envPath);
      this.render();
    });

    this.section("通用");
    const gen = this.body.createDiv({ cls: "pos-chart-wrap" });
    // 语言：影响 AI 处理语言（分流/蒸馏/翻译）；界面双语将在后续版本提供
    const langRow = gen.createDiv({ cls: "pos-set-row" });
    const li = langRow.createDiv({ cls: "pos-set-info" });
    li.createDiv({ cls: "pos-set-name", text: "AI 处理语言 / AI Language" });
    li.createDiv({ cls: "pos-set-desc", text: "English 模式下 AI 分流与蒸馏输出英文（自动翻译中文输入）" });
    const langSel = langRow.createEl("select");
    [["zh", "中文"], ["en", "English"]].forEach(([v2, t]) => langSel.createEl("option", { text: t, value: v2 }));
    langSel.value = S.lang || "zh";
    langSel.addEventListener("change", async () => {
      S.lang = langSel.value;
      const next = this.plugin.readEnvFile();
      next.POS_LANG = S.lang;
      this.plugin.writeEnvFile(next);
      await this.plugin.saveSettings();
      new Notice(S.lang === "en" ? "✅ AI will process in English" : "✅ AI 处理语言：中文");
    });
    const curIn = row(gen, "币种符号", "看板显示用，默认 RM（账本记 MYR）", S.currency);
    curIn.addEventListener("change", async () => {
      S.currency = curIn.value.trim() || "RM";
      await this.plugin.saveSettings();
      new Notice("✅ 币种已更新");
    });
    const auto = gen.createDiv({ cls: "pos-set-row" });
    const ai = auto.createDiv({ cls: "pos-set-info" });
    ai.createDiv({ cls: "pos-set-name", text: "启动时自动打开本看板" });
    ai.createDiv({ cls: "pos-set-desc", text: "让 Personal OS 常驻为主界面" });
    const tg = auto.createEl("input", { attr: { type: "checkbox" } });
    tg.checked = S.autoOpen;
    tg.addEventListener("change", async () => { S.autoOpen = tg.checked; await this.plugin.saveSettings(); });

    this.section("路径");
    const paths = this.body.createDiv({ cls: "pos-chart-wrap" });
    const base = this.app.vault.adapter.basePath || "（移动端不可见）";
    [["库根目录", base], ["引擎 CLI", base + "/03-Agents/automation/bin/rtk"], ["手机队列", base + "/01-Inbox/.queue/"], ["密钥文件", envPath]].forEach(([n, v]) => {
      const r = paths.createDiv({ cls: "pos-set-row" });
      r.createDiv({ cls: "pos-set-info" }).createDiv({ cls: "pos-set-name", text: n });
      r.createDiv({ cls: "pos-set-desc", text: v });
    });

    this.section("💾 备份（库 + Hermes 核心 + Hindsight 数据 → 三个 tar.gz）");
    const bk = this.body.createDiv({ cls: "pos-chart-wrap" });
    const bkDest = row(bk, "备份目标目录", "默认 NAS：/Volumes/home/Hermas Backup/personal-os", env.POS_BACKUP_DEST || "/Volumes/home/Hermas Backup/personal-os");
    const bkLog = (await this.readSafe(".system/logs/backup.log")).trim().split("\n").pop() || "（从未备份）";
    const bkRow = bk.createDiv({ cls: "pos-set-row" });
    bkRow.createDiv({ cls: "pos-set-info" }).createDiv({ cls: "pos-set-desc", text: `上次备份：${bkLog}` });
    const bkBtns = bkRow.createDiv({ cls: "pos-actions" });
    let bkAutoOn = false;
    try { bkAutoOn = require("fs").existsSync(require("os").homedir() + "/Library/LaunchAgents/com.elson.hermes.backup.plist"); } catch {}
    const bkNow = bkBtns.createEl("button", { cls: "pos-btn", text: "立即备份" });
    bkNow.addEventListener("click", () => {
      try {
        const { execFile } = require("child_process");
        const base = this.app.vault.adapter.basePath;
        const next = this.plugin.readEnvFile();
        next.POS_BACKUP_DEST = bkDest.value.trim();
        this.plugin.writeEnvFile(next);
        new Notice("备份运行中…（NAS 大文件可能要一两分钟）");
        execFile("/bin/bash", [`${base}/03-Agents/automation/bin/rtk`, "backup"], { timeout: 600000 }, (err, out) => {
          new Notice(err ? "❌ 备份失败：" + err.message : "✅ 备份完成", 6000);
          this.render();
        });
      } catch { new Notice("当前环境不支持，请在终端运行 rtk backup"); }
    });
    const bkAuto = bkBtns.createEl("button", { cls: "pos-btn pos-btn-ghost", text: bkAutoOn ? "关闭自动备份（每日22:30）" : "开启自动备份（每日22:30）" });
    bkAuto.addEventListener("click", () => {
      try {
        const { execFile } = require("child_process");
        const base = this.app.vault.adapter.basePath;
        const next = this.plugin.readEnvFile();
        next.POS_BACKUP_DEST = bkDest.value.trim();
        this.plugin.writeEnvFile(next);
        execFile("/bin/bash", [`${base}/03-Agents/automation/bin/rtk`, "backup-auto", bkAutoOn ? "off" : "on"], { timeout: 30000 }, (err) => {
          new Notice(err ? "❌ " + err.message : "✅ 已" + (bkAutoOn ? "关闭" : "开启") + "自动备份");
          this.render();
        });
      } catch { new Notice("请在终端运行 rtk backup-auto on"); }
    });

    this.section("🗄 NAS 收件箱扫描（旧 OS 功能移植）");
    const nas = this.body.createDiv({ cls: "pos-chart-wrap" });
    const nasIn = row(nas, "NAS 投递目录", "夜巡扫描顶层文件：文本智能分流、文件归桶；原件移入其 archive/。填 off 关闭", env.POS_NAS_INBOX || "/Volumes/home/OS-Inbox");
    nasIn.addEventListener("change", () => {
      const next = this.plugin.readEnvFile();
      next.POS_NAS_INBOX = nasIn.value.trim();
      this.plugin.writeEnvFile(next);
      new Notice("✅ NAS 收件箱路径已保存（夜巡生效）");
    });

    this.section("📱 手机端");
    const mob = this.body.createDiv({ cls: "pos-chart-wrap pos-md" });
    await MarkdownRenderer.render(this.app, [
      "**现阶段（零开发）**：iOS 快捷指令三问 → 存文本到上方「手机队列」路径 → 夜巡自动消化。",
      "详细搭建步骤：[[.system/config/MOBILE-SETUP|MOBILE-SETUP]]",
      "",
      "**未来（原生 App）**：Desktop 功能稳定后开发真正的手机 App，经自托管 ingest API 直连本库，",
      "协议与桌面端一致（写 `.queue/`），届时本页会出现配对二维码与同步设置。",
    ].join("\n"), mob, "/", this);
  }
}

/* ================= 插件主体 ================= */
module.exports = class PersonalOSPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.registerView(VIEW_TYPE, (leaf) => new POSView(leaf, this));
    this.addRibbonIcon("brain-circuit", "Personal OS", () => this.activateDashboard());
    this.addRibbonIcon("message-circle-plus", "引导式记录", () => this.openCapture());
    this.addCommand({ id: "open-dashboard", name: "打开 Personal OS", callback: () => this.activateDashboard() });
    this.addCommand({ id: "guided-capture", name: "引导式记录（丢进 Inbox）", callback: () => this.openCapture() });
    this.addSettingTab(new POSSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.autoOpen && !this.app.workspace.getLeavesOfType(VIEW_TYPE).length) this.activateDashboard();
    });
  }
  async saveSettings() { await this.saveData(this.settings); }

  async activateDashboard() {
    const ex = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (ex.length) { this.app.workspace.revealLeaf(ex[0]); return; }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
  }

  /* ----- 库外密钥文件 ----- */
  envFilePath() {
    try { return require("os").homedir() + "/.personal-os/llm.env"; } catch { return "~/.personal-os/llm.env"; }
  }
  readEnvFile() {
    try {
      const fs = require("fs");
      const out = {};
      fs.readFileSync(this.envFilePath(), "utf8").split("\n").forEach((l) => {
        const m = l.match(/^([A-Z_]+)=(.*)$/);
        if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
      });
      return out;
    } catch { return {}; }
  }
  writeEnvFile(obj) {
    const fs = require("fs"), os = require("os");
    const dir = os.homedir() + "/.personal-os";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const body = Object.entries(obj).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
    fs.writeFileSync(this.envFilePath(), body, { mode: 0o600 });
  }

  /* ----- 引导式记录（共用管线） ----- */
  openCapture(after) {
    new FormModal(this.app, {
      icon: "🧠", title: "引导式记录",
      sub: "别整理、别分类，想到什么写什么。系统会自动拆分为日记 · 待办 · 账单 · 学习 · 画像。",
      fields: [
        { key: "p", label: "今天核心进展是什么？", type: "textarea", rows: 2, placeholder: "一句话或一段话，可留空" },
        { key: "a", label: "有产生新的待办或消费吗？", type: "textarea", rows: 2, placeholder: "如：记得明天交电费。午饭花了 RM15" },
        { key: "t", label: "还有什么随想要记录？", type: "textarea", rows: 2, placeholder: "灵感、学到的东西、情绪、碎碎念……" },
      ],
      submitText: "智能分流 ✓", hint: "⌘+Enter 智能分流 · 存原文 = 不提取，待每周蒸馏",
      secondary: {
        text: "存原文",
        handler: async (v) => {
          const text = [v.p, v.a, v.t].filter(Boolean).join("\n");
          if (!text) { new Notice("什么都没写哦"); return; }
          const dir = "01-Inbox/legacy/unprocessed";
          if (!(await this.app.vault.adapter.exists(dir))) await this.app.vault.adapter.mkdir(dir);
          await this.app.vault.adapter.write(`${dir}/note-${nowStamp()}.md`,
            `---\ntype: raw\nstatus: inbox\ncreated: ${today()}\ntags: [unprocessed]\n---\n\n${text}\n`);
          new Notice("✅ 原文已存 unprocessed（不提取，每周日蒸馏扫描）", 5000);
          if (after) after();
        },
      },
    }, async (v) => {
      const text = [v.p, v.a, v.t].filter(Boolean).join("\n");
      if (!text) { new Notice("什么都没写哦"); return; }
      const dir = "01-Inbox/.queue";
      if (!(await this.app.vault.adapter.exists(dir))) await this.app.vault.adapter.mkdir(dir);
      await this.app.vault.adapter.write(`${dir}/q-desktop-${nowStamp()}.txt`, text);
      new Notice("✅ 已入队智能分流。夜巡自动归档（原文存 mobile-notes），或运维页「立即巡检」马上处理", 5000);
      if (after) after();
    }).open();
  }

  /* ----- Profile 向导 ----- */
  profileWizard(after) {
    new ChoiceModal(this.app, {
      icon: "🪪", title: "Profile 设定向导",
      sub: "选择一个维度，引导式填写。写入 02-Memory/static/os/profile/（你亲手操作 = 已授权）",
      choices: PROFILE_ASPECTS,
    }, (aspect) => {
      new FormModal(this.app, {
        icon: aspect.icon, title: aspect.title,
        sub: aspect.prompts,
        fields: [
          { key: "title", label: "标题", placeholder: `如：${aspect.title.split(" ")[0]}-2026` },
          { key: "content", label: "内容（参考上方引导问题，自由书写）", type: "textarea", rows: 7, placeholder: aspect.prompts },
        ],
        require: "content", submitText: "写入 Profile ✓",
      }, async (v) => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        const p = `02-Memory/static/os/profile/${aspect.dir}/${slug(v.title || aspect.id)}.md`;
        const md = `---\ntitle: ${v.title || aspect.title}\ntype: memory\nstatus: active\ncreated: ${today()}\nupdated: ${today()}\ntags: [profile, ${aspect.id}]\n---\n\n# ${v.title || aspect.title}\n\n${v.content}\n`;
        if (view) await view.writeNote(p, md);
        new Notice(`✅ 已写入 ${aspect.title}`);
        if (after) after();
      }).open();
    }).open();
  }

  /* ----- 记一笔 ----- */
  addExpense(view, after) {
    new FormModal(this.app, {
      icon: "💰", title: "记一笔", sub: "直接写入本月账本，财务页实时更新",
      fields: [
        { key: "item", label: "项目", placeholder: "如：午餐 / Grab / 订阅" },
        { key: "amount", label: "金额（支出填正数即可；收入加 + 号）", type: "text", placeholder: "15.50 或 +3000" },
        { key: "cat", label: "分类", type: "select", options: ["餐饮", "交通", "居住", "订阅", "设备", "学习", "医疗", "人情", "娱乐", "其他", "收入"] },
        { key: "chan", label: "渠道", placeholder: "如：TnG / 现金 / 银行卡（可留空）" },
      ],
      require: "amount", submitText: "入账 ✓",
    }, async (v) => {
      let amt = parseFloat(v.amount.replace("+", ""));
      if (isNaN(amt)) { new Notice("金额格式不对"); return; }
      if (!v.amount.includes("+")) amt = -Math.abs(amt);
      const ym = thisYM();
      const p = `02-Memory/dynamic/ops-log/cost-${ym}.md`;
      const header = `# 账本 ${ym}\n\n| 日期 | 项目 | 金额 | 币种 | 分类 | 渠道 | 备注 |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
      await view.appendTo(p, `| ${today()} | ${v.item || "未命名"} | ${amt.toFixed(2)} | MYR | ${v.cat} | ${v.chan} | |\n`, header);
      new Notice(`✅ 已入账 RM ${Math.abs(amt).toFixed(2)}`);
      if (after) after();
    }).open();
  }

  /* ----- 目标 / 任务 ----- */
  createGoal(view, after) {
    new FormModal(this.app, {
      icon: "🎯", title: "设定目标", sub: "写入目标库（可被 Active-Context 与任务双链引用）",
      fields: [
        { key: "title", label: "目标名称", placeholder: "如：2026 完成 Personal OS 手机 App" },
        { key: "why", label: "为什么重要？", type: "textarea", rows: 2, placeholder: "动机与意义" },
        { key: "done", label: "完成的标准是什么？", type: "textarea", rows: 2, placeholder: "可验证的判定条件" },
        { key: "due", label: "期限", type: "date" },
      ],
      require: "title", submitText: "写入目标库 ✓",
    }, async (v) => {
      const p = `02-Memory/static/os/profile/goals/${slug(v.title)}.md`;
      const md = view.fm(v.title, "memory", "tags: [profile, goals]\n") +
        `# 🎯 ${v.title}\n\n## 为什么\n\n${v.why || "（待补）"}\n\n## 完成标准\n\n${v.done || "（待补）"}\n\n## 期限\n\n${v.due || "未设定"}\n\n## 关联任务\n\n（在任务清单中用 #goal/${slug(v.title)} 标记即可关联）\n`;
      await view.writeNote(p, md);
      if (after) after();
    }).open();
  }
  createTask(view, after) {
    new FormModal(this.app, {
      icon: "✅", title: "新任务", sub: "直接进入集中任务清单 tasks.md",
      fields: [
        { key: "text", label: "做什么？（动词开头，≤30字）", placeholder: "如：给服务器换证书" },
        { key: "due", label: "截止日", type: "date" },
        { key: "prio", label: "优先级", type: "select", options: ["中", "高", "低"] },
        { key: "tag", label: "关联标签（项目/目标，可留空）", placeholder: "如 project/personal-os 或 goal/xxx" },
      ],
      require: "text", submitText: "加入清单 ✓",
    }, async (v) => {
      const prio = { "高": " ⏫", "中": "", "低": " 🔽" }[v.prio] || "";
      const due = v.due ? ` 📅 ${v.due}` : "";
      const tag = v.tag ? ` #${v.tag.replace(/^#/, "")}` : "";
      const id = ` ^task-${nowStamp().replace(/[-T]/g, "").slice(0, 12)}`;
      await view.appendTo("02-Memory/dynamic/ops-log/tasks.md",
        `- [ ] ${v.text}${prio}${due}${tag}${id}\n`, "# 任务清单\n\n");
      new Notice("✅ 已加入任务清单");
      if (after) after();
    }).open();
  }

  /* ----- 项目 ----- */
  createProject(view, after) {
    new FormModal(this.app, {
      icon: "📦", title: "创建项目", sub: "引导式项目描述 → static/projects/",
      fields: [
        { key: "name", label: "项目名称", placeholder: "如：Personal OS 手机 App" },
        { key: "desc", label: "一句话描述（做什么、为谁、价值）", type: "textarea", rows: 2 },
        { key: "phase", label: "当前阶段", type: "select", options: ["构思", "规划", "进行中", "收尾", "暂停"] },
        { key: "imp", label: "重要性", type: "select", options: ["high", "mid", "low"] },
        { key: "next", label: "下一步行动是什么？", type: "textarea", rows: 2, placeholder: "具体、可执行的第一步" },
      ],
      require: "name", submitText: "创建项目 ✓",
    }, async (v) => {
      const p = `02-Memory/static/projects/${slug(v.name)}.md`;
      const md = `---\ntitle: ${v.name}\ntype: project\nstatus: active\nproject-phase: ${v.phase}\nimportance: ${v.imp}\ncreated: ${today()}\nupdated: ${today()}\ntags: [project]\n---\n\n# 📦 ${v.name}\n\n## 描述\n\n${v.desc || "（待补）"}\n\n## 下一步\n\n- [ ] ${v.next || "定义第一步"}\n\n## 决策记录\n\n| 日期 | 决策 | 原因 |\n| --- | --- | --- |\n`;
      await view.writeNote(p, md);
      if (after) after();
    }).open();
  }

  /* ----- 学习 / Wiki ----- */
  createLearning(view, after) {
    new FormModal(this.app, {
      icon: "📚", title: "学习笔记", sub: "成块知识 → dynamic/raw/learning/（区别于日记流水）",
      fields: [
        { key: "topic", label: "主题", placeholder: "如：launchd 与 TCC 机制" },
        { key: "content", label: "学到了什么？（核心要点）", type: "textarea", rows: 5 },
        { key: "src", label: "来源（书/课程/链接，可留空）" },
      ],
      require: "content", submitText: "保存笔记 ✓",
    }, async (v) => {
      const y = String(new Date().getFullYear());
      const p = `02-Memory/dynamic/raw/learning/${y}/learning-${today()}-${slug(v.topic)}.md`;
      const md = `---\ntitle: ${v.topic || "学习笔记"}\ntype: raw\nstatus: active\ncreated: ${today()}\ntags: [learning]\n---\n\n## ${v.topic || "未命名主题"}\n\n${v.content}\n${v.src ? `\n> 来源：${v.src}\n` : ""}`;
      await view.writeNote(p, md);
      if (after) after();
    }).open();
  }
  async createWiki(view, after) {
    const cats = (await view.listSafe("02-Memory/static/learning/wiki")).folders.map((f) => f.split("/").pop());
    new FormModal(this.app, {
      icon: "🌐", title: "Wiki 条目", sub: "沉淀进长期知识体系 static/learning/wiki/",
      fields: [
        { key: "title", label: "条目名称", placeholder: "如：复利思维" },
        { key: "cat", label: "分类", type: "select", options: cats.length ? cats : ["General"] },
        { key: "content", label: "正文（是什么 / 为什么重要 / 怎么用）", type: "textarea", rows: 6 },
      ],
      require: "title", submitText: "写入 Wiki ✓",
    }, async (v) => {
      const p = `02-Memory/static/learning/wiki/${v.cat}/${slug(v.title)}.md`;
      const md = view.fm(v.title, "wiki", "tags: [wiki]\n") + `# ${v.title}\n\n${v.content || ""}\n`;
      await view.writeNote(p, md);
      if (after) after();
    }).open();
  }

  /* ----- 产出生成器 ----- */
  generateOutput(view, type, after) {
    new FormModal(this.app, {
      icon: type.icon, title: `生成 ${type.title}`, sub: `按模版创建到 ${type.dir}/`,
      fields: [
        { key: "title", label: "标题 / 周期", placeholder: type.id === "report" ? "如 2026-W24 或 2026-06" : "标题" },
        { key: "note", label: "备注 / 主题方向（可留空）", type: "textarea", rows: 2 },
      ],
      require: "title", submitText: "生成 ✓",
    }, async (v) => {
      let body = type.tpl ? await view.readSafe(type.tpl) : "";
      if (body) {
        body = body.replace(/\{\{[^}]*\}\}/g, (m) =>
          m.includes("日期") || m.includes("YYYY-MM-DD") ? today() :
          m.includes("周期") || m.includes("Www") ? v.title : v.title);
      } else {
        body = view.fm(v.title, "output", "status: draft\n") + `# ${v.title}\n\n${v.note || ""}\n`;
      }
      const p = `${type.dir}/${type.id}-${slug(v.title)}.md`;
      const ym = thisYM();
      // 产出闭环：草稿自带 Agent Brief（指令 + 数据引用清单）
      const brief = `\n\n---\n\n## 🤖 Agent Brief（完成后删除本区块）\n\n` +
        `> 把下面的指令粘贴给 Hermes Console 或 Claude：\n\n` +
        `\`\`\`\n请完成产出草稿 ${p}：\n` +
        `1. 读取数据源：02-Memory/dynamic/ops-log/（本期日报）、cost-${ym}.md（账本）、dynamic/journal/（日记）\n` +
        `2. 主题方向：${v.note || v.title}\n` +
        `3. 按草稿现有结构补写完整内容，数据必须可溯源，禁止编造；private 内容不得引用\n` +
        `4. 完成后删除 Agent Brief 区块，但保持 status: draft 由我审阅\n\`\`\`\n`;
      await view.writeNote(p, body + brief);
      const cmd = `请完成产出草稿 ${p}：读取 ops-log/账本/日记数据源，主题「${v.note || v.title}」，按草稿结构补写完整内容（数据可溯源、不编造、不引用 private），完成后删除 Agent Brief 区块，保持 status: draft 待我审阅。`;
      try { await navigator.clipboard.writeText(cmd); } catch {}
      new Notice("✅ 草稿已生成，Agent 指令已复制——粘贴给 Hermes Console 即可补写完整内容", 8000);
      if (after) after();
    }).open();
  }
};

/* ================= Obsidian 设置页入口 ================= */
class POSSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Personal OS 设置")
      .setDesc("LLM、币种、路径、手机端配置都在看板的「⚙️ 设置」页里")
      .addButton((b) => b.setButtonText("打开看板设置页").setCta().onClick(() => {
        this.plugin.activateDashboard();
      }));
  }
}
