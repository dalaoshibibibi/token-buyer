#!/usr/bin/env node
/**
 * report_generator.js — Token买手统一数据管道
 * 
 * 用法:
 *   node report_generator.js --track api-proxy                    # 全量平台对比
 *   node report_generator.js --track api-proxy --model "DS V4 Pro" # 单模型对比
 *   node report_generator.js --track token-plan                   # Token Plan 全量对比
 *   node report_generator.js --track token-plan --budget 150      # 按预算筛选
 *
 * 输出: JSON 到 stdout，AI 读取后格式化为报告
 * 
 * 变更记录:
 *   v1.1 (2026-06-30)
 *     - 新增 validateTokenPlanData() 数据验证层
 *     - 修复 Open Code Go cache token 遗漏 (82,000 tokens/次)
 *     - 所有平台入口增加 source_url / last_verified 字段
 *     - 增加 stderr 验证摘要输出
 *   v1.0 (2026-06-28)
 *     - 初始版本：双赛道分离 + 别名映射 + Token Plan 计算
 */

const fs = require("fs");
const path = require("path");

const SKILL_DIR = path.resolve(__dirname, "..").replace(/\/scripts$/, "");
const DATA_DIR = path.join(SKILL_DIR, "data");
const REF_DIR = path.join(SKILL_DIR, "references");

// ─────────────────────────────────────────────
// 参数解析
// ─────────────────────────────────────────────
const args = process.argv.slice(2);
const track = getArg("--track") || "api-proxy";
const modelQuery = getArg("--model");
const budget = getArg("--budget") ? Number(getArg("--budget")) : null;

