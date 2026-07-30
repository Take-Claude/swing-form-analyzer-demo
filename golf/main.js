import { extractPoseFrames } from "../js/poseProcessor.js";
import { drawSkeleton, nearestPoseFrame } from "../js/skeletonOverlay.js";
import { analyzeGolfSwing } from "./golfAnalyzer.js";
import { tipsComparing, tipsFor } from "./golfCoaching.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMetricsHtml(golf) {
  const lines = ["<h3>分析結果</h3>"];
  if (golf.xFactorDegrees != null) lines.push(`<p>Xファクター（ひねり差）: ${golf.xFactorDegrees.toFixed(0)}度</p>`);
  if (golf.tempoRatio != null) lines.push(`<p>テンポ比（バックスイング:ダウンスイング）: ${golf.tempoRatio.toFixed(1)} : 1</p>`);
  if (golf.swingPlaneAngle != null) lines.push(`<p>スイングプレーンの角度: ${golf.swingPlaneAngle.toFixed(0)}度</p>`);
  lines.push(`<p>手元スピード（相対値）: ${golf.peakHandSpeed.toFixed(2)} /秒</p>`);

  lines.push("<hr><h3>コーチング</h3>");
  for (const tip of tipsFor(golf)) {
    lines.push(`<p>• ${escapeHtml(tip)}</p>`);
  }
  return lines.join("\n");
}

function createSlot(root, { title, pickerLabel }) {
  root.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <div class="video-wrap">
      <div class="placeholder">
        <div class="placeholder-icon">⛳️</div>
        動画が選択されていません<br /><span>下のボタンから動画を選んでください</span>
      </div>
      <video playsinline controls style="display:none"></video>
      <canvas style="display:none"></canvas>
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

  const state = { frames: [], metrics: null, onUpdate: null };

  function setStatus(text) {
    statusEl.textContent = text;
  }

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
      state.metrics = analyzeGolfSwing(frames);
      resultsEl.innerHTML = state.metrics
        ? renderMetricsHtml(state.metrics)
        : '<p class="warn">スイングの区切りを検出できませんでした。人物全体が映っている、始動〜インパクトが分かりやすい動画だと検出しやすくなります。</p>';
      if (state.onUpdate) state.onUpdate();
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

function renderComparison(container, candidate, reference) {
  if (!candidate || !reference) {
    container.innerHTML = "";
    return;
  }
  const lines = ["<h2>比較結果</h2>"];
  for (const tip of tipsComparing(candidate, reference)) {
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
