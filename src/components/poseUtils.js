import { useEffect, useState } from 'react';
import * as posenet from '@tensorflow-models/posenet';
import similarity from 'compute-cosine-similarity';
import l2norm from 'compute-l2norm';
import VPTreeFactory from 'vptree';
import { sortBy, chain } from 'lodash';
import { drawKeypoints, drawSkeleton } from './demo_util';

import { imagePaths, imageCategories } from '../dataset';

export const mediaSize = 500;
const imageScaleFactor = 0.5;
const outputStride = 32;
const flipHorizontal = false;
const minPartConfidence = 0.1;
const minConsecutivePoses = 10;

export async function loadPoseData() {
  const net = await posenet.load();
  const poseData = await buildPoseData(net, imagePaths);
  const vptree = await buildVPTree(poseData);
  return { net, vptree };
}

export function usePoseDetection(start, net, video, canvas) {
  const [pose, setPose] = useState(null);
  useEffect(
    () => {
      if (video) {
        const ctx = canvas.getContext('2d');

        detectPoseInRealTime(net, video, pose => {
          setPose(pose);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const { keypoints } = pose;
          drawKeypoints(keypoints, minPartConfidence, ctx);
          drawSkeleton(keypoints, minPartConfidence, ctx);
        });
      }
    },
    [video]
  );
  return pose;
}

export function useRepsCounter(pose, vptree) {
  const [counter] = useState([]);
  if (pose) {
    const match = findMostSimilarMatch(vptree, pose);
    incrementPoseCount(counter, match.category);
    const reps = countTotalReps(counter, 2);
    return reps;
  }
  return 0;
}

function cosineDistanceMatching(poseVector1, poseVector2) {
  let cosineSimilarity = similarity(poseVector1, poseVector2);
  let distance = 2 * (1 - cosineSimilarity);
  return Math.sqrt(distance);
}

// poseVector1 and poseVector2 are 52-float vectors composed of:
// Values 0-33: are x,y coordinates for 17 body parts in alphabetical order
// Values 34-51: are confidence values for each of the 17 body parts in alphabetical order
// Value 51: A sum of all the confidence values
// Again the lower the number, the closer the distance
function weightedDistanceMatching(poseVector1, poseVector2) {
  const partsEnd = parts.length * 2;
  const scoresEnd = partsEnd + parts.length;
  let vector1PoseXY = poseVector1.slice(0, partsEnd);
  let vector1Confidences = poseVector1.slice(partsEnd, scoresEnd);
  let vector1ConfidenceSum = poseVector1.slice(scoresEnd, scoresEnd + 1);

  let vector2PoseXY = poseVector2.slice(0, partsEnd);

  // First summation
  let summation1 = 1 / vector1ConfidenceSum;

  // Second summation
  let summation2 = 0;
  for (let i = 0; i < vector1PoseXY.length; i++) {
    let tempConf = Math.floor(i / 2);
    let tempSum =
      vector1Confidences[tempConf] *
      Math.abs(vector1PoseXY[i] - vector2PoseXY[i]);
    summation2 = summation2 + tempSum;
  }

  return summation1 * summation2;
}

async function buildVPTree(poseData) {
  // Initialize our vptree with our images’ pose data and a distance function
  return new Promise(resolve => {
    resolve(VPTreeFactory.build(poseData, weightedDistanceMatching));
  });
}

function findMostSimilarMatch(vptree, userPose) {
  const pose = convertPoseToVector(userPose);
  // search the vp tree for the image pose that is nearest (in cosine distance) to userPose
  let nearestImage = vptree.search(pose);

  // return index (in relation to poseData) of nearest match.
  return {
    index: nearestImage[0].i,
    score: nearestImage[0].d,
    category: imageCategories[nearestImage[0].i],
  };
}

async function buildPoseData(net, paths) {
  return await Promise.all(
    paths.map(async path => {
      const imagePose = await estimatePoseOnImage(net, path);
      return convertPoseToVector(imagePose);
    })
  );
}

async function loadImage(imagePath) {
  const image = new Image();
  const promise = new Promise((resolve, reject) => {
    image.crossOrigin = '';
    image.onload = () => {
      resolve(image);
    };
  });

  image.src = imagePath;
  return promise;
}

const parts = [
  'nose',
  // 'leftEye',
  // 'rightEye',
  // 'leftEar',
  // 'rightEar',

  'leftShoulder',
  'rightShoulder',

  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',

  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
];
function convertPoseToVector(pose) {
  const keypoints = sortBy(normalizeKeypoints(pose), 'part');
  const vector = keypoints.reduce((acc, keypoint) => {
    if (parts.includes(keypoint.part)) {
      acc.push(keypoint.normalizedPosition.x);
      acc.push(keypoint.normalizedPosition.y);
    }
    return acc;
  }, []);

  const scoreSum = keypoints.reduce((acc, keypoint) => {
    vector.push(keypoint.score);
    return acc + keypoint.score;
  }, 0);

  vector.push(scoreSum);
  return l2normPoseVector(vector);
}

function normalizeKeypoints(pose) {
  const boundingBox = posenet.getBoundingBox(pose.keypoints);

  const normalizedPoints = pose.keypoints.map(keypoint => {
    return {
      ...keypoint,
      normalizedPosition: {
        x: keypoint.position.x - boundingBox.minX,
        y: keypoint.position.y - boundingBox.minY,
      },
    };
  });
  return normalizedPoints;
}

function l2normPoseVector(vector) {
  const norm = l2norm(vector);
  const normalized = vector.map(value => (value / norm) * (value / norm));
  // console.log(normalized.reduce((acc, value) => acc + value, 0))
  return normalized;
}

async function estimatePoseOnImage(net, imagePath) {
  // load the posenet model from a checkpoint
  const imageElement = await loadImage(imagePath);
  imageElement.width = mediaSize;
  imageElement.height = mediaSize;

  const pose = await net.estimateSinglePose(
    imageElement,
    imageScaleFactor,
    flipHorizontal,
    outputStride
  );

  console.log(pose);
  return pose;
}

function detectPoseInRealTime(net, video, onPose) {
  // video.playbackRate = 0.3;

  async function poseDetectionFrame() {
    const pose = await net.estimateSinglePose(
      video,
      imageScaleFactor,
      flipHorizontal,
      outputStride
    );

    onPose(pose);

    if (!video.paused) {
      requestAnimationFrame(poseDetectionFrame);
    }
  }

  poseDetectionFrame();
}

function incrementPoseCount(counter, category) {
  if (counter.length === 0) {
    counter.push([category, 1]);
  } else if (counter[counter.length - 1][0] === category) {
    counter[counter.length - 1][1]++;
  } else {
    counter.push([category, 1]);
  }
}

function countTotalReps(counter, numCategories) {
  const reps = chain(counter)
    .filter(p => p[1] >= minConsecutivePoses)
    .reduce((acc, pose) => {
      if (acc.length === 0) {
        acc.push(pose);
      } else {
        const previousPose = acc[acc.length - 1];
        if (previousPose[0] === pose[0]) {
          previousPose[1] += pose[1];
        } else {
          acc.push(pose);
        }
      }
      return acc;
    }, [])
    .value();

  return Math.max(0, Math.floor((reps.length - 1) / numCategories));
}
