// Port of Core/Sources/SwingAnalysis/SwingShapeAnalyzer.swift.
import { frameJoint, handSpeedSeries, handsMidpoint, lineAngleDegrees, movingAverage, nearestFrame } from "./metrics.js";
import { SwingPhase } from "./phaseSegmenter.js";

const PEAK_SUSTAIN_FRACTION = 0.9;

function peakSpineTiltAngle(frames, from, to) {
  let maxTilt = null;
  for (const f of frames) {
    if (f.timestamp < from || f.timestamp > to) continue;
    const lh = frameJoint(f, "leftHip");
    const rh = frameJoint(f, "rightHip");
    if (!lh || !rh) continue;
    const head = frameJoint(f, "neck") ?? frameJoint(f, "nose");
    if (!head) continue;

    const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    const angleFromHorizontal = lineAngleDegrees(hipMid, head);
    const tilt = Math.abs(90 - Math.abs(angleFromHorizontal));
    if (maxTilt === null || tilt > maxTilt) maxTilt = tilt;
  }
  return maxTilt;
}

function peakSustainRatio(speedSeries, from, to) {
  const windowDuration = to - from;
  if (windowDuration <= 0) return null;

  const smoothed = movingAverage(speedSeries, 5);
  const windowed = smoothed.filter((p) => p.time >= from && p.time <= to);
  if (windowed.length === 0) return null;

  const peak = Math.max(...windowed.map((p) => p.value));
  if (peak <= 0) return null;

  const threshold = peak * PEAK_SUSTAIN_FRACTION;
  const above = windowed.filter((p) => p.value >= threshold);
  if (above.length === 0) return null;

  const minTime = Math.min(...above.map((p) => p.time));
  const maxTime = Math.max(...above.map((p) => p.time));
  return (maxTime - minTime) / windowDuration;
}

export function analyzeSwingShape(frames, phases) {
  // Requires an actual detected `.launch` phase — no falling back to a
  // degenerate flat clip's single stanceAndLoad segment, since there's no
  // real swing motion to describe the shape of in that case.
  const launch = phases.find((p) => p.phase === SwingPhase.LAUNCH);
  if (!launch) return null;
  const launchStart = launch.startTime;

  // `.contact` is deliberately a narrow instant around peak speed, and
  // stopping exactly at peak speed only captures acceleration in, never
  // deceleration through — mirror the launch->peak duration past the peak
  // as a stand-in for "through contact", clamped to the clip's end.
  const speedSeries = handSpeedSeries(frames);
  if (speedSeries.length === 0) return null;
  let peakIndex = 0;
  for (let i = 1; i < speedSeries.length; i++) {
    if (speedSeries[i].value > speedSeries[peakIndex].value) peakIndex = i;
  }
  const peak = speedSeries[peakIndex];
  if (peak.time <= launchStart) return null;

  const clipEnd = frames.length ? frames[frames.length - 1].timestamp : peak.time;
  const windowEnd = Math.min(clipEnd, peak.time + (peak.time - launchStart));

  const startFrame = nearestFrame(frames, launchStart);
  const endFrame = nearestFrame(frames, windowEnd);
  const startHands = startFrame ? handsMidpoint(startFrame) : null;
  const endHands = endFrame ? handsMidpoint(endFrame) : null;
  if (!startHands || !endHands) return null;

  const dx = Math.abs(endHands.x - startHands.x);
  const dy = Math.abs(endHands.y - startHands.y);
  const swingPlaneAngle = dx + dy > 1e-9 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;

  const spineTilt = peakSpineTiltAngle(frames, launchStart, windowEnd);
  const normalizedPlane = Math.min(Math.max(swingPlaneAngle / 90, 0), 1);
  let verticalityScore;
  if (spineTilt !== null) {
    const normalizedTilt = Math.min(Math.max(spineTilt / 90, 0), 1);
    verticalityScore = (normalizedPlane + normalizedTilt) / 2;
  } else {
    verticalityScore = normalizedPlane;
  }

  const sustainRatio = peakSustainRatio(speedSeries, launchStart, windowEnd);

  return { swingPlaneAngle, spineTiltAngle: spineTilt, verticalityScore, peakSustainRatio: sustainRatio };
}
