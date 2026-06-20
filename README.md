# 基于 OCR 与LLM的加工食品配料表解析与健康关注提示原型系统

这是一个面向普通消费者的轻量级 Web 原型。用户可以上传食品包装配料表图片，系统通过 OCR 接口返回识别文本；也可以手动输入或粘贴配料表文本。用户确认文本后，系统调用大语言模型接口生成结构化分析，并在单页面中展示健康关注提示。

## 技术栈

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Next.js Route Handler

## 核心功能

- 单页面 UI
- 图片上传入口
- OCR 接口：`/api/ocr`
- DeepSeek 配料表抽取
- 配料表文本输入与编辑
- LLM 分析接口：`/api/analyze`
- 结构化结果展示
- 基本错误处理

## 项目流程

```text
用户上传图片或输入配料表文本
↓
如果上传图片，则调用 /api/ocr
↓
OCR 返回原始识别文本，并由 DeepSeek 从 OCR 原文中抽取配料表文本
↓
识别文本显示在可编辑文本框中，用户确认或修改
↓
用户点击“开始分析”
↓
前端调用 /api/analyze
↓
服务端读取环境变量中的 LLM API Key
↓
服务端调用大语言模型 API
↓
返回结构化 JSON
↓
单页面展示分析结果
```

## 环境变量说明

在项目根目录创建 `.env.local`：

```bash
DEEPSEEK_API_KEY=你的 DeepSeek API Key
LLM_MODEL=deepseek-chat
OCR_API_KEY=你的 OCR 服务 Key
OCR_MODEL=PaddleOCR-VL-1.6
```

说明：

- `DEEPSEEK_API_KEY`：用于 `/api/analyze` 调用 DeepSeek 大语言模型。
- `LLM_MODEL`：可选，默认使用 `deepseek-chat`。
- `OCR_API_KEY`：用于 `/api/ocr` 调用 PaddleOCR。
- `OCR_MODEL`：可选，默认使用 `PaddleOCR-VL-1.6`。

如果没有配置 `DEEPSEEK_API_KEY` 或 `OCR_API_KEY`，对应接口会返回配置错误提示。

## 本地运行步骤

```bash
npm install
npm run dev
```

然后访问：

```text
http://localhost:3000
```

## OCR API 如何配置或替换

当前 OCR 接口位于：

```text
app/api/ocr/route.ts
```

当前已实现 PaddleOCR + DeepSeek 抽取流程。配置 `OCR_API_KEY` 和 `DEEPSEEK_API_KEY` 后，上传图片会先调用 PaddleOCR 获取 OCR 原文，再调用 DeepSeek 从 OCR 原文中提取配料表文本。

如需替换为其他 OCR 服务，可以在该文件中：

1. 读取 `process.env.OCR_API_KEY`
2. 接收前端上传的图片文件
3. 调用真实 OCR 服务
4. 将 OCR 原文交给 DeepSeek 或其他模型抽取配料表
5. 将服务返回结果整理为以下格式：

```ts
{
  rawText: string;
  cleanedText: string;
  possibleIngredientText: string;
  confidenceNote: string;
}
```

## LLM API 如何配置

分析接口位于：

```text
app/api/analyze/route.ts
```

默认使用 DeepSeek Chat Completions 兼容接口，并要求模型返回 JSON。配置 `DEEPSEEK_API_KEY` 后即可调用真实模型。

## 免责声明

本结果仅基于配料表文本生成，用于食品配料理解和一般性健康关注提示，不构成医学建议、营养诊断或食品安全判定。具体健康问题请咨询医生、营养师或相关专业人士。