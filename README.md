# Token买手 — AI 算力采购决策专家

> 一个把「API 中转站」和「Token Plan 订阅」两类 AI 算力采购渠道，批量解析、交叉验证、算出真实折扣率，并直接告诉你「买谁」的 WorkBuddy Skill。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-v7.4-blue.svg)](./CHANGELOG.md)

---

## 一、这是什么

你在选 AI 算力（模型 API / Coding Plan / Token Plan）时，最大的痛点是：

- 各平台计费模型完全不同（信用额度制 / Prompt 次数制 / Agent 档位制 / Credit 积分制），**根本不能直接比单价**；
- 很多「套餐」标着「省 90%」，实际用官方 API 单价反推后根本不是那么回事；
- 平台数据鱼龙混杂，二手汇总站经常过时甚至造假。

**Token买手** 解决这三件事：

1. **双赛道分离**：API 中转站（按量付费，搜模型名出价）和 Token Plan（包月订阅，按场景推荐）永不混在一份报告里。
2. **真实折扣反推**：每个套餐都用真实 API 单价反算「等效 API 价值」和「折扣率」，让「省 90%」这类话有据可依。
3. **数据铁律**：未从官方页面亲自验证的数据，绝不进报告。你想看的全是带来源 URL + 验证日期的结论。

终极目标：**用户看完报告直接知道「买谁」，不允许只有数据表格没有结论。**

---

## 二、两条赛道

| 赛道 | 触发词 | 交付物 |
|------|--------|--------|
| 🔄 **API 中转站** | 中转站 / API / 具体模型名（如 DeepSeek V4 Pro） | 单模型跨平台对比卡 + 全量价格表 |
| 📦 **Token Plan** | Token Plan / 套餐 / 订阅 / MiniMax / GLM / Kimi / Qwen | 平台概览卡 + 统一对比大表 + 逐平台详情 + 决策推荐 |

> 无法识别赛道时，Skill 会反问：「你要比 API 中转站（按量付费）还是 Token Plan（包月订阅）？」

---

## 三、文件结构

```
token-buyer/
├── SKILL.md                      # Skill 主文档（能力 + 流程 + 铁律 + 质检清单）
├── CHANGELOG.md                  # 版本演进记录
├── README.md                     # 本文件
├── LICENSE                       # MIT
├── package.json                  # 可选 Node 依赖声明
├── requirements.txt              # Python 依赖（price_normalizer.py）
├── .gitignore
│
├── scripts/                      # 全部数据处理脚本（纯本地，无外部调用）
│   ├── report_generator.js       # ⭐ 统一数据管道：读取→标准化→算折扣率→跑验证层→输出 JSON
│   ├── model_matcher.js          # 模型别名匹配 + 多平台价格查询
│   ├── price_normalizer.py       # 价格标准化 + 异常检测 + Excel 输出
│   ├── scraper.js                # 三层爬取（API 探测 / 浏览器 / 引导导出）
│   └── reverse_calc.js           # Token Plan 折扣率计算（已被 report_generator 整合，保留备用）
│
├── references/                   # 知识库（可编辑扩展）
│   ├── model-aliases.md          # 跨平台模型别名映射（如「DS V4 Pro」↔「deepseek-v4-pro」）
│   ├── platform-rules.md         # API 中转站计费规则 & 风险汇总
│   ├── api-base-price.md         # 各平台旗舰模型真实 API 单价（反推折扣用）
│   └── token-plan-rules.md       # Token Plan 套餐规则 & 限额数据
│
├── templates/
│   └── output-template.md        # 双赛道输出格式规范（AI 照此排版）
│
├── data/                         # 运行时数据（已附带示例快照，可刷新）
│   ├── *.json                    # 各平台抓取/整理的价目快照
│   └── README.md                 # 数据格式说明 + 如何重新生成
│
└── companion-skills/
    └── browser/                  # 🔌 伴生插件：Puppeteer 无头浏览器（scraper 的可选依赖）
        ├── SKILL.md
        ├── README.md
        └── index.js
```

---

## 四、安装（WorkBuddy）

### 方式 A：直接克隆到 skills 目录（推荐）

```bash
# 在你的 WorkBuddy 用户级 skills 目录
cd ~/.workbuddy/skills
git clone <你的仓库地址> token-buyer
```

克隆后目录应为 `~/.workbuddy/skills/token-buyer/`，WorkBuddy 重启即自动识别。

### 方式 B：手动复制

把本仓库内容复制到 `~/.workbuddy/skills/token-buyer/` 即可。

