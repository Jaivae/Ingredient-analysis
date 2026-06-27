// 整体配料关注等级。unknown 用于信息不足或模型无法判断的情况。
export type ConcernLevel = "low" | "medium" | "high" | "unknown";

// 主要关注点类型必须限定在这些值内，便于前端稳定展示和答辩说明。
export type ConcernType =
  | "添加糖"
  | "高钠来源"
  | "油脂风险线索"
  | "食品添加剂"
  | "甜味剂"
  | "色素"
  | "防腐剂"
  | "咖啡因"
  | "过敏原"
  | "配料复杂度"
  | "其他";

// 配料分组名称保持固定，避免模型自由发挥导致页面栏目不可控。
export type IngredientGroupName =
  | "主要原料"
  | "糖类/甜味来源"
  | "油脂类"
  | "钠相关成分"
  | "食品添加剂"
  | "风味成分"
  | "营养强化剂"
  | "可能过敏原"
  | "其他";

// 特定人群提示的候选范围，原型系统不做个体健康档案。
export type PeopleGroup =
  | "儿童"
  | "控糖人群"
  | "控钠/高血压人群"
  | "孕妇"
  | "咖啡因敏感人群"
  | "过敏体质人群"
  | "减脂/控能量人群"
  | "其他";

export interface Overall {
  concernLevel: ConcernLevel;
  score: number;
  summary: string;
}

export interface KeyPro {
  title: string;
  description: string;
}

export interface KeyConcern {
  title: string;
  type: ConcernType;
  description: string;
}

export interface IngredientGroup {
  groupName: IngredientGroupName;
  items: string[];
}

export interface PeopleNote {
  group: PeopleGroup;
  advice: string;
}

// LLM 分析结果的完整结构，对应页面中的六个展示栏目。
export interface AnalysisResult {
  inputText: string;
  productTypeGuess: string;
  overall: Overall;
  keyPros: KeyPro[];
  keyConcerns: KeyConcern[];
  ingredientGroups: IngredientGroup[];
  peopleNotes: PeopleNote[];
  usageAdvice: string[];
  disclaimer: string;
}

// OCR 接口返回的结构。possibleIngredientText 用于优先回填文本框。
export interface OcrResult {
  rawText: string;
  cleanedText: string;
  possibleIngredientText: string;
  confidenceNote: string;
}
