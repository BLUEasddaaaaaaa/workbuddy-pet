#!/usr/bin/env node
'use strict';

/**
 * CodeBuddy Hook 脚本 — 桌面宠物状态触发器
 *
 * 安装方式（手动写入 ~/.codebuddy/settings.json）：
 * {
 *   "hooks": {
 *     "SessionStart":     [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js SessionStart"}],
 *     "SessionEnd":       [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js SessionEnd"}],
 *     "UserPromptSubmit": [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js UserPromptSubmit"}],
 *     "PreToolUse":       [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js PreToolUse"}],
 *     "PostToolUse":      [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js PostToolUse"}],
 *     "Stop":             [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js Stop"}],
 *     "Notification":     [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js Notification"}],
 *     "PreCompact":       [{"type":"command","command":"node /绝对路径/hooks/codebuddy-hook.js PreCompact"}]
 *   }
 * }
 *
 * CodeBuddy Hook 事件 → 宠物状态映射表：
 * ┌──────────────────────────────────┬───────────────┬──────────────────────────────────────┐
 * │ Hook 事件名                      │ 宠物状态      │ 语义说明                             │
 * ├──────────────────────────────────┼───────────────┼──────────────────────────────────────┤
 * │ SessionStart                     │ idle          │ 会话开始，显示默认待机                │
 * │ SessionEnd                       │ sleeping      │ 会话结束，进入睡眠                    │
 * │ UserPromptSubmit                 │ thinking      │ 用户发送提示词，思考动画              │
 * │ PreToolUse                       │ working       │ 工具调用前，工作动画                  │
 * │ PostToolUse                      │ working       │ 工具调用后，保持工作动画              │
 * │ Stop (stop_hook_active=false)    │ happy  ★      │ AI 正常完成任务 → 庆祝动画           │
 * │ Stop (stop_hook_active=true)     │ (跳过)        │ hook 触发的继续运行，非真实完成       │
 * │ Notification (idle_prompt)       │ happy  ★      │ 任务弹窗出现，AI 等待用户 → 庆祝     │
 * │ Notification (其他类型)          │ attention     │ 权限请求等其他通知，提醒状态          │
 * │ PreCompact                       │ idle          │ 上下文压缩前，回到待机                │
 * └──────────────────────────────────┴───────────────┴──────────────────────────────────────┘
 */

const http = require('http');

// ========== 配置 ==========
const PET_HOST = '127.0.0.1';
const PET_PORT = 18920;
const POST_TIMEOUT = 100;  // ms，不阻塞 CodeBuddy 主流程

// ========== Hook 事件 → 宠物状态映射表 ==========
// Stop / Notification(idle_prompt) 需要动态判断，不在此表中
const HOOK_MAP = {
  'SessionStart':     'idle',
  'SessionEnd':       'sleeping',
  'UserPromptSubmit': 'thinking',
  'PreToolUse':       'working',
  'PostToolUse':      'working',
  'PreCompact':       'idle',
};

// ========== 读取 stdin JSON（CodeBuddy 传入的 payload） ==========
function readStdinJson() {
  return new Promise(function (resolve) {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function (chunk) { data += chunk; });
    process.stdin.on('end', function () {
      try { resolve(JSON.parse(data)); }
      catch (e) { resolve({}); }
    });
    // stdin 不存在时直接 resolve
    if (process.stdin.isTTY) resolve({});
  });
}

// ========== POST 状态到桌面宠物 HTTP 服务 ==========
function postState(state) {
  return new Promise(function (resolve) {
    const body = JSON.stringify({ state: state });

    const req = http.request({
      hostname: PET_HOST,
      port: PET_PORT,
      path: '/state',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, function (res) {
      res.resume();  // 消费响应体，防止连接挂起
      res.on('end', resolve);
    });

    req.setTimeout(POST_TIMEOUT, function () {
      req.destroy();
      resolve();  // 超时静默失败，不阻塞 CodeBuddy
    });

    req.on('error', resolve);  // 宠物未运行时静默忽略
    req.write(body);
    req.end();
  });
}

// ========== 主流程 ==========
async function main() {
  const hookEventName = process.argv[2];

  // 读取 stdin payload（Stop / Notification 需要解析）
  const payload = await readStdinJson();

  // ── Stop 事件：任务正常结束 → happy；否则 attention ──────────────
  if (hookEventName === 'Stop') {
    // stop_hook_active 为 true 表示本次是 hook 触发的继续运行，
    // 不是真正的"任务完成"，跳过，避免无限触发
    if (!payload.stop_hook_active) {
      await postState('happy');
    }
    process.stdout.write('{}');
    process.exit(0);
  }

  // ── Notification 事件：idle_prompt = AI 完成等待用户 → happy ─────
  if (hookEventName === 'Notification') {
    const notifType = payload.notification_type || '';
    if (notifType === 'idle_prompt') {
      await postState('happy');
    } else {
      await postState('attention');
    }
    process.stdout.write('{}');
    process.exit(0);
  }

  // 未知事件：直接退出
  if (!hookEventName || !(hookEventName in HOOK_MAP)) {
    if (hookEventName === 'PreToolUse') {
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
    } else {
      process.stdout.write('{}');
    }
    process.exit(0);
  }

  const targetState = HOOK_MAP[hookEventName];
  await postState(targetState);

  // PreToolUse 必须返回 allow 决策
  if (hookEventName === 'PreToolUse') {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  } else {
    process.stdout.write('{}');
  }

  process.exit(0);
}

main().catch(function () {
  process.stdout.write('{}');
  process.exit(0);
});
