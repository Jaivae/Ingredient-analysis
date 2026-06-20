import { NextResponse } from "next/server";
import { buildIngredientExtractionPrompt } from "@/lib/prompts";
import type { OcrResult } from "@/lib/types";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/bmp","image/tif"]);
const PADDLE_OCR_JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "识别失败，请重新上传或手动输入" }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ message: "图片过大，请上传 10MB 以内图片" }, { status: 413 });
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: "暂不支持该类型图片，建议转换为 JPG、PNG后再上传" },
        { status: 415 }
      );
    }

    const apiKey = process.env.OCR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "未配置 OCR_API_KEY，请配置后重启服务" }, { status: 500 });
    }

    const result = await runPaddleOcr(file, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR failed:", error);
    return NextResponse.json({ message: "识别失败，请重新上传或手动输入" }, { status: 500 });
  }
}

// PaddleOCR 是异步任务接口：先提交文件获得 jobId，再轮询任务状态，最后下载 JSONL 结果。
async function runPaddleOcr(file: File, apiKey: string): Promise<OcrResult> {
  const optionalPayload = {
    useDocOrientationClassify: true,  
    useDocUnwarping: true,
    useChartRecognition: false
  };

  const uploadFormData = new FormData();
  uploadFormData.append("model", process.env.OCR_MODEL || "PaddleOCR-VL-1.6");
  uploadFormData.append("optionalPayload", JSON.stringify(optionalPayload));
  uploadFormData.append("file", file);

  const jobResponse = await fetch(PADDLE_OCR_JOB_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${apiKey}`
    },
    body: uploadFormData
  });

  if (!jobResponse.ok) {
    const errorText = await jobResponse.text();
    throw new Error(`PaddleOCR job create failed: ${jobResponse.status} ${errorText}`);
  }

  const jobData = await jobResponse.json();
  const jobId = jobData?.data?.jobId;
  if (!jobId || typeof jobId !== "string") {
    throw new Error("PaddleOCR response missing jobId");
  }

  const jsonUrl = await waitForPaddleOcrResult(jobId, apiKey);
  const jsonlResponse = await fetch(jsonUrl);
  if (!jsonlResponse.ok) {
    throw new Error(`PaddleOCR result download failed: ${jsonlResponse.status}`);
  }

  const rawText = extractTextFromPaddleJsonl(await jsonlResponse.text());
  logDebugBlock("1. PaddleOCR 原始识别文本", rawText);

  const ingredientText = await extractIngredientTextWithDeepSeek(rawText);
  logDebugBlock("2. DeepSeek 从 OCR 原文中提取的配料表文本", ingredientText || "未提取到明确配料表文本");

  return {
    rawText,
    cleanedText: rawText,
    possibleIngredientText: ingredientText.trim() || rawText,
    confidenceNote:
      "已调用 PaddleOCR 真实接口识别，并使用大语言模型从 OCR 原文中提取疑似配料表。OCR 和模型抽取结果仍需人工确认。"
  };
}

// 每 3 秒查询一次 OCR 任务状态，最多等待约 108 秒。
async function waitForPaddleOcrResult(jobId: string, apiKey: string) {
  const maxAttempts = 36;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${PADDLE_OCR_JOB_URL}/${jobId}`, {
      headers: {
        Authorization: `bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`PaddleOCR polling failed: ${response.status}`);
    }

    const data = await response.json();
    const state = data?.data?.state;

    if (state === "done") {
      const jsonUrl = data?.data?.resultUrl?.jsonUrl;
      if (!jsonUrl || typeof jsonUrl !== "string") {
        throw new Error("PaddleOCR result missing jsonUrl");
      }
      return jsonUrl;
    }

    if (state === "failed") {
      throw new Error(data?.data?.errorMsg || "PaddleOCR job failed");
    }

    await sleep(3000);
  }

  throw new Error("PaddleOCR job timeout");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logDebugBlock(title: string, content: unknown) {
  console.log(`\n========== ${title} ==========`);
  console.log(typeof content === "string" ? content : JSON.stringify(content, null, 2));
  console.log("========== END ==========\n");
}

async function extractIngredientTextWithDeepSeek(ocrText: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return "";
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-chat",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "你只输出合法 JSON，不输出 Markdown 或额外解释。"
        },
        {
          role: "user",
          content: buildIngredientExtractionPrompt(ocrText)
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek ingredient extraction failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return "";
  }

  const parsed = JSON.parse(content) as { ingredientText?: string };
  return typeof parsed.ingredientText === "string" ? parsed.ingredientText : "";
}

// 将 PaddleOCR 返回的 JSONL 结果合并成一段 OCR 原始文本。
function extractTextFromPaddleJsonl(jsonlText: string) {
  const textBlocks: string[] = [];

  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = JSON.parse(trimmed);
    const layoutResults = parsed?.result?.layoutParsingResults;
    if (!Array.isArray(layoutResults)) {
      continue;
    }

    for (const item of layoutResults) {
      const markdownText = item?.markdown?.text;
      if (typeof markdownText === "string" && markdownText.trim()) {
        textBlocks.push(markdownText.trim());
      }
    }
  }

  return textBlocks.join("\n\n");
}
