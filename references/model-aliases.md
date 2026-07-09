# 跨平台模型别名匹配映射库（价格归一化核心匹配规则）
## 一、GPT系列统一规则
gpt-5.4 / gpt-5.4-medium / gpt-5.4-high / gpt-5.4-xhigh → gpt-5.4
gpt-5 / gpt-5-low / gpt-5-medium / gpt-5-minimal → gpt-5
gpt-5.5 / gpt-5.5-high / gpt-5.5-xhigh → gpt-5.5
gpt-image-1.5 / gpt-image-1.5-official → gpt-image-1.5
gpt-image-2 / gpt-image-2-vip → gpt-image-2
后缀统一过滤：-chat-latest / -codex / -search-api / 年份日期后缀全部剔除

## 二、Gemini系列统一规则
gemini-3.1-pro-preview / gemini-3.1-pro → gemini-3.1-pro
gemini-3-flash-preview / gemini-3.1-flash-lite → gemini-3-flash
gemini-2.5-pro / gemini-2.5-pro-thinking → gemini-2.5-pro
nano-banana 全系列 = Gemini图像衍生模型统一别名

## 三、DeepSeek系列统一规则
deepseek-v4-flash 独立型号
deepseek-v4-pro 独立型号
deepseek-v3 / deepseek-v3.2 / deepseek-r1 各自独立，不合并

## 四、Grok系列统一规则
grok-imagine-1.5-video-apimart = grok-imagine视频通用模型
grok-imagine-1.5-edit / grok-imagine-1.5 统一归为Grok图像系列

## 五、通用清洗规则（脚本自动执行）
1. 所有模型名称去除末尾 `-xxxx` 版本/状态后缀
2. 大小写统一小写后匹配，输出展示首字母大写标准名
3. 仅匹配同大类模型：LLM只匹配LLM，图像只匹配图像，不跨类目合并

## 六、用户输入模糊匹配规则（v5.0 新增 — model_matcher.js 使用）
当用户输入自然语言模型名时，按以下规则逐层降级匹配：

### 6.1 常见缩写映射
| 用户输入 | 匹配到 |
|:--------|:-------|
| DS → deepseek | DS V4 Pro → deepseek-v4-pro |
| GPT → gpt | GPT5.5 → gpt-5.5 |
| Claude → claude | Claude Opus → claude-opus |
| Qwen → qwen | Qwen3.7 → qwen3.7 |
| GLM → glm | GLM5.2 → glm-5.2 |
| Kimi → kimi-k | Kimi K2.7 → kimi-k2.7 |
| M3 → minimax-m3 | M2.7 → minimax-m2.7 |
| K2.7 → kimi-k2.7-code | |

### 6.2 分隔符归一化
| 用户输入 | 内部处理 |
|:--------|:---------|
| "DeepSeek V4 Pro" | 空格→连字符 → deepseek-v4-pro |
| "DS_V4_Pro" | 下划线→连字符 → ds-v4-pro |
| "GPT 5.5" | 空格→连字符 → gpt-5.5 |

### 6.3 匹配优先级
1. **全称精确匹配**（model-aliases.md + ALIAS_MAP）→ 唯一匹配
2. **缩写匹配**（展开缩写后再匹配）→ 唯一匹配
3. **子串模糊匹配**（去除所有分隔符后包含匹配）→ 可能多条
4. 仅输出匹配到的模型，不做跨模型替代推荐（用户确认不需要）

### 6.4 不支持的输入（返回空结果后引导）
- 功能描述型输入（"我要做图""写代码的模型"）→ 建议用户输入具体模型名
- 模糊场景描述 → 提示"请告诉我你常用的模型名，比如 DeepSeek V4 Pro"
