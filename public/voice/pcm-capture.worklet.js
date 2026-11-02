/**
 * Microphone audio, resampled to what Gemini Live requires: 16 kHz, 16-bit PCM,
 * in 40 ms chunks. Runs on the audio thread so a busy page can't cause dropouts.
 * Resampling here, not by forcing the AudioContext's rate, because a context at a
 * rate unlike the microphone's is refused by some browsers.
 */
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 640;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / TARGET_RATE;
    this.position = 0;
    this.sum = 0;
    this.taken = 0;
    this.chunk = new Int16Array(CHUNK_SAMPLES);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      // Averaging each span of input is a cheap low-pass, so speech doesn't alias.
      this.sum += channel[i];
      this.taken++;
      this.position++;
      if (this.position >= this.step) {
        this.position -= this.step;
        const value = Math.max(-1, Math.min(1, this.sum / this.taken));
        this.chunk[this.filled++] = value < 0 ? value * 0x8000 : value * 0x7fff;
        this.sum = 0;
        this.taken = 0;
        if (this.filled === CHUNK_SAMPLES) {
          this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
          this.chunk = new Int16Array(CHUNK_SAMPLES);
          this.filled = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
