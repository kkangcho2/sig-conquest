/*  SIG CONQUEST V2 — console.js
    관리자 콘솔 (스텝 위자드 · 최대15인)
    ──────────────────────────────────────── */

/* ── IndexedDB helpers (전역) ────────── */
const extractAmount = name => {
  const m = (name||'').replace(/,/g,'').match(/\d+/);
  return m ? parseInt(m[0],10) : 0;
};

// 파일명에서 시그 이름 추출 (예: "22200_이라이라" → "이라이라")
const extractSigName = name => {
  const parts = (name||'').split('_');
  return parts.length > 1 ? parts.slice(1).join('_') : name;
};

function toggleAccordion(id) {
  document.getElementById(id)?.classList.toggle('open');
}

/* ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

let state = SigStorage.load();
if (!state || !state.version || state.version < 40) {
  state = SigEngine.createGame(4);
  SigStorage.saveOnly(state);
}

const $ = id => document.getElementById(id);
const cp = () => SigEngine.currentPlayer(state);
const ct = () => state.tiles[cp().position];
const saveR   = () => { SigStorage.saveOnly(state); render(); };
const backupR = () => { SigStorage.save(state); render(); };

let manualD1 = 0, manualD2 = 0;
let selectedPlayerIdx = 0;
let selectedTileId = -1;
let isAnimating = false;
let lastTurnKey = '';  // turnIdx+round로 턴 변경 감지

/* ═══ STEP 상태 (4단계) ═════════════════
   dice → move → donate → action → done
   _step: null=dice, 'move', 'donate', 'action', 'done'
   ═══════════════════════════════════════ */
function getStep() {
  if (state.gameOver) return 'over';
  const p = cp();
  if (state.pendingAction?.type === 'JAIL_TURN') return 'jail';
  if (state.pendingAction?.type === 'DESERT_TURN') return 'desert';
  return state._step || 'dice';
}

/* ═══ 렌더 ══════════════════════════════ */
function render() {
  renderTurnOrder();
  renderStepWizard();
  renderAssets();
  renderFooter();
  renderLog();
}

/* ── 턴 순서 바 ─────────────────────── */
function renderTurnOrder() {
  const bar = $('turnOrderBar');
  bar.innerHTML = '';
  state.players.forEach((p, i) => {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'turn-arrow';
      arrow.textContent = '→';
      bar.appendChild(arrow);
    }
    const chip = document.createElement('div');
    chip.className = 'turn-chip';
    if (i === state.turnIdx) chip.classList.add('active');
    if (p.bankrupt) chip.classList.add('bankrupt');
    chip.style.background = p.color;
    chip.textContent = `P${i + 1}`;
    chip.title = `${p.name} — 💰${p.money.toLocaleString()}`;
    bar.appendChild(chip);
  });
}

