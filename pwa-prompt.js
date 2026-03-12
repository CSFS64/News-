/**
 * FRONTLINE · pwa-prompt.js
 * First-visit mobile install prompt — Android (one-tap) + iOS (tutorial)
 * Self-contained: injects its own styles + DOM. No dependencies beyond window.
 */

(function () {
  'use strict';

  /* ── Only run on mobile, only on first visit ── */
  if (window.innerWidth > 700) return;

  /* Already installed as PWA? Skip. */
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (isStandalone) return;

  /* Already dismissed? Skip. */
  var STORAGE_KEY = 'fl_pwa_dismissed_v1';
  try { if (localStorage.getItem(STORAGE_KEY)) return; } catch(e) {}

  /* ── Detect platform ── */
  var ua = navigator.userAgent || '';
  var isIOS     = /iphone|ipad|ipod/i.test(ua);
  var isAndroid = /android/i.test(ua);
  if (!isIOS && !isAndroid) return; /* desktop with small window — skip */

  /* ── Capture beforeinstallprompt for Android ── */
  var _deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _deferredPrompt = e;
  });

  /* ══════════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════════ */
  var style = document.createElement('style');
  style.textContent = `
/* ─── overlay ─── */
#fl-pwa-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(8,9,7,0.92);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  display: flex; align-items: flex-end;
  font-family: 'Share Tech Mono', 'Courier New', monospace;
  -webkit-tap-highlight-color: transparent;
}

/* ─── sheet ─── */
#fl-pwa-sheet {
  width: 100%;
  background: #0e0f0b;
  border-top: 1px solid #2e3024;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
  position: relative;
  max-height: 92vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* scan-line texture */
#fl-pwa-sheet::before {
  content: '';
  position: absolute; inset: 0; z-index: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(255,255,255,0.012) 2px,
    rgba(255,255,255,0.012) 4px
  );
  pointer-events: none;
}

/* ─── red top bar ─── */
#fl-pwa-topbar {
  height: 3px;
  background: linear-gradient(90deg, #c0392b 0%, #e84040 50%, #c0392b 100%);
  background-size: 200% 100%;
  animation: fl-bar-scan 2s linear infinite;
  position: relative; z-index: 1;
}
@keyframes fl-bar-scan {
  0%   { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

/* ─── drag handle ─── */
#fl-pwa-handle {
  width: 36px; height: 4px;
  background: #2e3024; border-radius: 2px;
  margin: 14px auto 0;
  position: relative; z-index: 1;
}

/* ─── inner padding ─── */
#fl-pwa-inner {
  padding: 18px 20px 32px;
  position: relative; z-index: 1;
}

/* ─── header ─── */
#fl-pwa-header {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 22px;
}
#fl-pwa-logo {
  width: 46px; height: 46px; flex-shrink: 0;
  background: #c0392b;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 1px rgba(192,57,43,0.5), 0 4px 20px rgba(192,57,43,0.4);
  position: relative; overflow: hidden;
  animation: fl-logo-pulse 3s ease-in-out infinite;
}
@keyframes fl-logo-pulse {
  0%,100% { box-shadow: 0 0 0 1px rgba(192,57,43,0.5), 0 4px 20px rgba(192,57,43,0.4); }
  50%      { box-shadow: 0 0 0 1px rgba(232,64,64,0.7), 0 4px 28px rgba(232,64,64,0.6); }
}
#fl-pwa-logo svg { width: 26px; height: 26px; }
#fl-pwa-logo-scan {
  position: absolute; left: 0; right: 0; height: 2px;
  background: rgba(255,255,255,0.35);
  animation: fl-logo-scan 1.8s linear infinite;
}
@keyframes fl-logo-scan {
  from { top: -2px; }
  to   { top: 100%; }
}
#fl-pwa-titles { flex: 1; }
#fl-pwa-callsign {
  font-size: 10px; letter-spacing: 3px; color: #c0392b;
  text-transform: uppercase; margin-bottom: 3px;
  animation: fl-type-in 0.6s steps(12) both;
}
#fl-pwa-name {
  font-family: 'Oswald', 'Arial Black', sans-serif;
  font-size: 22px; font-weight: 700; color: #e8e9d8;
  letter-spacing: 0.5px; line-height: 1;
  animation: fl-type-in 0.5s steps(10) 0.2s both;
}
@keyframes fl-type-in {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0% 0 0); }
}
#fl-pwa-sub {
  font-size: 11px; color: #6e7060; margin-top: 4px; line-height: 1.4;
  animation: fl-fade-up 0.4s ease 0.5s both;
}

/* ─── status line ─── */
#fl-pwa-status {
  font-size: 10px; color: #4a5230; letter-spacing: 1.5px;
  border-top: 1px solid #1a1c15; padding-top: 10px; margin-bottom: 20px;
  display: flex; align-items: center; gap: 8px;
  animation: fl-fade-up 0.4s ease 0.6s both;
}
#fl-pwa-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #c0392b;
  animation: fl-blink 1.2s ease-in-out infinite;
}
@keyframes fl-blink {
  0%,100% { opacity: 1; } 50% { opacity: 0.2; }
}

/* ─── phase: select ─── */
#fl-pwa-phase-select { animation: fl-fade-up 0.35s ease 0.7s both; }
#fl-pwa-cta {
  font-size: 14px; color: #c8c9b8; margin-bottom: 18px; line-height: 1.6;
}
#fl-pwa-cta strong { color: #e8e9d8; }

.fl-os-cards {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-bottom: 18px;
}
.fl-os-card {
  background: #141510; border: 1px solid #2e3024;
  border-radius: 14px; padding: 16px 12px;
  cursor: pointer; transition: all 0.18s ease;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  position: relative; overflow: hidden;
}
.fl-os-card::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(192,57,43,0.06) 0%, transparent 60%);
  opacity: 0; transition: opacity 0.18s;
}
.fl-os-card:active { transform: scale(0.96); }
.fl-os-card:active::before { opacity: 1; }
.fl-os-card-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
}
.fl-os-card-icon.android { background: rgba(61,220,132,0.12); }
.fl-os-card-icon.ios     { background: rgba(120,180,255,0.12); }
.fl-os-card-label {
  font-size: 13px; font-weight: 700; color: #e8e9d8; letter-spacing: 0.3px;
}
.fl-os-card-sub {
  font-size: 10px; color: #6e7060; text-align: center; line-height: 1.4;
}

/* ─── phase: android ─── */
#fl-pwa-phase-android { display: none; }
#fl-pwa-phase-android.active { display: block; animation: fl-fade-up 0.3s ease both; }

.fl-section-title {
  font-size: 10px; letter-spacing: 2px; color: #c0392b;
  text-transform: uppercase; margin-bottom: 14px;
}

/* benefits list */
.fl-benefits { margin-bottom: 22px; display: flex; flex-direction: column; gap: 10px; }
.fl-benefit {
  display: flex; align-items: center; gap: 12px;
  background: #141510; border: 1px solid #1a1c15; border-radius: 10px;
  padding: 11px 14px;
}
.fl-benefit-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(192,57,43,0.12); display: flex; align-items: center;
  justify-content: center; font-size: 16px; flex-shrink: 0;
}
.fl-benefit-text { flex: 1; }
.fl-benefit-title { font-size: 12px; color: #e8e9d8; font-weight: 700; margin-bottom: 2px; }
.fl-benefit-sub { font-size: 10px; color: #6e7060; line-height: 1.4; }

/* install button */
#fl-android-install-btn {
  width: 100%; height: 52px;
  background: linear-gradient(135deg, #c0392b 0%, #e84040 100%);
  border: none; border-radius: 14px; color: #fff;
  font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 600;
  letter-spacing: 1px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  box-shadow: 0 4px 24px rgba(192,57,43,0.5);
  transition: all 0.15s ease; position: relative; overflow: hidden;
  margin-bottom: 12px;
}
#fl-android-install-btn::after {
  content: '';
  position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  animation: fl-btn-shimmer 2.5s ease 1s infinite;
}
@keyframes fl-btn-shimmer {
  0%   { left: -100%; }
  60%  { left: 150%; }
  100% { left: 150%; }
}
#fl-android-install-btn:active { transform: scale(0.97); box-shadow: 0 2px 12px rgba(192,57,43,0.4); }

/* manual fallback */
#fl-android-manual {
  display: none; /* shown if no prompt available */
  background: #141510; border: 1px solid #2e3024; border-radius: 12px;
  padding: 14px; margin-bottom: 12px;
}
#fl-android-manual .fl-step-row {
  display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;
}
#fl-android-manual .fl-step-row:last-child { margin-bottom: 0; }
.fl-step-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(192,57,43,0.15); border: 1px solid rgba(192,57,43,0.3);
  font-size: 11px; color: #c0392b; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fl-step-text { font-size: 12px; color: #c8c9b8; line-height: 1.5; }
.fl-step-text strong { color: #e8e9d8; }

/* ─── phase: ios ─── */
#fl-pwa-phase-ios { display: none; }
#fl-pwa-phase-ios.active { display: block; animation: fl-fade-up 0.3s ease both; }

.fl-ios-steps { display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px; }

.fl-ios-step {
  background: #141510; border: 1px solid #1a1c15; border-radius: 14px;
  padding: 14px; display: flex; gap: 14px; align-items: flex-start;
  opacity: 0; transform: translateX(-8px);
  transition: none;
}
.fl-ios-step.visible {
  animation: fl-step-enter 0.32s cubic-bezier(0.34,1.1,0.64,1) both;
}
@keyframes fl-step-enter {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.fl-ios-step-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(192,57,43,0.15); border: 1px solid rgba(192,57,43,0.4);
  font-size: 13px; font-weight: 700; color: #c0392b;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.fl-ios-step-body { flex: 1; }
.fl-ios-step-title {
  font-family: 'Oswald', sans-serif;
  font-size: 14px; font-weight: 600; color: #e8e9d8; margin-bottom: 5px;
}
.fl-ios-step-desc { font-size: 11px; color: #6e7060; line-height: 1.55; }
.fl-ios-step-desc strong { color: #c8c9b8; }

/* visual mockup for each step */
.fl-ios-mockup {
  margin-top: 10px; border-radius: 10px; overflow: hidden;
  border: 1px solid #2e3024; background: #1a1c15;
}

/* step 1: browser bar mockup */
.fl-mock-browser {
  padding: 10px 12px;
}
.fl-mock-url {
  height: 32px; background: #212318; border-radius: 8px;
  display: flex; align-items: center; gap: 8px; padding: 0 10px;
}
.fl-mock-url-text { font-size: 11px; color: #4a5230; flex: 1; }
.fl-mock-share-btn {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(192,57,43,0.15); border: 1px solid rgba(192,57,43,0.3);
  display: flex; align-items: center; justify-content: center;
  animation: fl-share-pulse 2s ease-in-out infinite;
}
@keyframes fl-share-pulse {
  0%,100% { background: rgba(192,57,43,0.15); border-color: rgba(192,57,43,0.3); }
  50%     { background: rgba(192,57,43,0.3);  border-color: rgba(192,57,43,0.6); }
}

/* step 2: share sheet mockup */
.fl-mock-sheet {
  padding: 10px 12px; display: flex; align-items: center; gap: 10px;
}
.fl-mock-add-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(192,57,43,0.15); border: 1px solid rgba(192,57,43,0.3);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  animation: fl-icon-bounce 1.8s cubic-bezier(0.34,1.56,0.64,1) 0.4s infinite;
}
@keyframes fl-icon-bounce {
  0%,70%,100% { transform: scale(1); }
  35% { transform: scale(1.18); }
}
.fl-mock-add-text { font-size: 11px; color: #c8c9b8; }
.fl-mock-add-sub { font-size: 10px; color: #4a5230; margin-top: 2px; }

/* step 3: home screen mockup */
.fl-mock-homescreen {
  padding: 10px 12px; display: flex; align-items: center; gap: 10px;
}
.fl-mock-app-icon {
  width: 42px; height: 42px; border-radius: 10px;
  background: #c0392b; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 12px rgba(192,57,43,0.4);
  animation: fl-app-appear 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both;
}
@keyframes fl-app-appear {
  from { opacity: 0; transform: scale(0); }
  to   { opacity: 1; transform: scale(1); }
}
.fl-mock-app-label { font-size: 11px; color: #c8c9b8; }
.fl-mock-app-sub { font-size: 10px; color: #4a5230; margin-top: 2px; }

/* ─── skip / back buttons ─── */
.fl-skip-btn {
  display: block; width: 100%; padding: 12px;
  background: none; border: 1px solid #2e3024; border-radius: 10px;
  font-family: 'Share Tech Mono', monospace; font-size: 11px;
  color: #4a5230; cursor: pointer; text-align: center;
  transition: all 0.15s; letter-spacing: 0.5px;
  margin-top: 8px;
}
.fl-skip-btn:active { color: #6e7060; border-color: #3d4030; }

.fl-back-btn {
  background: none; border: none; padding: 0;
  font-family: 'Share Tech Mono', monospace; font-size: 11px;
  color: #4a5230; cursor: pointer; margin-bottom: 16px;
  display: flex; align-items: center; gap: 6px;
  -webkit-tap-highlight-color: transparent;
}
.fl-back-btn:active { color: #6e7060; }

/* ─── util ─── */
@keyframes fl-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* sheet entrance */
#fl-pwa-sheet {
  animation: fl-sheet-rise 0.38s cubic-bezier(0.32,0.72,0,1) both;
}
@keyframes fl-sheet-rise {
  from { transform: translateY(100%); opacity: 0.6; }
  to   { transform: translateY(0);    opacity: 1; }
}
#fl-pwa-overlay {
  animation: fl-overlay-in 0.3s ease both;
}
@keyframes fl-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;
  document.head.appendChild(style);

  /* ══════════════════════════════════════════════
     DOM
  ══════════════════════════════════════════════ */
  var overlay = document.createElement('div');
  overlay.id = 'fl-pwa-overlay';

  overlay.innerHTML = `
