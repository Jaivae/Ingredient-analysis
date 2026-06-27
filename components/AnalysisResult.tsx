import type { AnalysisResult as AnalysisResultType, ConcernLevel } from "@/lib/types";

interface AnalysisResultProps {
  result: AnalysisResultType | null;
}

// 模型返回英文等级，页面展示时转为中文，便于普通用户理解。
const levelText: Record<ConcernLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
  unknown: "未知"
};

// 不同关注等级使用不同颜色，形成清晰的健康关注语义。
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

  // 空分类不展示，避免页面出现大量“未识别到相关配料”的无效信息。
  const visibleIngredientGroups = result.ingredientGroups.filter((group) => group.items.length > 0);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">分析结果</h2>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">总览结论</h3>
            <p className="mt-1 text-sm text-stone-600">食品类型推测：{result.productTypeGuess}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-sm font-medium ${levelClass[result.overall.concernLevel]}`}>
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
        <ResultSection title="主要优点">
          <div className="space-y-3">
            {result.keyPros.length === 0 ? (
              <p className="text-sm text-stone-500">未发现明显优点，需结合完整标签判断。</p>
            ) : null}
            {/* 优点使用绿色，表示相对积极的信息。 */}
            {result.keyPros.slice(0, 3).map((item) => (
              <div key={item.title} className="border-l-4 border-emerald-300 bg-emerald-50/70 px-4 py-3">
                <h4 className="font-medium text-emerald-800">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>
              </div>
            ))}
          </div>
        </ResultSection>

        <ResultSection title="主要关注点">
          <div className="space-y-3">
            {/* 关注点使用橙色，提示用户需要留意但不制造恐慌。 */}
            {result.keyConcerns.slice(0, 3).map((item) => (
              <div key={`${item.title}-${item.type}`} className="border-l-4 border-amber-300 bg-amber-50/80 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="font-medium text-amber-900">{item.title}</h4>
                  <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-700">
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
        </ResultSection>
      </div>

      <ResultSection title="配料分类">
        {visibleIngredientGroups.length === 0 ? (
          <p className="text-sm text-stone-500">未识别到明确配料分类。</p>
        ) : (
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {visibleIngredientGroups.map((group) => (
              <div key={group.groupName} className="border-t border-blue-100 pt-3">
                <h4 className="text-sm font-semibold text-ink">{group.groupName}</h4>
                <p className="mt-2 text-sm leading-6 text-stone-600">{group.items.join("、")}</p>
              </div>
            ))}
          </div>
        )}
      </ResultSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="特定人群提示">
          <div className="space-y-3">
            {result.peopleNotes.slice(0, 4).map((item) => (
              <div key={item.group} className="border-t border-blue-100 pt-3">
                <h4 className="text-sm font-semibold text-ink">{item.group}</h4>
                <p className="mt-2 text-sm leading-6 text-stone-600">{item.advice}</p>
              </div>
            ))}
            {result.peopleNotes.length === 0 ? (
              <p className="text-sm text-stone-500">暂无特定人群提示。</p>
            ) : null}
          </div>
        </ResultSection>

        <ResultSection title="食用/选购建议">
          <ul className="space-y-3 text-sm leading-6 text-stone-700">
            {result.usageAdvice.slice(0, 3).map((item) => (
              <li key={item} className="border-t border-blue-100 pt-3">
                {item}
              </li>
            ))}
          </ul>
        </ResultSection>
      </div>
    </section>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}