/* ── 스텝 위자드 (4단계) ─────────────── */
function renderStepWizard() {
  const step = getStep();
  const panels = ['stepDice','stepMove','stepDonate','stepAction'];
  panels.forEach(id => { $(id).classList.remove('active','done'); });

  const p = cp();
  const tile = ct();

  // ── Step 1: 주사위 ──
  if (step === 'dice') {
    $('stepDice').classList.add('active');
    // 매번 재생성 (이전 단계에서 innerHTML 교체되었을 수 있음)
    $('stepDiceBody').innerHTML = `
      <button class="btn-big primary" id="rollDiceBtnInner" style="width:100%;">🎲 주사위 굴리기</button>
      <div class="dice-manual">
        <div class="dice-col"><div class="dice-col-label">🎲①</div><div class="dice-num-grid" id="diceGrid1"></div></div>
        <div class="dice-col"><div class="dice-col-label">🎲②</div><div class="dice-num-grid" id="diceGrid2"></div></div>
      </div>
      <div class="dice-preview" id="dicePreview"></div>`;
    $('rollDiceBtnInner').onclick = () => {
      if (state._step && state._step !== 'dice') return;
      if (state.gameOver) return;
      SigEngine.rollDice(state);
      state._step = 'move';
      backupR();
    };
    renderDiceManual();
  } else if (step === 'jail') {
    $('stepDice').classList.add('active');
    renderJailUI();
    $('endTurnBtn').disabled = true;
    return;
  } else if (step === 'desert') {
    $('stepDice').classList.add('active');
    $('stepDiceBody').innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:32px;margin-bottom:8px;">🏝</div>
        <div style="font-size:18px;font-weight:900;color:#ffd700;">${p.name}</div>
        <div style="font-size:16px;margin-top:4px;">무인도 표류 중</div>
        <div style="font-size:22px;font-weight:900;color:#ff2b55;margin-top:8px;">남은 턴: ${p.desertTurn}</div>
        <button class="btn-big primary" style="width:100%;margin-top:12px;" onclick="desertRoll()">🎲 주사위 (더블 시 탈출!)</button>
      </div>`;
    $('endTurnBtn').disabled = true;
    $('endTurnBtn').textContent = '▶ 턴 종료 / 다음 턴';
    $('endTurnBtn').className = 'btn-huge warning';
    return;
  } else {
    $('stepDice').classList.add('done');
    const lastDiceLog = state.logs.slice().reverse().find(l => l.includes('🎲'));
    const diceText = lastDiceLog ? lastDiceLog.replace(/.*🎲\s*/, '🎲 ') : '✅';
    $('stepDiceBody').innerHTML = `<div style="text-align:center;font-size:13px;">${diceText}</div>`;
  }

  // ── Step 2: 이동 ──
  if (step === 'move') {
    $('stepMove').classList.add('active');
    const sum = SigEngine.diceSum(state);
    const dest = (p.position + sum) % CFG.TOTAL_TILES;
    $('stepMoveBody').innerHTML = `
      <div style="margin-bottom:10px;">현재: [${p.position}] ${tile.name}<br>→ ${sum}칸 이동 → [${dest}] ${state.tiles[dest].name}</div>
      <button class="btn-big primary" id="moveBtnInner" style="width:100%;">🚶 이동하기</button>`;
    $('moveBtnInner').onclick = async () => {
      if (state._step !== 'move' || state.isMoving || state.gameOver) return;
      const steps = SigEngine.diceSum(state);
      if (steps < 1) return;
      await animateMove(steps);
    };
  } else if (['donate','action','done'].includes(step)) {
    $('stepMove').classList.add('done');
    $('stepMoveBody').innerHTML = `<div style="text-align:center;">✅ [${p.position}] ${tile.name}</div>`;
  } else {
    $('stepMoveBody').innerHTML = `<div class="text-muted">주사위를 먼저 굴리세요</div>`;
  }

  // ── Step 3: 후원 체크 ──
  if (step === 'donate') {
    $('stepDonate').classList.add('active');
    renderDonateUI();
  } else if (['action','done'].includes(step)) {
    $('stepDonate').classList.add('done');
    const donateAmt = state._donateAmount || 0;
    $('stepDonateBody').innerHTML = donateAmt > 0
      ? `<div style="text-align:center;">✅ 후원 +${donateAmt.toLocaleString()}P</div>`
      : `<div style="text-align:center;">✅ 후원 없음</div>`;
  } else {
    $('stepDonateBody').innerHTML = `<div class="text-muted">이동 완료 후 표시됩니다</div>`;
  }

  // ── Step 4: 선택 ──
  if (step === 'action') {
    $('stepAction').classList.add('active');
    renderActionUI();
  } else if (step === 'done') {
    $('stepAction').classList.add('done');
    $('stepActionBody').innerHTML = `<div style="text-align:center;">✅ 완료</div>`;
  } else {
    $('stepActionBody').innerHTML = `<div class="text-muted">후원 체크 후 표시됩니다</div>`;
  }

  // ── 턴 종료 버튼 ──
  if (step === 'done') {
    $('endTurnBtn').disabled = false;
    if (state.isDouble && state.doubleCount < 3) {
      $('endTurnBtn').textContent = '🎲 더블! 한 번 더 굴리기';
      $('endTurnBtn').className = 'btn-huge warning';
    } else {
      const nextP = state.players[getNextPlayerIdx()];
      $('endTurnBtn').textContent = `▶ 턴 종료 → 다음: ${nextP.name}`;
      $('endTurnBtn').className = 'btn-huge primary';
    }
  } else if (step === 'over') {
    $('endTurnBtn').disabled = true;
    const w = state.players.find(x => x.id === state.winner);
    $('endTurnBtn').textContent = `🏆 게임 종료! ${w?.name||'?'} 승리!`;
    $('endTurnBtn').className = 'btn-huge warning';
  } else {
    $('endTurnBtn').disabled = true;
    $('endTurnBtn').textContent = '▶ 턴 종료 / 다음 턴';
    $('endTurnBtn').className = 'btn-huge warning';
  }
}

function getNextPlayerIdx() {
  const total = state.players.length;
  let idx = (state.turnIdx + 1) % total;
  let s = 0;
  while (state.players[idx].bankrupt && s++ < total) idx = (idx+1) % total;
  return idx;
}

/* ── 수동 주사위 그리드 ──────────────── */
function renderDiceManual() {
  manualD1 = 0; manualD2 = 0;
  ['diceGrid1','diceGrid2'].forEach((gridId, gi) => {
    const grid = $(gridId);
    grid.innerHTML = '';
    for (let n = 1; n <= 6; n++) {
      const btn = document.createElement('div');
      btn.className = 'dice-num';
      btn.textContent = n;
      btn.onclick = () => {
        grid.querySelectorAll('.dice-num').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (gi === 0) manualD1 = n; else manualD2 = n;
        updateDicePreview();
      };
      grid.appendChild(btn);
    }
  });
  $('dicePreview').textContent = '';
}

function updateDicePreview() {
  if (manualD1 && manualD2) {
    $('dicePreview').innerHTML = `🎲 ${manualD1} + ${manualD2} = ${manualD1+manualD2} <button class="btn primary" style="margin-left:10px;" onclick="applyManualDice()">적용</button>`;
  } else if (manualD1 || manualD2) {
    $('dicePreview').textContent = `🎲 ${manualD1||'?'} + ${manualD2||'?'}`;
  }
}

window.applyManualDice = function() {
  if (!manualD1 || !manualD2) return;
  SigEngine.setDice(state, manualD1, manualD2);
  state._step = 'move';
  backupR();
};

/* ── 감옥 UI ─────────────────────────── */
function renderJailUI() {
  const p = cp();
  let html = `<div style="text-align:center;margin-bottom:10px;">
    <div style="font-size:18px;font-weight:900;">⛓ ${p.name} — 감옥 (남은: ${p.jailTurn}턴)</div>
  </div>`;
  html += `<button class="btn-big primary" style="width:100%;margin-bottom:8px;" onclick="jailRoll()">🎲 주사위 (더블 시 탈출)</button>`;
  if (p.angel > 0) {
    html += `<button class="btn-big success" style="width:100%;margin-bottom:8px;" onclick="jailAngel()">😇 천사카드 사용 (${p.angel}개)</button>`;
  }
  if (p.money >= state.bailCost) {
    html += `<button class="btn-big warning" style="width:100%;margin-bottom:8px;" onclick="jailBail()">💰 보석금 ${state.bailCost.toLocaleString()}P</button>`;
  }
  $('stepDiceBody').innerHTML = html;
}

window.jailRoll = function() {
  const canMove = SigEngine.jailRollDice(state);
  if (canMove) {
    state._step = 'move';
    backupR();
  } else {
    state.pendingAction = null;
    state._step = 'done';
    backupR();
  }
};

/* ── 무인도 주사위 ──────────────────── */
window.desertRoll = function() {
  const canMove = SigEngine.desertRollDice(state);
  if (canMove) {
    // 탈출 성공 → 이동 단계
    state._step = 'move';
    backupR();
  } else {
    // 탈출 실패 → 턴 종료만 가능
    state.pendingAction = null;
    state._step = 'done';
    backupR();
  }
};

window.jailAngel = function() {
  SigEngine.applyEventAction(state, 'USE_ANGEL');
  state.pendingAction = null;
  state._step = 'dice';
  backupR();
};

window.jailBail = function() {
  SigEngine.applyEventAction(state, 'PAY_BAIL');
  state.pendingAction = null;
  state._step = 'dice';
  backupR();
};

/* ── 후원 체크 UI (여러번 가능 + 되돌리기 + 부족금액 미리보기) ── */
function renderDonateUI() {
  const body = $('stepDonateBody');
  const p = cp();
  const tile = ct();
  const totalDonated = state._donateAmount || 0;
  const donateCount = state._donateCount || 0;

  if (tile.type === 'SIG') {
    // 다음 단계 미리보기: 이 칸에서 뭐가 일어나는지 + 부족 금액
    let previewHtml = '';
    if (!tile.owner) {
      // 빈 땅 → 구매 가능
      const shortfall = tile.price - p.money;
      previewHtml = `
        <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:8px;margin-top:8px;">
          <div class="action-row"><span>📌 구매 가격</span><strong style="color:#ffd700;">${tile.price.toLocaleString()}P</strong></div>
          ${shortfall > 0 ? `<div class="action-row" style="background:rgba(255,43,85,.15);padding:6px;border-radius:6px;margin-top:4px;">
            <span style="color:#ff2b55;font-weight:900;">⚠ 구매 부족</span><strong style="color:#ff2b55;font-size:18px;">${shortfall.toLocaleString()}P</strong>
          </div>` : `<div class="action-row"><span>구매 후 잔액</span><strong style="color:#55ccff;">${(p.money - tile.price).toLocaleString()}P</strong></div>`}
        </div>`;
    } else if (tile.owner === p.id) {
      // 내 땅 → 업그레이드
      if (tile.level < 3) {
        const cost = SigEngine.getUpgradeCost(tile);
        const shortfall = cost - p.money;
        previewHtml = `
          <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:8px;margin-top:8px;">
            <div class="action-row"><span>📌 업그레이드 비용</span><strong style="color:#ffd700;">${cost.toLocaleString()}P</strong></div>
            ${shortfall > 0 ? `<div class="action-row" style="background:rgba(255,43,85,.15);padding:6px;border-radius:6px;margin-top:4px;">
              <span style="color:#ff2b55;font-weight:900;">⚠ 업그레이드 부족</span><strong style="color:#ff2b55;font-size:18px;">${shortfall.toLocaleString()}P</strong>
            </div>` : ''}
          </div>`;
      } else {
        previewHtml = `<div style="border-top:1px solid rgba(255,255,255,.1);padding-top:8px;margin-top:8px;color:var(--text-muted);">📌 최대 레벨 (업그레이드 불가)</div>`;
      }
    } else {
      // 남의 땅 → 통행료
      const toll = SigEngine.calcToll(state, tile);
      const shortfall = toll - p.money;
      const ownerP = state.players.find(x => x.id === tile.owner);
      previewHtml = `
        <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:8px;margin-top:8px;">
          <div class="action-row"><span>📌 통행료 → <span style="color:${ownerP?.color||'#fff'};">${tile.ownerName}</span></span><strong style="color:#ff2b55;font-size:18px;">${toll.toLocaleString()}P</strong></div>
          <div class="action-row"><span>보유 금액</span><strong>${p.money.toLocaleString()}P</strong></div>
          ${shortfall > 0 ? `<div class="action-row" style="background:rgba(255,43,85,.2);padding:8px;border-radius:8px;margin-top:4px;">
            <span style="color:#ff2b55;font-weight:900;font-size:16px;">⚠ 부족 금액</span><strong style="color:#ff2b55;font-size:22px;">${shortfall.toLocaleString()}P</strong>
          </div>` : `<div class="action-row"><span>지불 후 잔액</span><strong>${(p.money - toll).toLocaleString()}P</strong></div>`}
        </div>`;
    }

    body.innerHTML = `
      <div class="action-card" style="border-color:rgba(255,215,0,.5);">
        <div class="action-title">💰 후원 체크 — ${tile.name}</div>
        <div class="action-detail">
          <div class="action-row">
            <span>시그 금액</span>
            <strong style="color:#ffd700;font-size:18px;">${tile.price.toLocaleString()}P</strong>
          </div>
          <div class="action-row">
            <span>현재 잔액</span>
            <strong>${p.money.toLocaleString()}P</strong>
          </div>
          ${totalDonated > 0 ? `
          <div class="action-row" style="border-top:1px solid rgba(255,255,255,.1);padding-top:6px;margin-top:4px;">
            <span>누적 후원</span>
            <strong style="color:#ffd700;">+${totalDonated.toLocaleString()}P (${donateCount}회)</strong>
          </div>` : ''}
          ${previewHtml}
        </div>
        <div class="action-btns" style="flex-direction:column;gap:8px;">
          <button class="action-btn action-btn-event" onclick="doDonate()" style="font-size:18px;">
            💰 후원 받음! (+${tile.price.toLocaleString()}P)
          </button>
          ${totalDonated > 0 ? `
          <button class="action-btn action-btn-danger" onclick="doUndoDonate()" style="font-size:14px;">
            ↩ 마지막 후원 취소 (-${tile.price.toLocaleString()}P)
          </button>` : ''}
          <button class="action-btn action-btn-yes" onclick="doDonateNext()" style="font-size:16px;">
            ✅ 후원 완료 — 다음 단계로
          </button>
        </div>
      </div>`;
  } else {
    body.innerHTML = `<div style="text-align:center;color:var(--text-muted);">SIG 칸이 아님 — 후원 없음</div>`;
  }
}

// 후원 1회 추가 (여러번 가능, 단계 유지)
window.doDonate = function() {
  const p = cp();
  const tile = ct();
  const amt = tile.price;
  p.money += amt;
  p.totalEarned += amt;
  state._donateAmount = (state._donateAmount || 0) + amt;
  state._donateCount = (state._donateCount || 0) + 1;
  SigEngine.addLog(state, `💰 ${p.name} — '${tile.name}' 후원 +${amt.toLocaleString()}P (${state._donateCount}회)`);
  // 단계 유지 (donate) — 추가 후원 가능
  backupR();
};

// 마지막 후원 취소
window.doUndoDonate = function() {
  const p = cp();
  const tile = ct();
  const amt = tile.price;
  if ((state._donateAmount || 0) < amt) return;
  p.money -= amt;
  p.totalEarned -= amt;
  state._donateAmount -= amt;
  state._donateCount = Math.max(0, (state._donateCount || 0) - 1);
  SigEngine.addLog(state, `↩ ${p.name} — 후원 취소 -${amt.toLocaleString()}P`);
  backupR();
};

// 후원 완료 → 다음 단계 (action)
window.doDonateNext = function() {
  // 랜딩 로직 실행
  if (state._landingPending) {
    state._landingPending = false;
    SigEngine.applyLanding(state);
    state._step = state.pendingAction ? 'action' : 'done';
  } else {
    state._step = 'done';
  }
  backupR();
};

/* ── 액션 UI (큰 버튼 + 상세 정보) ──── */
function renderActionUI() {
  const body = $('stepActionBody');
  const act = state.pendingAction;
  if (!act) { body.innerHTML = '<div class="text-muted">액션 없음</div>'; return; }

  const p = cp();
  let html = '';

  switch (act.type) {
    case 'BUY': {
      const t = state.tiles[act.tileId];
      const after = p.money - t.price;
      html += `
        <div class="action-card buy">
          <div class="action-title">🏠 빈 땅 — 구매하시겠습니까?</div>
          <div class="action-detail">
            <div class="action-tile-name">${t.name}</div>
            <div class="action-row">
              <span>가격</span><strong style="color:#ffd700;">${t.price.toLocaleString()}P</strong>
            </div>
            <div class="action-row">
              <span>현재 잔액</span><strong>${p.money.toLocaleString()}P</strong>
            </div>
            <div class="action-row">
              <span>구매 후 잔액</span><strong style="color:${after>=0?'#55ccff':'#ff2b55'};">${after.toLocaleString()}P</strong>
            </div>
          </div>
          <div class="action-btns">
            <button class="action-btn action-btn-yes" onclick="actBuy()">✅ 구매</button>
            <button class="action-btn action-btn-no" onclick="actSkip()">❌ 패스</button>
          </div>
        </div>`;
      break;
    }
    case 'UPGRADE': {
      const t = state.tiles[act.tileId];
      const nextBld = CFG.BUILDING[t.level + 1];
      const curBld = CFG.BUILDING[t.level];
      const curToll = SigEngine.calcToll(state, t);
      const newToll = SigEngine.calcToll(state, {...t, level: t.level+1});
      html += `
        <div class="action-card upgrade">
          <div class="action-title">⬆ 내 땅 — 업그레이드?</div>
          <div class="action-detail">
            <div class="action-tile-name">${t.name}</div>
            <div class="action-row">
              <span>현재</span><strong>${curBld.icon||'빈땅'} ${curBld.name} → ${nextBld.icon} ${nextBld.name}</strong>
            </div>
            <div class="action-row">
              <span>비용</span><strong style="color:#ffd700;">${act.cost.toLocaleString()}P</strong>
            </div>
            <div class="action-row">
              <span>통행료</span><strong>${curToll.toLocaleString()} → <span style="color:#ff2b55;">${newToll.toLocaleString()}P</span></strong>
            </div>
          </div>
          <div class="action-btns">
            <button class="action-btn action-btn-yes" onclick="actUpgrade()">⬆ 업그레이드</button>
            <button class="action-btn action-btn-no" onclick="actSkip()">❌ 패스</button>
          </div>
        </div>`;
      break;
    }
    case 'TOLL': {
      const t = state.tiles[act.tileId];
      const ownerP = state.players.find(x => x.id === t.owner);
      const shortfall = act.toll - p.money;
      html += `
        <div class="action-card toll">
          <div class="action-title">💸 남의 땅 — 통행료!</div>
          <div class="action-detail">
            <div class="action-tile-name">${t.name} <span style="color:${ownerP?.color||'#fff'};">(${t.ownerName})</span></div>
            <div class="action-row">
              <span>통행료</span><strong style="color:#ff2b55;font-size:20px;">${act.toll.toLocaleString()}P</strong>
            </div>
            <div class="action-row">
              <span>보유 금액</span><strong>${p.money.toLocaleString()}P</strong>
            </div>
            ${shortfall > 0 ? `<div class="action-row" style="background:rgba(255,43,85,.15);padding:6px;border-radius:6px;margin-top:4px;">
              <span style="color:#ff2b55;font-weight:900;">⚠ 부족 금액</span><strong style="color:#ff2b55;font-size:18px;">${shortfall.toLocaleString()}P</strong>
            </div>` : `<div class="action-row">
              <span>지불 후 잔액</span><strong>${(p.money - act.toll).toLocaleString()}P</strong>
            </div>`}
          </div>
          <div class="action-btns">
            <button class="action-btn action-btn-danger" onclick="actToll()">💸 통행료 지불</button>
          </div>
        </div>`;
      break;
    }
    case 'TOLL_OR_BUY': {
      const t = state.tiles[act.tileId];
      const ownerP = state.players.find(x => x.id === t.owner);
      const takeoverTotal = act.takeoverCost || (act.toll + t.price);
      const tollShort = act.toll - p.money;
      const takeoverShort = takeoverTotal - p.money;
      html += `
        <div class="action-card toll">
          <div class="action-title">💸 남의 땅 — 통행료 또는 인수!</div>
          <div class="action-detail">
            <div class="action-tile-name">${t.name} <span style="color:${ownerP?.color||'#fff'};">(${t.ownerName})</span></div>
            <div class="action-row">
              <span>통행료</span><strong style="color:#ff2b55;">${act.toll.toLocaleString()}P</strong>
            </div>
            <div class="action-row">
              <span>보유 금액</span><strong>${p.money.toLocaleString()}P</strong>
            </div>
            ${tollShort > 0 ? `<div class="action-row" style="background:rgba(255,43,85,.15);padding:6px;border-radius:6px;margin-top:4px;">
              <span style="color:#ff2b55;font-weight:900;">⚠ 통행료 부족</span><strong style="color:#ff2b55;font-size:18px;">${tollShort.toLocaleString()}P</strong>
            </div>` : ''}
            <div class="action-row" style="margin-top:4px;">
              <span>인수 (통행료+땅값)</span><strong style="color:#cc44ff;">${takeoverTotal.toLocaleString()}P</strong> <span class="text-sm text-muted">(건물 1단계↓)</span>
            </div>
          </div>
          <div class="action-btns">
            <button class="action-btn action-btn-danger" onclick="actToll()">💸 통행료 ${act.toll.toLocaleString()}</button>
            <button class="action-btn action-btn-purple" onclick="actTakeover()">🏴 인수 ${takeoverTotal.toLocaleString()}</button>
          </div>
        </div>`;
      break;
    }
    case 'TOLL_SHIELD': {
      const t = state.tiles[act.tileId];
      const toll = act.toll || SigEngine.calcToll(state, t);
      const takeoverTotal = act.takeoverCost || (toll + t.price);
      const canTakeover = p.money >= takeoverTotal;
      html += `
        <div class="action-card toll">
          <div class="action-title">🛡 방어막 보유! 사용하시겠습니까?</div>
          <div class="action-detail">
            <div class="action-tile-name">${t.name} (${t.ownerName})</div>
            <div class="action-row">
              <span>통행료</span><strong style="color:#ff2b55;">${toll.toLocaleString()}P</strong>
            </div>
            <div class="action-row">
              <span>방어막</span><strong>🛡 ${p.shield}개 보유</strong>
            </div>
          </div>
          <div class="action-btns" style="flex-direction:column;gap:8px;">
            <button class="action-btn action-btn-yes" onclick="actShield()">🛡 방어막 사용 (무료)</button>
            <button class="action-btn action-btn-danger" onclick="actTollFromShield()">💸 통행료 ${toll.toLocaleString()}</button>
            ${canTakeover ? `<button class="action-btn action-btn-purple" onclick="actTakeoverFromShield()">🏴 인수 ${takeoverTotal.toLocaleString()}</button>` : ''}
          </div>
        </div>`;
      break;
    }
    case 'EVENT_DRAW':
      html += `
        <div class="action-card event">
          <div class="action-title">🎪 이벤트 칸!</div>
          <div style="text-align:center;margin:12px 0;">
            <button class="action-btn action-btn-event" onclick="actDrawEvent()" style="font-size:20px;padding:16px 40px;">🎪 이벤트 카드 뽑기!</button>
          </div>
        </div>`;
      break;
    case 'TRAVEL':
      html += `<div class="action-card travel"><div class="action-title">✈ 세계여행! 이동할 칸을 선택하세요</div>`;
      html += buildTileSelectGrid('SIG', (id) => `actTravel(${id})`);
      html += '</div>';
      break;
    case 'DOUBLE_TOLL':
      html += `<div class="action-card event"><div class="action-title">💪 통행료 2배 적용할 칸 선택</div>`;
      html += buildTileSelectGrid('SIG', (id) => `actDoubleToll(${id})`, t => t.owner);
      html += '</div>';
      break;
    case 'DESTROY':
      html += `<div class="action-card event"><div class="action-title">💥 건물 파괴할 칸 선택</div>`;
      html += buildTileSelectGrid('SIG', (id) => `actDestroy(${id})`, t => t.level > 0);
      html += '</div>';
      break;
    case 'FREE_BUILD':
      html += `<div class="action-card event"><div class="action-title">🏗 무료 업그레이드할 칸 선택</div>`;
      html += buildTileSelectGrid('SIG', (id) => `actFreeBuild(${id})`, t => t.owner === p.id && t.level < 3);
      html += '</div>';
      break;
    case 'GO_JAIL':
      html += `
        <div class="action-card jail">
          <div class="action-title">⛓ 감옥행!</div>
          <div class="action-btns">
            <button class="action-btn action-btn-danger" onclick="actGoJail()" style="width:100%;">⛓ 감옥으로 이동</button>
          </div>
        </div>`;
      break;

    case 'SELL_TILES': {
      const owned = SigEngine.getOwnedTiles(state, p.id);
      const totalAsset = owned.reduce((s,t) => s + SigEngine.getTileValue(t), 0);
      html += `
        <div class="action-card" style="border-color:rgba(255,43,85,.6);">
          <div class="action-title" style="color:#ff2b55;">⚠ 자금 부족! 땅을 매각하세요</div>
          <div class="action-detail">
            <div class="action-row">
              <span>현재 잔액</span><strong style="color:#ff2b55;">${p.money.toLocaleString()}P</strong>
            </div>
            <div class="action-row">
              <span>보유 부동산</span><strong>${totalAsset.toLocaleString()}P (${owned.length}칸)</strong>
            </div>
          </div>
          <div style="margin-top:10px;font-weight:700;margin-bottom:6px;">매각할 땅 선택:</div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;">`;
      owned.forEach(t => {
        const val = SigEngine.getTileValue(t);
        const bld = CFG.BUILDING[t.level];
        html += `<button class="action-btn" style="text-align:left;padding:10px 14px;justify-content:space-between;" onclick="actSellTile(${t.id})">
          <span>${bld.icon} [${t.id}] ${t.name} ${t.level > 0 ? '('+bld.name+')' : ''}</span>
          <strong style="color:#ffd700;">+${val.toLocaleString()}P</strong>
        </button>`;
      });
      html += `</div>`;
      // 잔액이 0 이상이면 매각 완료 가능
      if (p.money >= 0) {
        html += `<div class="action-btns" style="margin-top:10px;">
          <button class="action-btn action-btn-yes" onclick="actDoneSelling()" style="width:100%;">✅ 매각 완료 — 진행하기</button>
        </div>`;
      } else {
        html += `<div style="margin-top:10px;color:#ff2b55;font-weight:800;text-align:center;">잔액이 0P 이상이 되어야 진행할 수 있습니다</div>`;
      }
      html += `</div>`;
      break;
    }
  }

  body.innerHTML = html;
}