<div id="fl-pwa-sheet">
  <div id="fl-pwa-topbar"></div>
  <div id="fl-pwa-handle"></div>
  <div id="fl-pwa-inner">

    <!-- Header -->
    <div id="fl-pwa-header">
      <div id="fl-pwa-logo">
        <div id="fl-pwa-logo-scan"></div>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div id="fl-pwa-titles">
        <div id="fl-pwa-callsign">// FRONTLINE · MOBILE</div>
        <div id="fl-pwa-name">战线快报</div>
        <div id="fl-pwa-sub">全球冲突与战事实时跟踪</div>
      </div>
    </div>

    <!-- Status line -->
    <div id="fl-pwa-status">
      <span id="fl-pwa-dot"></span>
      <span id="fl-pwa-status-text">SIGNAL ACQUIRED · INSTALL RECOMMENDED</span>
    </div>

    <!-- PHASE: Select OS -->
    <div id="fl-pwa-phase-select">
      <div id="fl-pwa-cta">
        将 <strong>战线快报</strong> 安装到主屏幕，<br>
        获得接近原生 App 的完整体验
      </div>

      <div class="fl-os-cards">
        <div class="fl-os-card" id="fl-card-android">
          <div class="fl-os-card-icon android">🤖</div>
          <div class="fl-os-card-label">Android</div>
          <div class="fl-os-card-sub">Chrome · 一键安装</div>
        </div>
        <div class="fl-os-card" id="fl-card-ios">
          <div class="fl-os-card-icon ios"></div>
          <div class="fl-os-card-label">iPhone / iPad</div>
          <div class="fl-os-card-sub">Safari · 三步完成</div>
        </div>
      </div>

      <button class="fl-skip-btn" id="fl-skip-btn">// 稍后再说，继续浏览</button>
    </div>

    <!-- PHASE: Android -->
    <div id="fl-pwa-phase-android">
      <button class="fl-back-btn" id="fl-back-android">← 返回</button>

      <div class="fl-section-title">// 安装优势</div>
      <div class="fl-benefits">
        <div class="fl-benefit">
          <div class="fl-benefit-icon">⚡</div>
          <div class="fl-benefit-text">
            <div class="fl-benefit-title">秒开，无需等待</div>
            <div class="fl-benefit-sub">离线缓存，比浏览器快 3 倍</div>
          </div>
        </div>
        <div class="fl-benefit">
          <div class="fl-benefit-icon">🔔</div>
          <div class="fl-benefit-text">
            <div class="fl-benefit-title">推送通知（即将上线）</div>
            <div class="fl-benefit-sub">重大战报第一时间推送到桌面</div>
          </div>
        </div>
        <div class="fl-benefit">
          <div class="fl-benefit-icon">📱</div>
          <div class="fl-benefit-text">
            <div class="fl-benefit-title">全屏沉浸体验</div>
            <div class="fl-benefit-sub">无地址栏，专注于内容</div>
          </div>
        </div>
      </div>

      <div class="fl-section-title">// 立即安装</div>
      <button id="fl-android-install-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v13M7 11l5 5 5-5"/><path d="M3 20h18"/>
        </svg>
        添加到主屏幕
      </button>

      <div id="fl-android-manual">
        <div class="fl-step-row">
          <div class="fl-step-num">1</div>
          <div class="fl-step-text">点击浏览器右上角 <strong>⋮ 菜单</strong></div>
        </div>
        <div class="fl-step-row">
          <div class="fl-step-num">2</div>
          <div class="fl-step-text">选择 <strong>"添加到主屏幕"</strong> 或 <strong>"安装应用"</strong></div>
        </div>
        <div class="fl-step-row">
          <div class="fl-step-num">3</div>
          <div class="fl-step-text">点击 <strong>确认安装</strong>，图标即出现在桌面</div>
        </div>
      </div>

      <button class="fl-skip-btn" id="fl-skip-android">// 跳过，直接进入</button>
    </div>

    <!-- PHASE: iOS -->
    <div id="fl-pwa-phase-ios">
      <button class="fl-back-btn" id="fl-back-ios">← 返回</button>

      <div class="fl-section-title">// 安装步骤 · Safari</div>
      <div class="fl-ios-steps" id="fl-ios-steps">

        <div class="fl-ios-step" data-step="0">
          <div class="fl-ios-step-num">1</div>
          <div class="fl-ios-step-body">
            <div class="fl-ios-step-title">点击底部分享按钮</div>
            <div class="fl-ios-step-desc">
              在 Safari 底部工具栏找到
              <strong>分享按钮 <span style="font-size:14px">□↑</span></strong>，
              点击打开分享菜单
            </div>
            <div class="fl-ios-mockup">
              <div class="fl-mock-browser">
                <div class="fl-mock-url">
                  <span class="fl-mock-url-text">csfs64.github.io/News-/</span>
                  <div class="fl-mock-share-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                      <polyline points="16 6 12 2 8 6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="fl-ios-step" data-step="1">
          <div class="fl-ios-step-num">2</div>
          <div class="fl-ios-step-body">
            <div class="fl-ios-step-title">选择"添加到主屏幕"</div>
            <div class="fl-ios-step-desc">
              在分享菜单中向下滚动，找到
              <strong>「添加到主屏幕」</strong>
              选项并点击
            </div>
            <div class="fl-ios-mockup">
              <div class="fl-mock-sheet">
                <div class="fl-mock-add-icon">＋</div>
                <div>
                  <div class="fl-mock-add-text">添加到主屏幕</div>
                  <div class="fl-mock-add-sub">Add to Home Screen</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="fl-ios-step" data-step="2">
          <div class="fl-ios-step-num">3</div>
          <div class="fl-ios-step-body">
            <div class="fl-ios-step-title">点击右上角"添加"</div>
            <div class="fl-ios-step-desc">
              确认名称后，点击右上角
              <strong>「添加」</strong>
              — 战线快报图标就出现在你的主屏幕了
            </div>
            <div class="fl-ios-mockup">
              <div class="fl-mock-homescreen">
                <div class="fl-mock-app-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <div class="fl-mock-app-label">战线快报</div>
                  <div class="fl-mock-app-sub">已添加到主屏幕 ✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <button class="fl-skip-btn" id="fl-skip-ios">// 跳过，直接进入</button>
    </div>

  </div><!-- /inner -->
