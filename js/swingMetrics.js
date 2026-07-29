// Port of Core/Sources/SwingAnalysis/SwingMetrics.swift.
import { handSpeedSeries, peakOf } from "./metrics.js";
import { segmentPhases, SwingPhase } from "./phaseSegmenter.js";
import { analyzeSeparation, BatterHandedness } from "./separation.js";
import { analyzeSwingShape } from "./swingShape.js";

export function computeSwingMetrics(frames, handedness = BatterHandedness.RIGHT) {
  const speedSeries = handSpeedSeries(frames);
  const peak = peakOf(speedSeries);
  if (!peak) return null;

  const phases = segmentPhases(speedSeries);

  let launchToContactDuration = null;
  const launch = phases.find((p) => p.phase === SwingPhase.LAUNCH);
  const contact = phases.find((p) => p.phase === SwingPhase.CONTACT);
  if (launch && contact) launchToContactDuration = contact.startTime - launch.startTime;

  const separationTiming = analyzeSeparation(frames, phases, handedness);
  const swingShape = analyzeSwingShape(frames, phases);

  return {
    peakHandSpeed: peak.value,
    peakHandSpeedTime: peak.time,
    phases,
    launchToContactDuration,
    separationTiming,
    swingShape,
  };
}
