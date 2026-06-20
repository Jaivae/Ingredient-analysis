"use client";

import { useState } from "react";
import { AnalysisResult } from "@/components/AnalysisResult";
import type { AnalysisResult as AnalysisResultType, OcrResult } from "@/lib/types";

export default function Home() {
  // 单页面原型只需要少量本地状态，不引入复杂状态管理库。
  const [file, setFile] = useState<File | null>(null);
  const [ingredientText, setIngredientText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultType | null>(null);
  const [error, setError] = useState("");
  const [loadingText, setLoadingText] = useState("");
  const isLoading = Boolean(loadingText);

  // OCR 流程：前端只负责上传图片，真实识别逻辑放在服务端 Route Handler 中。
  async function handleOcr() {
    setError("");
    setAnalysisResult(null);

    if (!file) {
      setError("请先上传配料表图片");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("图片过大，请上传 10MB 以内图片");
      return;
    }

    if (!["image/jpeg", "image/png", "image/bmp","image/tif"].includes(file.type)) {
      setError("图片格式不支持，建议转换为 JPG、PNG 后再上传");
      return;
    }

    try {
      setLoadingText("正在识别图片文字...");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "识别失败，请重新上传或手动输入");
        return;
      }

      const ocrResult = data as OcrResult;
      // OCR 结果必须先回填到文本框，允许用户人工确认和修正后再进入 LLM 分析。
      setIngredientText(ocrResult.possibleIngredientText || ocrResult.cleanedText || ocrResult.rawText);
    } catch {
      setError("识别失败，请重新上传或手动输入");
    } finally {
      setLoadingText("");
    }
  }

  // LLM 分析流程：将用户确认后的配料表文本提交给后端，由后端读取 API Key 并调用模型。
  async function handleAnalyze() {
    setError("");
    setAnalysisResult(null);

    if (!ingredientText.trim()) {
      setError("请先输入或识别配料表文本");
      return;
    }

    try {
      setLoadingText("正在生成结构化分析...");
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ingredientText })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "分析失败，请稍后重试");
        return;
      }

      setAnalysisResult(data as AnalysisResultType);
    } catch {
      setError("分析失败，请稍后重试");
    } finally {
      setLoadingText("");
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-normal text-ink sm:text-3xl">
            加工食品配料表解析与健康关注提示原型系统
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
            基于OCR与LLM实现的面向普通消费者的轻量级单页面原型。用户可上传配料表图片或手动输入文本，确认后由大语言模型生成结构化分析结果。
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-ink">图片上传</h2>
              <p className="mt-1 text-sm text-stone-600">
                上传食品包装配料表图片，识别后会先进入文本框，以便确认。
              </p>
            </div>
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-skySoft px-4 py-6 text-center transition hover:border-leaf hover:bg-mint">
              <span className="text-sm font-medium text-ink">
                {file ? file.name : "点击选择图片"}
              </span>
              <span className="mt-2 text-xs text-stone-500">支持 JPG、PNG、WebP，大小不超过 5MB</span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isLoading}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </section>

          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-ink">配料表文本确认</h2>
              <p className="mt-1 text-sm text-stone-600">
                可手动输入，也可修改 OCR 识别结果后再分析。
              </p>
            </div>
            <textarea
              value={ingredientText}
              onChange={(event) => setIngredientText(event.target.value)}
              disabled={isLoading}
              placeholder="请输入或粘贴配料表文本，例如：配料：植物油、白砂糖、食用盐..."
              className="min-h-44 w-full resize-y rounded-lg border border-blue-100 bg-white p-4 text-sm leading-7 outline-none transition placeholder:text-stone-400 focus:border-leaf focus:ring-2 focus:ring-mint disabled:cursor-not-allowed disabled:bg-stone-50"
            />
          </section>
        </div>

        <section className="mt-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleOcr}
              disabled={isLoading || !file}
              className="rounded-md bg-leaf px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#21885f] disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              识别图片文字
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="rounded-md bg-[#2f80c4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#256aa5] disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              开始分析
            </button>
          </div>
        </section>

        <div className="mt-5 space-y-4">
          {loadingText ? (
            <div className="rounded-lg border border-blue-100 bg-white p-4 text-sm text-stone-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-leaf" />
                <span>{loadingText}</span>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <AnalysisResult result={analysisResult} />
        </div>

        <footer className="mt-8 rounded-lg border border-stone-200 bg-white p-5 text-xs leading-6 text-stone-500 shadow-sm">
          免责声明：本系统仅用于食品配料理解和一般性健康关注提示，不构成医学建议、营养诊断或食品安全判定。具体健康问题请咨询医生、营养师或相关专业人士。
        </footer>
      </div>
    </main>
  );
}