function buildTileSelectGrid(type, onClickFn, filterFn) {
  const tiles = state.tiles.filter(t => t.type === type && (!filterFn || filterFn(t)));
  if (!tiles.length) {
    // 선택 가능한 칸이 없으면 pendingAction 해제 → done으로 전환
    state.pendingAction = null;
    state.pendingMessage = '';
    state._step = 'done';
    // 렌더 사이클 밖에서 안전하게 상태 저장 + 재렌더
    Promise.resolve().then(() => backupR());
    return '<div class="text-muted">대상 없음 — 자동 패스</div>';
  }
  let html = '<div class="tile-select-grid">';
  tiles.forEach(t => {
    const ownerInfo = t.owner ? ` (${t.ownerName})` : '';
    html += `<button class="tile-select-btn" onclick="${onClickFn(t.id)}">[${t.id}] ${t.name}${ownerInfo}</button>`;
  });
  html += '</div>';
  return html;
}

/* ── 액션 핸들러 (전역) ──────────────── */
function afterAction() {
  // 액션 완료 후 pendingAction이 없으면 done, 있으면 action 유지
  if (!state.pendingAction) {
    state._step = 'done';
  } else {
    state._step = 'action';
  }
  backupR();
}
window.actBuy      = () => { SigEngine.buyTile(state); afterAction(); };
window.actSkip     = () => { SigEngine.skipBuy(state); afterAction(); };
window.actUpgrade  = () => { SigEngine.upgradeTile(state); afterAction(); };
window.actToll     = () => { SigEngine.payToll(state); afterAction(); };
window.actTakeover = () => { SigEngine.takeover(state); afterAction(); };
window.actShield   = () => { SigEngine.useShield(state); afterAction(); };
window.actDrawEvent= () => { SigEngine.drawEvent(state); afterAction(); };
window.actGoJail   = () => { SigEngine.applyEventAction(state,'GO_JAIL'); afterAction(); };
window.actTravel   = id => { SigEngine.applyEventAction(state,'TRAVEL',{tileId:id}); afterAction(); };
window.actDoubleToll=id => { SigEngine.applyEventAction(state,'DOUBLE_TOLL',{tileId:id}); afterAction(); };
window.actDestroy  = id => { SigEngine.applyEventAction(state,'DESTROY',{tileId:id}); afterAction(); };
window.actFreeBuild= id => { SigEngine.applyEventAction(state,'FREE_BUILD',{tileId:id}); afterAction(); };

