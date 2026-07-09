// 反推 Token Plan 实际折扣率 v2 — 修正 Qwen Credits 兑换
// 关键修正：百炼 1 Credit ≈ 500 tokens (Qwen3.6-Plus 口径)

const plans = [
  // ===== MiniMax =====
  // M2.7 官方 API: 实际为按 token 计费。综合按 1 元/百万 input + 4 元/百万 output，1:1 混合 = 2.5 元/百万
  {
    platform: "MiniMax",
    plan: "Plus",
    monthly_fee: 49,
    tokens_per_month: 600_000_000,
    mixed_unit_price: 2.5,
  },
  {
    platform: "MiniMax",
    plan: "Max",
    monthly_fee: 119,
    tokens_per_month: 1_800_000_000,
    mixed_unit_price: 2.5,
  },
  {
    platform: "MiniMax",
    plan: "Ultra",
    monthly_fee: 469,
    tokens_per_month: 7_100_000_000,
    mixed_unit_price: 2.5,
  },

  // ===== 智谱 GLM Coding =====
  // GLM-4.5 官方 API: 输入 0.8, 输出 2 元/百万, 1:1 混合 = 1.4 元/百万
  {
    platform: "GLM",
    plan: "Lite",
    monthly_fee: 49,
    tokens_per_month: 750_000_000,
    mixed_unit_price: 1.4,
  },
  {
    platform: "GLM",
    plan: "Pro",
    monthly_fee: 149,
    tokens_per_month: 2_300_000_000,
    mixed_unit_price: 1.4,
  },
  {
    platform: "GLM",
    plan: "Max",
    monthly_fee: 469,
    tokens_per_month: 7_000_000_000,
    mixed_unit_price: 1.4,
  },

  // ===== Kimi Code =====
  // Kimi 官方: K2 系列 4 元/百万 input, 16 元/百万 output, 1:1 混合 = 10 元/百万
  {
    platform: "Kimi",
    plan: "Andante (年付)",
    monthly_fee: 39,
    tokens_per_month: 200_000_000,
    mixed_unit_price: 10,
  },
  {
    platform: "Kimi",
    plan: "Moderato (年付)",
    monthly_fee: 79,
    tokens_per_month: 1_000_000_000,
    mixed_unit_price: 10,
  },

  // ===== Command Code AI (USD → ¥) =====
  {
    platform: "Command Code",
    plan: "Pro",
    monthly_fee: 15 * 7,
    tokens_per_month: 25_000 * 0.4 * 1_000_000,
    mixed_unit_price: 1.0,
  },
  {
    platform: "Command Code",
    plan: "Max 10x",
    monthly_fee: 100 * 7,
    tokens_per_month: 110_000 * 0.4 * 1_000_000,
    mixed_unit_price: 1.0,
  },

  // ===== 通义千问 Qwen (修正!) =====
  // 1 Credit = 500 tokens (Qwen3.6-Plus 基准)
  // 标准 25K Credits = 1250 万 tokens; 高级 100K = 5000 万; 尊享 250K = 12500 万
  // 按 Qwen3.6-Plus API 单价: 输入 0.8, 输出 2 元/百万, 1:1 = 1.4 元/百万
  {
    platform: "Qwen",
    plan: "标准坐席",
    monthly_fee: 198,
    tokens_per_month: 25_000 * 500,  // 1250 万
    mixed_unit_price: 1.4,
  },
  {
    platform: "Qwen",
    plan: "高级坐席",
    monthly_fee: 698,
    tokens_per_month: 100_000 * 500,  // 5000 万
    mixed_unit_price: 1.4,
  },
  {
    platform: "Qwen",
    plan: "尊享坐席",
    monthly_fee: 1398,
    tokens_per_month: 250_000 * 500,  // 12500 万
    mixed_unit_price: 1.4,
  },
];

console.log("┌──────────────────────┬─────────┬────────────────┬──────────────────┬──────────────┐");
console.log("│ 平台 · 套餐          │ 月费(元)│ 等效Token/月   │ 折算API价值(元)  │ 实际折扣率   │");
console.log("├──────────────────────┼─────────┼────────────────┼──────────────────┼──────────────┤");

const results = [];
for (const p of plans) {
  const apiValue = (p.tokens_per_month / 1_000_000) * p.mixed_unit_price;
  const discountRate = p.monthly_fee / apiValue;
  const costPer10k = p.monthly_fee / (p.tokens_per_month / 10_000);
  results.push({...p, apiValue, discountRate, costPer10k});

  const name = `${p.platform} ${p.plan}`.padEnd(20, " ");
  const fee = p.monthly_fee.toString().padStart(7, " ");
  const tokens = (p.tokens_per_month / 100_000_000).toFixed(2) + "亿".padStart(8, " ");
  const value = apiValue.toFixed(0).padStart(15, " ");
  const rate = (discountRate * 100).toFixed(1) + "%".padStart(12, " ");
  console.log(`│ ${name} │ ${fee} │ ${tokens}  │ ${value} │ ${rate} │`);
}
console.log("└──────────────────────┴─────────┴────────────────┴──────────────────┴──────────────┘");

// 排序 1: 折算价值 / 折扣率（折扣率越低 = 等效买到的 API 价值越高）
console.log("\n=== 等效 API 价值排序（从高到低，最划算在前）===");
results.sort((a, b) => b.apiValue - a.apiValue);
results.forEach((p, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${p.platform} ${p.plan.padEnd(15)} ` +
    `月费¥${p.monthly_fee.toString().padStart(5)} | ` +
    `等效价值¥${p.apiValue.toFixed(0).padStart(6)} | ` +
    `折扣率${(p.discountRate*100).toFixed(1).padStart(5)}%`);
});

// 排序 2: 每万 token 实际成本
console.log("\n=== 每万 token 实际成本（越低越好）===");
results.sort((a, b) => a.costPer10k - b.costPer10k);
results.forEach((p, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${p.platform} ${p.plan.padEnd(15)} ` +
    `¥${p.costPer10k.toFixed(4).padStart(8)} / 万token`);
});

// 排序 3: 折扣率（从低到高）
console.log("\n=== 折扣率排序（从低到高，最便宜在前）===");
results.sort((a, b) => a.discountRate - b.discountRate);
results.forEach((p, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${p.platform} ${p.plan.padEnd(15)} ` +
    `月费¥${p.monthly_fee.toString().padStart(5)} | ` +
    `等效价值¥${p.apiValue.toFixed(0).padStart(6)} | ` +
    `折扣率${(p.discountRate*100).toFixed(1).padStart(5)}%`);
});
