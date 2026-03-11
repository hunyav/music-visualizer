const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("statusText");

let audioContext;
let analyser;
let source;
let stream;
let animationId;
let hue = 180;
const sparks = [];

const fftSize = 2048;
let waveform = new Uint8Array(fftSize);
let spectrum = new Uint8Array(fftSize / 2);

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setStatus(message) {
  statusText.textContent = message;
}

function avgRange(data, start, end) {
  let total = 0;
  const safeEnd = Math.min(end, data.length);
  for (let i = start; i < safeEnd; i += 1) total += data[i];
  return total / Math.max(1, safeEnd - start) / 255;
}

function spawnSparks(strength, cx, cy, maxRadius) {
  const count = Math.min(50, Math.floor(strength * 40));
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.7 + Math.random() * (2 + strength * 2.5);
    const r = maxRadius * (0.1 + Math.random() * 0.5);
    sparks.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 45,
      colorHue: hue + Math.random() * 80 - 40,
      size: 1 + Math.random() * 2.5,
    });
  }
}

function drawBackground(w, h, beat) {
  const flash = Math.min(0.45, beat * 0.85);
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h));
  gradient.addColorStop(0, `hsla(${(hue + 40) % 360}, 95%, ${18 + flash * 20}%, 0.55)`);
  gradient.addColorStop(1, "rgba(1, 1, 10, 0.34)");

  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  if (flash > 0.2) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.2})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawOscilloscope(w, h, beat) {
  ctx.save();
  ctx.translate(w / 2, h / 2);

  const baseRadius = Math.min(w, h) * 0.18;
  const bass = avgRange(spectrum, 1, 36);
  const mid = avgRange(spectrum, 36, 180);
  const treble = avgRange(spectrum, 180, 420);

  for (let ring = 0; ring < 4; ring += 1) {
    const ringOffset = ring * 0.21;
    const radius = baseRadius + ring * 46 + bass * 55;

    ctx.beginPath();
    for (let i = 0; i <= 180; i += 1) {
      const t = i / 180;
      const a = t * Math.PI * 2;
      const waveIndex = Math.floor(t * (waveform.length - 1));
      const amp = (waveform[waveIndex] - 128) / 128;
      const wobble = Math.sin(a * 7 + performance.now() * 0.0016 + ringOffset * 8) * (mid * 24);
      const pulse = amp * (45 + treble * 70);
      const r = radius + pulse + wobble;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const lightness = 58 + ring * 6 + beat * 16;
    const ringHue = (hue + ring * 35) % 360;
    ctx.strokeStyle = `hsla(${ringHue}, 95%, ${lightness}%, ${0.35 + ring * 0.12})`;
    ctx.lineWidth = 1.6 + ring * 0.75;
    ctx.shadowBlur = 15 + ring * 8;
    ctx.shadowColor = `hsla(${ringHue}, 95%, 70%, 0.75)`;
    ctx.stroke();
  }

  ctx.beginPath();
  const coreRadius = baseRadius * (0.7 + bass * 0.75);
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  const orb = ctx.createRadialGradient(-coreRadius * 0.2, -coreRadius * 0.2, 2, 0, 0, coreRadius * 1.15);
  orb.addColorStop(0, `hsla(${(hue + 180) % 360}, 100%, ${72 + beat * 18}%, 0.92)`);
  orb.addColorStop(1, `hsla(${(hue + 40) % 360}, 100%, 50%, 0.22)`);
  ctx.fillStyle = orb;
  ctx.fill();

  ctx.restore();

  if (beat > 0.16) spawnSparks(beat, w / 2, h / 2, baseRadius * 1.6);
}

function drawSparks(w, h, treble) {
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const spark = sparks[i];
    spark.life -= 1;
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vx *= 0.985;
    spark.vy *= 0.985;

    if (spark.life <= 0 || spark.x < -30 || spark.x > w + 30 || spark.y < -30 || spark.y > h + 30) {
      sparks.splice(i, 1);
      continue;
    }

    const alpha = Math.min(1, spark.life / 50);
    ctx.fillStyle = `hsla(${spark.colorHue % 360}, 100%, ${58 + treble * 35}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderFrame() {
  analyser.getByteTimeDomainData(waveform);
  analyser.getByteFrequencyData(spectrum);

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  const bass = avgRange(spectrum, 0, 40);
  const mid = avgRange(spectrum, 40, 220);
  const treble = avgRange(spectrum, 220, 600);
  const beat = Math.max(bass * 0.9, mid * 0.6);

  hue = (hue + 0.35 + beat * 1.7) % 360;

  drawBackground(w, h, beat);
  drawOscilloscope(w, h, beat);
  drawSparks(w, h, treble);

  animationId = requestAnimationFrame(renderFrame);
}

function hasAudioTrack(mediaStream) {
  return mediaStream.getAudioTracks().some((track) => track.readyState === "live");
}

async function requestDisplayAudio() {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });

  if (hasAudioTrack(screenStream)) {
    setStatus("Connected to shared tab/window audio.");
    return screenStream;
  }

  screenStream.getTracks().forEach((track) => track.stop());
  throw new Error("Screen share started without an audio track.");
}

async function requestInputDeviceAudio() {
  const micLikeStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });

  if (hasAudioTrack(micLikeStream)) {
    setStatus("Connected to input device audio.");
    return micLikeStream;
  }

  micLikeStream.getTracks().forEach((track) => track.stop());
  throw new Error("Input device stream has no audio track.");
}

async function getAudioStream() {
  try {
    return await requestDisplayAudio();
  } catch (displayErr) {
    console.warn("Display audio capture unavailable, falling back to input devices:", displayErr);
    setStatus("Screen-share audio unavailable. Trying input devices instead...");
    return requestInputDeviceAudio();
  }
}

async function startVisualizer() {
  if (audioContext) return;

  try {
    stream = await getAudioStream();

    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.85;

    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    waveform = new Uint8Array(analyser.fftSize);
    spectrum = new Uint8Array(analyser.frequencyBinCount);

    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", stopVisualizer, { once: true });
    });

    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("Visualizer running. Play audio to drive the animation.");
    renderFrame();
  } catch (err) {
    console.error("Could not capture usable audio:", err);
    setStatus("No usable audio stream was detected. Enable tab/system audio or choose a music input device.");
    stopVisualizer();
  }
}

function stopVisualizer() {
  cancelAnimationFrame(animationId);
  animationId = undefined;

  if (source) {
    source.disconnect();
    source = null;
  }

  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  sparks.length = 0;

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

window.addEventListener("resize", resizeCanvas);
startBtn.addEventListener("click", startVisualizer);
stopBtn.addEventListener("click", stopVisualizer);

resizeCanvas();
ctx.fillStyle = "rgba(0, 0, 0, 1)";
ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
ctx.font = "600 22px Trebuchet MS";
ctx.textAlign = "center";
ctx.fillText("Press 'Start Visualizer' and share audio to begin.", canvas.clientWidth / 2, canvas.clientHeight / 2);