function getArg(key) {
  const idx = args.indexOf(key);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function loadJSON(filename) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function loadMD(filename) {
  const p = path.join(REF_DIR, filename);
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf8");
}

// ─────────────────────────────────────────────
// 别名映射（从 model-aliases.md 提取）
// ─────────────────────────────────────────────
const ALIAS_MAP = {
  "ds v4 pro": "deepseek-v4-pro",
  "deepseek v4 pro": "deepseek-v4-pro",
  "deepseek-v4-pro": "deepseek-v4-pro",
  "ds v4 flash": "deepseek-v4-flash",
  "deepseek v4 flash": "deepseek-v4-flash",
  "deepseek-v4-flash": "deepseek-v4-flash",
  "ds v4": "deepseek-v4-pro",
  "deepseek v4": "deepseek-v4-pro",
  "ds r1": "deepseek-r1",
  "deepseek r1": "deepseek-r1",
  "ds v3.2": "deepseek-v3.2",
  "deepseek v3.2": "deepseek-v3.2",
  "gpt 5.4": "gpt-5.4",
  "gpt-5.4": "gpt-5.4",
  "gpt 5.5": "gpt-5.5",
  "gpt-5.5": "gpt-5.5",
  "gpt 5.2": "gpt-5.2",
  "gpt-5.2": "gpt-5.2",
  "gpt 5.1": "gpt-5.1",
  "gpt-5.1": "gpt-5.1",
  "claude opus 4.8": "claude-opus-4-8",
  "claude-opus-4-8": "claude-opus-4-8",
  "claude opus 4.7": "claude-opus-4-7",
  "claude-opus-4-7": "claude-opus-4-7",
  "claude opus 4.6": "claude-opus-4-6",
  "claude-opus-4-6": "claude-opus-4-6",
  "claude sonnet 4.6": "claude-sonnet-4-6",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude sonnet 4.5": "claude-sonnet-4-5-20250929",
  "claude haiku 4.5": "claude-haiku-4-5-20251001",
  "gemini 2.5 pro": "gemini-2.5-pro",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini 2.5 flash": "gemini-2.5-flash",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini 3 pro": "gemini-3-pro-preview",
  "gemini 3 flash": "gemini-3-flash-preview",
  "glm 5.2": "glm-5.2",
  "glm-5.2": "glm-5.2",
  "glm 5.1": "glm-5.1",
  "glm-5.1": "glm-5.1",
  "glm 5": "glm-5",
  "glm-5": "glm-5",
  "glm 4.7": "glm-4.7",
  "glm-4.7": "glm-4.7",
  "glm 4.5": "glm-4.5",
  "glm-4.5": "glm-4.5",
  "kimi k2.7": "kimi-k2.7-code",
  "kimi k2.6": "kimi-k2.6",
  "kimi k2.5": "kimi-k2.5",
  "kimi-k2.7-code": "kimi-k2.7-code",
  "kimi-k2.6": "kimi-k2.6",
  "kimi-k2.5": "kimi-k2.5",
  "minimax m3": "minimax-m3",
  "minimax m2.7": "minimax-m2.7",
  "minimax m2.5": "minimax-m2.5",
  "minimax-m3": "minimax-m3",
  "minimax-m2.7": "minimax-m2.7",
  "minimax-m2.5": "minimax-m2.5",
  "qwen 3.7 max": "qwen3.7-max",
  "qwen 3.7 plus": "qwen3.7-plus",
  "qwen 3.6 plus": "qwen3.6-plus",
  "qwen3.7-max": "qwen3.7-max",
  "qwen3.7-plus": "qwen3.7-plus",
  "qwen3.6-plus": "qwen3.6-plus",
  "grok 4": "grok-4",
  "grok-4": "grok-4",
  "grok 3": "grok-3",
  "grok-3": "grok-3",
};

function resolveModelId(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim().replace(/\s+/g, " ");
  if (ALIAS_MAP[q]) return ALIAS_MAP[q];
  // 模糊匹配
  for (const [alias, id] of Object.entries(ALIAS_MAP)) {
    if (alias.includes(q) || q.includes(alias)) return id;
  }
  return q; // fallback: 原样返回
}

// ─────────────────────────────────────────────
// 赛道A: API中转站数据加载 & 标准化
// ─────────────────────────────────────────────

function loadHaoshuang() {
  const raw = loadJSON("haoshuang_scraped.json");
  if (!raw || !raw.models) return [];
  return raw.models.map(m => ({
    id: m.model_name,
    name: m.model_name,
    platform: "Haoshuang",
    inputPrice: m.best_price?.inputPrice ?? null,
    outputPrice: m.best_price?.outputPrice ?? null,
    currency: "CNY",
    groups: m.enable_groups || [],
    bestGroup: m.best_price?.group || null,
    allGroups: (m.group_prices || []).map(g => ({
      group: g.group,
      input: g.inputPrice,
      output: g.outputPrice,
    })),
  }));
}

function loadZenmux() {
  const raw = loadJSON("zenmux_scraped.json");
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(m => ({
    id: m.id,
    name: m.display_name || m.id,
    platform: "Zenmux",
    inputPrice: m.input_price_usd ? m.input_price_usd * 7 : null, // USD → CNY
    outputPrice: m.output_price_usd ? m.output_price_usd * 7 : null,
    currency: "CNY",
    groups: [],
    bestGroup: null,
    allGroups: [],
    contextLength: m.context_length,
    category: m.category,
  }));
}

function loadAPIKEYFUN() {
  const raw = loadJSON("apikeyfun_complete.json") || loadJSON("apikeyfun_full.json");
  if (!raw) return [];
  const results = [];
  
  // 递归提取模型数据
  function extractModels(obj, category) {
    if (!obj || typeof obj !== "object") return;
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        // 可能是模型列表
        for (const item of value) {
          if (item && typeof item === "object" && item.model) {
            const input = parseFloat(item.input);
            const output = parseFloat(item.output);
            if (isNaN(input) && isNaN(output)) continue;
            results.push({
              id: item.model,
              name: item.model,
              platform: "APIKEY.FUN",
              inputPrice: isNaN(input) ? null : input,
              outputPrice: isNaN(output) ? null : output,
              currency: "CNY",
              groups: [category],
              bestGroup: key,
              allGroups: [],
            });
          }
        }
      } else if (typeof value === "object" && value !== null) {
        // 嵌套字典，递归
        extractModels(value, category);
      }
    }
  }
  
  for (const [category, data] of Object.entries(raw)) {
    extractModels(data, category);
  }
  return results;
}

function loadYunwu() {
  const raw = loadJSON("yunwu_scraped.json");
  if (!raw || !raw.data) return [];
  const results = [];
  const { model_group, model_completion_ratio } = raw.data;
  
  // 用 default 分组的价格作为基准
  const defaultGroup = model_group?.["default"];
  if (!defaultGroup || !defaultGroup.ModelPrice) return [];
  
  for (const [modelName, priceData] of Object.entries(defaultGroup.ModelPrice)) {
    // priceType: 0=按token, 1=按次
    if (priceData.priceType === 1) continue; // 跳过按次计费
    const ratio = model_completion_ratio?.[modelName] || 1;
    results.push({
      id: modelName,
      name: modelName,
      platform: "Yunwu",
      inputPrice: priceData.price * ratio, // price * ratio = 实际单价
      outputPrice: priceData.price * ratio * 2, // output 通常是 input 的 2 倍
      currency: "CNY",
      groups: ["default"],
      bestGroup: "default",
      allGroups: [],
    });
  }
  return results;
}

// ─────────────────────────────────────────────
// 赛道A: 统一模型名匹配
// ─────────────────────────────────────────────

