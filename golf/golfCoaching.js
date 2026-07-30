// Descriptive coaching text for the golf metrics — mirrors the baseball
// version's philosophy: report the number and a commonly-cited reference
// point rather than a precise pass/fail grade from an uncalibrated
// single-camera measurement, but always explain *why it matters* (what
// tends to happen as a result) in plain, non-technical language, since
// this is meant to be shared publicly.

function xFactorDescription(x) {
  const base = `バックスイングで、上半身（肩）が下半身（腰）よりどれだけ多くひねれているか（Xファクター）は約${x.toFixed(0)}度でした。`;
  if (x < 20) {
    return (
      base +
      "プロ選手でよく紹介される目安（20〜40度くらい）に比べると小さめです。肩と腰があまりひねれておらず、体を「ゴムひも」のようにためられていない状態と考えられます。" +
      "この状態だと、腕の力だけでクラブを振ることになりやすく、ヘッドスピードが上がりにくい・飛距離が出にくい傾向があるとされます。"
    );
  }
  if (x > 40) {
    return (
      base +
      "プロ選手でよく紹介される目安（20〜40度くらい）に比べると大きめです。肩と腰をしっかりひねれていて、体に力をためられている状態と考えられます。" +
      "パワーは出しやすい一方、体の柔らかさや体幹の強さが必要で、無理に大きくひねろうとすると腰などを痛めやすくなることがあるとされます。"
    );
  }
  return base + "プロ選手でよく紹介される目安（20〜40度くらい）に近い値です。";
}

function tempoDescription(ratio) {
  const base = `バックスイング（振りかぶり）とダウンスイング（振り下ろし）にかかった時間の比率は約${ratio.toFixed(1)}:1でした。`;
  if (ratio < 2) {
    return (
      base +
      "プロ選手の平均としてよく紹介される3:1に比べると小さめです。振りかぶりに対して振り下ろしがあまり速くなっておらず、" +
      "「じっくりためて、一気に振る」というメリハリが少ない状態と考えられます。この場合、振り下ろしでの加速が乏しくなり、ヘッドスピードや飛距離が出にくくなる傾向があるとされます。"
    );
  }
  if (ratio > 4) {
    return (
      base +
      "プロ選手の平均としてよく紹介される3:1に比べると大きめです。振りかぶりに対して振り下ろしがかなり速く、メリハリの効いたスイングになっていると考えられます。" +
      "ただしこの差が極端に大きい場合は、振り下ろしが急ぎすぎてタイミングが崩れやすくなることもあるとされます。"
    );
  }
  return base + "プロ選手の平均としてよく紹介される3:1に近い、バランスの取れた比率です。";
}

function swingPlaneDescription(angle) {
  return (
    `振り下ろし中に手がどのくらいの角度で動いているか（スイングプレーン）は約${angle.toFixed(0)}度でした` +
    "（0度に近いほど横方向に平らな軌道、90度に近いほど縦方向に立った軌道です）。" +
    "角度が大きい（縦方向的な）スイングはボールを上から鋭角に捉えやすく、角度が小さい（横方向的な）スイングは緩やかな軌道でボールを払うように捉えやすいとされます。" +
    "どちらが良いというより、使うクラブや体格によって適した角度が変わる指標です。"
  );
}

export function tipsFor(golf) {
  const tips = [];

  if (golf.xFactorDegrees != null) tips.push(xFactorDescription(golf.xFactorDegrees));
  if (golf.tempoRatio != null) tips.push(tempoDescription(golf.tempoRatio));
  if (golf.swingPlaneAngle != null) tips.push(swingPlaneDescription(golf.swingPlaneAngle));

  if (tips.length === 0) {
    tips.push(
      "スイングの区切り（バックスイング〜インパクト）をうまく検出できなかったため、詳しい分析はできませんでした。" +
        "人物全体がフレームに収まっている動画だと検出しやすくなります。"
    );
  }
  return tips;
}

const OUTCOME_HINTS = {
  xFactorDegrees: {
    up: "ひねり差が大きくなった分、体に力をためやすくなっている可能性がありますが、無理をしていないかも確認しましょう。",
    down: "ひねり差が小さくなった分、腕の力に頼りやすくなり、ヘッドスピードが落ちやすい可能性があります。",
  },
  tempoRatio: {
    up: "振り下ろしがより速くなり、メリハリが強くなっている可能性があります。急ぎすぎてタイミングが崩れていないかも確認しましょう。",
    down: "振り下ろしの加速が控えめになり、ヘッドスピードが出にくくなっている可能性があります。",
  },
  swingPlaneAngle: {
    up: "より縦方向的な軌道になり、上からボールを鋭角に捉えやすくなっている可能性があります。",
    down: "より横方向的な軌道になり、緩やかな軌道でボールを払うように捉えやすくなっている可能性があります。",
  },
};

export function tipsComparing(candidate, reference) {
  const tips = [];

  const compareField = (name, label, unit, threshold) => {
    if (candidate[name] == null || reference[name] == null) return;
    const diff = candidate[name] - reference[name];
    if (Math.abs(diff) < threshold) return;
    const direction = diff > 0 ? "大きく" : "小さく";
    const hint = OUTCOME_HINTS[name]?.[diff > 0 ? "up" : "down"] ?? "";
    tips.push(`${label}が基準スイングより${Math.abs(diff).toFixed(1)}${unit}${direction}なりました。${hint}`);
  };

  compareField("xFactorDegrees", "ひねり差（Xファクター）", "度", 3);
  compareField("tempoRatio", "テンポ比", "", 0.2);
  compareField("swingPlaneAngle", "スイングの軌道の角度", "度", 5);

  if (tips.length === 0) tips.push("基準スイングと大きな差は見られません。");
  return tips;
}
