#!/usr/bin/env node
/**
 * model_matcher.js — 模型名称匹配引擎 v1
 *
 * 功能：
 *   用户输入自然语言模型名 → 标准化匹配 → 查多平台价格 → 输出对比卡数据
 *
 * 匹配三层：
 *   Layer 1 — 精确匹配（读取 references/model-aliases.md 映射表）
 *   Layer 2 — 模糊匹配（缩写/常见变体/大小写/分隔符归一）
 *   Layer 3 — 仅匹配，不做跨模型替代推荐
 *
 * 数据源：
 *   - data/zenmux_scraped.json    （137个模型）
 *   - data/yunwu_scraped.json     （227个模型）
 *   - data/haoshuang_scraped.json （27个模型）
 *   - data/apikeyfun_scraped.json （多Tab定价数据）
 *
 * 用法：
 *   node scripts/model_matcher.js "deepseek-v4-pro"
 *   node scripts/model_matcher.js "DS V4 Pro"
 *   node scripts/model_matcher.js "qwen3.7"
 */

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(SKILL_DIR, 'data');

// ============================================================
// Layer 1: 别名映射表（内联 + 从 model-aliases.md 解析）
// ============================================================
// 用户常见输入 → 标准模型名
const ALIAS_MAP = {
  // ---- DeepSeek ----
  'deepseek-v4-pro': 'deepseek/deepseek-v4-pro',
  'deepseek v4 pro': 'deepseek/deepseek-v4-pro',
  'ds v4 pro': 'deepseek/deepseek-v4-pro',
  'ds-v4-pro': 'deepseek/deepseek-v4-pro',
  'deepseek v4': 'deepseek/deepseek-v4-pro',
  'deepseek-v4': 'deepseek/deepseek-v4-pro',
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'deepseek v4 flash': 'deepseek/deepseek-v4-flash',
  'ds v4 flash': 'deepseek/deepseek-v4-flash',
  'ds-v4-flash': 'deepseek/deepseek-v4-flash',
  'deepseek-chat': 'deepseek/deepseek-v4-flash',
  'deepseek-r1': 'deepseek/deepseek-r1',
  'deepseek v3': 'deepseek/deepseek-v3',
  'ds v3': 'deepseek/deepseek-v3',

  // ---- OpenAI GPT ----
  'gpt-5.5': 'openai/gpt-5.5',
  'gpt 5.5': 'openai/gpt-5.5',
  'gpt5.5': 'openai/gpt-5.5',
  'gpt-5.5-pro': 'openai/gpt-5.5-pro',
  'gpt-5.4': 'openai/gpt-5.4',
  'gpt 5.4': 'openai/gpt-5.4',
  'gpt5.4': 'openai/gpt-5.4',
  'gpt-5.4-mini': 'openai/gpt-5.4-mini',
  'gpt-5.4-nano': 'openai/gpt-5.4-nano',
  'gpt-5.4-pro': 'openai/gpt-5.4-pro',
  'gpt-5.3-chat': 'openai/gpt-5.3-chat',
  'gpt-5': 'openai/gpt-5',
  'gpt5': 'openai/gpt-5',
  'gpt-image-2': 'openai/gpt-image-2',
  'gpt image 2': 'openai/gpt-image-2',
  'dall-e': 'openai/gpt-image-2',
  'o3': 'openai/o3',
  'o3-mini': 'openai/o3-mini',

  // ---- Anthropic Claude ----
  'claude-opus-4.8': 'anthropic/claude-opus-4.8',
  'claude opus 4.8': 'anthropic/claude-opus-4.8',
  'opus 4.8': 'anthropic/claude-opus-4.8',
  'claude-opus-4.7': 'anthropic/claude-opus-4.7',
  'claude-sonnet-4.6': 'anthropic/claude-sonnet-4.6',
  'claude sonnet 4.6': 'anthropic/claude-sonnet-4.6',
  'sonnet 4.6': 'anthropic/claude-sonnet-4.6',
  'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'claude haiku 4.5': 'anthropic/claude-haiku-4.5',
  'claude-fable-5': 'anthropic/claude-fable-5',
  'claude fable 5': 'anthropic/claude-fable-5',

  // ---- Google Gemini ----
  'gemini-3.1-pro': 'google/gemini-3.1-pro-preview',
  'gemini 3.1 pro': 'google/gemini-3.1-pro-preview',
  'gemini-3.5-flash': 'google/gemini-3.5-flash',
  'gemini 3.5 flash': 'google/gemini-3.5-flash',
  'gemini-3.1-flash-lite': 'google/gemini-3.1-flash-lite',
  'gemini-2.5-pro': 'google/gemini-2.5-pro',
  'gemini 2.5 pro': 'google/gemini-2.5-pro',
  'gemini-2.5-flash': 'google/gemini-2.5-flash',

  // ---- Qwen（通义千问） ----
  'qwen3.7-max': 'qwen/qwen3.7-max',
  'qwen-3.7-max': 'qwen/qwen3.7-max',
  'qwen 3.7 max': 'qwen/qwen3.7-max',
  'qwen3.7-plus': 'qwen/qwen3.7-plus',
  'qwen-3.7-plus': 'qwen/qwen3.7-plus',
  'qwen 3.7 plus': 'qwen/qwen3.7-plus',
  'qwen3.6-plus': 'qwen/qwen3.6-plus',
  'qwen3.6-flash': 'qwen/qwen3.6-flash',
  'qwen 3.6 flash': 'qwen/qwen3.6-flash',
  'qwen3.5-plus': 'qwen/qwen3.5-plus',
  'qwen3.5-flash': 'qwen/qwen3.5-flash',

  // ---- MiniMax ----
  'minimax-m3': 'minimax/minimax-m3',
  'minimax m3': 'minimax/minimax-m3',
  'mini-max-m3': 'minimax/minimax-m3',
  'm3': 'minimax/minimax-m3',
  'minimax-m2.7': 'minimax/minimax-m2.7',
  'minimax m2.7': 'minimax/minimax-m2.7',
  'minimax-m2.5': 'minimax/minimax-m2.7',
  'm2.7': 'minimax/minimax-m2.7',

  // ---- GLM / 智谱 ----
  'glm-5.2': 'z-ai/glm-5.2',
  'glm 5.2': 'z-ai/glm-5.2',
  'glm5.2': 'z-ai/glm-5.2',
  'glm-5.1': 'z-ai/glm-5.1',
  'glm 5.1': 'z-ai/glm-5.1',
  'glm-5-turbo': 'z-ai/glm-5-turbo',
  'glm-4.5': 'z-ai/glm-4.5',

  // ---- Kimi ----
  'kimi-k2.7': 'moonshotai/kimi-k2.7-code',
  'kimi k2.7': 'moonshotai/kimi-k2.7-code',
  'kimi-k2.7-code': 'moonshotai/kimi-k2.7-code',
  'kimi-k2.6': 'moonshotai/kimi-k2.6',
  'kimi k2.5': 'moonshotai/kimi-k2.5',
  'k2.7': 'moonshotai/kimi-k2.7-code',

  // ---- Grok ----
  'grok-4.3': 'x-ai/grok-4.3',
  'grok 4.3': 'x-ai/grok-4.3',
  'grok-4.2': 'x-ai/grok-4.2-fast',
  'grok-build-0.1': 'x-ai/grok-build-0.1',
  'grok build': 'x-ai/grok-build-0.1',

  // ---- 其他 ----
  'mimo-v2.5-pro': 'xiaomi/mimo-v2.5-pro',
  'mimo v2.5 pro': 'xiaomi/mimo-v2.5-pro',
  'mimo-v2.5': 'xiaomi/mimo-v2.5',
  'mimo v2.5': 'xiaomi/mimo-v2.5',
  'ernie-5.1': 'baidu/ernie-5.1',
  'ernie 5.1': 'baidu/ernie-5.1',
  'doubao-seed-2.1': 'bytedance/doubao-seed-2.1-pro',
  'doubao 2.1': 'bytedance/doubao-seed-2.1-pro',
  'llama-3.3': 'meta/llama-3.3',
  'mistral-large-3': 'mistralai/mistral-large-3',
  'mistral-small-4': 'mistralai/mistral-small-4',
  // Haoshuang naming convention
  'deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek-v4-flash': 'deepseek-v4-flash',
};