function matchModels(allModels, queryId) {
  if (!queryId) return allModels;
  
  // 精确匹配
  let matched = allModels.filter(m => m.id === queryId);
  if (matched.length > 0) return matched;
  
  // 包含匹配
  const q = queryId.toLowerCase();
  matched = allModels.filter(m => m.id.toLowerCase().includes(q));
  if (matched.length > 0) return matched;
  
  // 权威模型名列表（去重后的标准名）
  const canonicalNames = {
    "deepseek-v4-pro": ["deepseek-v4-pro", "ds-v4-pro", "deepseek_v4_pro"],
    "deepseek-v4-flash": ["deepseek-v4-flash", "ds-v4-flash", "deepseek_v4_flash"],
    "deepseek-v3.2": ["deepseek-v3.2", "ds-v3.2", "deepseek_v3.2", "deepseek-v3-2"],
    "deepseek-r1": ["deepseek-r1", "ds-r1", "deepseek_r1"],
    "gpt-5.4": ["gpt-5.4", "gpt_5.4", "gpt5.4"],
    "gpt-5.5": ["gpt-5.5", "gpt_5.5", "gpt5.5"],
    "gpt-5.2": ["gpt-5.2", "gpt_5.2", "gpt5.2"],
    "gpt-5.1": ["gpt-5.1", "gpt_5.1", "gpt5.1"],
    "gpt-5.3-codex": ["gpt-5.3-codex", "gpt_5.3_codex"],
    "gpt-5.1-codex": ["gpt-5.1-codex", "gpt_5.1_codex", "gpt-5.1-codex-max"],
    "claude-opus-4-8": ["claude-opus-4-8", "claude_opus_4_8"],
    "claude-opus-4-7": ["claude-opus-4-7", "claude_opus_4_7"],
    "claude-opus-4-6": ["claude-opus-4-6", "claude_opus_4_6"],
    "claude-sonnet-4-6": ["claude-sonnet-4-6", "claude_sonnet_4_6"],
    "claude-sonnet-4-5-20250929": ["claude-sonnet-4-5", "claude-sonnet-4-5-20250929"],
    "claude-haiku-4-5-20251001": ["claude-haiku-4-5", "claude-haiku-4-5-20251001"],
    "gemini-2.5-pro": ["gemini-2.5-pro", "gemini_2.5_pro"],
    "gemini-2.5-flash": ["gemini-2.5-flash", "gemini_2.5_flash"],
    "gemini-3-pro-preview": ["gemini-3-pro-preview", "gemini-3-pro"],
    "gemini-3-flash-preview": ["gemini-3-flash-preview", "gemini-3-flash"],
    "glm-5.2": ["glm-5.2", "glm_5.2"],
    "glm-5.1": ["glm-5.1", "glm_5.1"],
    "glm-5": ["glm-5", "glm_5"],
    "glm-4.7": ["glm-4.7", "glm_4.7"],
    "glm-4.5": ["glm-4.5", "glm_4.5"],
    "kimi-k2.7-code": ["kimi-k2.7-code", "kimi_k2.7_code", "kimi-k2.7"],
    "kimi-k2.6": ["kimi-k2.6", "kimi_k2.6"],
    "kimi-k2.5": ["kimi-k2.5", "kimi_k2.5"],
    "minimax-m3": ["minimax-m3", "minimax_m3"],
    "minimax-m2.7": ["minimax-m2.7", "minimax_m2.7"],
    "minimax-m2.5": ["minimax-m2.5", "minimax_m2.5"],
    "qwen3.7-max": ["qwen3.7-max", "qwen_3.7_max"],
    "qwen3.7-plus": ["qwen3.7-plus", "qwen_3.7_plus"],
    "qwen3.6-plus": ["qwen3.6-plus", "qwen_3.6_plus"],
    "grok-4": ["grok-4", "grok_4"],
    "grok-3": ["grok-3", "grok_3"],
  };
  
  // 查找 queryId 对应的权威名
  let canonical = queryId;
  for (const [canon, aliases] of Object.entries(canonicalNames)) {
    if (aliases.includes(queryId)) { canonical = canon; break; }
  }
  
  // 按权威名匹配所有平台
  const aliases = canonicalNames[canonical] || [canonical];
  matched = allModels.filter(m => aliases.some(a => m.id.toLowerCase().includes(a.toLowerCase())));
  return matched;
}

// ─────────────────────────────────────────────
// 赛道A: 异常价格检测
// ─────────────────────────────────────────────
function detectPriceAnomalies(modelGroup) {
  const anomalies = [];
  for (const [modelId, platforms] of Object.entries(modelGroup)) {
    const validPrices = platforms.filter(p => p.inputPrice != null).map(p => p.inputPrice);
    if (validPrices.length < 2) continue;
    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    if (max > 0 && min / max < 0.5) {
      anomalies.push({
        model: modelId,
        message: `最低价 ¥${min.toFixed(2)} 低于最高价 ¥${max.toFixed(2)} 的 50%，建议小批量测试稳定性`,
      });
    }
  }
  return anomalies;
}

