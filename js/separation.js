// Port of Core/Sources/SwingAnalysis/SeparationAnalyzer.swift + BatterHandedness.swift.
import { frameJoint, handsMidpoint, hipRotationSpeedSeries, movingAverage, nearestFrame, peakOf } from "./metrics.js";
import { SwingPhase } from "./phaseSegmenter.js";

export const BatterHandedness = Object.freeze({ RIGHT: "rightHanded", LEFT: "leftHanded" });

function frontFootJoint(handedness) {
  return handedness === BatterHandedness.RIGHT ? "leftAnkle" : "rightAnkle";
}

function hipRotationOnsetTime(frames) {
  const rotationSpeed = hipRotationSpeedSeries(frames);
  if (rotationSpeed.length < 3) return null;
  const smoothed = movingAverage(rotationSpeed, 5);
  const peak = peakOf(smoothed);
  if (!peak) return null;

  const baselineCount = Math.max(1, Math.floor(smoothed.length / 5));
  let baselineSum = 0;
  for (let i = 0; i < baselineCount; i++) baselineSum += smoothed[i].value;
  const baseline = baselineSum / baselineCount;
  const range = peak.value - baseline;
  if (range <= 1e-9) return null;

  const threshold = baseline + range * 0.15;
  for (const p of smoothed) {
    if (p.value >= threshold) return p.time;
  }
  return null;
}

function topToFrontFootDistance(frames, time, handedness) {
  const frame = nearestFrame(frames, time);
  if (!frame) return null;
  const hands = handsMidpoint(frame);
  const foot = frameJoint(frame, frontFootJoint(handedness));
  const ls = frameJoint(frame, "leftShoulder");
  const rs = frameJoint(frame, "rightShoulder");
  if (!hands || !foot || !ls || !rs) return null;

  const shoulderWidth = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  if (shoulderWidth <= 1e-6) return null;

  const rawDistance = Math.hypot(hands.x - foot.x, hands.y - foot.y);
  return rawDistance / shoulderWidth;
}

export function analyzeSeparation(frames, phases, handedness) {
  const launch = phases.find((p) => p.phase === SwingPhase.LAUNCH);
  if (!launch) return null;

  const topTime = launch.startTime;
  const hipOnset = hipRotationOnsetTime(frames);
  const topHoldDuration = hipOnset !== null ? topTime - hipOnset : null;
  const distance = topToFrontFootDistance(frames, topTime, handedness);

  return { topTime, hipRotationOnsetTime: hipOnset, topHoldDuration, topToFrontFootDistance: distance };
}
