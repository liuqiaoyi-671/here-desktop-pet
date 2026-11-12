'use strict';
const { EventEmitter } = require('node:events');
// Same verified private Site after a host rename. Never follow arbitrary credentialed redirects.
const ORIGIN_ALIASES = new Map();
function validateConfig(input) {
  if (!input || !['sender', 'receiver'].includes(input.role)) throw new Error('请选择连接身份');
  const url = new URL(input.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('联网地址需要 HTTPS；本机测试可用 HTTP');
  if (url.username || url.password || url.search || url.hash || !['/', ''].includes(url.pathname)) throw new Error('请填写中转服务的根地址');
  if (typeof input.key !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.key.trim())) throw new Error('请填写完整的配对密钥');
  if (input.siteAccess !== undefined && (typeof input.siteAccess !== 'string' || input.siteAccess.length > 8192 || !/^[!-~]+$/.test(input.siteAccess))) throw new Error('连接文件中的服务凭证不正确');
  return { role: input.role, url: ORIGIN_ALIASES.get(url.origin) || url.origin, key: input.key.trim(), ...(input.siteAccess ? { siteAccess: input.siteAccess } : {}) };
}
class Companion extends EventEmitter {
  constructor({ getConfig, onSeen = () => {}, seen = [], fetchFn = fetch, interval = 2000 }) {
    super(); Object.assign(this, { getConfig, onSeen, fetchFn, interval });
    this.seen = new Set(seen); this.timer = null; this.generation = 0; this.protocol = null;
    this.connectionState = { status: 'unconfigured', configured: false, connected: false, canSend: false, canReceive: false, duplex: false };
  }
  setState(status, error = '') {
    const config = this.getConfig();
    this.connectionState = { status, configured: !!config, connected: status === 'connected', duplex: this.protocol === 2, canSend: !!config && (config.role === 'sender' || this.protocol === 2), canReceive: !!config && (config.role === 'receiver' || this.protocol === 2), error };
    this.emit('state', this.connectionState); this.emit('connection', status === 'connected');
  }
  restart(seen = []) {
    this.stop(); this.seen = new Set(seen); this.protocol = null;
    if (this.getConfig()) { this.setState('connecting'); void this.poll(this.generation); }
    else this.setState('unconfigured');
  }
  stop() { this.generation++; clearTimeout(this.timer); this.abort?.abort(); }
  async request(route, data, signal) {
    const config = this.getConfig();
    if (!config) throw new Error('请先设置陪伴连接');
    const res = await this.fetchFn(config.url + route, {
      method: data ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + config.key, ...(config.siteAccess ? { 'OAI-Sites-Authorization': 'Bearer ' + config.siteAccess } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
      body: data ? JSON.stringify(data) : undefined,
      signal: signal || AbortSignal.timeout(8000), redirect: 'error',
    });
    if (!(res.headers?.get('content-type') || 'application/json').includes('application/json')) {
      const error = new Error('连接被网络或登录入口拦截，请检查网络并重新导入连接文件'); error.status = res.status; throw error;
    }
    const body = await res.json();
    if (!res.ok) { const error = new Error(body.error || '连接失败，请检查地址和密钥'); error.status = res.status; throw error; }
    return body;
  }
  async negotiate(signal) {
    try {
      const result = await this.request('/v2/check', null, signal);
      if (result.protocol !== 2 || result.duplex !== true) throw new Error('连接服务版本不正确');
      return 2;
    } catch (error) {
      if ([404, 405].includes(error.status)) return 1;
      throw error;
    }
  }
  async check() {
    // Invalidate pending reads before the handshake so an old connection cannot repaint the UI.
    this.stop(); const generation = this.generation; this.protocol = null; this.setState('connecting');
    await this.poll(generation);
    if (!this.connectionState.connected) throw new Error(this.connectionState.error || '暂时连不上，正在重试');
    return { ok: true, ...this.connectionState };
  }
  async send(data) {
    if (!this.getConfig()) throw new Error('请先设置陪伴连接');
    if (this.getConfig().role !== 'sender' && this.protocol !== 2) throw new Error('接收端只负责展示；双方更新后即可互发');
    const generation = this.generation;
    try { return await this.request(this.protocol === 2 ? '/v2/send' : '/v1/send', data); }
    catch (error) {
      if (generation === this.generation && (!error.status || error.status >= 500 || [401,403].includes(error.status))) this.setState([401,403].includes(error.status)?'failed':'reconnecting', friendlyError(error));
      throw error;
    }
  }
  async poll(generation) {
    if (generation !== this.generation || !this.getConfig()) return;
    const controller = new AbortController(); this.abort = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      if (this.protocol === null) {
        const protocol = await this.negotiate(controller.signal);
        if (generation !== this.generation) return; this.protocol = protocol;
      }
      const receives = this.protocol === 2 || this.getConfig().role === 'receiver';
      if (receives) {
        const snapshot = await this.request(this.protocol === 2 ? '/v2/snapshot' : '/v1/snapshot', null, controller.signal);
        if (generation !== this.generation) return;
        if (!Number.isFinite(snapshot.serverTime) || !Array.isArray(snapshot.events)) throw new Error('中转服务返回格式不正确');
        const offset = Date.now() - snapshot.serverTime;
        const events = snapshot.events.filter(e => e.expiresAt > snapshot.serverTime && !this.seen.has(e.id));
        for (const event of events) this.seen.add(event.id);
        this.seen = new Set([...this.seen].slice(-200)); this.onSeen([...this.seen]);
        this.emit('snapshot', {
          status: snapshot.status && snapshot.status.expiresAt > snapshot.serverTime ? { ...snapshot.status, expiresAt: snapshot.status.expiresAt + offset } : null,
          events: events.map(e => ({ ...e, expiresAt: e.expiresAt + offset })),
        });
      } else {
        await this.request('/v1/send', {kind:'check'}, controller.signal);
        if (generation !== this.generation) return;
      }
      this.setState('connected');
    } catch (error) {
      if (generation === this.generation) this.setState([401,403].includes(error.status)?'failed':'reconnecting', friendlyError(error));
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) this.timer = setTimeout(() => { void this.poll(generation); }, this.protocol === 1 && this.getConfig()?.role === 'sender' ? 15000 : this.interval);
    }
  }
}
function friendlyError(error) { return error.name === 'AbortError' || error.name === 'TimeoutError' ? '连接超时，正在重试' : error.message === 'fetch failed' ? '网络暂时断开，正在重试' : error.message; }
module.exports = { Companion, validateConfig };
