#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const TIM = require('tim-js-sdk');

const SDKAppID = 1600135634;
const userID = 'mac_mission_control';
const userSig = process.env.MC_IM_USER_SIG || 'eJwtzc0KgkAUBeB3mW1h4-xoCG2idJFCYmFBIKJj3cpRnGGIonfP1OX9zuHcDzqEiWVEhzxELIzmww2lkBoqGLjOi6wGpaCRWdFI3TXPqabKR962UCLPdjC2KXcoGxPxaqETvXPOCcZ4VA3131yXkyWnjEwrcO2-zJg5XxYbcmJRcYO7kv471cEuDpI0dbeRLw0JKavW*2Mcr9D3ByGmNvg_';
const peerID = 'mobile_test';
const inbox = path.join(process.cwd(), 'data', '.im-inbox.log');
const selftest = process.argv.includes('--selftest');

function runTaskStatus(taskId, status) {
  execFile('bash', ['-lc', `cd '${process.cwd()}' && ./scripts/mc-update.sh status '${taskId}' '${status}'`], (err, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (err) console.error('[im-bridge] task update failed:', err.message);
  });
}

function parseInstruction(text) {
  const m = text.match(/^\[(START_TASK|COMPLETE_TASK|MOVE_TASK)\]\s+(\S+)/i);
  if (!m) return null;
  return { action: m[1].toUpperCase(), taskId: m[2] };
}

async function startTim() {
  const tim = TIM.create({ SDKAppID });
  tim.on(TIM.EVENT.MESSAGE_RECEIVED, event => {
    const messages = event.data || [];
    for (const msg of messages) {
      const text = msg.payload && msg.payload.text;
      if (!text) continue;
      const inst = parseInstruction(text);
      if (!inst) continue;
      console.log('[im-bridge] recv', inst.action, inst.taskId);
      if (inst.action === 'START_TASK') runTaskStatus(inst.taskId, 'in_progress');
      if (inst.action === 'COMPLETE_TASK') runTaskStatus(inst.taskId, 'review');
      if (inst.action === 'MOVE_TASK') runTaskStatus(inst.taskId, 'backlog');
    }
  });

  const loginRes = await tim.login({ userID, userSig });
  console.log('[im-bridge] login ok', loginRes);

  if (selftest) {
    const msg = tim.createTextMessage({
      to: peerID,
      conversationType: TIM.TYPES.CONV_C2C,
      payload: { text: '[START_TASK] task_001' }
    });
    const res = await tim.sendMessage(msg);
    console.log('[im-bridge] selftest send ok', res.data && res.data.messageID);
    process.exit(0);
  }

  if (fs.existsSync(inbox)) {
    console.log('[im-bridge] local inbox available at', inbox);
  }

  return tim;
}

startTim().catch(err => {
  console.error('[im-bridge] fatal', err);
  process.exit(1);
});
