/**
 * reverse_calc.js — Token Plan 真实折扣率反推（v5.0 合并版）
 *
 * 数据源：../data/token-plans.json（唯一数据源，勿在本文件硬编码价格）
 *
 * 计算逻辑：
 *   等效 API 价值 = (套餐月 token 量 ÷ 1,000,000) × 旗舰模型混合单价
 *                 [可选] + (cache token 量 ÷ 1,000,000) × cache 混合单价   ← v5.0 新增
 *   实际折扣率   = 套餐月费 ÷ 等效 API 价值 × 100%
 *   折扣率 < 5%  = 极高性价比；> 100% = 溢价（卖的是附加价值而非 token 折扣）
 *
 * v5.0 硬性验证门禁（不可关闭，基于 data 的 confidence 字段自动触发）：
 *   ⛔ NEEDS_REVIEW    ：price.confidence === 'estimated' → 单价是估算值，推荐前必须 WebFetch 复核
 *   ⛔ PREMIUM         ：discountRate > 1.0 → 溢价，卖的是团队管理/模型超市等附加价值
 *   ⚠️ SUSPICIOUS     ：discountRate < 1% → 异常便宜，疑似算错或促销，需复核
 *   ⚠️ CACHE_NO_PRICE：有 cache token 量但缺 cache 单价 → 无法折算，等效价值偏低
 *
 * 运行：node scripts/reverse_calc.js
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'token-plans.json');
const db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

const META = db._meta || {};
console.log(`数据版本: ${META.as_of || '未知'} | ${META.warning ? '⚠️ ' + META.warning : ''}\n`);

// ---- 计算 + 门禁 ----
const results = db.token_plans.map(p => {
  const price = db.api_base_prices[p.price_key];
  if (!price) throw new Error(`未找到单价配置: ${p.price_key}（检查 token-plans.json 的 api_base_prices）`);

  const conf = price.confidence; // v5.0 修复：confidence 在单价对象上，不在 plan 上
  const flags = [];

  // 主 token 折算
  let apiValue = (p.tokens_per_month / 1_000_000) * price.mixed;

  // v5.0 新增：cache token 折算（绝不臆造单价）
  if (typeof p.cache_tokens_per_month === 'number') {
    if (p.cache_price_key && db.api_base_prices[p.cache_price_key]) {
      const cachePrice = db.api_base_prices[p.cache_price_key];
      apiValue += (p.cache_tokens_per_month / 1_000_000) * cachePrice.mixed;
    } else {
      flags.push('CACHE_NO_PRICE');
    }
  }

  const discountRate = p.monthly_fee / apiValue;
  const costPer10k = p.monthly_fee / (p.tokens_per_month / 10_000);

  if (conf === 'estimated') flags.push('NEEDS_REVIEW');
  if (discountRate > 1.0) flags.push('PREMIUM');
  // 阈值 0.5%：真实地板价（如 Kimi Moderato 0.8%）不误伤；真正算错通常差 10x+（落到 ~0.05%）
  if (discountRate > 0 && discountRate < 0.005) flags.push('SUSPICIOUS');

  return { ...p, mixed_unit_price: price.mixed, confidence: conf, apiValue, discountRate, costPer10k, flags };
});

const gateMark = r => (r.flags.length ? '⛔' : '✅');
const flagText = r => {
  if (r.flags.includes('NEEDS_REVIEW')) return '⛔估算单价·需复核';
  if (r.flags.includes('SUSPICIOUS')) return '⚠️异常便宜·疑似算错';
  if (r.flags.includes('CACHE_NO_PRICE')) return '⚠️有cache量·缺cache单价';
  if (r.flags.includes('PREMIUM')) return '⛔溢价·卖附加价值';
  return '';
};

// ===== 主表 =====
console.log('┌──────────────────────┬─────────┬────────────────┬──────────────────┬──────────────┐');
console.log('│ 平台 · 套餐          │ 月费(元)│ 等效Token/月   │ 折算API价值(元)  │ 实际折扣率   │');
console.log('├──────────────────────┼─────────┼────────────────┼──────────────────┼──────────────┤');
for (const p of results) {
  const name = `${p.platform} ${p.plan}`.padEnd(20, ' ');
  const fee = p.monthly_fee.toString().padStart(7, ' ');
  const tokens = (p.tokens_per_month / 100_000_000).toFixed(2) + '亿'.padStart(8, ' ');
  const value = p.apiValue.toFixed(0).padStart(15, ' ');
  const est = p.confidence === 'estimated' ? '~' : ' ';
  const rate = (p.discountRate * 100).toFixed(1) + '%'.padStart(11, ' ');
  const gate = gateMark(p);
  console.log(`│ ${name} │ ${fee} │ ${tokens}  │ ${value} │${est}${rate} ${gate}`);
}
console.log('└──────────────────────┴─────────┴────────────────┴──────────────────┴──────────────┘');
console.log('（~ = 该平台 API 单价为估算值，非官方公开价 | ⛔ = 触发门禁，发布前须人工核查 | ✅ = 通过）\n');

// ===== 排序 1: 等效 API 价值（从高到低）=====
console.log('=== 等效 API 价值排序（从高到低，最划算在前）===');
[...results].sort((a, b) => b.apiValue - a.apiValue).forEach((p, i) => {
  console.log(`${(i + 1).toString().padStart(2)}. ${p.platform} ${p.plan.padEnd(15)} ` +
    `月费¥${p.monthly_fee.toString().padStart(5)} | ` +
    `等效价值¥${p.apiValue.toFixed(0).padStart(6)} | ` +
    `折扣率${(p.discountRate * 100).toFixed(1).padStart(5)}% ${gateMark(p)}`);
});

// ===== 排序 2: 每万 token 实际成本（从低到高）=====
console.log('\n=== 每万 token 实际成本（越低越好）===');
[...results].sort((a, b) => a.costPer10k - b.costPer10k).forEach((p, i) => {
  console.log(`${(i + 1).toString().padStart(2)}. ${p.platform} ${p.plan.padEnd(15)} ` +
    `¥${p.costPer10k.toFixed(4).padStart(8)} / 万token`);
});

// ===== 排序 3: 折扣率（从低到高）=====
console.log('\n=== 折扣率排序（从低到高，最便宜在前）===');
[...results].sort((a, b) => a.discountRate - b.discountRate).forEach((p, i) => {
  const over = p.flags.includes('PREMIUM') ? ' ⛔ 溢价：卖的是附加价值而非token折扣' : '';
  const ft = flagText(p);
  console.log(`${(i + 1).toString().padStart(2)}. ${p.platform} ${p.plan.padEnd(15)} ` +
    `月费¥${p.monthly_fee.toString().padStart(5)} | ` +
    `等效价值¥${p.apiValue.toFixed(0).padStart(6)} | ` +
    `折扣率${(p.discountRate * 100).toFixed(1).padStart(5)}%${over}${ft ? ' [' + ft + ']' : ''}`);
});

// ===== v5.0 硬性 Sanity Check 摘要（不可关闭）=====
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  ⛔ SANITY CHECK 摘要（发布前必读）');
console.log('══════════════════════════════════════════════════════════════');
const cnt = { NEEDS_REVIEW: 0, PREMIUM: 0, SUSPICIOUS: 0, CACHE_NO_PRICE: 0, PASS: 0 };
for (const p of results) {
  if (p.flags.includes('NEEDS_REVIEW')) cnt.NEEDS_REVIEW++;
  if (p.flags.includes('PREMIUM')) cnt.PREMIUM++;
  if (p.flags.includes('SUSPICIOUS')) cnt.SUSPICIOUS++;
  if (p.flags.includes('CACHE_NO_PRICE')) cnt.CACHE_NO_PRICE++;
  if (p.flags.length === 0) cnt.PASS++;
  const ft = flagText(p);
  console.log(`  ${gateMark(p)} ${p.platform} ${p.plan.padEnd(15)} ${ft}`);
}
console.log('────────────────────────────────────────────────────────────────────');
console.log(`  通过 ${cnt.PASS} | 估算需复核 ${cnt.NEEDS_REVIEW} | 溢价 ${cnt.PREMIUM} | 异常便宜 ${cnt.SUSPICIOUS} | cache缺单价 ${cnt.CACHE_NO_PRICE}`);

const blocked = cnt.NEEDS_REVIEW + cnt.SUSPICIOUS;
if (blocked > 0) {
  console.log('\n  ⛔ 结论：报告含未复核/异常项，发布前必须人工核查（先 WebFetch 官方定价页复核带 ~ 的平台）。');
} else if (cnt.PREMIUM > 0) {
  console.log('\n  ✅ 结论：单价可信，溢价项已标注附加价值，可信任。');
} else {
  console.log('\n  ✅ 结论：全部官方单价 + 折扣率合理，可信任。');
}

module.exports = { results, cnt };
