# CHANGELOG — Token买手 AI算力采购决策专家

## v5.0 — 2026-07-17：合并 v4.1 + v7.4 硬性验证门禁
**合并动机**：v4.1（数据架构 / 推荐质量）与 v7.4（自动化验证门禁）是两条平行分支，各有对方没有的好东西。本次合并为统一终版。

**核心改动**：
1. **加回硬性 Sanity Check 门禁**（来自 v7.4，但改为读 `confidence` 字段自动触发）：
   - 修复 v4.1 `reverse_calc.js` 的 bug——原代码判断 `p.confidence`，但 `confidence` 字段在 `api_base_prices[price_key]` 上、不在 plan 上，导致估算标记 `~` **永不显示**、门禁形同虚设。改为读 `price.confidence`。
   - 门禁四档：`⛔ NEEDS_REVIEW`（estimated 单价必复核）/ `⛔ PREMIUM`（折扣率>100%）/ `⚠️ SUSPICIOUS`（折扣率<0.5% 异常便宜）/ `⚠️ CACHE_NO_PRICE`（有 cache 量缺 cache 单价）。
   - 末尾输出 **Sanity Check 摘要 + 可信任判定**，凡带 `⛔` 的项 AI 禁止在 WebFetch 复核前下"买它"结论。
2. **cache token 折算支持**：`reverse_calc.js` 识别套餐的 `cache_tokens_per_month` + `cache_price_key`，折算进等效 API 价值；缺单价时标 `⚠️ CACHE_NO_PRICE`，**绝不臆造 cache 单价**（守 R0 铁律）。
3. **删除 v7.4 专属脚本**：`report_generator.js` / `model_matcher.js` 已被 v4.1 的 `token-plans.json` 单一数据源 + `reverse_calc.js` + `scraper.js` + `price_normalizer.py` 架构取代，移除以消歧义。

**现版本状态**：数据架构（v4.1 胜出）+ 推荐质量（v4.1 胜出）+ 安全闸门（v7.4 胜出）三者合一。

## v4.1 — 2026-07-16：结构重构 + 数据源统一
**问题诊断**：v4.0 的价格数据散落在 3 处（token-plan-rules.md / api-base-price.md / reverse_calc.js 硬编码），更新一处漏两处必然漂移；SKILL.md 300+ 行且把 6 月底的价格结论写死，过期后会误导推荐。

**核心改动**：
1. **数据源统一**：新增 `data/token-plans.json` 作为唯一数据源（套餐 + API 单价 + Credits 兑换率，每条带 source_url 和 as_of 日期）；`reverse_calc.js` 改为读取该文件，references 文档只留方法论
2. **SKILL.md 精简**：约 300 行 → 约 150 行；版本演进移到本文件；输出规范去重（以 templates/output-template.md 为准）
3. **时效性规则**：所有硬编码价格结论标注数据日期，新增强制规则"推荐前必须 WebFetch 复核最新价格"
4. **脚本修复**：
   - `price_normalizer.py`：修复 data 目录路径错误（原指向 scripts/data）、修复 `[${k}]` JS 语法混入
   - `scraper.js`：补齐 yunwu / haoshuang / apikeyfun 平台配置（可行性表声称可用但脚本缺失）
5. **data/ 瘦身**：apikeyfun 4 个变体文件合并为 1 个样本
6. **修复编号**：token-plan-rules.md 3.3→3.5 跳号，补 Command Code 条目

## v4.0 — 2026-06-28：真实 API 单价反推 + 使用画像 + 组合套餐
**问题诊断**：v3.0 格式虽然对了，但价格数据缺乏验证，"每万token成本"是估算而非真实 API 单价反推，用户没法信任推荐结论。

**核心改动**：
1. 新增能力C — 真实折扣反推：用各平台旗舰模型真实 API 单价反算每个套餐的"等效 API 价值 + 实际折扣率"
2. 新增使用画像反推：触发对比时先问月均调用/主要场景/团队规模，用答案反推档位
3. 新增组合套餐方案：报告包含组合方案 vs 单套餐的对比
4. 新增强制规则：真实折扣必算、使用画像必问、组合方案必列
5. 重写输出模板为 v4.0 三段式

**当时的数据快照**（2026-06-28，仅作历史记录，勿直接引用）：
- 多数 Token Plan 折扣率在 1%-5%（约 API 价的 1/20 ~ 1/100）
- Kimi Moderato 折扣率 0.8% 当时最低（纯文本无多模态）
- Qwen 坐席折扣率 > 100%，卖的是"团队管理 + 模型超市"而非 token 折扣
- 组合 "Kimi ¥79 + MiniMax ¥119" 覆盖面优于单买 Ultra ¥469

## v3.0 — 2026-06-27：从"数据堆砌"到"直接决策"
**问题诊断**：v2.0 的输出全是数据表格，用户看完不知道买谁。

**核心改动**：
1. 输出重构为三段式：分析过程 + 按预算分档推荐 + 速查卡片
2. 新增强制规则：必写短板、必列避坑清单、必按预算分档、必附速查卡
3. 触发词扩展："我该买谁"、"丢链接→自动入库+对比"
4. 新增平台：Command Code AI、通义千问 Qwen

## v2.0 — 2026-06-27：Token Plan 分析能力 + 爬取层
- 新增能力B（Token Plan 对比），WebFetch 驱动数据采集
- 新增 Step0 爬取层（API 探测 → 浏览器自动化 → 引导导出）
- 收录 MiniMax、GLM、Kimi 三大 Token Plan

## v1.0 — 2026-06-26：基础版
- 三大 API 中转站比价（GeekNow、GrsAI、APIMart）
- Excel 导入 + 价格标准化 + 跨平台对齐
- 多 Sheet 对比表 + MD 报告
