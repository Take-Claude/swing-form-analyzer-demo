// Port of Core/Sources/Coaching/CoachingTipGenerator.swift + SwingTypeClassifier.swift.
import { compareSwings } from "./comparator.js";

const LONG_LAUNCH_TO_CONTACT_THRESHOLD = 0.25;
const SIGNIFICANT_PERCENT_DIFFERENCE = 15;
const SIGNIFICANT_HOLD_DURATION_DIFFERENCE = 0.03;

export function tipsFor(metrics) {
  const tips = [];

  if (metrics.separationTiming) {
    tips.push(...separationTips(metrics.separationTiming));
  } else {
    tips.push(
      "スイングの区切り（始動〜インパクト）をうまく検出できなかったため、トップの位置に関する分析はできませんでした。" +
        "人物全体がフレームに収まっている動画だと検出しやすくなります。"
    );
  }

  if (metrics.launchToContactDuration != null && metrics.launchToContactDuration > LONG_LAUNCH_TO_CONTACT_THRESHOLD) {
    tips.push(
      "始動からインパクトまでの時間がやや長めです。実戦の球速に対してタイミングが合わせにくく、" +
        "差し込まれたり詰まった打球になりやすい傾向があります。始動をもう少し早める、" +
        "あるいはトップの位置をコンパクトにすると縮められることがあります。"
    );
  }

  if (tips.length === 0) {
    tips.push("測定できた範囲では大きな崩れは見当たりません。今のフォームの感覚を大事にしましょう。");
  }
  return tips;
}

function separationTips(timing) {
  const tips = [];
  if (timing.topHoldDuration == null) {
    if (timing.topToFrontFootDistance != null) tips.push(topToFrontFootDistanceDescription(timing.topToFrontFootDistance));
    return tips;
  }

  if (timing.topHoldDuration < 0) {
    tips.push(
      "下半身が回り始めるより先に、手（トップの位置）が動き出しているようです。いわゆる「手打ち」に近い状態で、" +
        "体全体の力をバットに伝えにくく、パワーが落ちやすい傾向があります。下半身の始動を早める、" +
        "または手をもう少し我慢させる意識を持つと改善しやすいです。"
    );
  } else {
    tips.push(
      `下半身が回り始めてから約${timing.topHoldDuration.toFixed(2)}秒、トップの位置を保てています。` +
        "この「ため」の時間が長いほど、長距離打者に多い傾向があると言われます。"
    );
  }

  if (timing.topToFrontFootDistance != null) tips.push(topToFrontFootDistanceDescription(timing.topToFrontFootDistance));
  return tips;
}

function topToFrontFootDistanceDescription(distance) {
  return (
    `トップの位置と前足の距離は肩幅の約${distance.toFixed(1)}倍でした。この距離が大きいほど長距離打者に多い傾向があるとされます` +
    "（体格や打法にもよるため、あくまで一般的な傾向です）。"
  );
}

export function tipsComparing(candidate, reference) {
  const result = compareSwings(candidate, reference);
  const tips = [];

  for (const delta of result.deltas) {
    if (delta.name === "topHoldDuration") {
      if (Math.abs(delta.difference) < SIGNIFICANT_HOLD_DURATION_DIFFERENCE) continue;
      const isLonger = delta.difference > 0;
      const header = `トップ保持時間が基準スイングより${Math.abs(delta.difference).toFixed(2)}秒${isLonger ? "長くなりました" : "短くなりました"}。`;
      tips.push(`${header} ${comparisonExplanation("topHoldDuration", isLonger)}`);
      continue;
    }

    if (delta.percentDifference == null || Math.abs(delta.percentDifference) < SIGNIFICANT_PERCENT_DIFFERENCE) continue;
    const isHigher = delta.percentDifference > 0;
    const direction = isHigher ? "上回りました" : "下回りました";
    const header = `${displayName(delta.name)}が基準スイングを${Math.round(Math.abs(delta.percentDifference))}%${direction}。`;
    const explanation = comparisonExplanation(delta.name, isHigher);
    tips.push(explanation ? `${header} ${explanation}` : header);
  }

  if (tips.length === 0) tips.push("基準スイングと大きな差は見られません。今の感覚を大事にしましょう。");
  return tips;
}

