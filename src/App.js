import React, { Component } from 'react';
import './App.css';
import VideoSelector from './components/VideoSelector';

class App extends Component {
  render() {
    return (
      <div className="App">
        <VideoSelector />
      </div>
    );
  }
}

export default App;
