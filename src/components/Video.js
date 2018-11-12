import React from 'react';

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobile() {
  return isAndroid() || isiOS();
}

class Video extends React.Component {
  setupCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available'
      );
    }

    const { width, height } = this.props;

    const video = this.props.videoRef.current;

    const mobile = isMobile();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: mobile ? undefined : width,
        height: mobile ? undefined : height,
      },
    });
    video.srcObject = stream;

    return new Promise(resolve => {
      video.onloadedmetadata = () => {
        resolve(video);
      };
    });
  };

  startVideo = () => {
    const video = this.props.videoRef.current;
    video.play();
  };

  componentDidUpdate(prevProps) {
    if (this.props.play && !prevProps.play) {
      this.startVideo();
    }
  }

  async componentDidMount() {
    const video = this.props.videoRef.current;
    video.width = this.props.width;
    video.height = this.props.height;
    if (this.props.src !== 'camera') {
      this.props.videoRef.current.src = this.props.src;
    } else {
      await this.setupCamera();
      video.play();
    }
  }

  componentWillUnmount() {
    const video = this.props.videoRef.current;
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
    }
  }

  render() {
    return (
      <video
        ref={this.props.videoRef}
        width={this.props.width}
        height={this.props.height}
        playsInline
      />
    );
  }
}

export default Video;