// ============================================================
// Layer 2: 模糊匹配规则
// ============================================================
function fuzzyNormalize(input) {
  return input
    .toLowerCase()
    .trim()
    // 统一分隔符
    .replace(/[_-\s]+/g, '-')
    // 去掉开头结尾分隔符
    .replace(/^-+|-+$/g, '')
    // 展开常见缩写
    .replace(/^ds\b/, 'deepseek')
    .replace(/^gpt\b/, 'gpt')
    .replace(/^claude\b/, 'claude')
    .replace(/^opus\b/, 'claude-opus')
    .replace(/^sonnet\b/, 'claude-sonnet')
    .replace(/^haiku\b/, 'claude-haiku')
    .replace(/^gemini\b/, 'gemini')
    .replace(/^qwen\b/, 'qwen')
    .replace(/^glm\b/, 'glm')
    .replace(/^kimi\b/, 'kimi-k')
    .replace(/^grok\b/, 'grok')
    .replace(/^minimax\b/, 'minimax')
    .replace(/^mimo\b/, 'mimo')
    .replace(/^ernie\b/, 'ernie')
    .replace(/^doubao\b/, 'doubao-seed')
    .replace(/^llama\b/, 'llama')
    .replace(/^mistral\b/, 'mistral')
    .replace(/^m3$/, 'minimax-m3')
    .replace(/^m2\.7$/, 'minimax-m2.7')
    .replace(/^k2\.7$/, 'kimi-k2.7-code')
    ;
}

