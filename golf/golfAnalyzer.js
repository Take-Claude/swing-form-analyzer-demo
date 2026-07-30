// Golf-specific analysis, built on the same shared primitives as the
// baseball version (metrics.js, phaseSegmenter.js). Reuses general golf
// instruction concepts rather than inventing new ones:
//
// - X-Factor: peak hip/shoulder rotation separation during the backswing —
//   a well-known golf term (coined by instructor Jim McLean). Bigger
//   separation is widely cited as correlating with more clubhead speed
//   potential. This is the same "angle between hip line and shoulder line"
//   idea the baseball version originally used and later replaced (a real
//   hitting coach explained that specific metric doesn't map well to
//   baseball's "割れ" — but X-Factor is *literally defined* this way in
//   golf instruction, so it's a better fit here).
// - Swing plane: the angle of the hands' downswing path — golf instruction
//   talks about "upright" vs "flat" planes.
// - Tempo ratio: backswing duration : downswing duration. A commonly-cited
//   target across golf instruction media is roughly 3:1.
//
// As with the baseball version, this is a single-camera 2D proxy, not a
// biomechanically precise measurement — treated as a rough, descriptive
// read, not a pass/fail grade.
import { frameJoint, handsMidpoint, handSpeedSeries, lineAngleDegrees, nearestFrame, peakOf } from "../js/metrics.js";
import { segmentPhases, SwingPhase } from "../js/phaseSegmenter.js";

function angularDifferenceDegrees(a, b) {
  let diff = Math.abs(a - b) % 180;
  if (diff > 90) diff = 180 - diff;
  return diff;
}

function peakHipShoulderSeparation(frames, from, to) {
  let maxSeparation = null;
  for (const f of frames) {
    if (f.timestamp < from || f.timestamp > to) continue;
    const lh = frameJoint(f, "leftHip");
    const rh = frameJoint(f, "rightHip");
    const ls = frameJoint(f, "leftShoulder");
    const rs = frameJoint(f, "rightShoulder");
    if (!lh || !rh || !ls || !rs) continue;

    const hipAngle = lineAngleDegrees(lh, rh);
    const shoulderAngle = lineAngleDegrees(ls, rs);
    const separation = angularDifferenceDegrees(hipAngle, shoulderAngle);
    if (maxSeparation === null || separation > maxSeparation) maxSeparation = separation;
  }
  return maxSeparation;
}

function handPathAngleDegrees(frames, from, to) {
  const startFrame = nearestFrame(frames, from);
  const endFrame = nearestFrame(frames, to);
  const startHands = startFrame ? handsMidpoint(startFrame) : null;
  const endHands = endFrame ? handsMidpoint(endFrame) : null;
  if (!startHands || !endHands) return null;

  const dx = Math.abs(endHands.x - startHands.x);
  const dy = Math.abs(endHands.y - startHands.y);
  return dx + dy > 1e-9 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
}

export function analyzeGolfSwing(frames) {
  const speedSeries = handSpeedSeries(frames);
  const peak = peakOf(speedSeries);
  if (!peak) return null;

  // Re-use the same phase segmenter as baseball: stanceAndLoad ~ backswing,
  // launch ~ transition-into-downswing, contact ~ impact.
  const phases = segmentPhases(speedSeries);
  const stanceAndLoad = phases.find((p) => p.phase === SwingPhase.STANCE_AND_LOAD);
  const launch = phases.find((p) => p.phase === SwingPhase.LAUNCH);
  const contact = phases.find((p) => p.phase === SwingPhase.CONTACT);
  if (!launch || !contact) return null;

  const backswingStart = stanceAndLoad ? stanceAndLoad.startTime : launch.startTime;
  const topTime = launch.startTime;
  const impactTime = contact.startTime;

  const backswingDuration = topTime - backswingStart;
  const downswingDuration = impactTime - topTime;
  const tempoRatio = downswingDuration > 0 ? backswingDuration / downswingDuration : null;

  const xFactorDegrees = peakHipShoulderSeparation(frames, backswingStart, topTime);
  const swingPlaneAngle = handPathAngleDegrees(frames, topTime, impactTime);

  return {
    phases,
    backswingDuration,
    downswingDuration,
    tempoRatio,
    xFactorDegrees,
    swingPlaneAngle,
    peakHandSpeed: peak.value,
  };
}