// ─────────────────────────────────────────────
// 赛道B: Token Plan 数据
// ─────────────────────────────────────────────

const TOKEN_PLANS = [
  // MiniMax (国产模型平台，标准配额制)
  // 数据来源: https://platform.minimaxi.com/ （官方套餐页）
  { platform: "MiniMax", plan: "Plus", monthly_fee: 49, tokens_per_month: 600_000_000, mixed_unit_price: 2.5, source_url: "https://platform.minimaxi.com/", features: ["文本", "图像理解", "MCP"] },
  { platform: "MiniMax", plan: "Max", monthly_fee: 119, tokens_per_month: 1_800_000_000, mixed_unit_price: 2.5, source_url: "https://platform.minimaxi.com/", features: ["文本", "图像理解", "视频生成(3条/日)", "MCP"] },
  { platform: "MiniMax", plan: "Ultra", monthly_fee: 469, tokens_per_month: 7_100_000_000, mixed_unit_price: 2.5, source_url: "https://platform.minimaxi.com/", features: ["文本", "图像理解", "视频生成(5条/日)", "MCP"] },
  // GLM (国产模型平台，标准配额制)
  // 数据来源: https://open.bigmodel.cn/pricing （官方套餐页）
  { platform: "GLM", plan: "Lite", monthly_fee: 49, tokens_per_month: 750_000_000, mixed_unit_price: 1.4, source_url: "https://open.bigmodel.cn/pricing", features: ["文本", "图像理解"] },
  { platform: "GLM", plan: "Pro", monthly_fee: 149, tokens_per_month: 2_300_000_000, mixed_unit_price: 1.4, source_url: "https://open.bigmodel.cn/pricing", features: ["文本", "图像理解", "MCP"] },
  { platform: "GLM", plan: "Max", monthly_fee: 469, tokens_per_month: 7_000_000_000, mixed_unit_price: 1.4, source_url: "https://open.bigmodel.cn/pricing", features: ["文本", "图像理解", "MCP"] },
  // Kimi (国产模型平台，标准配额制)
  // 数据来源: https://kimi.moonshot.cn/pricing （官方套餐页）
  { platform: "Kimi", plan: "Andante", monthly_fee: 39, tokens_per_month: 200_000_000, mixed_unit_price: 10, source_url: "https://kimi.moonshot.cn/pricing", features: ["文本", "图像理解"], period: "年付" },
  { platform: "Kimi", plan: "Moderato", monthly_fee: 79, tokens_per_month: 1_000_000_000, mixed_unit_price: 10, source_url: "https://kimi.moonshot.cn/pricing", features: ["文本", "图像理解"], period: "年付" },
  // Qwen (Credit制: 1 Credit ≈ 500 tokens, 按 Qwen3.6-Plus 口径)
  // 数据来源: https://tongyi.aliyun.com/pricing （官方套餐页）
  { platform: "Qwen", plan: "标准坐席", monthly_fee: 198, tokens_per_month: 25_000 * 500, mixed_unit_price: 1.4, source_url: "https://tongyi.aliyun.com/pricing", features: ["文本", "图像理解", "图像生成"], credits: 25000 },
  { platform: "Qwen", plan: "高级坐席", monthly_fee: 698, tokens_per_month: 100_000 * 500, mixed_unit_price: 1.4, source_url: "https://tongyi.aliyun.com/pricing", features: ["文本", "图像理解", "图像生成", "无窗口限制", "团队管理"], credits: 100000 },
  { platform: "Qwen", plan: "尊享坐席", monthly_fee: 1398, tokens_per_month: 250_000 * 500, mixed_unit_price: 1.4, source_url: "https://tongyi.aliyun.com/pricing", features: ["文本", "图像理解", "图像生成", "无窗口限制", "团队管理"], credits: 250000 },
  // Command Code (USD→¥, 资源站型)
  // 数据来源: https://command-ai.com/pricing （官方定价页）
  // 锚点模型: DeepSeek V4 Pro (综合单价)
  { platform: "Command Code", plan: "Go", monthly_fee: 1 * 7, tokens_per_month: 10_000 * 0.4 * 1_000_000, mixed_unit_price: 1.0, source_url: "https://command-ai.com/pricing", features: ["34+款模型含海外", "窗口限制"] },
  { platform: "Command Code", plan: "Pro", monthly_fee: 15 * 7, tokens_per_month: 25_000 * 0.4 * 1_000_000, mixed_unit_price: 1.0, source_url: "https://command-ai.com/pricing", features: ["34+款模型含海外", "窗口限制"] },
  { platform: "Command Code", plan: "Max", monthly_fee: 100 * 7, tokens_per_month: 110_000 * 0.4 * 1_000_000, mixed_unit_price: 1.0, source_url: "https://command-ai.com/pricing", features: ["34+款模型含海外", "窗口限制"] },
  // Open Code Go (USD额度制, 资源站型)
  // ════════════════════════════════════════════════════════════
  // [2026-06-30] 数据修复记录：
  //   旧: tokens_per_month: 17_150 * 1_040  (漏了 82,000 cache token)
  //   新: tokens_per_month: 17_150 * 83_040  (含所有 token 类型)
  //   旧: mixed_unit_price: 1.0125  (粗略估算的混合单价)
  //   新: mixed_unit_price: 0.675    (Haoshuang DS V4 Pro 输入价，cache 走 input 价)
  //   原因: 首次硬编码时凭印象假设了 1,040 tokens/次，实际应为 83,040
  // ════════════════════════════════════════════════════════════
  // 数据来源：https://opencode.ai/docs/zh-cn/go/ 
  // 最后验证：2026-06-30
  // 锚点模型：DS V4 Pro
  //   每次请求 token 构成:
  //     750 input + 82,000 cache (context) + 290 output = 83,040 tokens
  //   （注意：cache token 在使用 DeepSeek 模型时占据绝大多数，
  //    因为每次请求需要加载完整的对话上下文到 KV cache 中）
  //   官方月可调用次数: 17,150
  //   等效 token/月: 17,150 × 83,040 = 1,424,136,000 ≈ 14.24亿
  //   Cache token 计费方式确认（Haoshuang）：
  //     Haoshuang 没有单独的 cache tier，cache token 按输入价计费
  //     Input tokens 和 cache tokens 都按 ¥0.675/M 计费
  //     Output tokens 按 ¥1.35/M 计费
  //   Per request at Haoshuang:
  //     (750 + 82,000) / 1,000,000 × ¥0.675 + 290 / 1,000,000 × ¥1.35
  //     = 82,750 / 1,000,000 × ¥0.675 + 290 / 1,000,000 × ¥1.35
  //     = ¥0.055856 + ¥0.000392
  //     = ¥0.056248
  //   等效 API 价值: 17,150 × ¥0.056248 = ¥964.65
  //   折扣率: ¥71 / ¥965 = 7.4%
  // ════════════════════════════════════════════════════════════
  // 风险提示：此为估算值。Open Code Go 的 14 款模型各有不同调用次数和 token 消耗，
  // 实际使用中若主要使用低消耗模型（如 DS V4 Flash），折扣率可低至 1.0%。
  // ════════════════════════════════════════════════════════════
  {
    platform: "Open Code Go",
    plan: "$10/月",
    monthly_fee: 71,
    tokens_per_month: 17_150 * 83_040,  // 17,150次 × 83,040 tokens/次 (含cache)
    mixed_unit_price: 0.675,  // Haoshuang DS V4 Pro 输入价（cache 走 input 价）
    equivalent_api_value: 965,
    discount_rate_pct: 7.4,
    pricing_model: "USD额度制",
    source_url: "https://opencode.ai/docs/zh-cn/go/",
    last_verified: "2026-06-30",
    features: ["14款国产开源精选", "USD$60/月上限", "5h=$12/w=$30"],
    models_included: 14,
    anchor_model: "DS V4 Pro",
    monthly_calls_anchor: 17150,
    model_list: [
      { name: "DeepSeek V4 Flash", calls_per_month: 158150 },
      { name: "Qwen 3.5 Plus", calls_per_month: 50500 },
      { name: "MiniMax M2.5", calls_per_month: 31800 },
      { name: "MiniMax M2.7", calls_per_month: 17000 },
      { name: "DeepSeek V4 Pro", calls_per_month: 17150, isAnchor: true },
      { name: "Qwen 3.6 Plus", calls_per_month: 16300 },
      { name: "MiMo V2.5", calls_per_month: 10900 },
      { name: "Kimi K2.5", calls_per_month: 9250 },
      { name: "MiMo V2.5 Pro", calls_per_month: 6450 },
      { name: "GLM 5", calls_per_month: 5750 },
      { name: "Kimi K2.6", calls_per_month: 5750 },
      { name: "GLM 5.1", calls_per_month: 4300 },
    ],
  },
];