// ============================================================
// 数据加载器
// ============================================================
function loadDataSource(fileName) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, fileName), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function extractModelsFromZenmux(data) {
  // zenmux: 标准数组 [{id, display_name, input_price_usd, output_price_usd, ...}]
  if (!Array.isArray(data)) return [];
  return data.map(m => ({
    id: m.id || '',
    displayName: m.display_name || m.id || '',
    provider: (m.id || '').split('/')[0] || '',
    platform: 'ZenmuxAI',
    inputPrice: m.input_price_usd || 0,
    outputPrice: m.output_price_usd || 0,
    unit: 'perMTokens',
    currency: 'USD',
    priceCNYInput: (m.input_price_usd || 0) * 7,
    priceCNYOutput: (m.output_price_usd || 0) * 7,
    category: m.category || 'LLM对话/多模态',
    contextLength: m.context_length || 0,
  }));
}

function extractModelsFromYunwu(data) {
  // yunwu: { data: { model_info: { key: { name, supplier, ... }, ... }, ... } }
  if (!data || !data.data || !data.data.model_info) return [];
  const models = [];
  const info = data.data.model_info;
  const prices = data.data.supplier_price_list || [];
  const priceMap = {};
  prices.forEach(p => {
    const key = `${p.supplier_name || ''}_${p.model_name || ''}`;
    priceMap[key] = p;
  });
  Object.entries(info).forEach(([key, val]) => {
    models.push({
      id: key,
      displayName: val.name || key,
      provider: val.supplier || '',
      platform: 'yunwu.ai',
      inputPrice: 0,
      outputPrice: 0,
      unit: 'perMTokens',
      currency: 'CNY',
      priceCNYInput: 0,
      priceCNYOutput: 0,
      category: (val.tags || []).join(','),
    });
  });
  return models;
}

function extractModelsFromHaoshuang(data) {
  if (!data) return [];
  const models = [];
  const list = data.models || [];
  (Array.isArray(list) ? list : []).forEach(m => {
    // 从 group_prices 中取第一个生效的价格
    const prices = m.group_prices || [];
    const firstPrice = prices[0] || {};
    const inputP = parseFloat(firstPrice.inputPrice) || 0;
    const outputP = parseFloat(firstPrice.outputPrice) || 0;

    models.push({
      id: m.model_name || m.id || '',
      displayName: m.model_name || m.id || '',
      provider: m.vendor_id ? 'vendor_'+m.vendor_id : '',
      platform: 'HaoshuangAPI',
      inputPrice: inputP,
      outputPrice: outputP,
      unit: 'perMTokens',
      currency: 'CNY',
      priceCNYInput: inputP,
      priceCNYOutput: outputP,
    });
  });
  return models;
}

