#!/bin/bash
# PERSONAL OS 一键安装：vault 模板 + 引擎 + 夜间自动化
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/vault-template"

echo "==============================================="
echo "  🧠 PERSONAL OS 安装向导"
echo "==============================================="
echo
echo "请输入新库的存放路径（直接回车 = 默认 iCloud Obsidian 目录，可与手机同步）："
DEFAULT="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/PERSONAL OS"
read -r -p "> " DEST
DEST="${DEST:-$DEFAULT}"

if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
  echo "❌ 目标已存在且非空：$DEST"; exit 1
fi
mkdir -p "$DEST"
cp -R "$SRC/" "$DEST/"
chmod +x "$DEST/03-Agents/automation/bin/rtk"
echo "✅ 库已生成：$DEST"

echo
read -r -p "注册每晚 23:30 自动巡检（launchd）？[y/N] " yn
if [[ "${yn:-n}" =~ ^[Yy]$ ]]; then
  "$DEST/03-Agents/automation/bin/rtk" install-launchd
  echo "ℹ️  若巡检日志报 Operation not permitted："
  echo "   系统设置→隐私与安全性→完全磁盘访问权限→添加 python3 真实路径"
  echo "   （路径: $(python3 -c 'import os,sys;print(os.path.realpath(sys.executable))')）"
fi

echo
echo "🎉 安装完成！下一步："
echo "  1. 用 Obsidian 打开库：$DEST"
echo "  2. 设置→第三方插件→启用「Personal OS」插件"
echo "  3. 阅读库内 START-HERE.md（10 分钟上手）"
echo "  4. 终端运行: \"$DEST/03-Agents/automation/bin/rtk\" onboard"
echo
echo "  可选：export DEEPSEEK_API_KEY=...  开启 LLM 智能分流（不配置则用规则引擎）"
