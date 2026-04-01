/*  SIG CONQUEST V2 — overlay.js
    방송 오버레이 UI 컨트롤러
    ──────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  let state = SigStorage.load();
  if (!state) return;

  const $ = id => document.getElementById(id);
  const board = $('board');
  let sigImages = {};   // tileId → objectURL
  let lastAssignTs = '';
  let popupTimer = null;

  /* ═══ 보드 렌더 ═══════════════════════ */

  function buildBoard() {
    board.innerHTML = '';
    state.tiles.forEach(tile => {
      const div = document.createElement('div');
      div.className = `cell type-${tile.type}`;
      div.id = `cell-${tile.id}`;
      div.dataset.id = tile.id;

      const pos = CFG.GRID_POS[tile.id];
      div.style.gridRow = pos[0];
      div.style.gridColumn = pos[1];

      // 코너
      if ([0,11,18,29].includes(tile.id)) div.classList.add('corner');

      div.innerHTML = buildCellHTML(tile);
      board.appendChild(div);
    });
  }

  function buildCellHTML(tile) {
    let html = '';

    // 그룹 컬러바
    if (tile.group && CFG.GROUPS[tile.group]) {
      html += `<div class="cell-group-bar" style="background:${CFG.GROUPS[tile.group].color}"></div>`;
    }

    // SIG 배경 이미지
    if (tile.type === 'SIG' && sigImages[tile.id]) {
      html += `<div class="cell-bg" style="background-image:url('${sigImages[tile.id]}')"></div>`;
    }

    // 특수칸 아이콘
    const icons = { START:'⭐', DESERT:'🏝', JAIL:'⛓', TRAVEL:'✈', EVENT:'🎪' };
    if (icons[tile.type]) {
      html += `<div class="cell-icon">${icons[tile.type]}</div>`;
    }

    // 이름
    html += `<div class="cell-name">${tile.name}</div>`;

    // 가격
    if (tile.type === 'SIG' && tile.price > 0) {
      html += `<div class="cell-price">${tile.price.toLocaleString()}</div>`;
    }

    // 건물
    if (tile.type === 'SIG' && tile.level > 0) {
      html += `<div class="cell-buildings">${CFG.BUILDING[tile.level].icon}</div>`;
    }

    // 2배
    if (tile.doubled) {
      html += `<div class="cell-doubled">×2</div>`;
    }

    // 토큰 영역
    html += `<div class="cell-tokens" id="tokens-${tile.id}"></div>`;

    // 소유자 표시 (하단바 + 좌측바 + 이름)
    if (tile.owner) {
      const owner = state.players.find(p => p.id === tile.owner);
      if (owner) {
        html += `<div class="cell-owner-border" style="background:${owner.color}"></div>`;
        html += `<div class="cell-owner-side" style="background:${owner.color}"></div>`;
        html += `<div class="cell-owner-name" style="color:${owner.color}">${owner.name}</div>`;
      }
    }

    return html;
  }

  /* ═══ 토큰 배치 ═══════════════════════ */

  function renderTokens() {
    // 모든 토큰 영역 초기화
    state.tiles.forEach(t => {
      const el = document.getElementById(`tokens-${t.id}`);
      if (el) el.innerHTML = '';
    });

    // 셀 소유 스타일 업데이트
    state.tiles.forEach(t => {
      const cell = document.getElementById(`cell-${t.id}`);
      if (!cell) return;
      cell.classList.toggle('owned', !!t.owner);
      if (t.owner) {
        const owner = state.players.find(p => p.id === t.owner);
        if (owner) {
          const rgb = hexToRgb(owner.color);
          cell.style.setProperty('--owner-r', rgb.r);
          cell.style.setProperty('--owner-g', rgb.g);
          cell.style.setProperty('--owner-b', rgb.b);
          cell.style.borderColor = owner.color + '60';
        }
      } else {
        cell.style.borderColor = '';
      }
    });

    // 위치별 플레이어 그룹
    const posMap = {};
    state.players.forEach((p, idx) => {
      if (p.bankrupt) return;
      if (!posMap[p.position]) posMap[p.position] = [];
      posMap[p.position].push({ ...p, idx });
    });

    Object.entries(posMap).forEach(([pos, players]) => {
      const el = document.getElementById(`tokens-${pos}`);
      if (!el) return;

      if (players.length <= 5) {
        players.forEach(p => {
          const tok = document.createElement('div');
          tok.className = 'token';
          if (p.idx === state.turnIdx) tok.classList.add('current');
          tok.style.background = p.color;
          tok.style.color = '#fff';
          tok.textContent = `P${p.idx + 1}`;
          tok.id = `token-p${p.idx}`;
          el.appendChild(tok);
        });
      } else {
        // 5명 초과 시 압축 표시
        players.slice(0, 4).forEach(p => {
          const tok = document.createElement('div');
          tok.className = 'token';
          if (p.idx === state.turnIdx) tok.classList.add('current');
          tok.style.background = p.color;
          tok.textContent = `P${p.idx + 1}`;
          el.appendChild(tok);
        });
        const more = document.createElement('div');
        more.className = 'cell-more';
        more.textContent = `+${players.length - 4}`;
        el.appendChild(more);
      }
    });
  }

  /* ═══ 중앙 패널 ═══════════════════════ */

  function renderCenter() {
    const cp = SigEngine.currentPlayer(state);
    const ri = $('roundInfo');
    if (ri) ri.textContent = `R${state.round}`;

    const ti = $('turnInfo');
    if (ti) ti.innerHTML = `<span style="color:${cp.color};font-weight:900;">${cp.name}</span>의 턴 &nbsp;|&nbsp; 📍 [${cp.position}] ${state.tiles[cp.position].name} &nbsp;|&nbsp; 💰 ${cp.money.toLocaleString()}P`;

    const cards = $('playerCards');
    if (!cards) return;
    cards.innerHTML = '';
    state.players.forEach((p, idx) => {
      const ownedCount = state.tiles.filter(t => t.owner === p.id).length;
      const card = document.createElement('div');
      card.className = 'p-card';
      if (idx === state.turnIdx) card.classList.add('active');
      if (p.bankrupt) card.classList.add('bankrupt');
      card.style.setProperty('--player-color', p.color);
      card.style.borderColor = idx === state.turnIdx ? p.color : '';
      card.innerHTML = `
        <div class="p-card-name" style="color:${p.color}">${p.name}${p.bankrupt?' 💀':''}</div>
        <div class="p-card-money">💰 ${p.money.toLocaleString()}</div>
        <div class="p-card-items">${p.shield?'🛡'+p.shield:''}${p.angel?' 😇'+p.angel:''}</div>
        <div class="p-card-tiles">🏠 ${ownedCount}칸</div>`;
      cards.appendChild(card);
    });
  }

  /* ═══ 주사위 표시 (굴림 애니메이션) ═══ */

  let diceAnimTimer = null;

  // 주사위 점 표시 (SVG dot pattern)
  function diceDots(n) {
    const dots = {
      1: [[50,50]],
      2: [[25,25],[75,75]],
      3: [[25,25],[50,50],[75,75]],
      4: [[25,25],[75,25],[25,75],[75,75]],
      5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
      6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
    };
    const d = dots[n] || dots[1];
    let svg = `<svg viewBox="0 0 100 100" width="100%" height="100%">`;
    d.forEach(([x,y]) => { svg += `<circle cx="${x}" cy="${y}" r="12" fill="white"/>`; });
    svg += `</svg>`;
    return svg;
  }

  function renderDice() {
    const area = $('diceArea');
    if (state.popup?.type === 'dice') {
      area.style.display = 'flex';
      clearTimeout(diceAnimTimer);

      const d1El = $('dice1');
      const d2El = $('dice2');
      const sumEl = $('diceSum');
      const dblEl = $('diceDouble');

      d1El.classList.add('rolling');
      d2El.classList.add('rolling');
      sumEl.textContent = '';
      dblEl.style.display = 'none';

      let tick = 0;
      const rollInterval = setInterval(() => {
        d1El.innerHTML = diceDots(Math.floor(Math.random()*6)+1);
        d2El.innerHTML = diceDots(Math.floor(Math.random()*6)+1);
        tick++;
        if (tick >= 12) {
          clearInterval(rollInterval);
          d1El.innerHTML = diceDots(state.popup.d1);
          d2El.innerHTML = diceDots(state.popup.d2);
          d1El.classList.remove('rolling');
          d2El.classList.remove('rolling');
          d1El.classList.add('landed');
          d2El.classList.add('landed');
          sumEl.textContent = state.popup.sum;
          sumEl.classList.add('pop');
          dblEl.style.display = state.popup.isDouble ? 'block' : 'none';
          setTimeout(() => {
            d1El.classList.remove('landed');
            d2El.classList.remove('landed');
            sumEl.classList.remove('pop');
          }, 500);
        }
      }, 70);

      diceAnimTimer = setTimeout(() => { area.style.display = 'none'; }, 4500);
    } else {
      area.style.display = 'none';
    }
  }

  /* ═══ 이벤트 카드 애니메이션 ════════════ */

  function showEventCard(title, text) {
    // 기존 팝업 대신 카드 뒤집기 애니메이션
    const area = $('popupArea');
    area.style.display = 'block';
    area.style.borderColor = '#ffd700';
    area.innerHTML = `
      <div class="event-card-anim">
        <div class="event-card-inner" id="eventCardInner">
          <div class="event-card-front">🎪<br><span style="font-size:24px;font-weight:900;">?</span></div>
          <div class="event-card-back">
            <div style="font-size:32px;font-weight:900;margin-bottom:12px;">${title}</div>
            <div style="font-size:26px;font-weight:800;color:var(--text-muted);">${text}</div>
          </div>
        </div>
      </div>`;

    // 0.5초 후 카드 뒤집기
    setTimeout(() => {
      const inner = $('eventCardInner');
      if (inner) inner.classList.add('flipped');
    }, 600);

    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => { area.style.display = 'none'; }, 4500);
  }

  /* ═══ 파산 애니메이션 ════════════════ */

  let bankruptEl = null;

  function showBankruptcy(player) {
    if (bankruptEl) bankruptEl.remove();
    bankruptEl = document.createElement('div');
    bankruptEl.className = 'bankrupt-overlay';

    // 파티클 생성
    let particles = '';
    for (let i = 0; i < 30; i++) {
      const dx = (Math.random() - 0.5) * 600;
      const dy = (Math.random() - 0.5) * 400;
      const delay = Math.random() * 0.5;
      const size = 4 + Math.random() * 8;
      particles += `<div class="bankrupt-particle" style="left:50%;top:50%;width:${size}px;height:${size}px;--dx:${dx}px;--dy:${dy}px;animation-delay:${delay}s;"></div>`;
    }

    bankruptEl.innerHTML = `
      <div class="bankrupt-shatter">${particles}</div>
      <div class="bankrupt-skull">💀</div>
      <div class="bankrupt-name" style="color:${player.color};">${player.name}</div>
      <div class="bankrupt-text">파산!</div>`;

    document.getElementById('overlay').appendChild(bankruptEl);

    setTimeout(() => {
      if (bankruptEl) { bankruptEl.remove(); bankruptEl = null; }
    }, 5000);
  }

  // 파산 감지용
  let prevBankruptIds = new Set();

  function checkBankruptAnim() {
    const currentBankrupt = new Set(state.players.filter(p => p.bankrupt).map(p => p.id));
    currentBankrupt.forEach(id => {
      if (!prevBankruptIds.has(id)) {
        const player = state.players.find(p => p.id === id);
        if (player) showBankruptcy(player);
      }
    });
    prevBankruptIds = currentBankrupt;
  }

  /* ═══ 팝업 ════════════════════════════ */

  function renderPopup() {
    const area = $('popupArea');

    // 주사위 팝업은 별도 영역
    if (state.popup?.type === 'dice') {
      area.style.display = 'none';
      return;
    }

    if (state.popup?.type === 'RULES') {
      area.style.display = 'none';
      showRules(state.popup.tab || 'basic');
      return;
    }

    if (state.popup?.type === 'SPOTLIGHT') {
      area.style.display = 'none';
      showSpotlight(state.popup);
      return;
    }

    $('rulesOverlay').style.display = 'none';
    $('spotlightOverlay').style.display = 'none';

    // 이벤트 카드 결과 → 카드 뒤집기 애니메이션
    if (state.popup && state.popup.type === 'event') {
      showEventCard(state.popup.title, state.popup.text);
      return;
    }

    // 액션 팝업 (구매/통행료 등 결과)
    if (state.popup && state.popup.title) {
      area.style.display = 'block';
      area.style.borderColor = '#20a8ff';
      area.innerHTML = `
        <div class="popup-title">${state.popup.title}</div>
        <div class="popup-text">${state.popup.text || ''}</div>`;
      clearTimeout(popupTimer);
      popupTimer = setTimeout(() => { area.style.display = 'none'; }, 3500);
      return;
    }

    // 후원 체크 단계 — 부족 금액 미리 표시
    if (state._step === 'donate' && state._landingPending) {
      const p = SigEngine.currentPlayer(state);
      const tile = state.tiles[p.position];
      if (tile.type === 'SIG') {
        let html = `<div class="popup-player" style="color:${p.color};">${p.name}</div>`;
        if (!tile.owner) {
          const short = tile.price - p.money;
          html += `<div class="popup-title">🏠 ${tile.name}</div>`;
          html += `<div style="font-size:40px;color:#ffd700;font-weight:900;margin:10px 0;">${tile.price.toLocaleString()}P</div>`;
          html += `<div class="popup-text">보유: ${p.money.toLocaleString()}P</div>`;
          if (short > 0) html += `<div style="font-size:32px;color:#ff2b55;font-weight:900;margin:8px 0;background:rgba(255,43,85,.2);padding:8px 16px;border-radius:10px;">⚠ ${short.toLocaleString()}P 부족!</div>`;
        } else if (tile.owner !== p.id) {
          const toll = SigEngine.calcToll(state, tile);
          const short = toll - p.money;
          const ownerP = state.players.find(x => x.id === tile.owner);
          html += `<div class="popup-title">💸 ${tile.name}</div>`;
          html += `<div class="popup-text">소유자: <span style="color:${ownerP?.color||'#fff'};">${tile.ownerName}</span></div>`;
          html += `<div style="font-size:42px;color:#ff2b55;font-weight:900;margin:10px 0;">통행료 ${toll.toLocaleString()}P</div>`;
          html += `<div class="popup-text">보유: ${p.money.toLocaleString()}P</div>`;
          if (short > 0) html += `<div style="font-size:32px;color:#ff2b55;font-weight:900;margin:8px 0;background:rgba(255,43,85,.2);padding:8px 16px;border-radius:10px;">⚠ ${short.toLocaleString()}P 부족!</div>`;
        } else if (tile.level < 3) {
          const cost = SigEngine.getUpgradeCost(tile);
          const short = cost - p.money;
          html += `<div class="popup-title">⬆ ${tile.name}</div>`;
          html += `<div style="font-size:36px;color:#ffd700;font-weight:900;margin:8px 0;">업그레이드 ${cost.toLocaleString()}P</div>`;
          if (short > 0) html += `<div style="font-size:28px;color:#ff2b55;font-weight:900;margin:6px 0;background:rgba(255,43,85,.2);padding:6px 14px;border-radius:10px;">⚠ ${short.toLocaleString()}P 부족!</div>`;
        }
        const donated = state._donateAmount || 0;
        if (donated > 0) html += `<div class="popup-text" style="color:#ffd700;margin-top:8px;">후원: +${donated.toLocaleString()}P</div>`;
        area.style.display = 'block';
        area.style.borderColor = p.color;
        area.innerHTML = html;
        clearTimeout(popupTimer);
        return;
      }
    }

    // 대기 중인 액션 표시 (구매/통행료 선택 등)
    if (state.pendingAction && state.pendingMessage) {
      const p = SigEngine.currentPlayer(state);
      const act = state.pendingAction;
      let html = `<div class="popup-player" style="color:${p.color};">${p.name}</div>`;

      if (act.type === 'BUY') {
        const t = state.tiles[act.tileId];
        const buyShort = t.price - p.money;
        html += `<div class="popup-title">🏠 ${t.name}</div>`;
        html += `<div style="font-size:40px;color:#ffd700;font-weight:900;margin:12px 0;">${t.price.toLocaleString()}P</div>`;
        html += `<div class="popup-text">보유: ${p.money.toLocaleString()}P</div>`;
        if (buyShort > 0) {
          html += `<div style="font-size:28px;color:#ff2b55;font-weight:900;margin:6px 0;background:rgba(255,43,85,.2);padding:6px 14px;border-radius:10px;">⚠ ${buyShort.toLocaleString()}P 부족!</div>`;
        } else {
          html += `<div class="popup-text">구매 대기중...</div>`;
        }
      } else if (act.type === 'UPGRADE') {
        const t = state.tiles[act.tileId];
        const nextBld = CFG.BUILDING[t.level + 1];
        html += `<div class="popup-title">⬆ ${t.name}</div>`;
        html += `<div class="popup-text">${CFG.BUILDING[t.level].icon||'땅'} → ${nextBld.icon} ${nextBld.name}</div>`;
        html += `<div style="font-size:36px;color:#ffd700;font-weight:900;margin:8px 0;">${act.cost.toLocaleString()}P</div>`;
      } else if (act.type === 'TOLL' || act.type === 'TOLL_OR_BUY') {
        const t = state.tiles[act.tileId];
        const ownerP = state.players.find(x => x.id === t.owner);
        const toll = act.toll || 0;
        const shortfall = toll - p.money;
        html += `<div class="popup-title">💸 ${t.name}</div>`;
        html += `<div class="popup-text">소유자: <span style="color:${ownerP?.color||'#fff'};">${t.ownerName}</span></div>`;
        html += `<div style="font-size:42px;color:#ff2b55;font-weight:900;margin:10px 0;">통행료 ${toll.toLocaleString()}P</div>`;
        html += `<div class="popup-text">보유: ${p.money.toLocaleString()}P</div>`;
        if (shortfall > 0) {
          html += `<div style="font-size:32px;color:#ff2b55;font-weight:900;margin:8px 0;background:rgba(255,43,85,.2);padding:8px 16px;border-radius:10px;">⚠ ${shortfall.toLocaleString()}P 부족!</div>`;
        }
        if (act.type === 'TOLL_OR_BUY') {
          html += `<div style="font-size:24px;color:#cc44ff;font-weight:800;margin-top:6px;">인수: ${(act.takeoverCost||0).toLocaleString()}P</div>`;
        }
      } else if (act.type === 'TOLL_SHIELD') {
        html += `<div class="popup-title">🛡 방어막 보유!</div>`;
        html += `<div class="popup-text">통행료 면제 가능</div>`;
      } else if (act.type === 'EVENT_DRAW') {
        html += `<div class="popup-title" style="font-size:42px;">🎪 이벤트!</div>`;
      } else if (act.type === 'SELL_TILES') {
        const owned = SigEngine.getOwnedTiles(state, p.id);
        const totalAsset = owned.reduce((s,t) => s + SigEngine.getTileValue(t), 0);
        html += `<div class="popup-title" style="color:#ff2b55;">⚠ 자금 부족!</div>`;
        html += `<div style="font-size:32px;color:#ff2b55;font-weight:900;margin:8px 0;">${p.money.toLocaleString()}P</div>`;
        html += `<div class="popup-text">땅 매각 중... (${owned.length}칸 / ${totalAsset.toLocaleString()}P)</div>`;
      } else {
        html += `<div class="popup-title">${state.pendingMessage}</div>`;
      }

      area.style.display = 'block';
      area.style.borderColor = p.color;
      area.innerHTML = html;
      clearTimeout(popupTimer);
      return;
    }

    area.style.display = 'none';
    return;
  }


  /* ═══ 게임 설명 ═══════════════════════ */

  function showRules(tab) {
    const overlay = $('rulesOverlay');
    overlay.style.display = 'flex';
    $('spotlightOverlay').style.display = 'none';

    const tabs = $('rulesTabs');
    const content = $('rulesContent');
    tabs.innerHTML = '';

    Object.entries(CFG.RULES).forEach(([key, rule]) => {
      const btn = document.createElement('div');
      btn.className = 'rules-tab' + (key === tab ? ' active' : '');
      btn.textContent = rule.title;
      btn.onclick = () => showRules(key);
      tabs.appendChild(btn);
    });

    const rule = CFG.RULES[tab];
    if (rule) {
      content.innerHTML = rule.lines.map(l => `<div class="rules-line">${l}</div>`).join('');
    }
  }

  /* ═══ 스포트라이트 ════════════════════ */

  let spotlightInterval = null;

  function showSpotlight(data) {
    const overlay = $('spotlightOverlay');
    overlay.style.display = 'flex';
    $('rulesOverlay').style.display = 'none';

    clearInterval(spotlightInterval);

    const alivePlayers = state.players.filter(p => !p.bankrupt);
    let idx = data.playerIdx || 0;

    function renderPlayer(i) {
      const p = alivePlayers[i];
      if (!p) return;
      const tile = state.tiles[p.position];
      const ownedCount = state.tiles.filter(t => t.owner === p.id).length;

      $('spotlightCard').style.borderColor = p.color;
      $('spotlightCard').style.color = p.color;
      $('spotlightCard').innerHTML = `
        <div class="spotlight-name" style="color:${p.color}">${p.name}</div>
        <div>📍 [${p.position}] ${tile.name}</div>
        <div class="spotlight-info">💰 ${p.money.toLocaleString()}P &nbsp;|&nbsp; 🏠 ${ownedCount}칸 &nbsp;|&nbsp; 🛡${p.shield} 😇${p.angel}</div>`;

      // 진행 점
      $('spotlightDots').innerHTML = alivePlayers.map((_, di) =>
        `<div class="spotlight-dot${di === i ? ' active' : ''}"></div>`
      ).join('');

      // 보드 셀 하이라이트
      document.querySelectorAll('.cell.highlight').forEach(c => c.classList.remove('highlight'));
      const cell = document.getElementById(`cell-${p.position}`);
      if (cell) cell.classList.add('highlight');
    }

    renderPlayer(idx);

    if (data.auto) {
      spotlightInterval = setInterval(() => {
        idx = (idx + 1) % alivePlayers.length;
        renderPlayer(idx);
      }, 3000);
    }
  }

  function hideSpotlight() {
    clearInterval(spotlightInterval);
    $('spotlightOverlay').style.display = 'none';
    document.querySelectorAll('.cell.highlight').forEach(c => c.classList.remove('highlight'));
  }

  /* ═══ 이동 애니메이션 (Visual) ════════ */

  function renderMoveOverlay() {
    const el = $('moveOverlay');
    if (state.isMoving && state.moveAnim) {
      el.style.display = 'block';
      const p = state.players[state.moveAnim.playerIdx];
      el.querySelector('.move-text').textContent =
        `🚶 ${p.name} 이동 중... (${state.moveAnim.currentStep}/${state.moveAnim.totalSteps})`;
    } else {
      el.style.display = 'none';
    }
  }

  /* ═══ 알림 로그 ═══════════════════════ */

  function renderNotif() {
    const el = $('notifLog');
    if (!el) return;
    const recent = state.logs.slice(-8).reverse();
    el.innerHTML = recent.map(l => `<div class="notif-line">${l}</div>`).join('');
  }

  /* ═══ SIG 이미지 로드 ═════════════════ */

  async function loadSigImages() {
    const assign = loadAssign();
    const pool   = await idbGetAll();
    const uidMap = Object.fromEntries(pool.map(p => [p.uid, p]));

    // 이전 URL 해제
    Object.values(sigImages).forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
    sigImages = {};

    Object.entries(assign).forEach(([tileId, uid]) => {
      const item = uidMap[uid];
      if (item?.blob) {
        sigImages[tileId] = URL.createObjectURL(item.blob);
      } else if (item?.url) {
        sigImages[tileId] = item.url;
      }
    });
  }

  /* ═══ 전체 렌더 ═══════════════════════ */

  function render() {
    buildBoard();
    renderTokens();
    renderCenter();
    renderDice();
    renderPopup();
    renderMoveOverlay();
    renderNotif();
    checkBankruptAnim();
  }

  /* ═══ 동기화 ══════════════════════════ */

  SigStorage.onChange(newState => {
    if (!newState) return;
    const prevPopup = state.popup;
    state = newState;

    // 룰/스포트라이트 팝업 상태 변경 감지
    if (!state.popup || state.popup.type !== 'RULES') {
      $('rulesOverlay').style.display = 'none';
    }
    if (!state.popup || state.popup.type !== 'SPOTLIGHT') {
      hideSpotlight();
    }

    render();

    // 이미지 배정 변경 감지
    const ts = localStorage.getItem(SIG_ASSIGN_TS) || '';
    if (ts !== lastAssignTs) {
      lastAssignTs = ts;
      loadSigImages().then(render);
    }
  });

  // 이동 애니메이션용 경량 동기화
  SigStorage.onVisual(data => {
    if (!data) return;
    if (data.isMoving) {
      // 이동 중 — 위치만 업데이트
      data.positions.forEach((pos, idx) => {
        if (state.players[idx]) state.players[idx].position = pos;
      });
      state.isMoving = true;
      state.moveAnim = {
        playerIdx: data.currentPlayerIdx,
        currentStep: data.moveStep,
        totalSteps: data.moveTotal,
      };
      renderTokens();
      renderMoveOverlay();
    }
  });

  /* ═══ 초기화 ══════════════════════════ */

  loadSigImages().then(() => {
    render();
    lastAssignTs = localStorage.getItem(SIG_ASSIGN_TS) || '';
  });

  /* ═══ 유틸 ════════════════════════════ */

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return { r, g, b };
  }
});