### 伴生浏览器插件（可选，仅爬取新数据时用到）

```bash
cp -R companion-skills/browser ~/.workbuddy/skills/browser
# 安装 puppeteer
cd ~/.workbuddy/skills/browser && npm install puppeteer
```

---

## 五、依赖

| 依赖 | 必需？ | 用途 | 安装 |
|------|--------|------|------|
| Node.js ≥ 18 | ✅ 必需 | 运行 `report_generator.js` / `model_matcher.js` / `scraper.js` | 自带 |
| Python ≥ 3.10 | ⚠️ 仅赛道 A 全量 Excel | 运行 `price_normalizer.py` | 系统自带 |
| `pandas` + `openpyxl` | ⚠️ 仅赛道 A Excel | 价格标准化与多 Sheet 输出 | `pip install -r requirements.txt` |
| `axios` + `playwright-core` | ⚠️ 仅爬取新数据 | `scraper.js` 三层爬取 | `npm install`（见 package.json） |
| `companion-skills/browser` + `puppeteer` | ⚠️ 仅爬取 JS 渲染页 | 无头浏览器渲染 | 见第四节 |
| WorkBuddy 飞书连接器 | ⚠️ 仅飞书交付 | 把报告推送为飞书云文档 | 在 WorkBuddy 内配置飞书 |

> **核心能力零外部依赖**：`report_generator.js` 和 `model_matcher.js` 只用 Node 内置 `fs`/`path`，**无需联网、无需 npm install** 即可直接出报告。

---

## 六、用法

### 赛道 B — Token Plan（最常用）

```bash
# 直接生成全部已收录平台的对比分析（JSON）
node scripts/report_generator.js --track token-plan

# 只看某个平台
node scripts/report_generator.js --track token-plan --platform "Open Code Go"
```

输出为结构化 JSON（供 AI 排版成报告），同时在 stderr 打印 **数据验证层摘要**（Sanity Check）。

### 赛道 A — API 中转站

```bash
# 搜某模型在各中转站的价格
node scripts/model_matcher.js "DeepSeek V4 Pro"

# 全量标准化对比 → Excel
python3 scripts/price_normalizer.py
```

### 刷新数据

```bash
# 三层爬取（API 探测 → 浏览器渲染 → 引导导出）
node scripts/scraper.js

# 或读取平台后台导出的 Excel，放入 data/ 后运行
python3 scripts/price_normalizer.py
```

---

## 七、数据铁律（为什么你可以信任它）

Skill 内置一套不可关闭的验证机制（`SKILL.md` 第四节）：

- **V1–V4**：硬编码任何平台数据前必须先 WebFetch 官方定价页，并保留推导注释 + 来源 URL。
- **R0**：未亲自验证的数据绝不进报告；`❓` 标注的猜测值只能内部暂存，不可输出给用户。
- **Sanity Check**：脚本自动检测折扣率 > 100%、token 量异常、同类偏离 3x 等，触发即标「⚠️ 需人工核查」。

> 真实教训：v7.0 之前曾因漏算 82,000 cache token，把 Open Code Go 折扣率错算成 393%（正确值 7.4%）。此后所有非标准计费平台都必须标注「锚点模型」和「估算值」，不得伪装成精确值。

---

## 八、如何扩展（贡献新平台）

1. **加模型别名**：编辑 `references/model-aliases.md`，让「DS V4 Pro」这类叫法能命中。
2. **加 API 中转站规则**：编辑 `references/platform-rules.md` + 把价目快照放入 `data/`。
3. **加 Token Plan 平台**：在 `scripts/report_generator.js` 的 `TOKEN_PLANS` 数组追加条目，**必须**包含 `source_url` + `last_verified`，并在注释里保留完整的折扣率推导过程（含 cache token、USD 额度、Credit 制等特殊处理）。
4. 跑一遍 `node scripts/report_generator.js --track token-plan`，确认 Sanity Check 无异常告警。
5. 提交 PR。

---

## 九、许可证

[MIT](./LICENSE) — 自由使用、修改、再分发，包括商业用途。

---

## 十、Roadmap

- [ ] 增加更多 Token Plan 平台（Cursor / Windsurf / 通义灵码 等）
- [ ] 中转站增加「充值倍率」维度自动计算
- [ ] 报告增加可视化图表（折扣率柱状图 / 价格热力图）
- [ ] 飞书交付模板化（一次配置，自动建表）

欢迎提 Issue / PR 一起完善 🚀
