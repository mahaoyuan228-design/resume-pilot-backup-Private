// Minimal Chrome DevTools Protocol transport for a locally launched Microsoft Edge.
// This only talks to a loopback debugging port; no third-party browser driver is used.
export class CdpSession {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.pending = new Map();
    this.listeners = new Map();
    this.nextId = 1;
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        for (const handler of this.listeners.get(message.method) || []) handler(message.params);
        return;
      }
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (waiter.timer) clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
    });
    this.socket.addEventListener("close", () => this.rejectPending("CDP socket closed"));
  }

  rejectPending(reason) {
    for (const waiter of this.pending.values()) {
      if (waiter.timer) clearTimeout(waiter.timer);
      waiter.reject(new Error(reason));
    }
    this.pending.clear();
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  async send(method, params = {}, { timeoutMs } = {}) {
    await this.ready;
    if (this.socket.readyState !== WebSocket.OPEN) throw new Error("CDP socket closed");
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`CDP request timeout: ${method}`));
        }, timeoutMs);
      }
      this.pending.set(id, waiter);
    });
    try {
      this.socket.send(JSON.stringify({ id, method, params }));
    } catch (error) {
      const waiter = this.pending.get(id);
      this.pending.delete(id);
      if (waiter?.timer) clearTimeout(waiter.timer);
      waiter?.reject(error);
    }
    return result;
  }

  async evaluate(expression, { timeoutMs } = {}) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, { timeoutMs });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }

  close() {
    this.rejectPending("CDP socket closed");
    this.socket.close();
  }
}

export async function connectPage(port, predicate = () => true) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = targets.find((item) => item.type === "page" && predicate(item));
  if (!target) throw new Error("No matching Edge page target");
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.ready;
  await session.send("Runtime.enable");
  await session.send("Page.enable");
  return { target, session };
}

export async function navigate(session, url) {
  await session.send("Page.navigate", { url });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await session.evaluate("({ url: location.href, ready: document.readyState })");
    if (state.url === url && state.ready === "complete") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Page did not load: ${url}`);
}
