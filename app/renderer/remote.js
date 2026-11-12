'use strict';
(() => {
  if (!window.pet) return;
  const panel = document.getElementById('remote');
  let lastAnchor = null, placedBelow = false;
  let desktop = null, refreshing = false, mirror = false;
  function refreshBounds() {
    if (refreshing) return;
    refreshing = true;
    window.pet.bounds().then(value => {desktop = value;}).catch(()=>{}).finally(()=>{refreshing=false;});
  }
  refreshBounds(); setInterval(refreshBounds, 200);
  function horizontal(width) {
    const left = desktop ? Math.max(4, desktop.workArea.x - desktop.x + 4) : 4;
    const right = desktop ? Math.min(innerWidth-4, desktop.workArea.x + desktop.workArea.width - desktop.x - 4) : 296;
    mirror = desktop ? desktop.x + innerWidth/2 > desktop.workArea.x + desktop.workArea.width / 2 : false;
    return Math.max(left, Math.min(right-width, innerWidth/2-(mirror ? width-38 : 38)));
  }
  const statusEl = document.getElementById('remote-status');
  const messageEl = document.getElementById('remote-message');
  const actionEl = document.getElementById('remote-action');
  const labels = { wave: '👋 我在这里，挥挥手', heart: '♡ 给你一颗小小的心', sparkle: '✦ 给你一点星光' };
  let status = null, message = null, action = null, quiet = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const active = item => !!item && item.expiresAt > Date.now();
  function render() {
    if (!active(status)) status = null;
    if (!active(message)) message = null;
    if (!active(action)) action = null;
    statusEl.hidden = quiet || !status;
    messageEl.hidden = quiet || !message;
    actionEl.hidden = quiet || !action;
    statusEl.textContent = status?.text || '';
    messageEl.textContent = message?.text || '';
    messageEl.classList.toggle('fading', !!message && message.expiresAt - Date.now() < 700);
    actionEl.textContent = action ? labels[action.action] : '';
  }
  window.pet.onCompanion(update => {
    if (update.reset) { status = message = action = null; }
    if (typeof update.quiet === 'boolean') { quiet = update.quiet; if (quiet) message = action = null; }
    if ('status' in update) status = update.status;
    if (!quiet) {
      for (const item of update.events || []) {
        if (!active(item)) continue;
        if (item.kind === 'message') message = item;
        if (item.kind === 'action' && labels[item.action]) action = { ...item, expiresAt: Math.min(item.expiresAt, Date.now() + 6500), born: performance.now() };
      }
    }
    render();
  });
  function hit(x, y) {
    return [statusEl, messageEl, actionEl].some(el => {
      if (el.hidden) return false;
      const box = el.getBoundingClientRect();
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    });
  }
  function position(headTop, bodyBottom) {
    lastAnchor = { headTop, bodyBottom };
    const width = panel.offsetWidth;
    const left = horizontal(width);
    panel.style.left = left + 'px';
    panel.style.setProperty('--head-offset', (innerWidth/2-left-width/2) + 'px');
    panel.classList.toggle('mirror', mirror);
    const height = panel.offsetHeight;
    placedBelow = headTop - 8 - height < 4;
    panel.classList.toggle('below', placedBelow);
    const top = placedBelow ? Math.max(4, Math.min(460 - height - 4, bodyBottom + 12)) : headTop - 8 - height;
    panel.style.top = top + 'px';
  }
  window.remoteCompanion = {
    position,
    thoughtBox(width, height, headTop, bodyBottom, reserve) {
      const x0 = horizontal(width);
      let y0 = headTop - reserve - height - 24, below = y0 < 4;
      if (below) y0 = Math.max(20, Math.min(456-height, bodyBottom+26));
      return {x0,y0,cx:x0+width/2,below,mirror};
    },
    getHeadSpace: () => !quiet && lastAnchor && !placedBelow && panel.offsetHeight > 0 ? panel.offsetHeight + 8 : 0,
    hit,
    dismiss() { message = null; action = null; render(); },
    hasMessage: () => !quiet && active(message),
    drawEffect(ctx, now, headTop) {
      if (quiet || !active(action) || reducedMotion.matches) return;
      const t = (now - action.born) / 1000;
      ctx.save(); ctx.textAlign = 'center'; ctx.font = '22px -apple-system, sans-serif';
      ctx.fillStyle = action.action === 'heart' ? '#b97983' : '#b69258';
      for (let i = 0; i < 7; i++) {
        const phase = (t * .42 + i / 7) % 1;
        ctx.globalAlpha = Math.sin(phase * Math.PI) * .85;
        ctx.fillText(action.action === 'heart' ? '♡' : action.action === 'wave' ? '👋' : '✦', innerWidth/2-60 + i * 20 + Math.sin(t * 2 + i) * 9, Math.min(445, headTop + 65) - phase * 95);
      }
      ctx.restore();
    },
  };
  setInterval(render, 100);
})();
