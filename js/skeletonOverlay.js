// Port of SwingFormAnalyzer/SkeletonOverlay.swift.
// MediaPipe landmarks are already top-left-origin normalized [0,1], matching
// canvas coordinate space directly — no y-flip needed here (Vision's
// bottom-left origin was why the Swift version flipped y).
import { frameJoint, nearestFrame } from "./metrics.js";

const BONES = [
  ["nose", "neck"],
  ["neck", "leftShoulder"],
  ["neck", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];

export function drawSkeleton(canvas, frame, color = "#34c759") {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;

  const point = (name) => {
    const kp = frameJoint(frame, name);
    if (!kp) return null;
    return { x: kp.x * canvas.width, y: kp.y * canvas.height };
  };

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;

  for (const [a, b] of BONES) {
    const pa = point(a);
    const pb = point(b);
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  for (const name of Object.keys(frame.joints)) {
    const p = point(name);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export function nearestPoseFrame(frames, time) {
  return nearestFrame(frames, time);
}
