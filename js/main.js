import { classifySwingType, tipsComparing, tipsFor } from "./coaching.js";
import { extractPoseFrames } from "./poseProcessor.js";
import { BatterHandedness } from "./separation.js";
import { drawSkeleton, nearestPoseFrame } from "./skeletonOverlay.js";
import { computeSwingMetrics } from "./swingMetrics.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMetricsHtml(metrics) {
  const lines = ["<h3>分析結果</h3>"];

  const timing = metrics.separationTiming;
  if (timing) {
    if (timing.topHoldDuration != null) {
      const flag = timing.topHoldDuration < 0 ? "（手が先行）" : "";
      const cls = timing.topHoldDuration < 0 ? ' class="warn"' : "";
      lines.push(`<p${cls}>トップ保持時間: ${timing.topHoldDuration.toFixed(2)}秒${flag}</p>`);
    }
    if (timing.topToFrontFootDistance != null) {
      lines.push(`<p>トップと前足の距離: 肩幅の${timing.topToFrontFootDistance.toFixed(1)}倍</p>`);
    }
  }
  lines.push(`<p>手元スピード（相対値）: ${metrics.peakHandSpeed.toFixed(2)} /秒</p>`);
  if (metrics.launchToContactDuration != null) {
    lines.push(`<p>始動 → インパクト: ${metrics.launchToContactDuration.toFixed(2)}秒</p>`);
  }

  const type = classifySwingType(metrics);
  if (type) {
    lines.push("<hr><h3>スイングタイプ</h3>");
    lines.push(`<p><strong>${escapeHtml(type.name)}</strong></p>`);
    lines.push(`<p>${escapeHtml(type.description)}</p>`);
    lines.push(`<p class="caption">${escapeHtml(type.referenceNote)}</p>`);
  }

  lines.push("<hr><h3>コーチング</h3>");
  for (const tip of tipsFor(metrics)) {
    lines.push(`<p>• ${escapeHtml(tip)}</p>`);
  }

  return lines.join("\n");
}

function createSlot(root, { title, pickerLabel }) {
  root.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <div class="video-wrap">
      <div class="placeholder">
        <div class="placeholder-icon">🏏</div>
        動画が選択されていません<br /><span>下のボタンから動画を選んでください</span>
      </div>
      <video playsinline controls style="display:none"></video>
      <canvas style="display:none"></canvas>
    </div>
    <div class="handedness">
      <label><input type="radio" name="hand-${escapeHtml(title)}" value="rightHanded" checked /> 右打者</label>
      <label><input type="radio" name="hand-${escapeHtml(title)}" value="leftHanded" /> 左打者</label>
    </div>
    <label class="file-button">
      📹 ${escapeHtml(pickerLabel)}
      <input type="file" accept="video/*" hidden />
    </label>
    <p class="status"></p>
    <div class="results"></div>
  `;

  const video = root.querySelector("video");
  const canvas = root.querySelector("canvas");
  const placeholder = root.querySelector(".placeholder");
  const fileInput = root.querySelector('input[type="file"]');
  const statusEl = root.querySelector(".status");
  const resultsEl = root.querySelector(".results");
  const handInputs = root.querySelectorAll('input[type="radio"]');

  const state = { frames: [], metrics: null, handedness: BatterHandedness.RIGHT, onUpdate: null };

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function recomputeMetrics() {
    if (state.frames.length === 0) return;
    state.metrics = computeSwingMetrics(state.frames, state.handedness);
    resultsEl.innerHTML = state.metrics ? renderMetricsHtml(state.metrics) : "";
    if (state.onUpdate) state.onUpdate();
  }

  handInputs.forEach((input) => {
    input.addEventListener("change", () => {
      state.handedness = input.value;
      recomputeMetrics();
    });
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    placeholder.style.display = "none";
    video.style.display = "block";
    canvas.style.display = "block";
    video.src = URL.createObjectURL(file);

    resultsEl.innerHTML = "";
    state.frames = [];
    state.metrics = null;
    if (state.onUpdate) state.onUpdate();
    setStatus("動画を読み込み中...");

    await new Promise((resolve) => {
      if (video.readyState >= 1) resolve();
      else video.addEventListener("loadedmetadata", resolve, { once: true });
    });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    setStatus("動画を解析中... 0%");
    try {
      const { frames } = await extractPoseFrames(video, {
        fps: 20,
        onProgress: (fraction) => setStatus(`動画を解析中... ${Math.round(fraction * 100)}%`),
      });
      state.frames = frames;
      video.currentTime = 0;
      if (frames.length === 0) {
        setStatus("関節を検出できませんでした。人物全体が映っている動画か確認してください。");
      } else {
        setStatus("");
      }
      recomputeMetrics();
    } catch (err) {
      console.error(err);
      setStatus(`分析に失敗しました: ${err.message}`);
    }
  });

  video.addEventListener("timeupdate", () => {
    drawSkeleton(canvas, nearestPoseFrame(state.frames, video.currentTime));
  });

  return state;
}

function renderComparison(container, candidateMetrics, referenceMetrics) {
  if (!candidateMetrics || !referenceMetrics) {
    container.innerHTML = "";
    return;
  }
  const lines = ["<h2>比較結果</h2>"];
  for (const tip of tipsComparing(candidateMetrics, referenceMetrics)) {
    lines.push(`<p>• ${escapeHtml(tip)}</p>`);
  }
  container.innerHTML = lines.join("\n");
}

function main() {
  const candidate = createSlot(document.getElementById("candidate-slot"), {
    title: "自分のスイング",
    pickerLabel: "スイング動画を選ぶ",
  });
  const reference = createSlot(document.getElementById("reference-slot"), {
    title: "比較用のスイング（お手本や前回の自分など）",
    pickerLabel: "比較用の動画を選ぶ",
  });

  const comparisonRoot = document.getElementById("comparison");
  const updateComparison = () => renderComparison(comparisonRoot, candidate.metrics, reference.metrics);
  candidate.onUpdate = updateComparison;
  reference.onUpdate = updateComparison;
}

main();
