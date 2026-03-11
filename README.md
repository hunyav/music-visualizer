# music-visualizer

A throwback-inspired 2000s-style audio visualizer that reacts to your PC audio.

## Features

- Live oscilloscope rings that morph with waveform + frequency data.
- Pulsing core orb and beat-based color cycling.
- Reactive particle sparks and flash effects on stronger beats.
- Captures shared tab/window audio first, then falls back to regular audio input devices when needed.
- Runs in-browser with the Web Audio API and HTML canvas.

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> and click **Start Visualizer**.

If your browser does not provide an audio track through screen sharing, grant microphone/input-device access and choose a music-capable device (for example Stereo Mix/Loopback).
