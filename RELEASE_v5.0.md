# Token买手 v5.0 — 合并版（数据架构 + 硬性验证门禁）

把两条平行分支合为统一终版：
- **v4.1 的强项**——`data/token-plans.json` 单一数据源（价格不再散落 3 处）、溯源编码进数据（`source_url` + `confidence` + `as_of`）、推荐质量（画像反推 / 组合套餐 / 必写短板 / 避坑 / 三段式 / 速查卡 / 预算分档）、第三方抓取文件瘦身（剔除 ToS 全文）。
- **v7.4 的强项**——自动化验证门禁，本次以"读 `confidence` 字段自动触发"的方式重新加回。

## 🔧 本次关键修复
- **修掉 v4.1 的隐藏 bug**：原 `reverse_calc.js` 判断 `p.confidence` 来标估算值，但 `confidence` 字段在 `api_base_prices[price_key]` 上、不在 plan 上，导致 `~` 估算标记**永不显示**、门禁形同虚设。已改为读 `price.confidence`。
- **加回硬性 Sanity Check 门禁**（算完即拦，不靠自觉）：
  - `⛔ NEEDS_REVIEW`：`confidence: estimated` → 推荐前必须 WebFetch 复核
  - `⛔ PREMIUM`：折扣率 > 100% → 标"卖附加价值而非 token 折扣"
  - `⚠️ SUSPICIOUS`：折扣率 < 0.5% → 异常便宜，疑似算错
  - `⚠️ CACHE_NO_PRICE`：有 cache token 量但缺 cache 单价 → 无法折算
  - 末尾输出**摘要 + 可信任判定**
- **cache token 折算支持**：识别套餐的 `cache_tokens_per_month` + `cache_price_key`，折算进等效 API 价值；缺单价时标 `⚠️ CACHE_NO_PRICE`，**绝不臆造 cache 单价**（守 R0 铁律）。
- **删除 v7.4 专属脚本** `report_generator.js` / `model_matcher.js`（已被 v4.1 架构取代）。

## 📦 安装
```bash
cd ~/.workbuddy/skills
git clone https://github.com/dalaoshibibibi/token-buyer.git token-buyer
```
重启 WorkBuddy 即识别。核心能力零外部依赖：`reverse_calc.js` / `scraper.js` / `price_normalizer.py` 仅需 Node / Python 内置库。

## 🚀 快速验证
```bash
node scripts/reverse_calc.js   # 跑完看末尾 Sanity Check 摘要
```

## ⚠️ 开源说明
仅含自有创作（脚本 / 规则 / 方法论）+ 自有整理数据 `token-plans.json`（带来源与置信度）+ 纯合成样例 `sample.json`。第三方平台抓取快照不随仓库分发。

MIT License。欢迎 Issue / PR 🚀