// ─────────────────────────────────────────────
// 赛道B: 数据验证 & Sanity Check
// ─────────────────────────────────────────────

/**
 * 对计算后的 Token Plan 数据运行 sanity checks。
 * 返回验证结果数组（每个结果含 severity、message、相关平台）
 */
function validateTokenPlanData(plans) {
  const warnings = [];
  const errors = [];
  
  for (const p of plans) {
    // V1: 折扣率 > 100% 报警
    if (p.discountRate != null && p.discountRate > 1.0) {
      // 检查是否是已知的 "模型超市型"（如 Qwen Credit 制，本身折扣率就会 >100%）
      const isKnownModelSupermarket = p.platform === "Qwen" || p.platform === "Open Code Go";
      if (!isKnownModelSupermarket) {
        errors.push({
          check: "V1-折扣率超100%",
          severity: "error",
          platform: p.platform,
          plan: p.plan,
          message: `折扣率 ${(p.discountRate * 100).toFixed(0)}% > 100%，等效API价值低于套餐月费。确认货币单位或计算基数是否正确`,
          value: (p.discountRate * 100).toFixed(1) + "%",
        });
      } else {
        warnings.push({
          check: "V1-折扣率超100%",
          severity: "warning",
          platform: p.platform,
          plan: p.plan,
          message: `模型超市型平台，折扣率 ${(p.discountRate * 100).toFixed(0)}% > 100%，这在合理的预期范围内（卖的是模型选择权，不是 token 折扣）`,
          value: (p.discountRate * 100).toFixed(1) + "%",
        });
      }
    }
    
    // V2: 等效API价值远低于月费（< 10%）
    if (p.discountRate != null && p.discountRate > 10) {
      errors.push({
        check: "V2-API价值远低于月费",
        severity: "error",
        platform: p.platform,
        plan: p.plan,
        message: `等效API价值(¥${p.apiValue?.toFixed(0)}) 仅为月费(¥${p.monthly_fee}) 的 ${(1/p.discountRate*100).toFixed(0)}%，可能是 token 数/货币单位/计算基数错误`,
        value: `¥${p.apiValue?.toFixed(0)} / ¥${p.monthly_fee}`,
      });
    }
    
    // V3: tokens_per_month < 500万 报警
    if (p.tokens_per_month != null && p.tokens_per_month < 5_000_000) {
      errors.push({
        check: "V3-token量极低",
        severity: "error",
        platform: p.platform,
        plan: p.plan,
        message: `每月 token 量 ${p.tokens_per_month.toLocaleString()} < 500万，确认数据是否正确（可能漏了 cache token）`,
        value: p.tokens_per_month.toLocaleString(),
      });
    }
    
    // V4: tokens_per_month 在 500万~1亿之间但月费 > 80
    if (p.tokens_per_month != null && p.tokens_per_month >= 5_000_000 && p.tokens_per_month < 100_000_000 && p.monthly_fee > 80) {
      warnings.push({
        check: "V4-单token成本高",
        severity: "warning",
        platform: p.platform,
        plan: p.plan,
        message: `Token量适中(${(p.tokens_per_month / 10_000).toFixed(0)}万)但月费¥${p.monthly_fee}，单token成本偏高。确认是否为资源站型/额度制平台`,
        value: `¥${(p.monthly_fee / p.tokens_per_month * 10000).toFixed(4)}/万token`,
      });
    }
    
    // V5: 检查数据来源是否缺失
    if (!p.source_url) {
      warnings.push({
        check: "V5-数据来源缺失",
        severity: "warning",
        platform: p.platform,
        plan: p.plan,
        message: `平台数据缺少 source_url 字段。如果是新添加的平台，请先 WebFetch 官方定价页并补充来源链接`,
        value: "未标注",
      });
    }
    
    // V6: 检查标准配额制平台的 tokens_per_month 是否与月费匹配
    if (p.tokens_per_month != null && p.mixed_unit_price != null && !p.pricing_model) {
      const impliedValue = (p.tokens_per_month / 1_000_000) * p.mixed_unit_price;
      const impliedDiscount = p.monthly_fee / impliedValue;
      if (impliedDiscount > 0.5) {
        warnings.push({
          check: "V6-标准计划折扣偏高",
          severity: "warning",
          platform: p.platform,
          plan: p.plan,
          message: `折扣率 ${(impliedDiscount * 100).toFixed(0)}% > 50%，虽然是标准配额制但折扣偏大，建议与官方页面交叉验证`,
          value: (impliedDiscount * 100).toFixed(0) + "%",
        });
      }
    }
  }
  
  return { errors, warnings };
}

