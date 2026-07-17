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
