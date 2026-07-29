// Port of Core/Sources/SwingAnalysis/PhaseSegmenter.swift + SwingPhase.swift.
import { movingAverage, peakOf } from "./metrics.js";

export const SwingPhase = Object.freeze({
  STANCE_AND_LOAD: "stanceAndLoad",
  LAUNCH: "launch",
  CONTACT: "contact",
  FOLLOW_THROUGH: "followThrough",
});

/**
 * Splits a swing into phases from its hand-speed time series using a
 * threshold state machine (no learned model): the peak-speed sample is
 * treated as contact, the average speed over the first ~20% of the clip is
 * the "at rest" baseline, and the point where speed first climbs
 * meaningfully above baseline marks the start of the swing launch.
 */
export function segmentPhases(handSpeed, launchThresholdFraction = 0.15) {
  if (handSpeed.length < 3) return [];
  const first = handSpeed[0];
  const last = handSpeed[handSpeed.length - 1];
  const smoothed = movingAverage(handSpeed, 5);

  const peak = peakOf(smoothed);
  if (!peak) return [];

  const baselineCount = Math.max(1, Math.floor(smoothed.length / 5));
  let baselineSum = 0;
  for (let i = 0; i < baselineCount; i++) baselineSum += smoothed[i].value;
  const baseline = baselineSum / baselineCount;
  const range = peak.value - baseline;

  // A strict `> 0` here is too fragile: summing near-identical floating
  // point speeds (a genuinely flat signal) can leave a spurious range of a
  // few ULPs, which would otherwise be treated as a real launch.
  if (range <= 1e-9) {
    return [{ phase: SwingPhase.STANCE_AND_LOAD, startTime: first.time, endTime: last.time }];
  }

  const threshold = baseline + range * launchThresholdFraction;
  let launchStartIndex = 0;
  for (let i = 0; i <= peak.index; i++) {
    if (smoothed[i].value >= threshold) {
      launchStartIndex = i;
      break;
    }
  }
  const launchStartTime = smoothed[launchStartIndex].time;

  const segments = [];
  if (launchStartTime > first.time) {
    segments.push({ phase: SwingPhase.STANCE_AND_LOAD, startTime: first.time, endTime: launchStartTime });
  }

  // Represent contact as a brief window around the peak-speed sample
  // (using the average inter-sample gap) rather than a zero-width instant.
  const averageStep = smoothed.length > 1 ? (last.time - first.time) / (smoothed.length - 1) : 0;
  const contactStart = Math.max(launchStartTime, peak.time - averageStep / 2);
  const contactEnd = Math.min(last.time, peak.time + averageStep / 2);

  if (contactStart > launchStartTime) {
    segments.push({ phase: SwingPhase.LAUNCH, startTime: launchStartTime, endTime: contactStart });
  }
  segments.push({ phase: SwingPhase.CONTACT, startTime: contactStart, endTime: contactEnd });
  if (last.time > contactEnd) {
    segments.push({ phase: SwingPhase.FOLLOW_THROUGH, startTime: contactEnd, endTime: last.time });
  }
  return segments;
}
