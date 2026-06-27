"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisResult } from "@/components/AnalysisResult";
import type { AnalysisResult as AnalysisResultType, OcrResult } from "@/lib/types";

type TaskStatus = "待识别" | "识别中" | "待分析" | "分析中" | "已完成" | "失败";

// 批量上传任务
interface BatchTask {
  id: string;
  file: File;
  fileName: string;
  thumbnailUrl: string;
  status: TaskStatus;
  ingredientText: string;
  analysisResult: AnalysisResultType | null;
  error: string;
}

// 历史记录
interface HistoryRecord {
  id: string;
  title: string;
  createdAt: string;
  ingredientText: string;
  thumbnailUrl?: string;
  result: AnalysisResultType;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const HISTORY_KEY = "ingredient-analysis-history";
const HISTORY_LIMIT = 20;
const FALLBACK_HISTORY_LIMIT = 10;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/bmp", "image/tif"];

// 页面主逻辑
export default function Home() {
  // 批量上传任务、手动输入和历史记录都保存在前端状态中，不引入额外状态管理库。
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [manualText, setManualText] = useState("");
  const [manualResult, setManualResult] = useState<AnalysisResultType | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [error, setError] = useState("");
  const [loadingText, setLoadingText] = useState("");

  // 当前页面只展示一个“当前项”：选中图片任务时展示任务内容，否则展示手动输入内容。
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );
  const currentText = selectedTask ? selectedTask.ingredientText : manualText;
  const currentResult = selectedTask ? selectedTask.analysisResult : manualResult;
  const isLoading = Boolean(loadingText);