function comparisonExplanation(name, isHigher) {
  switch (name) {
    case "peakHandSpeed":
      return isHigher
        ? "基準スイングが良い状態のものなら、力強く振れている可能性があります。ただしフォームが崩れて力任せになっていないかも見比べてみましょう。"
        : "バットが加速しきる前にインパクトを迎えている可能性があり、打球の強さや飛距離が落ちやすくなります。";
    case "topHoldDuration":
      return isHigher
        ? "下半身が回り始めてからトップの位置をより長く保てています。「ため」が強くなっている可能性があります。"
        : "トップの位置を保てている時間が基準スイングより短くなっています。下半身が回り始める前に手が動き出していないか確認してみましょう。";
    case "topToFrontFootDistance":
      return isHigher
        ? "トップの位置と前足の距離が基準スイングより大きくなっています。より大きな「ため」が作れている可能性があります。"
        : "トップの位置と前足の距離が基準スイングより小さくなっています。ためが浅くなっていないか確認しましょう。";
    case "launchToContactDuration":
      return isHigher
        ? "始動からインパクトまでの時間が基準スイングより長くなっています。タイミングが取りにくく、差し込まれやすくなる可能性があります。"
        : "始動からインパクトまでの時間が基準スイングより短くなっています。コンパクトに振れている可能性があります。";
    default:
      return "";
  }
}

function displayName(name) {
  switch (name) {
    case "peakHandSpeed":
      return "手元のスピード（相対値）";
    case "topHoldDuration":
      return "トップ保持時間";
    case "topToFrontFootDistance":
      return "トップと前足の距離";
    case "launchToContactDuration":
      return "始動からインパクトまでの時間";
    default:
      return name;
  }
}

const HIGH_THRESHOLD = 0.6;
const LOW_THRESHOLD = 0.4;

export function classifySwingType(metrics) {
  const shape = metrics.swingShape;
  if (!shape) return null;

  const verticalityLabel = axisLabel(shape.verticalityScore, "縦回転", "横回転");
  const styleLabel = shape.peakSustainRatio != null ? axisLabel(shape.peakSustainRatio, "スインガー", "パンチャー") : null;
  const name = [verticalityLabel, styleLabel].filter(Boolean).join("・");
  const description =
    `手の軌道と上半身の傾きから見て${verticalityLabel}、` +
    (styleLabel ? `スイングスピードのピークの持続時間から見て${styleLabel}、` : "") +
    "という傾向が出ています。";

  return { name, description, referenceNote: referenceNote(shape.verticalityScore, shape.peakSustainRatio) };
}

function axisLabel(score, highName, lowName) {
  if (score >= HIGH_THRESHOLD) return `${highName}寄り`;
  if (score <= LOW_THRESHOLD) return `${lowName}寄り`;
  return `${lowName}と${highName}の中間（斜め）`;
}

function referenceNote(verticalityScore, sustainRatio) {
  const vertical = verticalityScore >= HIGH_THRESHOLD;
  const horizontal = verticalityScore <= LOW_THRESHOLD;
  const s = sustainRatio ?? 0.5;
  const swinger = s >= HIGH_THRESHOLD;
  const puncher = s <= LOW_THRESHOLD;

  let examples;
  if (vertical && puncher) examples = "ボンズ選手、トラウト選手、ジャッジ選手 など";
  else if (vertical && swinger) examples = "イチロー選手、ピート・ローズ選手、ルース選手 など";
  else if (horizontal && puncher) examples = "筒香選手、松中選手、城島選手 など";
  else if (horizontal && swinger) examples = "川上哲治選手、テッド・ウィリアムズ選手、野村選手 など";
  else examples = "大谷翔平選手（渡米前）、落合博満選手、清原和博選手 など、縦横・パンチャー/スインガーの中間タイプとされる選手";

  return (
    `参考までに、似たタイプとして語られることがある選手の例: ${examples}` +
    "（ユーザー提供の分類図をもとにした大まかな目安で、実測データによる一致ではありません。閾値も仮の値です）"
  );
}
