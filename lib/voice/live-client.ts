/**
 * The WebSocket to Gemini Live. A raw socket rather than Google's SDK: the protocol
 * here is small, and every byte of a chat page's bundle is paid on every visit.
 * Frames arrive as binary JSON. The token carries the model and all the settings.
 */

export interface LiveHandlers {
  onReady: () => void;
  onAudio: (pcm: ArrayBuffer) => void;
  onInputText: (text: string) => void;
  onOutputText: (text: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onResumeHandle: (handle: string) => void;
  onGoAway: () => void;
  onClosed: (detail: { code: number; reason: string }) => void;
}

interface ServerMessage {
  setupComplete?: unknown;
  goAway?: unknown;
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function fromBase64(data: string): ArrayBuffer {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export class LiveClient {
  private socket: WebSocket | null = null;
  private ready = false;
  private closedByUs = false;
  private readonly decoder = new TextDecoder();

  constructor(private readonly handlers: LiveHandlers) {}

  connect(url: string, token: string, model: string): void {
    const socket = new WebSocket(`${url}?access_token=${encodeURIComponent(token)}`);
    socket.binaryType = "arraybuffer";
    socket.onopen = () => socket.send(JSON.stringify({ setup: { model } }));
    socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      const text = typeof event.data === "string" ? event.data : this.decoder.decode(event.data);
      this.dispatch(JSON.parse(text) as ServerMessage);
    };
    socket.onclose = (event) => {
      this.ready = false;
      if (!this.closedByUs) this.handlers.onClosed({ code: event.code, reason: event.reason });
    };
    this.socket = socket;
  }

  private dispatch(message: ServerMessage): void {
    if (message.setupComplete !== undefined) {
      this.ready = true;
      this.handlers.onReady();
    }
    if (message.goAway !== undefined) this.handlers.onGoAway();
    const update = message.sessionResumptionUpdate;
    if (update?.resumable && update.newHandle) this.handlers.onResumeHandle(update.newHandle);

    const content = message.serverContent;
    if (!content) return;
    if (content.inputTranscription?.text) this.handlers.onInputText(content.inputTranscription.text);
    if (content.outputTranscription?.text) this.handlers.onOutputText(content.outputTranscription.text);
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) this.handlers.onAudio(fromBase64(part.inlineData.data));
    }
    if (content.interrupted) this.handlers.onInterrupted();
    if (content.turnComplete) this.handlers.onTurnComplete();
  }

  get isReady(): boolean {
    return this.ready;
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({
      realtimeInput: { audio: { data: toBase64(pcm), mimeType: "audio/pcm;rate=16000" } },
    }));
  }

  /** The microphone stopped: flush what the server has buffered. */
  endAudioStream(): void {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  close(): void {
    this.closedByUs = true;
    this.ready = false;
    this.socket?.close();
    this.socket = null;
  }
}
