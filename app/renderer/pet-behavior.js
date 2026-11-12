/* Behavior owns intent; outfit only chooses an asset. No desktop/network dependencies. */
(function (root) {
  'use strict';
  const outfits = {
    grey: { idle: 'greyidle', typing: 'greytyping', chin: 'greychin', wave: 'greywave', kiss: 'greykiss', stretch: 'greystretch' },
    summer: { idle: 'idle', typing: 'typing', chin: 'chin', wave: 'wave', kiss: 'kiss', stretch: 'stretch' },
  };
  const seasons = ['auto', 'spring-summer', 'autumn-winter'];
  function normalizeSeason(value) { return ['spring','summer'].includes(value)?'spring-summer':['autumn','winter'].includes(value)?'autumn-winter':seasons.includes(value)?value:'auto'; }
  function calendarSeason(month) { return month >= 3 && month <= 8 ? 'spring-summer' : 'autumn-winter'; }
  class PetBehavior {
    constructor({ random = Math.random, now = 0, season = 'auto', month = new Date().getMonth() + 1, duration = () => 0 } = {}) {
      this.random = random; this.duration = duration; this.month = month;
      this.season = normalizeSeason(season);
      this.main = 'idle'; this.phase = 'typing'; this.temporary = null; this.effect = null;
      this.started = now; this.phaseStarted = now; this.lastInteraction = now;
      this.suspendedAt = null; this.quiet = false; this.lastReaction = -Infinity;
      this.planStretch(now); this.phaseUntil = now + this.phaseLength();
    }
    range(min, max) { return min + this.random() * (max - min); }
    get outfit() { return (this.season === 'auto' ? calendarSeason(this.month) : this.season) === 'spring-summer' ? 'summer' : 'grey'; }
    assetFor(action) { return action === 'sleep' ? 'sleep' : action === 'dash' ? 'dash' : outfits[this.outfit][action]; }
    phaseLength() {
      const cycle = this.duration(this.assetFor(this.phase));
      const target = this.phase === 'typing' ? this.range(25000, 55000) : this.range(10000, 22000);
      return cycle > 0 ? Math.ceil(target / cycle) * cycle : target;
    }
    planStretch(now) { this.nextStretch = now + this.range(240000, 480000); }
    setMain(main, now) {
      if (!['idle', 'work', 'sleep'].includes(main) || this.main === main) return false;
      this.main = main; this.temporary = null; this.effect = null; this.started = now; this.phaseStarted = now;
      this.phase = 'typing'; this.phaseUntil = now + this.phaseLength(); this.planStretch(now);
      return true;
    }
    setSeason(season, now, month = this.month) {
      const before = this.outfit; this.season = normalizeSeason(season); this.month = month;
      if (before !== this.outfit) {
        this.temporary = null; this.effect = null; this.started = now; this.phaseStarted = now;
        this.phaseUntil = now + this.phaseLength();
      }
      return true;
    }
    interact(now) { this.lastInteraction = now; this.planStretch(now); }
    trigger(action, now) {
      if (this.quiet || this.suspendedAt !== null || this.main !== 'idle' || this.temporary || !['wave', 'kiss', 'stretch'].includes(action)) return false;
      this.temporary = { action, started: now, until: now + (this.duration(this.assetFor(action)) || 2600) };
      this.effect = ['kiss','stretch'].includes(action) ? {action,started:now,until:now+(action==='kiss'?5000:4000)} : null;
      return true;
    }
    easterEgg(action, now) {
      if (action !== 'dash' || this.quiet || this.suspendedAt !== null || this.temporary) return false;
      const duration = this.duration('dash') || 2080;
      this.temporary = { action, started: now, until: now + duration }; this.effect = null;
      this.phaseUntil += duration; this.phaseStarted += duration;
      this.interact(now); return true;
    }
    click(now) {
      this.interact(now);
      if (this.main !== 'idle' || now - this.lastReaction < 1200) return null;
      const choice = this.random(); this.lastReaction = now;
      const action = choice < .3 ? 'wave' : choice < .55 ? 'kiss' : null;
      return action && this.trigger(action, now) ? action : null;
    }
    message(event, now) {
      // Messages never interrupt work/sleep. Only explicit small gestures cause a reaction.
      if (event.kind !== 'action' || now - this.lastReaction < 10000) return false;
      const action = event.action === 'wave' ? 'wave' : event.action === 'heart' ? 'kiss' : null;
      const done = action ? this.trigger(action, now) : false;
      if (done) { this.lastReaction = now; this.interact(now); }
      return done;
    }
    suspend(now) { if (this.suspendedAt === null) { this.suspendedAt = now; this.temporary = null; this.effect = null; } }
    resume(now) {
      if (this.suspendedAt !== null) {
        const elapsed = Math.max(0, now - this.suspendedAt);
        this.phaseUntil += elapsed; this.phaseStarted += elapsed; this.started += elapsed;
        this.suspendedAt = null; this.interact(now);
      }
    }
    setQuiet(value, now) { this.quiet = value; if (value) { this.temporary = null; this.effect = null; } this.planStretch(now); }
    update(now) {
      if (this.suspendedAt !== null) return;
      if (this.effect && now >= this.effect.until) this.effect = null;
      if (this.temporary && now >= this.temporary.until) { this.temporary = null; this.started = now; }
      if (this.main === 'work' && now >= this.phaseUntil) {
        this.phase = this.phase === 'typing' ? 'chin' : 'typing';
        this.phaseStarted = now; this.phaseUntil = now + this.phaseLength();
      }
      if (this.main === 'idle' && now >= this.nextStretch) {
        if (!this.quiet && now - this.lastInteraction >= 180000) this.trigger('stretch', now);
        this.planStretch(now);
      }
    }
    snapshot(now) {
      const action = this.temporary?.action || (this.main === 'work' ? this.phase : this.main);
      const started = this.temporary?.started ?? (this.main === 'work' ? this.phaseStarted : this.started);
      return { effect: this.effect ? {action:this.effect.action,elapsed:Math.max(0,now-this.effect.started)} : null, main: this.main, phase: this.phase, season: this.season, outfit: this.outfit, action, asset: this.assetFor(action), elapsed: Math.max(0, (this.suspendedAt ?? now) - started), temporary: !!this.temporary, quiet: this.quiet, suspended: this.suspendedAt !== null, nextStretch: this.nextStretch, phaseUntil: this.phaseUntil };
    }
  }
  const api = { PetBehavior, calendarSeason, normalizeSeason, seasons };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PetBehavior = api;
})(typeof window === 'object' ? window : globalThis);
