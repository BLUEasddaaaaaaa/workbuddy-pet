(function () {
  'use strict';

  // ========== 读取缩放 ==========
  const SCALE = (window.petAPI && window.petAPI.scale) || 1;

  // 设置 CSS 变量控制宠物容器大小
  const petSize = 160 * SCALE;
  document.documentElement.style.setProperty('--pet-size', petSize + 'px');

  // ========== 网格 → 像素映射 ==========
  // SVG viewBox 始终 0 0 160 160，CSS 自动等比缩放到 petSize
  const CELL = 5;

  const LEFT_EYE = {
    col: 12, row: 14, cols: 2, rows: 4,
    x: 12 * CELL,
    y: 14 * CELL,
    w: 2 * CELL,
    h: 4 * CELL,
  };

  const RIGHT_EYE = {
    col: 18, row: 14, cols: 2, rows: 4,
    x: 18 * CELL,
    y: 14 * CELL,
    w: 2 * CELL,
    h: 4 * CELL,
  };

  const CONFIG = {
    followRangeX: 8,
    followRangeY: 8,
    followSpeed: 0.3,
    blinkMinInterval: 4000,
    blinkMaxInterval: 9000,
    blinkCloseMs: 80,
    blinkOpenMs: 120,
    doubleBlinkChance: 0.03,
  };

  const $ = function (id) { return document.getElementById(id); };

  const leftEye   = $('left-eye-group');
  const rightEye  = $('right-eye-group');
  const leftLid   = $('left-lid');
  const rightLid  = $('right-lid');
  const svgEl     = $('eyes-svg');

  // ========== 鼠标跟踪 ==========
  let mouseX = 0, mouseY = 0;
  let lastMouseX = -1, lastMouseY = -1;
  let hasMouse = false;

  let leftCurX = LEFT_EYE.x, leftCurY = LEFT_EYE.y;
  let rightCurX = RIGHT_EYE.x, rightCurY = RIGHT_EYE.y;

  let leftTargetX = LEFT_EYE.x, leftTargetY = LEFT_EYE.y;
  let rightTargetX = RIGHT_EYE.x, rightTargetY = RIGHT_EYE.y;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // ========== 窗口拖拽（限流 + 累加，防止高频 setPosition 破坏透明） ==========
  var isDragging = false;
  var dragDistance = 0;
  var dragStartX = 0, dragStartY = 0;
  var pendingDx = 0, pendingDy = 0;
  var lastMoveTime = 0;
  var MOVE_THROTTLE = 33;  // ~30fps 限制 IPC 频率

  var petContainer = document.getElementById('pet-container');

  function flushDrag() {
    if (pendingDx !== 0 || pendingDy !== 0) {
      window.petAPI.moveWindow(pendingDx, pendingDy);
      pendingDx = 0;
      pendingDy = 0;
    }
    if (window.petAPI.dragEnd) {
      window.petAPI.dragEnd();
    }
  }

  petContainer.addEventListener('mousedown', function (e) {
    isDragging = true;
    dragDistance = 0;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    pendingDx = 0;
    pendingDy = 0;
    lastMoveTime = performance.now();

    // 点击操作重置空闲计时
    stateController.handleMouseActivity();
    resetMouseIdle();
  });

  // ========== 统一的 mousemove 处理（仅处理窗口拖拽，眼睛跟随由全局 IPC 轮询驱动） ==========
  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;

    var dx = e.screenX - dragStartX;
    var dy = e.screenY - dragStartY;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    dragStartX = e.screenX;
    dragStartY = e.screenY;

    if (dx !== 0 || dy !== 0) {
      pendingDx += dx;
      pendingDy += dy;
    }

    var now = performance.now();
    if (now - lastMoveTime >= MOVE_THROTTLE) {
      lastMoveTime = now;
      if (pendingDx !== 0 || pendingDy !== 0) {
        window.petAPI.moveWindow(pendingDx, pendingDy);
        pendingDx = 0;
        pendingDy = 0;
      }
    }
  });

  document.addEventListener('mouseup', function () {
    if (isDragging) {
      if (dragDistance >= 3) {
        flushDrag();
      }
    }
    isDragging = false;
  });

  document.addEventListener('mouseleave', function () {
    if (isDragging) {
      if (dragDistance >= 3) {
        flushDrag();
      }
    }
    isDragging = false;
  });

  // ========== 睡眠系统（60s 无鼠标移动 → 自动睡觉 / 移动唤醒） ==========

  var SLEEP_TIMEOUT = 60000;  // 60 秒无操作进入睡眠
  var lastMouseMoveTime = 0;

  var sleepImg = $('sleep-img');

  // ========== 待机随机动作系统（read 5% / think 3%） ==========

  var IDLE_CHECK_INTERVAL = 10000;  // 每 10 秒检查一次
  var READ_COOLDOWN     = 120000;   // read 触发后 2 分钟内不再触发
  var ACTION_DURATION_MIN = 5000;   // 动作最短播放 5 秒
  var ACTION_DURATION_MAX = 10000;  // 动作最长播放 10 秒

  var lastIdleCheck   = 0;
  var lastReadTime     = -READ_COOLDOWN;  // 初始允许立即触发
  var readImg  = $('read-img');
  var thinkImg = $('think-img');
  var workImg  = $('work-img');
  var attentionImg = $('attention-img');
  var happyImg = $('happy-img');
  var petShadow = $('pet-shadow');
  var workGifUnavailable = false;
  var renderedVisualState = null;

  function hideAllActionGifs() {
    readImg.style.display = 'none';
    thinkImg.style.display = 'none';
    workImg.style.display = 'none';
    attentionImg.style.display = 'none';
    happyImg.style.display = 'none';
    sleepImg.style.display = 'none';
  }

  function checkIdleActions(now) {
    if (stateController.snapshot().visibleState !== 'idle' || isDragging) return;
    if (now - lastIdleCheck < IDLE_CHECK_INTERVAL) return;

    lastIdleCheck = now;

    // read: 5% 概率，2min 冷却
    if (Math.random() < 0.05 && (now - lastReadTime >= READ_COOLDOWN)) {
      var readDuration = ACTION_DURATION_MIN + Math.random() * (ACTION_DURATION_MAX - ACTION_DURATION_MIN);
      if (stateController.requestIdleAction('idle-reading', readDuration)) lastReadTime = now;
      return;
    }

    // think: 5% 概率
    if (Math.random() < 0.05) {
      var thinkDuration = ACTION_DURATION_MIN + Math.random() * (ACTION_DURATION_MAX - ACTION_DURATION_MIN);
      stateController.requestIdleAction('idle-thinking', thinkDuration);
      return;
    }
  }

  // ========== 任务完成音效（Web Audio API） ==========

  function playCompletionSound() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      var audioCtx = new AudioCtx();
      // 欢快的上行琶音 C5 → E5 → G5 → C6
      var notes = [523.25, 659.25, 783.99, 1046.50];
      var startTime = audioCtx.currentTime;

      notes.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.value = freq;

        var t = startTime + i * 0.10;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch (e) {
      // 音频不可用时静默失败
    }
  }

  function renderVisualState(state) {
    hideAllActionGifs();
    petContainer.classList.remove('reading', 'thinking', 'working', 'happy', 'attention', 'sleeping');
    petShadow.style.display = 'none';
    $('pet-img').style.display = 'none';
    svgEl.style.display = 'none';

    if (state === 'idle') {
      $('pet-img').style.display = 'block';
      svgEl.style.display = '';
    } else if (state === 'idle-reading') {
      readImg.style.display = 'block';
      petContainer.classList.add('reading');
      petShadow.style.display = 'block';
    } else if (state === 'idle-thinking' || state === 'thinking') {
      thinkImg.style.display = 'block';
      petContainer.classList.add('thinking');
      petShadow.style.display = 'block';
    } else if (state === 'working') {
      if (workGifUnavailable) {
        $('pet-img').style.display = 'block';
        svgEl.style.display = '';
      } else {
        workImg.style.display = 'block';
      }
      petContainer.classList.add('working');
      petShadow.style.display = 'block';
    } else if (state === 'attention') {
      attentionImg.style.display = 'block';
      petContainer.classList.add('attention');
      petShadow.style.display = 'block';
    } else if (state === 'happy') {
      happyImg.style.display = 'block';
      petContainer.classList.add('happy');
      petShadow.style.display = 'block';
      if (renderedVisualState !== 'happy') playCompletionSound();
    } else if (state === 'sleeping') {
      sleepImg.style.display = 'block';
      petContainer.classList.add('sleeping');
      hasMouse = false;
    }

    renderedVisualState = state;
  }

  function resetMouseIdle() {
    lastMouseMoveTime = performance.now();
  }

  var stateController = window.BlueberryStateController.createStateController({
    now: function () { return performance.now(); },
    setTimer: function (callback, delay) { return setTimeout(callback, delay); },
    clearTimer: function (timer) { clearTimeout(timer); },
    applyVisual: renderVisualState,
    resetMouseIdle: resetMouseIdle,
  });

  if (window.petAPI.acceptanceMode === true) {
    Object.defineProperty(window, '__blueberryDebug', {
      value: Object.freeze({
        snapshot: function () {
          return stateController.snapshot();
        },
      }),
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }

  // work.gif 加载失败时设置降级标记
  workImg.addEventListener('error', function () {
    workGifUnavailable = true;
    workImg.style.display = 'none';
    if (stateController.snapshot().visibleState === 'working') {
      $('pet-img').style.display = 'block';
      svgEl.style.display = '';
    }
  });

  // ========== 眼睛目标计算（统一方向，双眼同步，杜绝抽搐/对眼） ==========

  function updateTargets() {
    if (!hasMouse) {
      leftTargetX = LEFT_EYE.x;
      leftTargetY = LEFT_EYE.y;
      rightTargetX = RIGHT_EYE.x;
      rightTargetY = RIGHT_EYE.y;
      return;
    }

    // 计算双眼中点（对称中心）
    var leftCX = LEFT_EYE.x + LEFT_EYE.w / 2;
    var leftCY = LEFT_EYE.y + LEFT_EYE.h / 2;
    var rightCX = RIGHT_EYE.x + RIGHT_EYE.w / 2;
    var rightCY = RIGHT_EYE.y + RIGHT_EYE.h / 2;
    var midX = (leftCX + rightCX) / 2;
    var midY = (leftCY + rightCY) / 2;

    // 从双眼中点指向鼠标的统一方向向量
    var dx = mouseX - midX;
    var dy = mouseY - midY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) {
      leftTargetX = LEFT_EYE.x;
      leftTargetY = LEFT_EYE.y;
      rightTargetX = RIGHT_EYE.x;
      rightTargetY = RIGHT_EYE.y;
      return;
    }

    // 归一化方向
    dx = dx / dist;
    dy = dy / dist;

    // 距离越远幅度越大，最大为 CONFIG.followRange
    var factor = Math.min(dist / 50, 1);
    var offsetX = dx * factor * CONFIG.followRangeX;
    var offsetY = dy * factor * CONFIG.followRangeY;

    // 双眼施加完全相同的偏移量 —— 间距固定、方向一致
    leftTargetX = clamp(LEFT_EYE.x + offsetX,
                        LEFT_EYE.x - CONFIG.followRangeX,
                        LEFT_EYE.x + CONFIG.followRangeX);
    leftTargetY = clamp(LEFT_EYE.y + offsetY,
                        LEFT_EYE.y - CONFIG.followRangeY,
                        LEFT_EYE.y + CONFIG.followRangeY);
    rightTargetX = clamp(RIGHT_EYE.x + offsetX,
                         RIGHT_EYE.x - CONFIG.followRangeX,
                         RIGHT_EYE.x + CONFIG.followRangeX);
    rightTargetY = clamp(RIGHT_EYE.y + offsetY,
                         RIGHT_EYE.y - CONFIG.followRangeY,
                         RIGHT_EYE.y + CONFIG.followRangeY);
  }

  // ========== 平滑渲染 ==========

  function applySmoothEyes() {
    var s = CONFIG.followSpeed;

    leftCurX = lerp(leftCurX, leftTargetX, s);
    leftCurY = lerp(leftCurY, leftTargetY, s);
    rightCurX = lerp(rightCurX, rightTargetX, s);
    rightCurY = lerp(rightCurY, rightTargetY, s);

    leftEye.setAttribute('transform', 'translate(' + leftCurX + ', ' + leftCurY + ')');
    rightEye.setAttribute('transform', 'translate(' + rightCurX + ', ' + rightCurY + ')');
  }

  // ========== 眨眼系统 ==========

  var blinkState = 'idle';
  var blinkTimer = null;
  var blinkStartTime = 0;
  var isDoubleBlink = false;
  var blinkPhase = 0;

  function scheduleBlink() {
    var delay = CONFIG.blinkMinInterval +
      Math.random() * (CONFIG.blinkMaxInterval - CONFIG.blinkMinInterval);
    blinkTimer = setTimeout(startBlink, delay);
  }

  function startBlink() {
    if (blinkState !== 'idle') return;
    isDoubleBlink = Math.random() < CONFIG.doubleBlinkChance;
    blinkPhase = 0;
    blinkState = 'closing';
    blinkStartTime = performance.now();
  }

  function setLidHeight(h) {
    leftLid.setAttribute('height', Math.round(h));
    rightLid.setAttribute('height', Math.round(h));
  }

  function updateBlink(now) {
    if (blinkState === 'idle') return;

    var elapsed = now - blinkStartTime;

    if (blinkState === 'closing') {
      var t = clamp(elapsed / CONFIG.blinkCloseMs, 0, 1);
      setLidHeight(t * LEFT_EYE.h);
      if (t >= 1) {
        blinkState = isDoubleBlink ? 'closed_double' : 'closed';
        blinkStartTime = now;
        blinkPhase++;
      }
    } else if (blinkState === 'closed') {
      if (elapsed > 40) {
        blinkState = 'opening';
        blinkStartTime = now;
      }
    } else if (blinkState === 'closed_double') {
      if (elapsed > 50) {
        blinkState = 'opening';
        blinkStartTime = now;
      }
    } else if (blinkState === 'opening') {
      var t2 = clamp(elapsed / CONFIG.blinkOpenMs, 0, 1);
      setLidHeight(LEFT_EYE.h * (1 - t2));
      if (t2 >= 1) {
        if (isDoubleBlink && blinkPhase === 1) {
          blinkState = 'closing';
          blinkStartTime = now;
          blinkPhase++;
        } else {
          blinkState = 'idle';
          setLidHeight(0);
          scheduleBlink();
        }
      }
    }
  }

  // ========== 主循环 ==========

  function gameLoop(timestamp) {
    // 睡眠检测：60s 无鼠标移动 → 自动睡觉（拖拽/反应期间不触发）
    var visibleState = stateController.snapshot().visibleState;
    if (visibleState !== 'sleeping' && !isDragging && lastMouseMoveTime > 0 && (timestamp - lastMouseMoveTime > SLEEP_TIMEOUT)) {
      stateController.handleMouseSleep();
    }

    if (visibleState === 'idle') {
      updateTargets();
      applySmoothEyes();
      updateBlink(timestamp);
    }

    checkIdleActions(timestamp);
    requestAnimationFrame(gameLoop);
  }

  // ========== 启动 ==========

  // 全局鼠标位置监听（从主进程 IPC 推送，实现大范围眼睛跟随）
  window.petAPI.onMousePosition(function (pos) {
    var relX = pos.cursorX - pos.windowX;
    var relY = pos.cursorY - pos.windowY;

    // 映射到 SVG viewBox 0-160 坐标空间
    mouseX = (relX / pos.windowWidth) * 160;
    mouseY = (relY / pos.windowHeight) * 160;
    hasMouse = true;

    // 首次收到位置时初始化空闲计时
    if (lastMouseMoveTime === 0) {
      lastMouseMoveTime = performance.now();
    }

    // 更新空闲计时 → 如有位移则唤醒
    if (mouseX !== lastMouseX || mouseY !== lastMouseY) {
      stateController.handleMouseActivity();
      resetMouseIdle();
    }
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  });

  // Codex Hook 事件经主进程归一化后 → 宠物状态（统一通道）
  window.petAPI.onTriggerState(function (state) {
    stateController.handleHookState(state);
  });

  scheduleBlink();
  requestAnimationFrame(gameLoop);

})();
