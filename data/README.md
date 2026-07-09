# data/ — 运行时数据目录

本目录存放各 AI 算力平台的价目快照。Skill 运行时直接读取这里的 JSON，**无需联网**即可出报告。

> ⚠️ **开源仓库不含原始抓取数据**：`data/*.json` 原始快照（含第三方平台的定价 / 条款文本）已在 `.gitignore` 中忽略，不会进入 GitHub。仓库仅保留 `sample.json` 作为纯合成的格式样例。
> 克隆本仓库后，请用下方「如何刷新数据」自行生成 `data/*.json`，或在本地放入你自己的数据。

---

## 文件说明

| 文件 | 来源平台 | 内容 |
|------|----------|------|
| `haoshuang_scraped.json` | 好爽 API | `{ platform, scrape_time, group_ratio, models[] }` |
| `yunwu_scraped.json` | 云雾 AI | `{ success, message, data[] }` 全量模型价目 |
| `zenmux_scraped.json` | ZenmuxAI | 专用 API 抓取的全量模型 |
| `apikeyfun_*.json` | APIKEY.FUN | 含 `appConfig` / `tabData` 的页面快照 + 整理后的全量/剩余清单 |
| `scrape_report.json` | — | 最近一次 `scraper.js` 的运行摘要（各平台成功/失败/模型数） |

各平台 JSON 结构不完全一致（不同平台页面差异导致），但核心都是 **平台名 + 模型价格数组**。

---

## 推荐的数据格式（新增平台时）

为了让 `model_matcher.js` / `price_normalizer.py` 能命中，新增平台数据建议统一为：

```json
{
  "platform": "平台英文名",
  "scrape_time": "2026-07-01T12:00:00+08:00",
  "models": [
    {
      "name": "标准模型名（与 references/model-aliases.md 对齐）",
      "input_price": 0.0,    // 每百万 token 输入价（人民币）
      "output_price": 0.0,   // 每百万 token 输出价（人民币）
      "currency": "CNY",
      "source_url": "https://平台定价页"
    }
  ]
}
```

---

## 如何刷新数据

### 方法 1：自动爬取（推荐，需装依赖）

```bash
# 安装可选依赖
npm install            # 安装 axios + playwright-core

# 三层爬取：API 探测 → 浏览器渲染 → 引导导出
node ../scripts/scraper.js
```

- 对 JS 渲染页（如好爽 API），`scraper.js` 会自动调用 `playwright-core` 启动系统 Chrome；
- 未安装 playwright 时自动跳过浏览器层，仅做 API 探测；
- 需要登录的平台会在控制台提示「引导导出」，你从平台后台导出 Excel 放入 `data/` 即可。

### 方法 2：手动整理

1. 浏览器打开平台官方定价页，复制模型价目；
2. 按上方「推荐格式」写成 `data/<平台>.json`；
3. 在 `references/model-aliases.md` 补一条别名映射，确保能被搜到。

---

## 注意事项

- 本目录数据全部来自**公开网页**，不含任何密钥 / 账号 / 凭证；
- 刷新后建议同步更新 `references/api-base-price.md`（旗舰模型真实单价），否则折扣率反推会偏旧；
- 不要把带个人账号的 `credentials.json` 放进本目录（已在 `.gitignore` 忽略）。