window.actTollFromShield = () => {
  const act = state.pendingAction;
  const t = state.tiles[act.tileId];
  const toll = act.toll || SigEngine.calcToll(state, t);
  state.pendingAction = { type:'TOLL', tileId: t.id, toll };
  SigEngine.payToll(state);
  afterAction();
};

window.actTakeoverFromShield = () => {
  SigEngine.takeover(state);
  afterAction();
};

// 땅 매각
window.actSellTile = (tileId) => {
  SigEngine.sellTile(state, tileId);
  // 매각 후 아직 잔액이 부족하면 매각 계속, 충분하면 매각 완료 가능
  const owned = SigEngine.getOwnedTiles(state, cp().id);
  if (cp().money < 0 && owned.length === 0) {
    // 땅 다 팔았는데 아직 부족 → 파산
    state.pendingAction = null;
    SigEngine.checkBankruptcy(state);
  }
  // 매각 UI 갱신 (pendingAction은 SELL_TILES 유지)
  backupR();
};

// 매각 완료 → 원래 진행
window.actDoneSelling = () => {
  state.pendingAction = null;
  state.pendingMessage = '';
  state._step = 'done';
  backupR();
};

/* ═══ 이동 애니메이션 ═══════════════════ */
async function animateMove(steps) {
  const p = cp();
  const startPos = p.position;
  isAnimating = true;
  state.isMoving = true;
  state.pendingAction = null;
  state.popup = null;  // 주사위 팝업 제거


  for (let i = 1; i <= steps; i++) {
    const pos = (startPos + i) % CFG.TOTAL_TILES;
    p.position = pos;

    // 출발 통과 (중간만)
    if (pos === 0 && i < steps) {
      p.money += state.salary;
      p.totalEarned += state.salary;
      SigEngine.addLog(state, `${p.name} 출발 통과 — +${state.salary.toLocaleString()}P`);
    }

    // 시각적 동기화만 (팝업/액션 없음)
    SigStorage.sendVisual({
      positions: state.players.map(pl => pl.position),
      currentPlayerIdx: state.turnIdx,
      isMoving: true,
      moveStep: i,
      moveTotal: steps,
    });

    await new Promise(r => setTimeout(r, 250));
  }

  // 최종 도착 → 후원 체크 단계로
  state.isMoving = false;
  state.dice = [0, 0];
  state.diceRolled = false;
  isAnimating = false;
  state._donateAmount = 0;
  state._donateCount = 0;

  const landedTile = state.tiles[p.position];
  if (landedTile.type === 'SIG') {
    // SIG 칸 → 후원 체크 단계 (랜딩은 후원 완료 후)
    state._step = 'donate';
    state._landingPending = true;
    backupR();
  } else {
    // 비SIG 칸 → 바로 랜딩 처리
    SigEngine.applyLanding(state);
    state._step = state.pendingAction ? 'action' : 'done';
    backupR();
  }
}