function extractModelsFromApikeyfun(data) {
  if (!data) return [];
  const models = [];

  // 格式1: 分组对象 { provider: [ {model, input, output}, ... ] }
  if (!Array.isArray(data)) {
    Object.entries(data).forEach(([provider, list]) => {
      if (Array.isArray(list)) {
        list.forEach(m => {
          models.push({
            id: m.model || m.model_id || '',
            displayName: m.model || '',
            provider: provider,
            platform: 'APIKEY.FUN',
            inputPrice: parseFloat(m.input) || 0,
            outputPrice: parseFloat(m.output) || 0,
            unit: 'perMTokens',
            currency: 'CNY',
            priceCNYInput: parseFloat(m.input) || 0,
            priceCNYOutput: parseFloat(m.output) || 0,
          });
        });
      }
    });
    return models;
  }

  // 格式2: 数组（多个Tab页）
  data.forEach(tab => {
    const header = tab.header || tab.tab || tab.provider || '';
    const list = tab.data || tab.models || tab.list || [];
    (Array.isArray(list) ? list : []).forEach(m => {
      models.push({
        id: m.model_id || m.id || m.model || '',
        displayName: m.model_name || m.model || '',
        provider: header,
        platform: 'APIKEY.FUN',
        inputPrice: parseFloat(m.input_price || m.input) || 0,
        outputPrice: parseFloat(m.output_price || m.output) || 0,
        unit: 'perMTokens',
        currency: 'CNY',
        priceCNYInput: parseFloat(m.input_price || m.input) || 0,
        priceCNYOutput: parseFloat(m.output_price || m.output) || 0,
      });
    });
  });

  return models;
}

// ============================================================
// 主匹配函数
// ============================================================
function matchModel(userInput) {
  const inputNorm = userInput.toLowerCase().trim();
  
  // Step 1: 直接走别名映射
  let stdId = ALIAS_MAP[inputNorm];
  
  // Step 2: 别名没命中 → 模糊归一后再试
  if (!stdId) {
    const fuzzy = fuzzyNormalize(inputNorm);
    stdId = ALIAS_MAP[fuzzy] || ALIAS_MAP[inputNorm.replace(/[\s_-]+/g, '-')] || null;
  }

  // Step 3: 如果规范名中有 provider/ 前缀，直接用这个；否则尝试子串匹配
  // 构建所有可用模型池
  const allModels = loadAllModels();
  
  let matches = [];
  if (stdId) {
    // 精确匹配：用标准名在所有数据源中搜索（包含或结尾匹配）
    const searchName = stdId.includes('/') ? stdId.split('/')[1] : stdId;
    matches = allModels.filter(m => {
      const id = m.id.toLowerCase();
      const display = m.displayName.toLowerCase();
      return id === stdId || id.endsWith('/' + searchName) || id === searchName ||
             display.includes(searchName);
    });
  }

  // Step 4: 精确没命中 → 子串模糊
  if (matches.length === 0) {
    const searchKey = inputNorm.replace(/[\s_-]/g, '').toLowerCase();
    matches = allModels.filter(m => {
      const idClean = m.id.replace(/[\s_/-]/g, '').toLowerCase();
      const nameClean = (m.displayName || '').replace(/[\s_/-]/g, '').toLowerCase();
      return idClean.includes(searchKey) || nameClean.includes(searchKey);
    });
  }

  // Step 5: 去重 + 按平台分组
  const grouped = groupByPlatform(matches);
  
  return {
    query: userInput,
    normalizedQuery: inputNorm,
    matchedStandardId: stdId || null,
    totalMatches: matches.length,
    platforms: Object.keys(grouped),
    byPlatform: grouped,
    all: matches.slice(0, 50), // 限制输出
  };
}

function loadAllModels() {
  let all = [];
  
  const zenmux = loadDataSource('zenmux_scraped.json');
  if (zenmux) all = all.concat(extractModelsFromZenmux(zenmux));

  const yunwu = loadDataSource('yunwu_scraped.json');
  if (yunwu) all = all.concat(extractModelsFromYunwu(yunwu));

  const haoshuang = loadDataSource('haoshuang_scraped.json');
  if (haoshuang) all = all.concat(extractModelsFromHaoshuang(haoshuang));

  const apikeyfun = loadDataSource('apikeyfun_scraped.json');
  if (apikeyfun) all = all.concat(extractModelsFromApikeyfun(apikeyfun));

  const apikeyfunComplete = loadDataSource('apikeyfun_complete.json');
  if (apikeyfunComplete) all = all.concat(extractModelsFromApikeyfun(apikeyfunComplete));

  return all;
}

function groupByPlatform(models) {
  const grouped = {};
  models.forEach(m => {
    const plat = m.platform || 'unknown';
    if (!grouped[plat]) grouped[plat] = [];
    grouped[plat].push(m);
  });
  return grouped;
}

