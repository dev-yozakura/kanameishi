export class SeedlinkWsClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.onMessage = null;
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => this.onOpen && this.onOpen();
    this.ws.onclose = () => this.onClose && this.onClose();
    this.ws.onerror = e => this.onError && this.onError(e);

    this.ws.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data);
        this.onMessage && this.onMessage(data);
      } catch {
        // ignore
      }
    };
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}