/* ═══ 자산 카드 ═════════════════════════ */
function renderAssets() {
  const cards = $('assetCards');
  cards.innerHTML = '';
  state.players.forEach((p, i) => {
    const owned = state.tiles.filter(t => t.owner === p.id);
    const tileVal = owned.reduce((s,t) => s + SigEngine.getTileValue(t), 0);
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.style.setProperty('--pc', p.color);
    if (i === state.turnIdx) card.classList.add('active');
    if (p.bankrupt) card.classList.add('bankrupt');
    card.style.borderColor = i === state.turnIdx ? p.color : '';
    card.innerHTML = `
      <div class="ac-name" style="color:${p.color}">${p.name}${p.bankrupt?' 💀':''}</div>
      <div class="ac-money">💰 ${p.money.toLocaleString()}</div>
      <div class="ac-detail">🏠${owned.length}칸 📈${(p.money+tileVal).toLocaleString()}</div>
      <div class="ac-detail">${p.shield?'🛡'+p.shield+'  ':''}${p.angel?'😇'+p.angel:''}</div>`;
    cards.appendChild(card);
  });
}

/* ═══ 하단 고정바 ═══════════════════════ */
function renderFooter() {
  const p = cp();
  const tile = ct();
  const step = getStep();
  const stepName = {dice:'주사위',move:'이동',action:'액션',done:'완료',jail:'감옥',desert:'무인도',over:'종료'}[step]||'';
  $('footerStatus').innerHTML = `R${state.round} · <span style="color:${p.color}">${p.name}</span>의 턴 · ${stepName} · 📍[${p.position}] ${tile.name}`;
}

