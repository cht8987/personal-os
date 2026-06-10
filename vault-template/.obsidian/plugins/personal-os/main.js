/* Personal OS — 引导式提问输入插件
 * 三个引导问题 → 拼合文本 → 写入 01-Inbox/.queue/ → 与手机端共用同一条 ingest 管线
 */
const { Plugin, Modal, Notice } = require("obsidian");

const QUESTIONS = [
  { key: "progress", label: "今天核心进展是什么？", placeholder: "一句话或一段话，可留空" },
  { key: "actions",  label: "有产生新的待办或消费吗？", placeholder: "如：记得明天交电费。午饭花了38块" },
  { key: "thoughts", label: "还有什么随想要记录？", placeholder: "灵感、情绪、碎碎念……" },
];

class GuidedCaptureModal extends Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.answers = {};
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "🧠 Personal OS · 引导式记录" });
    contentEl.createEl("p", {
      text: "别整理、别分类，想到什么写什么。系统会自动拆分为日记 / 待办 / 账单 / 学习 / 画像。",
      cls: "setting-item-description",
    });
    this.inputs = QUESTIONS.map((q) => {
      contentEl.createEl("h5", { text: q.label });
      const ta = contentEl.createEl("textarea", {
        attr: { rows: 3, placeholder: q.placeholder, style: "width:100%;margin-bottom:8px;" },
      });
      return { key: q.key, el: ta };
    });
    const btnRow = contentEl.createEl("div", { attr: { style: "text-align:right;margin-top:12px;" } });
    const submit = btnRow.createEl("button", { text: "丢进 Inbox ✓", cls: "mod-cta" });
    submit.addEventListener("click", () => this.submit());
    // Cmd/Ctrl+Enter 快捷提交
    contentEl.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") this.submit();
    });
    this.inputs[0].el.focus();
  }
  submit() {
    const text = this.inputs
      .map((i) => i.el.value.trim())
      .filter(Boolean)
      .join("\n");
    if (!text) { new Notice("什么都没写哦"); return; }
    this.onSubmit(text);
    this.close();
  }
  onClose() { this.contentEl.empty(); }
}

module.exports = class PersonalOSPlugin extends Plugin {
  async onload() {
    this.addRibbonIcon("brain-circuit", "Personal OS：引导式记录", () => this.openCapture());
    this.addCommand({
      id: "guided-capture",
      name: "引导式记录（丢进 Inbox）",
      callback: () => this.openCapture(),
    });
  }

  openCapture() {
    new GuidedCaptureModal(this.app, (text) => this.enqueue(text)).open();
  }

  async enqueue(text) {
    const adapter = this.app.vault.adapter;
    const dir = "01-Inbox/.queue";
    if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const path = `${dir}/q-desktop-${ts}.txt`;
    await adapter.write(path, text);
    new Notice("✅ 已入队。今晚 23:30 自动归档\n（或终端运行 rtk patrol 立即处理）", 6000);
  }
};