</div><!-- /sheet -->
`;

  /* ══════════════════════════════════════════════
     LOGIC
  ══════════════════════════════════════════════ */
  function dismiss() {
    overlay.style.animation = 'fl-overlay-out 0.28s ease forwards';
    var sheet = document.getElementById('fl-pwa-sheet');
    if (sheet) sheet.style.animation = 'fl-sheet-drop 0.28s cubic-bezier(0.4,0,1,1) forwards';

    var exitStyle = document.createElement('style');
    exitStyle.textContent = `
      @keyframes fl-overlay-out { to { opacity: 0; pointer-events: none; } }
      @keyframes fl-sheet-drop  { to { transform: translateY(100%); } }
    `;
    document.head.appendChild(exitStyle);

    setTimeout(function () { overlay.remove(); exitStyle.remove(); }, 300);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
  }

  function showPhase(id) {
    var phases = ['fl-pwa-phase-select','fl-pwa-phase-android','fl-pwa-phase-ios'];
    phases.forEach(function(p) {
      var el = document.getElementById(p);
      if (!el) return;
      if (p === id) { el.style.display = 'block'; el.classList.add('active'); }
      else          { el.style.display = 'none';  el.classList.remove('active'); }
    });
    // Scroll sheet to top
    var sheet = document.getElementById('fl-pwa-sheet');
    if (sheet) sheet.scrollTop = 0;
    // Animate iOS steps with stagger
    if (id === 'fl-pwa-phase-ios') {
      document.querySelectorAll('.fl-ios-step').forEach(function(el, i) {
        el.classList.remove('visible');
        setTimeout(function() { el.classList.add('visible'); }, 60 + i * 130);
      });
    }
  }

  /* ── Wire up after appending to DOM ── */
  function bindEvents() {
    /* OS select */
    document.getElementById('fl-card-android').addEventListener('click', function() {
      showPhase('fl-pwa-phase-android');
      // Show install button or manual fallback
      var installBtn = document.getElementById('fl-android-install-btn');
      var manual     = document.getElementById('fl-android-manual');
      if (_deferredPrompt) {
        installBtn.style.display = 'flex';
        manual.style.display = 'none';
      } else {
        installBtn.style.display = 'none';
        manual.style.display = 'block';
      }
    });
    document.getElementById('fl-card-ios').addEventListener('click', function() {
      showPhase('fl-pwa-phase-ios');
    });

    /* Android install */
    document.getElementById('fl-android-install-btn').addEventListener('click', function() {
      if (!_deferredPrompt) return;
      var btn = this;
      btn.textContent = '安装中…'; btn.disabled = true;
      _deferredPrompt.prompt();
      _deferredPrompt.userChoice.then(function(r) {
        if (r.outcome === 'accepted') { dismiss(); }
        else {
          btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v13M7 11l5 5 5-5"/><path d="M3 20h18"/></svg> 添加到主屏幕';
          btn.disabled = false;
        }
        _deferredPrompt = null;
      });
    });

    /* Back buttons */
    document.getElementById('fl-back-android').addEventListener('click', function() { showPhase('fl-pwa-phase-select'); });
    document.getElementById('fl-back-ios').addEventListener('click', function()     { showPhase('fl-pwa-phase-select'); });

    /* Skip / dismiss */
    ['fl-skip-btn','fl-skip-android','fl-skip-ios'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', dismiss);
    });

    /* Tap overlay background to dismiss */
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) dismiss();
    });
  }

  /* ── Mount ── */
  document.body.appendChild(overlay);
  bindEvents();

  /* Auto-detect & pre-select OS to reduce friction */
  if (isAndroid) {
    /* Highlight android card subtly */
    var ac = document.getElementById('fl-card-android');
    if (ac) {
      ac.style.borderColor = 'rgba(192,57,43,0.4)';
      ac.style.background  = 'rgba(192,57,43,0.04)';
    }
  } else if (isIOS) {
    var ic = document.getElementById('fl-card-ios');
    if (ic) {
      ic.style.borderColor = 'rgba(192,57,43,0.4)';
      ic.style.background  = 'rgba(192,57,43,0.04)';
    }
  }

})();
