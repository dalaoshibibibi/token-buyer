# Skill 名称：Token买手 AI算力采购决策专家
> 版本：v5.0 | 更新：2026-07-17 | 合并 v4.1（数据架构）+ v7.4（硬性验证门禁）| 版本历史见 CHANGELOG.md

## 一、技能定位与触发

### 1.1 核心用途
批量解析 API 平台价目表 + Token Plan 订阅套餐，三大能力：
- **能力A — API中转站比价**：跨平台模型对齐、价格统一换算、比价排序、风险标记
- **能力B — Token Plan 对比**：订阅套餐额度分析、窗口限制对比、每万token成本折算
- **能力C — 真实折扣反推**：用各平台真实 API 单价反算每个 Token Plan 的"等效 API 价值 + 实际折扣率"

**终极目标**：用户看完报告直接知道"我该买谁"，而不是面对一堆数据表格。
输出三段式：分析过程（看懂）→ 按预算推荐（决策）→ 速查卡片（秒查）。

### 1.2 触发话术
| 能力 | 命中任意即启动 |
|------|--------------|
| API中转站比价 | 对比API平台模型价格 / 算力成本哪个最低 / GPT-Gemini-DeepSeek-Grok价格汇总 / API充值方案测算 / 导入价目表做横向对比 |
| Token Plan 对比 | 对比所有 Token Plan / 对比所有渠道的价格 / 哪个套餐性价比最高 / 丢链接→自动入库+全量对比 |
| 通用 | "我该买谁" = 直接给结论，别让用户看表 |

### 1.3 输入支持
- **能力A**：Excel/CSV 导入（最可靠）→ 自动爬取（scraper.js）→ 引导导出（兜底）
- **能力B**：WebFetch 官方定价页 + 官方文档（/docs/ 路径查窗口限额）+ 第三方对比站交叉验证

## 二、执行工作流

### Step 0 — 数据源获取（三层降级）
1. **L1 API直连**：对 `/api/models`、`/api/pricing` 等预置端点发 GET，返回 JSON 含模型/价格即成功
2. **L2 浏览器自动化**：Playwright + 系统 Chrome（headless），渲染 JS 后提取表格/卡片/价格文本，适用 SPA 和反爬平台
3. **L3 引导导出**：输出分步指南，让用户在平台后台导出 Excel/CSV 放入 `data/`

### Step 1 — 读取与分类
- 自动识别格式：Excel / CSV / JSON / 网页抓取结果
- 区分 6 大类目：LLM对话 / 多模态 / 图像生成 / 视频生成 / 音频 / Embedding
- 区分计费模式：按 Token（输入/输出双价）vs 按次（单次单价），**禁止跨单位混比**

### Step 2 — 价格标准化（scripts/price_normalizer.py）
- 平台折扣规则见 `references/platform-rules.md`（APIMart 美元×7×0.8、GrsAI 积分双档、GeekNow 分组折扣）
- 统一单位：元/M tokens（对话）、元/次（图/视频）

### Step 3 — 跨模型名称匹配（references/model-aliases.md）
剔除 -latest/-preview/日期后缀 → 别名合并 → 归类 GPT / Gemini / DeepSeek / Grok 产品线

### Step 4 — 异常价格检测
任意模型某平台价格低于其他平台均值 50%，标记「⚠️低价渠道风险，建议小批量测试稳定性」

### Step 5 — API比价输出（能力A）
分产品线表格 + 全平台最低价/价差/溢价比例 + 充值性价比测算 → 输出 Excel + MD 报告

### Step 6 — Token Plan 分析（能力B+C）
1. **数据采集**：已收录平台读 `data/token-plans.json`；新平台按 `references/token-plan-rules.md` 的抓取指南 WebFetch
2. **⚠️ 时效复核（必做）**：`token-plans.json` 带 `as_of` 日期，推荐前必须 WebFetch 官方定价页复核关键数字，发现变化先更新 JSON 再出报告
3. **核心计算**（可直接运行 `node scripts/reverse_calc.js`）：
   - 等效 API 价值 = (套餐月token量 ÷ 1M) × 旗舰模型混合单价（(输入+输出)÷2）
   - 实际折扣率 = 月费 ÷ 等效 API 价值 × 100%（<5% 极高性价比 / 5-50% 合理 / >100% 溢价）
   - 折扣率 >100% 必须标注"卖的不是 token 折扣，是团队管理/模型超市等附加价值"
   - 每万token成本 = 月费 ÷ 月token量 × 10000
4. **使用画像反推**：用户未明确场景时，先问 3 个问题再推荐——
   月均调用（轻 <1K / 中 1K-10K / 重 >10K）、主要场景（纯代码/多模态/Agent/内容）、团队规模（个人/2-10人/10+）
5. **组合套餐视角**：报告必须含"组合方案 vs 单套餐"对比表（覆盖场景数、月总成本、关键短板）

## 三、输出规范

**完整格式以 `templates/output-template.md` 为准**，三段式结构不可省略：

```
第一部分 分析过程   → 真实折扣反推表 + 总览表 + 各维度对比，每个维度配一句"关键发现"
第二部分 决策推荐   → 使用画像反推 + 按预算分档（≤100/100-200/200-600/600-1500）+ 组合方案
                     每个推荐必含：✅为什么选它（2-3条）+ ⚠️不能做什么（必写，不隐恶）
第三部分 速查卡片   → 决策速查表（预算→买谁→一句话理由）+ 刚需对照表 + 避坑清单 + 折扣率排名
```