// ============================================================
// 输出格式：对比卡数据
// ============================================================
function generateComparisonCard(query, matchResult) {
  const card = {
    query: query,
    matchedModel: matchResult.matchedStandardId || '模糊匹配',
    totalMatches: matchResult.totalMatches,
    comparison: [],
    lowestPrice: null,
    recommendation: null,
  };

  // 整理每个平台的报价
  for (const [platform, models] of Object.entries(matchResult.byPlatform)) {
    models.forEach(m => {
      const inputCNY = m.priceCNYInput || m.inputPrice || 0;
      const outputCNY = m.priceCNYOutput || m.outputPrice || 0;
      card.comparison.push({
        platform: platform,
        modelId: m.id,
        displayName: m.displayName,
        inputPrice: inputCNY,
        outputPrice: outputCNY,
        unit: m.unit || 'perMTokens',
        currency: m.currency || 'CNY',
      });
    });
  }

  // 找最低价（優先输入价）
  if (card.comparison.length > 0) {
    const valid = card.comparison.filter(c => c.inputPrice > 0);
    if (valid.length > 0) {
      valid.sort((a, b) => a.inputPrice - b.inputPrice);
      card.lowestPrice = valid[0];
      card.recommendation = {
        platform: valid[0].platform,
        inputPrice: valid[0].inputPrice,
        outputPrice: valid[0].outputPrice,
        reason: '输入/输出价格综合最低',
        risk: valid[0].platform === 'APIKEY.FUN' ? '新平台，建议小批量测试' : '正常',
      };
    }
  }

  return card;
}

// ============================================================
// CLI 入口
// ============================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  const query = args.join(' ');
  
  if (!query || args.includes('--help')) {
    console.log(`
用法: node scripts/model_matcher.js "<模型名>"

示例:
  node scripts/model_matcher.js "DeepSeek V4 Pro"
  node scripts/model_matcher.js "DS V4 Pro"
  node scripts/model_matcher.js "qwen3.7-plus"
  node scripts/model_matcher.js "GPT-5.5"
  node scripts/model_matcher.js "claude opus 4.8"
  node scripts/model_matcher.js "gpt-image-2"

输出: 匹配结果 + 各平台对比数据
`);
    process.exit(0);
  }

  const result = matchModel(query);
  const card = generateComparisonCard(query, result);

  console.log(`\n🔍 查询: "${query}"`);
  console.log(`✅ 匹配: ${card.matchedModel}`);
  console.log(`📊 匹配结果: ${card.totalMatches} 条`);
  console.log(`🏪 覆盖平台: ${result.platforms.join(', ') || '无'}`);
  console.log('');

  if (card.comparison.length === 0) {
    console.log('❌ 未找到匹配数据。尝试用更精确的模型名再查。');
    console.log('   常见模型: DeepSeek V4 Pro, GPT-5.5, Claude Opus 4.8, Qwen3.7-Plus, etc.');
    process.exit(0);
  }

  // 输出对比卡
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log(`│  🔍 模型: ${card.matchedModel.padEnd(50)}│`);
  console.log('├──────────────┬──────────────┬──────────────┬──────────────┤');
  
  const rows = card.comparison.slice(0, 4); // 最多4列
  // 表头
  console.log('│ 平台'.padEnd(14) + '│' + rows.map(() => '              ').join('│') + '│');
  console.log('│' + rows.map(r => `  ${r.platform.padEnd(12)}`).join('│') + '│');
  // 输入价
  console.log('│ 输入(CNY)'.padEnd(14) + '│' + rows.map(r => {
    const p = r.inputPrice > 0 ? `¥${r.inputPrice.toFixed(2)}` : '#N/A';
    return `  ${p.padEnd(12)}`;
  }).join('│') + '│');
  // 输出价
  console.log('│ 输出(CNY)'.padEnd(14) + '│' + rows.map(r => {
    const p = r.outputPrice > 0 ? `¥${r.outputPrice.toFixed(2)}` : '#N/A';
    return `  ${p.padEnd(12)}`;
  }).join('│') + '│');
  console.log('└──────────────┴──────────────┴──────────────┴──────────────┘');

  if (card.lowestPrice) {
    console.log(`\n✅ 最低价: ${card.lowestPrice.platform}`);
    console.log(`   输入 ¥${card.lowestPrice.inputPrice.toFixed(2)}, 输出 ¥${card.lowestPrice.outputPrice.toFixed(2)}`);
    if (card.recommendation) {
      console.log(`⚠️  ${card.recommendation.risk}`);
    }
  }
}

module.exports = { matchModel, generateComparisonCard, ALIAS_MAP };