function renderLog() {
  const box = $('logBox');
  if (box) box.textContent = state.logs.join('\n');
}

/* ═══ 이벤트 바인딩 ═════════════════════ */

// 주사위/이동 버튼은 renderStepWizard에서 동적 생성

// 턴 종료 (또는 더블 시 추가 턴)
$('endTurnBtn').onclick = () => {
  if (state.gameOver || state.pendingAction || state.isMoving) return;

  const p = cp();

  // 감옥/무인도에 있으면 더블 무효 (Bug #15, #16)
  const inJailOrDesert = p.jailTurn > 0 || p.desertTurn > 0;

  // 3연속 더블 → 즉시 감옥 (Bug #1)
  if (state.doubleCount >= 3) {
    p.position = 29;
    p.jailTurn = CFG.JAIL_TURNS;
    state.isDouble = false;
    state.doubleCount = 0;
    state.eventMsg = `${p.name} 3연속 더블! 감옥행!`;
    state.popup = { type:'action', title:'⛓ 3연속 더블!', text:`${p.name} 감옥행!` };
    SigEngine.addLog(state, state.eventMsg);
    // 바로 다음 플레이어로
    state._step = 'dice';
    state._donateAmount = 0;
    state._donateCount = 0;
    state._landingPending = false;
    SigEngine.nextPlayer(state);
    state._step = 'dice';
    backupR();
    return;
  }

  // 더블이고 감옥/무인도가 아니면 같은 플레이어 추가 턴
  if (state.isDouble && !inJailOrDesert) {
    state.isDouble = false;
    state.diceRolled = false;
    state.dice = [0, 0];
    state._step = 'dice';
    state._donateAmount = 0;
    state._donateCount = 0;
    state._landingPending = false;
    state.popup = null;
    SigEngine.addLog(state, `더블! ${p.name} 추가 턴`);
    backupR();
    return;
  }

  // 일반 턴 종료 → 다음 플레이어
  state.isDouble = false;
  state.doubleCount = 0;
  state._step = 'dice';
  state._donateAmount = 0;
  state._donateCount = 0;
  state._landingPending = false;
  state.popup = null;
  SigEngine.nextPlayer(state);
  state._step = 'dice';
  backupR();
};

// 되돌리기
const doUndo = () => {
  if (SigStorage.undo()) { state = SigStorage.load(); render(); }
};
$('undoBtn').onclick = doUndo;
$('footUndo').onclick = doUndo;

// 저장
const doSave = () => {
  SigStorage.saveOnly(state);
  $('saveBtn').textContent = '✓ 저장됨';
  setTimeout(() => $('saveBtn').textContent = '💾 저장', 1200);
};
$('saveBtn').onclick = doSave;
$('footSave').onclick = doSave;

// RESET
$('resetBtn').onclick = () => {
  const t = prompt('RESET 을 입력하면 초기화됩니다.');
  if (t === 'RESET') {
    SigStorage.reset();
    state = SigEngine.createGame(state.players.length);
    SigStorage.saveOnly(state);
    render();
  }
};

// 게임 설명
$('footRules').onclick = () => {
  $('rulesDropdown').classList.toggle('open');
};
document.addEventListener('click', e => {
  if (!e.target.closest('#rulesDropdown')) $('rulesDropdown').classList.remove('open');
});
function buildRulesMenu() {
  const menu = $('rulesMenu');
  menu.innerHTML = '';
  Object.entries(CFG.RULES).forEach(([key, rule]) => {
    const item = document.createElement('div');
    item.className = 'rules-menu-item';
    item.textContent = rule.title;
    item.onclick = () => {
      state.popup = { type:'RULES', tab: key };
      SigStorage.saveOnly(state);
      $('rulesDropdown').classList.remove('open');
    };
    menu.appendChild(item);
  });
  const closeItem = document.createElement('div');
  closeItem.className = 'rules-menu-item';
  closeItem.style.color = 'var(--danger)';
  closeItem.textContent = '설명 닫기';
  closeItem.onclick = () => {
    state.popup = null;
    SigStorage.saveOnly(state);
    $('rulesDropdown').classList.remove('open');
  };
  menu.appendChild(closeItem);
}
buildRulesMenu();

// 위치 확인 스포트라이트
$('footSpotlight').onclick = () => {
  if (state.popup?.type === 'SPOTLIGHT') {
    state.popup = null;
  } else {
    state.popup = { type:'SPOTLIGHT', playerIdx: 0, auto: true };
  }
  SigStorage.saveOnly(state);
};

