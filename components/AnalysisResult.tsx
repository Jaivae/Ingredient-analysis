import type { AnalysisResult as AnalysisResultType, ConcernLevel } from "@/lib/types";

interface AnalysisResultProps {
  result: AnalysisResultType | null;
}

// 将模型内部使用的英文等级转换为页面上更适合普通用户阅读的中文标签。
const levelText: Record<ConcernLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
  unknown: "未知"
};

// 不同关注等级使用不同颜色，帮助快速说明整体风险关注程度。
const levelClass: Record<ConcernLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-stone-50 text-stone-700 border-stone-200"
};

export function AnalysisResult({ result }: AnalysisResultProps) {
  if (!result) {
    return null;
  }

  // 结果区固定展示六个栏目，和需求文档中的页面结构一一对应。
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">分析结果</h2>

      <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">总览结论</h3>
            <p className="mt-1 text-sm text-stone-600">食品类型推测：{result.productTypeGuess}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-sm font-medium ${levelClass[result.overall.concernLevel]}`}
            >
              关注等级：{levelText[result.overall.concernLevel]}
            </span>
            <span className="rounded-full border border-blue-100 bg-blueSoft px-3 py-1 text-sm font-medium text-[#256aa5]">
              关注指数：{result.overall.score}/100
            </span>
          </div>
        </div>
        <p className="rounded-md bg-mint p-4 text-sm leading-7 text-ink">{result.overall.summary}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultCard title="主要优点">
          <div className="space-y-3">
            {result.keyPros.length === 0 ? (
              <p className="text-sm text-stone-500">未发现明显优点，需结合完整标签判断。</p>
            ) : null}
            {result.keyPros.slice(0, 3).map((item) => (
              <div key={item.title} className="rounded-md bg-skySoft p-3">
                <h4 className="font-medium text-ink">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>
              </div>
            ))}
          </div>
        </ResultCard>

        <ResultCard title="主要关注点">
          <div className="space-y-3">
            {result.keyConcerns.slice(0, 3).map((item) => (
              <div key={`${item.title}-${item.type}`} className="rounded-md bg-skySoft p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-medium text-ink">{item.title}</h4>
                  <span className="w-fit rounded-full bg-mint px-2.5 py-1 text-xs font-medium text-leaf">
                    {item.type}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>
              </div>
            ))}
            {result.keyConcerns.length === 0 ? (
              <p className="text-sm text-stone-500">未发现明确关注点。</p>
            ) : null}
          </div>
        </ResultCard>
      </div>

      <ResultCard title="配料分类">
        <div className="grid gap-3 md:grid-cols-2">
          {result.ingredientGroups.map((group) => (
            <div key={group.groupName} className="rounded-md border border-blue-100 bg-skySoft p-3">
              <h4 className="text-sm font-semibold text-ink">{group.groupName}</h4>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {group.items.length > 0 ? group.items.join("、") : "未识别到相关配料"}
              </p>
            </div>
          ))}
        </div>
      </ResultCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultCard title="特定人群提示">
          <div className="space-y-3">
            {result.peopleNotes.slice(0, 4).map((item) => (
              <div key={item.group} className="rounded-md bg-skySoft p-3">
                <h4 className="text-sm font-semibold text-ink">{item.group}</h4>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.advice}</p>
              </div>
            ))}
            {result.peopleNotes.length === 0 ? (
              <p className="text-sm text-stone-500">暂无特定人群提示。</p>
            ) : null}
          </div>
        </ResultCard>

        <ResultCard title="食用/选购建议">
          <ul className="space-y-2 text-sm leading-6 text-stone-700">
            {result.usageAdvice.slice(0, 3).map((item) => (
              <li key={item} className="rounded-md bg-skySoft p-3">
                {item}
              </li>
            ))}
          </ul>
        </ResultCard>
      </div>
    </section>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}
