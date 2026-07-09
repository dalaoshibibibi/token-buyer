# Token买手 v7.4 — AI 算力采购决策专家

把「API 中转站」和「Token Plan 订阅」两类 AI 算力采购渠道，批量解析、交叉验证、反推真实折扣率，并直接告诉你「买谁」。

## ✨ 核心能力

- **双赛道分离**：API 中转站（按量付费，搜模型名出价）与 Token Plan（包月订阅，按场景推荐）永不混在一份报告里。
- **真实折扣反推**：每个套餐都用真实 API 单价反算「等效 API 价值」和「折扣率」，让「省 90%」这类话有据可依。
- **数据铁律**：未从官方页面亲自验证的数据绝不进报告；输出全部带来源 URL + 验证日期。
- **内置验证层**：`report_generator.js` 自动跑 Sanity Check，折扣率 >100%、token 量异常、同类偏离 3x 等情况触发即标「⚠️ 需人工核查」。

## 🛣️ 两条赛道

| 赛道 | 触发词 | 交付物 |
|------|--------|--------|
| 🔄 API 中转站 | 中转站 / API / 具体模型名（如 DeepSeek V4 Pro） | 单模型跨平台对比卡 + 全量价格表 |
| 📦 Token Plan | Token Plan / 套餐 / 订阅 / MiniMax / GLM / Kimi / Qwen | 平台概览卡 + 统一对比大表 + 逐平台详情 + 决策推荐 |

## 📦 安装（WorkBuddy）

```bash
# 克隆到 WorkBuddy 用户级 skills 目录
cd ~/.workbuddy/skills
git clone https://github.com/dalaoshibibibi/token-buyer.git token-buyer
```

重启 WorkBuddy 即自动识别。核心能力 **零外部依赖**：`report_generator.js` / `model_matcher.js` 只用 Node 内置 `fs`/`path`，无需联网、无需 `npm install` 即可直接出报告。

可选依赖（仅爬取新数据 / 生成 Excel）：`pandas`+`openpyxl`、`axios`+`playwright-core`、伴生 `companion-skills/browser`（Puppeteer）。详见 README 第五节。

## 🚀 快速用法

```bash
# 赛道 B：生成全部已收录 Token Plan 平台的对比分析（JSON）
node scripts/report_generator.js --track token-plan

# 赛道 A：搜某模型在各中转站的价格
node scripts/model_matcher.js "DeepSeek V4 Pro"
```

## 📂 仓库结构

- `SKILL.md` + `CHANGELOG.md`（v7.4）— Skill 主文档与版本演进
- `scripts/` — 5 个脚本（report_generator / model_matcher / price_normalizer / scraper / reverse_calc）
- `references/` — 知识库（模型别名 / 平台规则 / 真实单价 / Token Plan 规则）
- `templates/` — 双赛道输出格式规范
- `data/` — 仅含纯合成 `sample.json` 格式样例（原始抓取快照不进开源仓库）
- `companion-skills/browser/` — Puppeteer 伴生插件

## ⚠️ 开源说明

本仓库仅包含**自有创作**（脚本、规则、方法论）与**纯合成**的格式样例。各平台的原始价目抓取快照与第三方条款文本**不随仓库分发**，请按需自行抓取生成，避免分发第三方版权与专有数据。

## 📄 许可证

[MIT](./LICENSE) — 自由使用、修改、再分发，含商业用途。

欢迎提 Issue / PR 一起完善 🚀