/* ═══ 플레이어 관리 ═════════════════════ */
function renderPlayerEditor() {
  const tabs = $('playerTabs');
  const editor = $('playerEditor');
  tabs.innerHTML = '';
  state.players.forEach((p, i) => {
    const tab = document.createElement('div');
    tab.className = 'player-tab' + (i === selectedPlayerIdx ? ' selected' : '');
    tab.style.background = p.color;
    tab.textContent = `P${i + 1}`;
    tab.title = p.name;
    tab.onclick = () => { selectedPlayerIdx = i; renderPlayerEditor(); };
    tabs.appendChild(tab);
  });

  const p = state.players[selectedPlayerIdx];
  if (!p) return;

  editor.innerHTML = `
    <div style="color:${p.color};font-size:16px;font-weight:900;margin-bottom:10px;">${p.name}${p.bankrupt?' 💀':''}</div>
    <div class="row gap-4 mt-8">
      <label>이름: <input type="text" id="peditName" value="${p.name}" style="width:150px;"/></label>
      <button class="btn primary" onclick="peditApplyName()">변경</button>
    </div>
    <div class="mt-12" style="font-weight:700;">💰 잔고 조정</div>
    <div class="money-adjust mt-8">
      <button class="money-adj-btn minus" onclick="peditMoney(-50000)">-50K</button>
      <button class="money-adj-btn minus" onclick="peditMoney(-10000)">-10K</button>
      <button class="money-adj-btn minus" onclick="peditMoney(-5000)">-5K</button>
      <button class="money-adj-btn minus" onclick="peditMoney(-1000)">-1K</button>
      <div class="money-display">${p.money.toLocaleString()}</div>
      <button class="money-adj-btn plus" onclick="peditMoney(1000)">+1K</button>
      <button class="money-adj-btn plus" onclick="peditMoney(5000)">+5K</button>
      <button class="money-adj-btn plus" onclick="peditMoney(10000)">+10K</button>
      <button class="money-adj-btn plus" onclick="peditMoney(50000)">+50K</button>
    </div>
    <div class="row gap-4 mt-8">
      <label>직접 입력: <input type="number" id="peditMoneyDirect" value="${p.money}" style="width:160px;font-size:15px;font-weight:900;"/></label>
      <button class="btn primary" onclick="peditSetMoney()">잔고 설정</button>
    </div>
    <div class="row gap-4 mt-12">
      <button class="btn" onclick="peditItem('shield')">🛡+1</button>
      <button class="btn" onclick="peditItem('angel')">😇+1</button>
    </div>
    <div class="row gap-4 mt-8">
      <label>위치 이동: <input type="number" id="peditPos" min="0" max="35" value="${p.position}" style="width:70px;"/></label>
      <button class="btn primary" onclick="peditMove()">이동</button>
    </div>`;
}

window.peditApplyName = () => {
  const name = $('peditName')?.value?.trim();
  if (!name) return;
  const p = state.players[selectedPlayerIdx];
  state.tiles.forEach(t => { if (t.owner === p.id) t.ownerName = name; });
  p.name = name;
  backupR(); renderPlayerEditor();
};

window.peditMoney = (amt) => {
  const p = state.players[selectedPlayerIdx];
  p.money += amt;
  SigEngine.addLog(state, `${p.name} 잔고 ${amt>0?'+':''}${amt.toLocaleString()}P`);
  if (amt < 0) SigEngine.checkBankruptcy(state);
  backupR(); renderPlayerEditor();
};

window.peditSetMoney = () => {
  const p = state.players[selectedPlayerIdx];
  const val = parseInt($('peditMoneyDirect')?.value, 10);
  if (isNaN(val)) return;
  const diff = val - p.money;
  p.money = val;
  SigEngine.addLog(state, `${p.name} 잔고 → ${val.toLocaleString()}P (${diff>=0?'+':''}${diff.toLocaleString()})`);
  SigEngine.checkBankruptcy(state);
  backupR(); renderPlayerEditor();
};

window.peditItem = (type) => {
  const p = state.players[selectedPlayerIdx];
  p[type]++;
  SigEngine.addLog(state, `${p.name} ${type==='shield'?'방어막':'천사카드'} +1`);
  backupR(); renderPlayerEditor();
};

window.peditMove = () => {
  const p = state.players[selectedPlayerIdx];
  const pos = parseInt($('peditPos')?.value, 10);
  if (isNaN(pos) || pos < 0 || pos > 35) return;
  p.position = pos;
  SigEngine.addLog(state, `${p.name} 위치 → [${pos}] ${state.tiles[pos].name}`);
  backupR();
};

/* ═══ 땅 관리 (테이블 + 편집기 병렬) ═══ */
function buildMinimap() {
  const map = $('minimap');
  map.innerHTML = '';

  // SIG 칸만 테이블로 표시
  let html = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#1a2140;">
      <th style="padding:6px;width:40px;">ID</th>
      <th style="padding:6px;">이름</th>
      <th style="padding:6px;width:80px;">가격</th>
      <th style="padding:6px;width:60px;">건물</th>
      <th style="padding:6px;width:80px;">소유자</th>
      <th style="padding:6px;width:50px;">편집</th>
    </tr></thead><tbody>`;

  state.tiles.forEach(tile => {
    if (tile.type !== 'SIG') return;
    const owner = tile.owner ? state.players.find(p => p.id === tile.owner) : null;
    const ownerColor = owner ? owner.color : 'transparent';
    const bld = CFG.BUILDING[tile.level];
    const sel = tile.id === selectedTileId ? 'background:rgba(32,168,255,.15);' : '';
    const grpColor = tile.group && CFG.GROUPS[tile.group] ? CFG.GROUPS[tile.group].color : '#555';
    html += `<tr style="border-bottom:1px solid rgba(255,255,255,.05);${sel}cursor:pointer;" onclick="tileSelect(${tile.id})">
      <td style="padding:5px;text-align:center;border-left:3px solid ${grpColor};">${tile.id}</td>
      <td style="padding:5px;font-weight:700;">${tile.name}</td>
      <td style="padding:5px;color:#ffd700;text-align:right;">${tile.price.toLocaleString()}</td>
      <td style="padding:5px;text-align:center;">${bld.icon||'-'} ${bld.name}</td>
      <td style="padding:5px;color:${ownerColor};font-weight:700;">${owner ? owner.name : '-'}</td>
      <td style="padding:5px;text-align:center;"><button class="btn" style="padding:2px 8px;font-size:11px;" onclick="event.stopPropagation();tileSelect(${tile.id})">✏</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  map.innerHTML = html;
}

window.tileSelect = (id) => {
  selectedTileId = id;
  buildMinimap();
  renderTileEditor();
};

