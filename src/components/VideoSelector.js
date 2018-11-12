import React, { useState, useRef } from 'react';
import { toPairs } from 'lodash';
import importAll from 'import-all.macro';

import Video from './Video';
import {
  loadPoseData,
  usePoseDetection,
  useRepsCounter,
  mediaSize,
} from './poseUtils';

const videoFiles = toPairs(importAll.sync('../videos/**/*.mov'));

function MediaPose({ src, poseData }) {
  const [play, setPlay] = useState(false);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const pose = usePoseDetection(
    play,
    poseData.net,
    videoRef.current,
    canvasRef.current
  );
  const reps = useRepsCounter(pose, poseData.vptree);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div>
        <span
          style={{
            position: 'absolute',
            color: '#AF1F24',
            fontWeight: 'bold',
            fontSize: 68,
            width: 100,
            height: 100,
            backgroundColor: '#ffffff90',
            wordWrap: 'break-word',
            whiteSpace: 'pre-line',
            top: '0%',
          }}
        >
          {reps}
        </span>
        <canvas
          width={mediaSize}
          height={mediaSize}
          ref={canvasRef}
          style={{ position: 'absolute' }}
        />
        <Video
          width={mediaSize}
          height={mediaSize}
          src={src}
          play={play}
          videoRef={videoRef}
        />
      </div>
      <button
        style={{ height: 40, width: 100, margin: 'auto' }}
        onClick={() => setPlay(true)}
      >
        START
      </button>
    </div>
  );
}

class Images extends React.Component {
  state = {
    loadedPoses: false,
    src: videoFiles[0][1],
  };

  setup = async () => {
    this.poseData = await loadPoseData();
    console.log('LOADED ALL POSES!!!');
    this.setState({ loadedPoses: true });
  };

  async componentDidMount() {
    await this.setup();
  }

  render() {
    const { loadedPoses, src } = this.state;
    return (
      loadedPoses && (
        <div>
          <MediaPose key={src} src={src} poseData={this.poseData} />

          <select
            defaultValue={src}
            onChange={e => this.setState({ src: e.target.value })}
          >
            <option value="camera">Camera</option>
            {videoFiles.map(([filename, path]) => (
              <option key={path} value={path}>
                {filename}
              </option>
            ))}
          </select>
        </div>
      )
    );
  }
}

export default Images;