## 四、强制执行规则

### 4.0 硬性验证门禁（v5.0 加回，不可关闭）
`node scripts/reverse_calc.js` 跑完每个套餐会输出 **Sanity Check 摘要**，基于 `data/token-plans.json` 每条单价的 `confidence` 字段**自动触发**，AI 不得跳过：
- `⛔ NEEDS_REVIEW`：`confidence: "estimated"`（单价是估算值，非官方公开价）→ 推荐前**必须 WebFetch 官方定价页复核**，不得用陈旧/估算数字下"买它"的结论。
- `⛔ PREMIUM`：折扣率 > 100% → 该套餐卖的是团队管理/模型超市等附加价值，不是 token 折扣，报告须显式标注。
- `⚠️ SUSPICIOUS`：折扣率 < 0.5% → 异常便宜，疑似算错或促销，须复核计算口径。
- `⚠️ CACHE_NO_PRICE`：套餐带 `cache_tokens_per_month` 但缺 `cache_price_key` → 无法折算 cache，等效价值偏低，须补单价（**绝不臆造 cache 单价**）。
- 摘要末尾给判定：`⛔ 报告含未复核/异常项，发布前必须人工核查` 或 `✅ 可信任`。

> **铁律**：凡带 `⛔` 的项，AI **禁止**在未经 WebFetch 复核前输出"买它"的推荐。这是对 v7.4「Open Code Go 折扣率算成 393%」事故的硬性兜底——不靠自觉，靠脚本算完即拦。

### 4.1 数据层面
1. 按 Token / 按次数据隔离，禁止混合比价
2. GrsAI 必须同时输出小额充值、999 顶配两套单价
3. GeekNow 低价 GPT 系列强制标注渠道稳定性风险
4. 汇率统一 1 USD = 7 CNY，报告末尾标注可替换实时汇率
5. 所有价格数据标注来源 URL + 抓取时间
6. **时效复核必做**：推荐前 WebFetch 复核 `token-plans.json` 关键数字，不得直接引用陈旧结论

### 4.2 推荐层面
7. **必写短板**：每个推荐附 ⚠️ 明确列出该套餐不能做什么
8. **避坑必列**：报告必须包含"不推荐"清单，用直白语言说明原因
9. **预算分档必做**：按 <100 / 100-200 / 200-600 / 600+ 分档，不允许笼统推荐
10. **速查卡必附**：报告末尾必须有"预算→买谁→一句话理由"决策速查表
11. **真实折扣必算**：每个套餐必须反推折扣率，不允许只贴月费/额度
12. **使用画像必问**：未明确场景时先问 3 个问题
13. **组合方案必列**：必须含"组合套餐 vs 单套餐"对比表

### 4.3 交付层面
14. 双交付：聊天窗口贴核心结论 + MD 文件存档
15. 旧报告产出后删除，工作区只保留最新一份
16. 文件名强制带时间戳：`Token_Plan_Analysis_20260716_1543.md` / `API_Price_Compare_2026-07-16.xlsx`，禁止无时间戳通用文件名

## 五、爬取可行性速查表（实测于 2026-06 底，使用前复测）
| 平台 | 类型 | 抓取方式 | 状态 |
|------|------|---------|------|
| ZenmuxAI | API中转站 | ✅ API直连 /api/v1/models（137模型） | 可用 |
| HaoshuangAPI | API中转站 | ✅ API直连 /api/pricing（27模型） | 可用 |
| yunwu.ai | API中转站 | ✅ API直连 /api/pricing（227模型/30分组） | 可用 |
| APIKEY.FUN | API中转站 | ✅ Playwright（Cloudflare 挡直连） | 可用 |
| APIMart | API中转站 | ❌ JS SPA | 需Excel导出 |
| GrsAI | API中转站 | ❌ WAF 反爬 | 需Excel导出 |
| GeekNow | API中转站 | ⚠️ 端点存在需Token | 需凭证 |
| MiniMax / 智谱GLM / Kimi / Command Code / Qwen | Token Plan | ✅ WebFetch 官方定价页+文档 | 可用 |

## 六、文件说明
| 文件 | 作用 |
|------|------|
| `data/token-plans.json` | **唯一数据源**：套餐+API单价+Credits兑换率（带 as_of 日期与来源） |
| `scripts/scraper.js` | 三层爬取引擎，`node scripts/scraper.js [platform]` |
| `scripts/reverse_calc.js` | 折扣率反推，读取 token-plans.json，`node scripts/reverse_calc.js` |
| `scripts/price_normalizer.py` | 价格标准化/合并/异常检测，`python3 scripts/price_normalizer.py` |
| `references/platform-rules.md` | API中转站计费规则与风险 |
| `references/model-aliases.md` | 跨平台模型别名映射 |
| `references/token-plan-rules.md` | Token Plan 对比维度、平台档案、抓取指南 |
| `references/api-base-price.md` | 折扣反推方法论与计算示例 |
| `templates/output-template.md` | 输出报告模板（权威版本） |
| `CHANGELOG.md` | 版本演进记录 |

**首次启动建议**：优先 Excel 导入（最稳定）；自动爬取运行 `scraper.js`；Token Plan 对比先跑 `reverse_calc.js` 拿基线数据再 WebFetch 复核。