  // 页面打开时从浏览器本地读取历史记录；读取失败时清空异常数据。
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) {
      return;
    }

    try {
      setHistory(JSON.parse(saved) as HistoryRecord[]);
    } catch {
      localStorage.removeItem(HISTORY_KEY);
    }
  }, []);

  // 更新任务状态
  function updateTask(id: string, changes: Partial<BatchTask>) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...changes } : task)));
  }

  // 标记任务失败
  function markTaskFailed(id: string, message: string) {
    updateTask(id, { status: "失败", error: message });
  }

  // 历史记录保存在 localStorage。这里只保存压缩缩略图，不保存原始图片。
  function saveHistory(result: AnalysisResultType, sourceName: string, thumbnailUrl?: string) {
    const record: HistoryRecord = {
      id: crypto.randomUUID(),
      title: result.productTypeGuess || sourceName || "配料表分析",
      createdAt: new Date().toLocaleString("zh-CN"),
      ingredientText: result.inputText,
      thumbnailUrl,
      result
    };

    setHistory((current) => {
      const next = [record, ...current].slice(0, HISTORY_LIMIT);
      try {
        // 保存历史记录
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      } catch {
        // 如果浏览器本地存储接近上限，就减少保留条数，避免影响主流程。
        const shorterHistory = [record, ...current].slice(0, FALLBACK_HISTORY_LIMIT);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(shorterHistory));
          return shorterHistory;
        } catch {
          return current;
        }
      }
    });
  }

  // 选择图片后先生成前端任务和缩略图，真正 OCR 仍由用户点击按钮触发。
  async function handleFiles(files: FileList | null) {
    setError("");

    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    try {
      setLoadingText("正在生成图片缩略图...");
      const validTasks: BatchTask[] = [];
      for (const file of selectedFiles) {
        if (file.size > MAX_IMAGE_SIZE) {
          setError("部分图片超过 10MB，已跳过。请上传 10MB 以内图片");
          continue;
        }

        if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          setError("部分图片格式不支持，已跳过。建议转换为 JPG、PNG 后再上传");
          continue;
        }

        validTasks.push({
          id: crypto.randomUUID(),
          file,
          fileName: file.name,
          thumbnailUrl: await createImageThumbnail(file),
          status: "待识别",
          ingredientText: "",
          analysisResult: null,
          error: ""
        });
      }

      if (validTasks.length === 0) {
        return;
      }

      setTasks((current) => [...validTasks, ...current]);
      setSelectedTaskId(validTasks[0].id);
    } finally {
      setLoadingText("");
    }
  }

  // 调用服务端 OCR 接口，识别结果先回填到文本框，用户确认后才进入分析。
  async function recognizeTask(task: BatchTask) {
    updateTask(task.id, { status: "识别中", error: "" });

    const formData = new FormData();
    formData.append("file", task.file);

    const response = await fetch("/api/ocr", {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "识别失败，请重新上传或手动输入");
    }

    const ocrResult = data as OcrResult;
    updateTask(task.id, {
      status: "待分析",
      ingredientText: ocrResult.possibleIngredientText || ocrResult.cleanedText || ocrResult.rawText
    });
  }

  // 统一封装分析请求，前端不直接接触 DeepSeek API Key。
  async function analyzeText(ingredientText: string) {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ingredientText })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "分析失败，请稍后重试");
    }

    return data as AnalysisResultType;
  }

  // 识别当前图片
  async function handleRecognizeSelected() {
    if (!selectedTask) {
      setError("请先上传配料表图片");
      return;
    }

    try {
      setError("");
      setLoadingText("正在识别当前图片文字...");
      await recognizeTask(selectedTask);
    } catch (err) {
      markTaskFailed(selectedTask.id, err instanceof Error ? err.message : "识别失败，请重新上传或手动输入");
      setError("识别失败，请重新上传或手动输入");
    } finally {
      setLoadingText("");
    }
  }

  // 批量识别图片
  async function handleRecognizeAll() {
    const pendingTasks = tasks.filter((task) => task.status === "待识别");
    if (pendingTasks.length === 0) {
      setError("没有待识别的图片");
      return;
    }

    setError("");
    for (let index = 0; index < pendingTasks.length; index += 1) {
      const task = pendingTasks[index];
      setSelectedTaskId(task.id);
      setLoadingText(`正在识别第 ${index + 1}/${pendingTasks.length} 张图片...`);

      try {
        await recognizeTask(task);
      } catch (err) {
        markTaskFailed(task.id, err instanceof Error ? err.message : "识别失败，请重新上传或手动输入");
      }
    }

    setLoadingText("");
  }

  // 分析当前文本：可能来自选中的图片任务，也可能来自用户手动输入。
  async function handleAnalyzeCurrent() {
    const text = currentText.trim();
    if (!text) {
      setError("请先输入或识别配料表文本");
      return;
    }

    try {
      setError("");
      setLoadingText("正在生成结构化分析...");
      if (selectedTask) {
        updateTask(selectedTask.id, { status: "分析中", error: "" });
      }

      const result = await analyzeText(text);
      saveHistory(result, selectedTask?.fileName ?? "手动输入", selectedTask?.thumbnailUrl);

      if (selectedTask) {
        updateTask(selectedTask.id, { status: "已完成", analysisResult: result });
      } else {
        setManualResult(result);
      }
    } catch (err) {
      if (selectedTask) {
        markTaskFailed(selectedTask.id, err instanceof Error ? err.message : "分析失败，请稍后重试");
      }
      setError("分析失败，请稍后重试");
    } finally {
      setLoadingText("");
    }
  }

  // 批量分析图片
  async function handleAnalyzeAll() {
    const readyTasks = tasks.filter((task) => task.ingredientText.trim());
    if (readyTasks.length === 0) {
      setError("请先识别图片文字，或在当前文本框中手动输入配料表文本");
      return;
    }

    setError("");
    for (let index = 0; index < readyTasks.length; index += 1) {
      const task = readyTasks[index];
      setSelectedTaskId(task.id);
      setLoadingText(`正在分析第 ${index + 1}/${readyTasks.length} 条配料表...`);

      try {
        updateTask(task.id, { status: "分析中", error: "" });
        const result = await analyzeText(task.ingredientText);
        saveHistory(result, task.fileName, task.thumbnailUrl);
        updateTask(task.id, { status: "已完成", analysisResult: result });
      } catch (err) {
        markTaskFailed(task.id, err instanceof Error ? err.message : "分析失败，请稍后重试");
      }
    }

    setLoadingText("");
  }

  // 用户修改文本后，清空旧分析结果，避免展示与当前文本不一致的结果。
  function handleCurrentTextChange(value: string) {
    if (selectedTask) {
      updateTask(selectedTask.id, {
        ingredientText: value,
        analysisResult: null,
        status: value.trim() ? "待分析" : selectedTask.status
      });
    } else {
      setManualText(value);
      setManualResult(null);
    }
  }

  // 历史记录只回填文本和分析结果，不会重新创建图片任务。
  function loadHistoryRecord(record: HistoryRecord) {
    setSelectedTaskId("");
    setManualText(record.ingredientText);
    setManualResult(record.result);
    setError("");
  }

  // 清空当前浏览器里的本地历史记录。
  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-10 mt-10 text-center text-2xl font-bold tracking-normal text-ink sm:text-3xl">
          加工食品配料表解析与健康关注提示系统
        </h1>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-skySoft px-4 py-6 text-center transition hover:border-leaf hover:bg-mint">
            <span className="text-lg font-semibold text-ink">上传图片</span>
            <span className="mt-2 text-xs text-stone-500">支持批量上传，支持 JPG、PNG、BMP、TIF 格式，单张不超过 10MB</span>
            <input
              className="sr-only"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/bmp,image/tif,image/tiff"
              disabled={isLoading}
              onChange={(event) => handleFiles(event.target.files)}
            />
          </label>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col">
              <div className="flex-1">
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-ink">任务列表</h2>
                  <span className="rounded-full bg-blueSoft px-3 py-1 text-xs font-medium text-[#256aa5]">
                    {tasks.length} 项
                  </span>
                </div>

                <div className="space-y-1">
                  {tasks.length === 0 ? (
                    <p className="rounded-md bg-skySoft p-3 text-sm text-stone-500">
                      暂无图片任务。可选择上方上传图片，或直接输入配料表文本。
                    </p>
                  ) : null}

                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`w-full rounded-md px-3 py-2 text-left transition ${
                        selectedTaskId === task.id ? "bg-mint" : "hover:bg-skySoft"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Thumbnail src={task.thumbnailUrl} label="图" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{task.fileName}</span>
                          <span className="mt-1 flex items-center justify-between gap-2 text-xs text-stone-500">
                            <span>{task.status}</span>
                            {task.error ? <span className="text-red-600">有错误</span> : null}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleRecognizeSelected}
                  disabled={isLoading || !selectedTask}
                  className="rounded-md border border-leaf px-4 py-3 text-sm font-medium text-leaf transition hover:bg-mint disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300"
                >
                  识别当前图片
                </button>
                <button
                  type="button"
                  onClick={handleRecognizeAll}
                  disabled={isLoading || tasks.every((task) => task.status !== "待识别")}
                  className="rounded-md border border-blue-200 px-4 py-3 text-sm font-medium text-[#256aa5] transition hover:bg-skySoft disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300"
                >
                  批量识别
                </button>
                <button
                  type="button"
                  onClick={handleAnalyzeAll}
                  disabled={isLoading || tasks.length === 0}
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
                >
                  批量分析
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              <h2 className="mb-3 text-lg font-semibold text-ink">配料表输入/确认</h2>
              <textarea
                value={currentText}
                onChange={(event) => handleCurrentTextChange(event.target.value)}
                disabled={isLoading}
                placeholder="请输入或粘贴配料表文本，例如：配料：植物油、白砂糖、食用盐..."
                className="min-h-64 w-full flex-1 resize-y rounded-lg border border-blue-100 bg-white p-4 text-sm leading-7 outline-none transition placeholder:text-stone-400 focus:border-leaf focus:ring-2 focus:ring-mint disabled:cursor-not-allowed disabled:bg-stone-50"
              />

              {selectedTask?.error ? (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{selectedTask.error}</p>
              ) : null}

              <div className="mt-4 flex justify-center lg:justify-end">
                <button
                  type="button"
                  onClick={handleAnalyzeCurrent}
                  disabled={isLoading}
                  className="w-full rounded-md bg-leaf px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#21885f] disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto lg:min-w-36"
                >
                  分析当前项
                </button>
              </div>
            </div>
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

          <AnalysisResult result={currentResult} />
        </div>

        <section className="mt-6 rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-ink">历史记录</h2>
            <button
              type="button"
              onClick={clearHistory}
              disabled={history.length === 0}
              className="w-fit rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-300"
            >
              清空历史
            </button>
          </div>

          {history.length === 0 ? (
            <p className="rounded-md bg-skySoft p-3 text-sm text-stone-500">
              暂无历史记录。完成分析后，结果会自动保存。
            </p>
          ) : (
            <div className="divide-y divide-blue-100">
              {history.map((record) => (
                <div key={record.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Thumbnail src={record.thumbnailUrl} label="文" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{record.title}</p>
                      <p className="mt-1 text-xs text-stone-500">{record.createdAt}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadHistoryRecord(record)}
                    className="w-fit rounded-md bg-mint px-3 py-2 text-sm font-medium text-leaf transition hover:bg-[#d7f0e8]"
                  >
                    查看
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 rounded-lg border border-stone-200 bg-white p-5 text-xs leading-6 text-stone-500 shadow-sm">
          免责声明：本系统仅用于食品配料理解和一般性健康关注提示，不构成医学建议、营养诊断或食品安全判定。具体健康问题请咨询医生、营养师或相关专业人士。
        </footer>
      </div>
    </main>
  );
}

// 图片缩略图组件
function Thumbnail({ src, label }: { src?: string; label: string }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-blue-100 bg-skySoft text-xs font-medium text-stone-500">
      {src ? (
        <img src={src} alt="上传图片缩略图" className="h-full w-full object-cover" />
      ) : (
        label
      )}
    </span>
  );
}

// 创建图片缩略图
function createImageThumbnail(file: File) {
  return new Promise<string>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxSize = 96;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve("");
    };

    image.src = objectUrl;
  });
}