function renderTileEditor() {
  const editor = $('tileEditor');
  if (selectedTileId < 0) { editor.innerHTML = '<div class="text-muted">위 테이블에서 칸을 선택하세요</div>'; return; }
  const t = state.tiles[selectedTileId];
  if (!t) return;

  if (t.type !== 'SIG') {
    editor.innerHTML = `<div style="font-weight:700;">[${t.id}] ${t.name} — ${t.type} (편집 불가)</div>`;
    return;
  }

  editor.innerHTML = `
    <div style="font-size:15px;font-weight:900;margin-bottom:8px;border-left:4px solid ${t.group?CFG.GROUPS[t.group].color:'#555'};padding-left:8px;">[${t.id}] ${t.name}</div>
    <div class="row wrap gap-4 mt-8">
      <label>이름: <input type="text" id="teditName" value="${t.name}" style="width:140px;"/></label>
      <label>가격: <input type="number" id="teditPrice" value="${t.price}" style="width:110px;"/></label>
      <label>소유자: <select id="teditOwner" style="width:130px;"><option value="">없음</option>${state.players.map(p=>`<option value="${p.id}" ${t.owner===p.id?'selected':''}>${p.name}</option>`).join('')}</select></label>
      <label>건물: <select id="teditLevel" style="width:100px;">${[0,1,2,3].map(l=>`<option value="${l}" ${t.level===l?'selected':''}>${CFG.BUILDING[l].icon||'·'} ${CFG.BUILDING[l].name}</option>`).join('')}</select></label>
      <button class="btn primary" onclick="teditApplyAll()">일괄 적용</button>
    </div>`;
}

window.teditApplyAll = () => {
  const t = state.tiles[selectedTileId];
  if (!t || t.type !== 'SIG') return;

  const name = $('teditName')?.value?.trim();
  if (name) t.name = name;

  const price = parseInt($('teditPrice')?.value, 10);
  if (!isNaN(price) && price >= 0) t.price = price;

  const ownerId = $('teditOwner')?.value;
  if (!ownerId) { t.owner = null; t.ownerName = ''; }
  else { const p = state.players.find(x => x.id === ownerId); if (p) { t.owner = p.id; t.ownerName = p.name; } }

  const level = parseInt($('teditLevel')?.value, 10);
  if (!isNaN(level) && level >= 0 && level <= 3) t.level = level;

  SigEngine.addLog(state, `[${t.id}] ${t.name} 수정됨`);
  backupR(); buildMinimap(); renderTileEditor();
};

/* ═══ 게임 설정 ═════════════════════════ */

$('setMoney3')?.addEventListener('click', () => { $('cfgMoney').value = 30000; });
$('setMoney5')?.addEventListener('click', () => { $('cfgMoney').value = 50000; });
$('setMoney10')?.addEventListener('click', () => { $('cfgMoney').value = 100000; });
$('setMoney20')?.addEventListener('click', () => { $('cfgMoney').value = 200000; });

$('applyMoneyBtn')?.addEventListener('click', () => {
  const amt = parseInt($('cfgMoney')?.value, 10) || 50000;
  state.players.forEach(p => { if (!p.bankrupt) p.money = amt; });
  SigEngine.addLog(state, `전원 잔고 → ${amt.toLocaleString()}P`);
  backupR();
});

$('applyCfgBtn')?.addEventListener('click', () => {
  state.salary = parseInt($('cfgSalary')?.value, 10) || 3000;
  state.bailCost = parseInt($('cfgBail')?.value, 10) || 5000;
  SigEngine.addLog(state, `설정 변경 — 급여:${state.salary} 보석금:${state.bailCost}`);
  backupR();
});

/* ═══ SIG 이미지 관리 ═══════════════════ */

async function renderSigGrid() {
  const pool = await idbGetAll();
  const assign = loadAssign();
  const grid = $('sigGrid');
  if (!grid) return;
  grid.innerHTML = '';
  pool.forEach(item => {
    const url = item.blob ? URL.createObjectURL(item.blob) : item.url;
    const card = document.createElement('div');
    card.className = 'sig-card';
    card.innerHTML = `
      <img src="${url}" onerror="this.style.display='none'" alt="${item.name}">
      <div class="sig-card-name">${item.name}</div>
      <button class="sig-card-del" onclick="sigDelete('${item.uid}')" title="삭제">×</button>`;
    grid.appendChild(card);
  });
}

async function doAssign() {
  const sigTiles = state.tiles.filter(t => t.type === 'SIG').sort((a,b) => a.id - b.id);
  const pool = await idbGetAll();
  if (!pool.length) return alert('이미지가 없습니다.');

  // 전체 풀을 셔플 후 금액 오름차순 정렬 (같은 금액 내 랜덤)
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const sorted = shuffled.sort((a,b) => extractAmount(a.name) - extractAmount(b.name));
  const N = sigTiles.length; // 24칸

  // 풀에서 N개를 구간별 랜덤 선택 (매번 다른 결과)
  let picked;
  if (sorted.length <= N) {
    picked = [...sorted];
  } else {
    picked = [];
    const chunkSize = sorted.length / N;
    for (let i = 0; i < N; i++) {
      const start = Math.floor(i * chunkSize);
      const end = Math.min(Math.floor((i + 1) * chunkSize), sorted.length);
      const chunk = sorted.slice(start, end);
      picked.push(chunk[Math.floor(Math.random() * chunk.length)]);
    }
  }

  const assign = {};
  sigTiles.forEach((tile, i) => {
    if (!picked[i]) return;
    assign[tile.id] = picked[i].uid;

    // 파일명에서 금액 → 땅 가격
    const amt = extractAmount(picked[i].name);
    if (amt > 0) tile.price = amt;

    // 파일명에서 시그이름 → 땅 이름
    const sigName = extractSigName(picked[i].name);
    if (sigName) tile.name = sigName;
  });

  saveAssign(assign);
  SigEngine.addLog(state, `시그 배정 완료 (${Object.keys(assign).length}칸) — 금액순 정렬`);
  backupR();
  renderSigGrid();
  buildMinimap();
}

async function addFiles(files) {
  await Promise.all(Array.from(files).map(f =>
    idbPut({ uid: makeUid(), blob: f, name: f.name.replace(/\.[^.]+$/,''), fromFile: true })
  ));
  renderSigGrid();
}

$('sigAssignBtn')?.addEventListener('click', doAssign);
$('sigClearBtn')?.addEventListener('click', () => { saveAssign({}); renderSigGrid(); });

$('sigUploadZone')?.addEventListener('click', () => $('sigFileInput')?.click());
$('sigFileInput')?.addEventListener('change', function() { addFiles(this.files); this.value=''; });

const upZone = $('sigUploadZone');
upZone?.addEventListener('dragover', e => { e.preventDefault(); upZone.classList.add('drag-over'); });
upZone?.addEventListener('dragleave', () => upZone.classList.remove('drag-over'));
upZone?.addEventListener('drop', e => { e.preventDefault(); upZone.classList.remove('drag-over'); addFiles(e.dataTransfer.files); });

window.sigDelete = async (uid) => {
  await idbDelete(uid);
  const assign = loadAssign();
  Object.keys(assign).forEach(k => { if (assign[k] === uid) delete assign[k]; });
  saveAssign(assign);
  renderSigGrid();
};

/* ═══ Storage 동기화 ════════════════════ */

SigStorage.onChange(newState => {
  if (!newState || isAnimating) return;
  state = newState;
  render();
  renderPlayerEditor();
  buildMinimap();
});

/* ═══ 초기 렌더 ═════════════════════════ */
render();
renderPlayerEditor();
buildMinimap();
renderTileEditor();
renderSigGrid();

});
