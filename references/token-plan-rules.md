# Token Plan 订阅套餐规则与平台档案

> ⚠️ **套餐价格/额度等数字以 `data/token-plans.json` 为准**（带 as_of 日期与来源 URL）。
> 本文件保留对比维度、平台定性档案与抓取指南。使用前必须 WebFetch 官方页复核。
> 输出格式规范见 `templates/output-template.md`（唯一权威版本，本文件不重复）。

## 一、什么是 Token Plan
Token Plan 是各大 AI 模型厂商推出的**固定月费订阅套餐**，按月付费获得一定量的模型调用额度。与 API 按量计费不同，核心价值在于**可预测的成本 + 充足的调用量**。

## 二、核心对比维度（调研必查）

| 维度 | 说明 | 重要性 |
|------|------|--------|
| **月费** | 每月固定费用 | ★★★★★ |
| **总月token量** | 套餐包含的总 token 额度 | ★★★★★ |
| **调用次数估算** | 折算成月调用次数 | ★★★★★ |
| **5小时窗口额度** | 每5小时可调用的最大次数/token量 | ★★★★★ |
| **周窗口额度** | 每周上限与刷新规则 | ★★★★ |
| **Agent并发数** | 同时运行的 Agent 数量上限 | ★★★★ |
| **速率限制(RPM/TPM)** | 每分钟/每秒请求限制 | ★★★ |
| **模型支持** | 是否包含旗舰模型 | ★★★★★ |
| **多模态能力** | 图像理解/生成、视频、语音、音乐 | ★★★★ |
| **MCP/工具调用** | 联网搜索、网页读取等限额 | ★★★ |
| **高峰期倍率** | 高峰时段是否多倍扣额度 | ★★★ |
| **超额策略** | 用完后：扣积分 / 等刷新 / 升级 | ★★★ |
| **年付优惠** | 年付折扣力度 | ★★ |

## 三、已收录平台档案（定性信息；数字见 token-plans.json）

### 3.1 智谱 GLM Coding
- **入口**：https://bigmodel.cn/glm-coding | **文档**：https://docs.bigmodel.cn/cn/coding-plan/overview
- **模型**：GLM-5.2 / GLM-5-Turbo / GLM-4.7
- **倍率规则**：GLM-5.2 高峰期(14-18点) 3倍扣，非高峰 2倍（限时福利：非高峰 1倍至 2026-09 底）
- **换算**：1 次 prompt ≈ 15-20 次模型调用
- **档位**：Lite / Pro🔥 / Max

### 3.2 MiniMax Token Plan
- **入口**：https://platform.minimaxi.com/subscribe/token-plan | **文档**：https://platform.minimaxi.com/docs/token-plan
- **模型**：M3 / M2.7 全系，支持图像/语音/音乐生成，Max 档以上含视频生成
- **窗口规则**：5 小时固定窗口 + 周窗口，未用完不累积
- **超额**：可用已购积分自动补充支付
- **档位**：Plus / Max🔥 / Ultra

### 3.3 Kimi Code Plan（Moonshot AI）
- **官方入口**：https://www.kimi.com/code | **第三方参考**：https://codingplan.org/plans/kimi
- **模型**：Kimi K2.5 旗舰，纯文本（无多模态生成）
- **窗口规则**：5 小时 token 配额，每 7 天刷新，未用完不累积；最大并发 30
- **额外权益**：AI 建站 / AI 文档 / AI PPT；曾有限时 3 倍额度扩容活动（注意时效）
- **档位**：Andante / Moderato🔥（年付有折扣）

### 3.4 Command Code AI
- **入口**：https://commandcode.ai/pricing（公开定价页 + 说明书）
- **计费**：Credit 制（月度 Credits × 模型倍率），USD 计价
- **特点**：6 档套餐 + Credit 倍率 + 窗口规则公开透明
- **短板**：USD 定价，同等预算下折算额度通常被 RMB 平台碾压
- **档位**：Pro / Max 5x / Max 10x 等

### 3.5 通义千问 Qwen Token Plan（阿里百炼）
- **入口**：https://platform.qianwenai.com/pricing/token-plan | **文档**：https://help.aliyun.com/zh/model-studio/token-plan-overview
- **计费**：Credits 统一计费，非固定兑换率（兑换表见 token-plans.json 的 credits_exchange）
- **核心特点**：
  - **无 5 小时/周窗口限制**：月度额度用完即止，可买共享用量包（¥5,000/625K Credits）补充
  - **多品牌模型超市**：一个订阅覆盖 5 品牌 12+ 模型（千问 + 万相 + DeepSeek + Kimi + GLM + MiniMax）
  - **团队管理**：席位管理、用量分析、多租户隔离
  - **限制**：仅支持华北2（北京）；承诺不训练用户数据
- **档位**：标准坐席 / 高级坐席🔥 / 尊享坐席
- ⚠️ **定价性质**：折扣率远超 100%，卖的是附加价值不是 token 折扣（详见 references/api-base-price.md §2）

## 四、抓取指南（新平台入库流程）

1. **优先找官方说明书**：/docs/ 路径下通常有详细限额说明
2. **WebFetch 入口页**：获取套餐价格、能力列表等展示信息
3. **翻说明书文档**：获取 5小时/每周窗口的精确数字
4. **注意活动时效**：限时扩容、限时折扣需标注有效期
5. **第三方对比站**（如 codingplan.org）可作参考，必须回官方验证
6. **入库**：将结构化数据写入 `data/token-plans.json`（含 source_url），而不是写进本文件