function computeTokenPlanAnalysis() {
  const results = TOKEN_PLANS.map(p => {
    let apiValue = null;
    let discountRate = null;
    let costPer10k = null;
    let pricingNote = null;
    
    if (p.tokens_per_month && p.mixed_unit_price) {
      apiValue = (p.tokens_per_month / 1_000_000) * p.mixed_unit_price;
      discountRate = p.monthly_fee / apiValue;
      costPer10k = p.monthly_fee / (p.tokens_per_month / 10_000);
      
      if (p.pricing_model === "USD额度制") {
        pricingNote = "基于锚点模型(DS V4 Pro)调用次数反推，估算值";
      }
    }
    
    // V7: 检查预设值与公式计算值的一致性
    let presetMismatch = null;
    if (p.equivalent_api_value != null && apiValue != null) {
      const diff = Math.abs(p.equivalent_api_value - apiValue) / p.equivalent_api_value;
      if (diff > 0.2) {  // 差异 > 20%
        presetMismatch = {
          preset_value: p.equivalent_api_value,
          calculated_value: Math.round(apiValue * 100) / 100,
          relative_diff: (diff * 100).toFixed(1) + "%",
        };
      }
    }
    if (p.discount_rate_pct != null && discountRate != null) {
      const presetDR = p.discount_rate_pct / 100;
      const diff = Math.abs(presetDR - discountRate) / presetDR;
      if (diff > 0.2) {
        presetMismatch = {
          ...(presetMismatch || {}),
          preset_rate: (presetDR * 100).toFixed(1) + "%",
          calculated_rate: (discountRate * 100).toFixed(1) + "%",
          relative_diff: (diff * 100).toFixed(1) + "%",
        };
      }
    }
    
    return {
      ...p,
      apiValue: apiValue != null ? Math.round(apiValue * 100) / 100 : null,
      discountRate: discountRate != null ? Math.round(discountRate * 10000) / 10000 : null,
      costPer10k: costPer10k != null ? Math.round(costPer10k * 10000000) / 10000000 : null,
      equivalentTokens: p.tokens_per_month 
        ? (p.tokens_per_month >= 100_000_000 
            ? (p.tokens_per_month / 100_000_000).toFixed(2) + "亿"
            : (p.tokens_per_month / 10_000).toFixed(0) + "万")
        : "待计算",
      pricingNote,
      presetMismatch,  // null = 一致或无预设值; object = 差异>20%需核查
    };
  });
  
  // 按折扣率排序（低=好），包括USD额度制（标注为估算）
  const byDiscount = results
    .filter(r => r.discountRate != null)
    .sort((a, b) => a.discountRate - b.discountRate)
    .map((r, i) => ({
      rank: i + 1,
      platform: r.platform,
      plan: r.plan,
      monthly_fee: r.monthly_fee,
      apiValue: r.apiValue?.toFixed(0),
      discountRate: (r.discountRate * 100).toFixed(1) + "%",
      costPer10k: r.costPer10k?.toFixed(4),
      note: r.pricingNote || null,
    }));
  
  // 按每万token成本排序
  const byCost = results
    .filter(r => r.costPer10k != null)
    .sort((a, b) => a.costPer10k - b.costPer10k)
    .map((r, i) => ({
      rank: i + 1,
      platform: r.platform,
      plan: r.plan,
      monthly_fee: r.monthly_fee,
      costPer10k: r.costPer10k?.toFixed(4),
    }));
  
  // 按预算分档推荐
  const budgetTiers = [
    { max: 100, label: "≤100元" },
    { max: 200, label: "100-200元" },
    { max: 600, label: "200-600元" },
    { max: Infinity, label: "600+元" },
  ];
  
  const recommendations = budgetTiers.map(tier => {
    const candidates = results.filter(r => r.monthly_fee <= tier.max && r.monthly_fee > (tier.max === 100 ? 0 : tier.max === 200 ? 100 : tier.max === 600 ? 200 : 600));
    // 按折扣率排序取最优
    candidates.sort((a, b) => (a.discountRate ?? 1) - (b.discountRate ?? 1));
    return {
      tier: tier.label,
      recommended: candidates.slice(0, 3).map(c => ({
        platform: c.platform,
        plan: c.plan,
        monthly_fee: c.monthly_fee,
        discountRate: c.discountRate ? (c.discountRate * 100).toFixed(1) + "%" : "资源站型",
        features: c.features,
      })),
    };
  });
  
  // 垃圾套餐 — 智能判断
  // 规则:
  //   1. 标准配额制平台(💰📝) 折扣率 > 50% → 垃圾（花¥198买到价值<¥4的API）
  //   2. 模型超市型平台(🎫🔄) 折扣率 > 500% → 标注⚠️但不直接标垃圾（卖的是模型选择权）
  //   3. 不硬编码特定平台为垃圾
  const trash = results.filter(r => {
    if (!r.discountRate) return false;
    const isStandardType = !r.pricing_model;  // 无 pricing_model = 标准配额制
    const isModelSupermarket = r.pricing_model === "USD额度制" || r.pricing_model === "Credit积分制";
    
    if (isStandardType && r.discountRate > 0.5) return true;  // 标准型折扣率>50%
    if (isModelSupermarket && r.discountRate > 5) return true; // 超市型折扣率>500%
    return false;
  }).map(r => {
    const isStandard = !r.pricing_model;
    return {
      platform: r.platform,
      plan: r.plan,
      monthly_fee: r.monthly_fee,
      discountRate: (r.discountRate * 100).toFixed(0) + "%",
      type: isStandard ? "标准配额制" : r.pricing_model,
      reason: isStandard 
        ? `折扣率${(r.discountRate * 100).toFixed(0)}%，等效API价值仅¥${r.apiValue?.toFixed(0)}，不如直接用按量API`
        : `折扣率${(r.discountRate * 100).toFixed(0)}%，模型超市型溢价过高`,
    };
  });
  
  return {
    allPlans: results,
    discountRanking: byDiscount,
    costRanking: byCost,
    recommendations,
    trash,
  };
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────

function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  
  if (track === "api-proxy") {
    // 加载所有平台数据
    const haoshuang = loadHaoshuang();
    const zenmux = loadZenmux();
    const apikeyfun = loadAPIKEYFUN();
    const yunwu = loadYunwu();
    const allModels = [...haoshuang, ...zenmux, ...apikeyfun, ...yunwu];
    
    // 按模型ID分组
    const modelGroups = {};
    for (const m of allModels) {
      if (!modelGroups[m.id]) modelGroups[m.id] = [];
      modelGroups[m.id].push(m);
    }
    
    // 如果指定了模型名，只输出该模型
    if (modelQuery) {
      const queryId = resolveModelId(modelQuery);
      const matched = matchModels(allModels, queryId);
      
      // 按模型分组
      const matchedGroups = {};
      for (const m of matched) {
        if (!matchedGroups[m.id]) matchedGroups[m.id] = [];
        matchedGroups[m.id].push(m);
      }
      
      const output = {
        type: "api-proxy-model",
        query: modelQuery,
        resolvedId: queryId,
        timestamp,
        models: Object.entries(matchedGroups).map(([id, platforms]) => ({
          id,
          platforms: platforms
            .filter(p => p.inputPrice != null)
            .sort((a, b) => a.inputPrice - b.inputPrice)
            .map(p => ({
              platform: p.platform,
              inputPrice: p.inputPrice?.toFixed(2),
              outputPrice: p.outputPrice?.toFixed(2),
              bestGroup: p.bestGroup,
              allGroups: p.allGroups,
            })),
          bestPlatform: platforms.filter(p => p.inputPrice != null).sort((a, b) => a.inputPrice - b.inputPrice)[0]?.platform,
        })),
        anomalies: detectPriceAnomalies(matchedGroups),
      };
      
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    
    // 全量对比
    const output = {
      type: "api-proxy-full",
      timestamp,
      platformCount: new Set(allModels.map(m => m.platform)).size,
      modelCount: Object.keys(modelGroups).length,
      platforms: [...new Set(allModels.map(m => m.platform))],
      topCheapestModels: Object.entries(modelGroups)
        .map(([id, platforms]) => {
          const valid = platforms.filter(p => p.inputPrice != null);
          if (valid.length === 0) return null;
          valid.sort((a, b) => a.inputPrice - b.inputPrice);
          return {
            id,
            bestPrice: valid[0].inputPrice?.toFixed(2),
            bestPlatform: valid[0].platform,
            allPrices: valid.map(p => ({ platform: p.platform, input: p.inputPrice?.toFixed(2), output: p.outputPrice?.toFixed(2) })),
          };
        })
        .filter(Boolean)
        .sort((a, b) => parseFloat(a.bestPrice) - parseFloat(b.bestPrice))
        .slice(0, 30),
      anomalies: detectPriceAnomalies(modelGroups),
    };
    
    console.log(JSON.stringify(output, null, 2));
    
  } else if (track === "token-plan") {
    const analysis = computeTokenPlanAnalysis();
    const validation = validateTokenPlanData(analysis.allPlans);
    
    // 输出验证摘要到 stderr（可见于终端但不会混入 JSON）
    if (validation.errors.length > 0) {
      console.error("╔══════════════════════════════════════════════╗");
      console.error("║  ❌ SANITY CHECK FAILED                     ║");
      console.error("╚══════════════════════════════════════════════╝");
      for (const e of validation.errors) {
        console.error(`  [${e.check}] ${e.platform}/${e.plan}: ${e.message}`);
      }
    }
    if (validation.warnings.length > 0) {
      console.error("╔══════════════════════════════════════════════╗");
      console.error("║  ⚠️  SANITY CHECK WARNINGS                  ║");
      console.error("╚══════════════════════════════════════════════╝");
      for (const w of validation.warnings) {
        console.error(`  [${w.check}] ${w.platform}/${w.plan}: ${w.message}`);
      }
    }
    if (validation.errors.length === 0 && validation.warnings.length === 0) {
      console.error("✅ SANITY CHECK PASSED — all values look reasonable");
    }
    
    const output = {
      type: "token-plan",
      timestamp,
      validation: {
        passed: validation.errors.length === 0,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      ...analysis,
    };
    console.log(JSON.stringify(output, null, 2));
    
  } else {
    console.error(`Unknown track: ${track}. Use "api-proxy" or "token-plan".`);
    process.exit(1);
  }
}

main();
