# 真实折扣反推 — 方法论与计算示例

> ⚠️ **具体单价数字以 `data/token-plans.json` 为准**（`api_base_prices` 字段，带 as_of 日期与来源 URL）。
> 本文件只保留方法论、数据口径说明与计算示例。使用前必须 WebFetch 各平台官方定价页复核。

## 一、单价口径说明

| 平台 key | 旗舰模型 | 数据可信度 | 备注 |
|---------|---------|:---------:|------|
| deepseek | deepseek-v4-pro | official | platform.deepseek.com 公开价；思考模式默认开启 |
| glm | GLM-4.5 系列 | official | bigmodel.cn/pricing；GLM-5 系列未公开列价；Batch API = 标准价 × 0.5 |
| qwen | qwen3.7-plus | official | help.aliyun.com；Max 档约 输入2.6/输出13 |
| kimi | kimi-k2.7-code | **estimated** | K2 系列官方未公开精准定价，多方交叉估算；联网搜索另收 ¥0.03/次 |
| minimax | MiniMax-M2.7 | **estimated** | 官方定价页为 SPA 无法提取；取保守值 2.5 元/百万（算术混合约 4.5），确保不高估套餐等效价值 |
| command_code | 混合模型池 | **estimated** | 按 Credit 倍率折算的等效混合单价 |

**混合均价** = (输入单价 + 输出单价) ÷ 2，按输入输出 1:1 假设。实际业务输入远多于输出时（如长文档分析），应按实际比例重算。

**汇率**：1 USD = 7 CNY（固定，报告标注可替换实时汇率）。

## 二、Credits 制平台的特殊处理（阿里云百炼）

Qwen Token Plan 用 Credits 计费，1 Credit 兑换的 tokens 数随模型档位浮动（兑换表在 `token-plans.json` 的 `credits_exchange` 字段）：
- 轻量模型 1000 tokens/Credit → 通用 500 → 旗舰 200 → 长上下文 100

⚠️ 这意味着 Qwen 标准坐席 25K Credits 按通用模型仅 = 1250 万 tokens，远低于其他平台动辄数亿的额度。Qwen 卖的不是"token 折扣"，而是"团队管理 + 多品牌模型超市 + 无窗口限制"。

## 三、反推计算公式

```
等效 API 价值 = (套餐月 token 量 ÷ 1,000,000) × 旗舰模型混合单价
实际折扣率   = 套餐月费 ÷ 等效 API 价值 × 100%
```

判读标准：
- 折扣率 < 5% → 极高性价比（月费远低于 API 价值）
- 5% - 50% → 合理定价
- \> 100% → 溢价定价，**必须标注**"该套餐卖的不是 token 折扣，而是附加价值"

## 四、计算示例（数字为 2026-06-28 快照，仅示范算法）

**例1：MiniMax Max ¥119**
- Token 额度 18 亿/月；M2.7 混合单价 2.5 元/百万（保守取值）
- 等效 API 价值 = 1800 × 2.5 = ¥4,500
- 实际折扣率 = 119 ÷ 4500 = **2.6%** → 花 ¥119 买到价值 ¥4,500 的调用量（约 1/38 价格）

**例2：Qwen 高级坐席 ¥698**
- 100,000 Credits × 500 tokens = 5,000 万 tokens；qwen3.6-plus 混合单价 1.4 元/百万
- 等效 API 价值 = 50 × 1.4 = ¥70
- 实际折扣率 = 698 ÷ 70 = **997%** → 比按量付费贵约 10 倍，买的是团队管理/模型超市等附加价值

## 五、执行方式

直接运行脚本得到全量结果（读取 token-plans.json，无需手算）：
```bash
node scripts/reverse_calc.js
```
输出：主表 + 等效价值排序 + 每万token成本排序 + 折扣率排序（估算单价的平台会标 `~`）。
