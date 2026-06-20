import { NextResponse } from "next/server";
import { buildAnalyzePrompt } from "@/lib/prompts";
import type { AnalysisResult, IngredientGroupName } from "@/lib/types";

// 分析接口只接收文本，不接收图片；图片必须先经过 OCR 并由用户确认。
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ingredientText?: string };
    const ingredientText = body.ingredientText?.trim();

    if (!ingredientText) {
      return NextResponse.json({ message: "请先输入或识别配料表文本" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "未配置 DEEPSEEK_API_KEY，请配置后重启服务" }, { status: 500 });
    }

    const result = normalizeAnalysisResult(await analyzeWithDeepSeek(ingredientText, apiKey), ingredientText);
    logDebugBlock("3. DeepSeek 配料表分析结果", result);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "模型返回格式异常，请重新分析" }, { status: 502 });
    }

    return NextResponse.json({ message: "分析失败，请稍后重试" }, { status: 500 });
  }
}

// 调用 DeepSeek 的 OpenAI 兼容 Chat Completions 接口，并要求模型直接返回 JSON。
async function analyzeWithDeepSeek(ingredientText: string, apiKey: string): Promise<AnalysisResult> {
  const model = process.env.LLM_MODEL || "deepseek-chat";
  const prompt = buildAnalyzePrompt(ingredientText);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "你只输出合法 JSON，不输出 Markdown 或额外解释。"
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("LLM request failed");
  }


  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new SyntaxError("Empty model content");
  }

  return JSON.parse(content) as AnalysisResult;
}

// 固定展示 9 个配料分类，避免模型漏掉某一类导致页面栏目不完整。
const ingredientGroupNames: IngredientGroupName[] = [
  "主要原料",
  "糖类/甜味来源",
  "油脂类",
  "钠相关成分",
  "食品添加剂",
  "风味成分",
  "营养强化剂",
  "可能过敏原",
  "其他"
];

// 对模型输出做轻量规范化：限制条数、补齐分类，并保留用户确认后的原始输入。
function normalizeAnalysisResult(result: AnalysisResult, inputText: string): AnalysisResult {
  const existingGroups = new Map(result.ingredientGroups?.map((group) => [group.groupName, group.items]) ?? []);

  return {
    ...result,
    // inputText 必须保留用户确认后的原始输入，不使用模型可能改写或截断后的版本。
    inputText,
    keyPros: (result.keyPros ?? []).slice(0, 3),
    keyConcerns: (result.keyConcerns ?? []).slice(0, 3),
    ingredientGroups: ingredientGroupNames.map((groupName) => ({
      groupName,
      items: existingGroups.get(groupName) ?? []
    })),
    peopleNotes: (result.peopleNotes ?? []).slice(0, 4),
    usageAdvice: (result.usageAdvice ?? []).slice(0, 3),
    disclaimer:
      result.disclaimer ||
      "本结果仅基于配料表文本生成，用于食品配料理解和一般性健康关注提示，不构成医学建议、营养诊断或食品安全判定。具体健康问题请咨询医生、营养师或相关专业人士。"
  };
}

function logDebugBlock(title: string, content: unknown) {
  console.log(`\n========== ${title} ==========`);
  console.log(typeof content === "string" ? content : JSON.stringify(content, null, 2));
  console.log("========== END ==========\n");
}
