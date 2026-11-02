/**
 * The audio side of a voice session: microphone in, Atlas's voice out, and the
 * levels that move the orb. One AudioContext carries both directions, which is
 * also what lets the browser's echo cancellation hear what is being played.
 */

const OUTPUT_RATE = 24000;
/** A small cushion so a late network packet doesn't click. */
const PLAYBACK_LEAD_SECONDS = 0.04;

export class MicrophoneBlockedError extends Error {}
export class MicrophoneMissingError extends Error {}

function levelOf(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i]! * buffer[i]!;
  // Speech RMS sits around 0.02–0.2; this spreads that across most of 0–1.
  return Math.min(1, Math.sqrt(sum / buffer.length) * 4.5);
}

/** Loudness of one chunk of 16-bit PCM, 0–1 RMS. */
export function pcmLevel(pcm: ArrayBuffer): number {
  const samples = new Int16Array(pcm);
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i]! / 0x8000) ** 2;
  return Math.sqrt(sum / samples.length);
}

export class VoiceAudio {
  private readonly context: AudioContext;
  private readonly output: AnalyserNode;
  private readonly mic: AnalyserNode;
  private readonly outputBuffer: Float32Array<ArrayBuffer>;
  private readonly micBuffer: Float32Array<ArrayBuffer>;
  private readonly playing = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private nextStart = 0;
  private receivedSeconds = 0;
  private firstStart = 0;

  /** Call inside the tap that started the session, or the browser keeps it silent. */
  constructor() {
    this.context = new AudioContext({ latencyHint: "interactive" });
    void this.context.resume();
    this.output = this.context.createAnalyser();
    this.output.fftSize = 1024;
    this.output.connect(this.context.destination);
    this.mic = this.context.createAnalyser();
    this.mic.fftSize = 1024;
    this.outputBuffer = new Float32Array(this.output.fftSize);
    this.micBuffer = new Float32Array(this.mic.fftSize);
  }

  async startMicrophone(onChunk: (pcm: ArrayBuffer) => void, onLost: () => void): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") throw new MicrophoneMissingError();
      throw new MicrophoneBlockedError();
    }
    await this.context.audioWorklet.addModule("/voice/pcm-capture.worklet.js");
    const source = this.context.createMediaStreamSource(this.stream);
    this.capture = new AudioWorkletNode(this.context, "pcm-capture");
    this.capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => onChunk(event.data);
    source.connect(this.mic);
    source.connect(this.capture);
    this.stream.getAudioTracks()[0]?.addEventListener("ended", onLost);
  }

  setMuted(muted: boolean): void {
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }

  /** Queue 24 kHz 16-bit PCM from Atlas, gaplessly. */
  play(pcm: ArrayBuffer): void {
    const samples = new Int16Array(pcm);
    if (samples.length === 0) return;
    const buffer = this.context.createBuffer(1, samples.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i]! / 0x8000;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    const start = Math.max(this.context.currentTime + PLAYBACK_LEAD_SECONDS, this.nextStart);
    if (this.playing.size === 0 && this.receivedSeconds === 0) this.firstStart = start;
    source.start(start);
    this.nextStart = start + buffer.duration;
    this.receivedSeconds += buffer.duration;
    this.playing.add(source);
    source.onended = () => this.playing.delete(source);
  }

  get isPlaying(): boolean {
    return this.playing.size > 0;
  }

  /** How much of this turn has actually been heard, 0–1, for cutting its transcript. */
  get heardShare(): number {
    if (this.receivedSeconds === 0) return 0;
    const heard = this.context.currentTime - this.firstStart;
    return Math.max(0, Math.min(1, heard / this.receivedSeconds));
  }

  /** Atlas was interrupted, or the turn is over: stop now and forget what's queued. */
  flush(): void {
    this.playing.forEach((source) => {
      source.onended = null;
      try { source.stop(); } catch { /* it had already finished */ }
    });
    this.playing.clear();
    this.resetTurn();
  }

  resetTurn(): void {
    this.nextStart = 0;
    this.receivedSeconds = 0;
    this.firstStart = 0;
  }

  micLevel(): number {
    return levelOf(this.mic, this.micBuffer);
  }

  outputLevel(): number {
    return levelOf(this.output, this.outputBuffer);
  }

  /** Every exit path comes through here, so the browser's recording light goes out. */
  close(): void {
    this.flush();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.capture?.port.close();
    this.capture?.disconnect();
    this.capture = null;
    void this.context.close().catch(() => undefined);
  }
}
