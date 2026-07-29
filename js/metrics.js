// Port of Core/Sources/SwingAnalysis/MetricCalculators.swift + TimedValue.swift + PoseFrame helpers.
// Note: MediaPipe's landmarks use a top-left origin (y grows downward), unlike
// Vision's bottom-left origin — this port adopts MediaPipe's convention
// throughout rather than trying to match Vision's sign conventions.

export const MIN_VISIBILITY = 0.3; // mirrors Keypoint.minimumReliableConfidence

export function frameJoint(frame, name) {
  const kp = frame.joints[name];
  if (!kp || kp.visibility < MIN_VISIBILITY) return null;
  return kp;
}

export function handsMidpoint(frame) {
  const l = frameJoint(frame, "leftWrist");
  const r = frameJoint(frame, "rightWrist");
  if (!l || !r) return null;
  return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
}

export function handSpeedSeries(frames) {
  const points = [];
  for (const f of frames) {
    const hm = handsMidpoint(f);
    if (hm) points.push({ time: f.timestamp, point: hm });
  }
  const result = [];
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].time - points[i - 1].time;
    if (dt <= 0) continue;
    const dx = points[i].point.x - points[i - 1].point.x;
    const dy = points[i].point.y - points[i - 1].point.y;
    result.push({ time: points[i].time, value: Math.sqrt(dx * dx + dy * dy) / dt });
  }
  return result;
}

export function lineAngleDegrees(a, b) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Shortest signed angular difference from a to b, wrapped to [-180, 180]. */
export function angularDelta(a, b) {
  let delta = (b - a) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export function hipRotationSpeedSeries(frames) {
  const hipAngles = [];
  for (const f of frames) {
    const lh = frameJoint(f, "leftHip");
    const rh = frameJoint(f, "rightHip");
    if (!lh || !rh) continue;
    hipAngles.push({ time: f.timestamp, angle: lineAngleDegrees(lh, rh) });
  }
  const result = [];
  for (let i = 1; i < hipAngles.length; i++) {
    const dt = hipAngles[i].time - hipAngles[i - 1].time;
    if (dt <= 0) continue;
    const delta = angularDelta(hipAngles[i - 1].angle, hipAngles[i].angle);
    result.push({ time: hipAngles[i].time, value: Math.abs(delta) / dt });
  }
  return result;
}

export function movingAverage(series, windowSize) {
  if (windowSize <= 1 || series.length === 0) return series;
  const half = Math.floor(windowSize / 2);
  const result = [];
  for (let i = 0; i < series.length; i++) {
    const lower = Math.max(0, i - half);
    const upper = Math.min(series.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = lower; j <= upper; j++) {
      sum += series[j].value;
      count++;
    }
    result.push({ time: series[i].time, value: sum / count });
  }
  return result;
}

export function peakOf(series) {
  if (series.length === 0) return null;
  let best = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i].value > series[best].value) best = i;
  }
  return { index: best, ...series[best] };
}

export function nearestFrame(frames, time) {
  let best = null;
  let bestDiff = Infinity;
  for (const f of frames) {
    const diff = Math.abs(f.timestamp - time);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = f;
    }
  }
  return best;
}
