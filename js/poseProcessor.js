// Browser equivalent of Core/Sources/PoseEstimation/PoseFrameProcessor.swift,
// using MediaPipe Tasks Vision (BlazePose) instead of Apple's Vision
// framework. Browsers decode <video> frames with rotation metadata already
// applied, so — unlike the Swift version reading raw AVAssetReader sample
// buffers — there's no separate orientation-correction step needed here.
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const LANDMARK_INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

let landmarkerPromise = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

function seekVideo(videoEl, time) {
  return new Promise((resolve) => {
    if (Math.abs(videoEl.currentTime - time) < 0.001) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      videoEl.removeEventListener("seeked", finish);
      clearTimeout(timer);
      resolve();
    };
    videoEl.addEventListener("seeked", finish);
    const timer = setTimeout(finish, 2000);
    videoEl.currentTime = time;
  });
}

export async function extractPoseFrames(videoEl, { fps = 20, onProgress } = {}) {
  const landmarker = await getLandmarker();
  const duration = videoEl.duration;
  const frameInterval = 1 / fps;
  const frames = [];

  let t = 0;
  while (t < duration) {
    await seekVideo(videoEl, t);
    const result = landmarker.detectForVideo(videoEl, performance.now());
    const lm = result.landmarks && result.landmarks[0];
    if (lm) {
      const joints = {};
      for (const [name, idx] of Object.entries(LANDMARK_INDEX)) {
        const p = lm[idx];
        if (p) joints[name] = { x: p.x, y: p.y, visibility: p.visibility ?? 1 };
      }
      if (joints.leftShoulder && joints.rightShoulder) {
        joints.neck = {
          x: (joints.leftShoulder.x + joints.rightShoulder.x) / 2,
          y: (joints.leftShoulder.y + joints.rightShoulder.y) / 2,
          visibility: Math.min(joints.leftShoulder.visibility, joints.rightShoulder.visibility),
        };
      }
      frames.push({ timestamp: t, joints });
    }
    if (onProgress) onProgress(Math.min(1, t / duration));
    t += frameInterval;
  }

  if (onProgress) onProgress(1);

  return {
    frames,
    videoSize: { width: videoEl.videoWidth, height: videoEl.videoHeight },
  };
}        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

function seekVideo(videoEl, time) {
  return new Promise((resolve) => {
    // A seek to the position the video is already at (notably t=0 on a
    // freshly-loaded video) doesn't reliably fire `seeked` in every
    // browser, which would otherwise hang this Promise — and the whole
    // extraction loop — forever on the very first frame.
    if (Math.abs(videoEl.currentTime - time) < 0.001) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      videoEl.removeEventListener("seeked", finish);
      clearTimeout(timer);
      resolve();
    };
    videoEl.addEventListener("seeked", finish);
    // Safety net: never let one frame's seek hang the whole analysis.
    const timer = setTimeout(finish, 2000);
    videoEl.currentTime = time;
  });
}

/**
 * @param {HTMLVideoElement} videoEl a loaded (metadata-ready) video element
 * @param {{fps?: number, onProgress?: (fraction: number) => void}} options
 * @returns {Promise<{frames: Array, videoSize: {width: number, height: number}}>}
 */
export async function extractPoseFrames(videoEl, { fps = 20, onProgress } = {}) {
  const landmarker = await getLandmarker();
  const duration = videoEl.duration;
  const frameInterval = 1 / fps;
  const frames = [];

  let t = 0;
  while (t < duration) {
    // eslint-disable-next-line no-await-in-loop
    await seekVideo(videoEl, t);
    const result = landmarker.detectForVideo(videoEl, performance.now());
    const lm = result.landmarks && result.landmarks[0];
    if (lm) {
      const joints = {};
      for (const [name, idx] of Object.entries(LANDMARK_INDEX)) {
        const p = lm[idx];
        if (p) joints[name] = { x: p.x, y: p.y, visibility: p.visibility ?? 1 };
      }
      // Vision gives a dedicated `.neck` joint; BlazePose doesn't, so
      // approximate it the same way SwingShapeAnalyzer already treats a
      // missing neck (falls back toward nose) — but a shoulder-midpoint
      // proxy is closer to "neck" than nose is, so provide it when possible.
      if (joints.leftShoulder && joints.rightShoulder) {
        joints.neck = {
          x: (joints.leftShoulder.x + joints.rightShoulder.x) / 2,
          y: (joints.leftShoulder.y + joints.rightShoulder.y) / 2,
          visibility: Math.min(joints.leftShoulder.visibility, joints.rightShoulder.visibility),
        };
      }
      frames.push({ timestamp: t, joints });
    }
    if (onProgress) onProgress(Math.min(1, t / duration));
    t += frameInterval;
  }

  if (onProgress) onProgress(1);

  return {
    frames,
    videoSize: { width: videoEl.videoWidth, height: videoEl.videoHeight },
  };
}        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })();
  }
  return landmarkerPromise;
}

function seekVideo(videoEl, time) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      resolve();
    };
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.currentTime = time;
  });
}

/**
 * @param {HTMLVideoElement} videoEl a loaded (metadata-ready) video element
 * @param {{fps?: number, onProgress?: (fraction: number) => void}} options
 * @returns {Promise<{frames: Array, videoSize: {width: number, height: number}}>}
 */
export async function extractPoseFrames(videoEl, { fps = 20, onProgress } = {}) {
  const landmarker = await getLandmarker();
  const duration = videoEl.duration;
  const frameInterval = 1 / fps;
  const frames = [];

  let t = 0;
  while (t < duration) {
    // eslint-disable-next-line no-await-in-loop
    await seekVideo(videoEl, t);
    const result = landmarker.detectForVideo(videoEl, performance.now());
    const lm = result.landmarks && result.landmarks[0];
    if (lm) {
      const joints = {};
      for (const [name, idx] of Object.entries(LANDMARK_INDEX)) {
        const p = lm[idx];
        if (p) joints[name] = { x: p.x, y: p.y, visibility: p.visibility ?? 1 };
      }
      // Vision gives a dedicated `.neck` joint; BlazePose doesn't, so
      // approximate it the same way SwingShapeAnalyzer already treats a
      // missing neck (falls back toward nose) — but a shoulder-midpoint
      // proxy is closer to "neck" than nose is, so provide it when possible.
      if (joints.leftShoulder && joints.rightShoulder) {
        joints.neck = {
          x: (joints.leftShoulder.x + joints.rightShoulder.x) / 2,
          y: (joints.leftShoulder.y + joints.rightShoulder.y) / 2,
          visibility: Math.min(joints.leftShoulder.visibility, joints.rightShoulder.visibility),
        };
      }
      frames.push({ timestamp: t, joints });
    }
    if (onProgress) onProgress(Math.min(1, t / duration));
    t += frameInterval;
  }

  if (onProgress) onProgress(1);

  return {
    frames,
    videoSize: { width: videoEl.videoWidth, height: videoEl.videoHeight },
  };
}
