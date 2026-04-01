/*  SIG CONQUEST V2 — engine.js
    게임 로직 엔진 (36칸 · 최대15인 · 주사위2개)
    ──────────────────────────────────────── */

const SigEngine = {

  /* ═══ 게임 생성 ═══════════════════════ */
  createGame(playerCount = 4, initialMoney = null, customNames = []) {
    playerCount = Math.max(CFG.MIN_PLAYERS, Math.min(CFG.MAX_PLAYERS, playerCount));
    const money = initialMoney || CFG.DEFAULT_MONEY;
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      players.push({
        id:          `p${i + 1}`,
        name:        customNames[i] || CFG.DEFAULT_NAMES[i],
        money:       money,
        position:    0,
        shield:      0,
        angel:       0,
        jailTurn:    0,
        desertTurn:  0,
        color:       CFG.COLORS[i],
        bankrupt:    false,
        totalEarned: 0,
        totalPaid:   0,
      });
    }
    const tiles = CFG.DEFAULT_TILES.map(t => ({
      ...t,
      owner:     null,
      ownerName: '',
      level:     0,
      doubled:   false,
    }));
    return {
      version:      CFG.VERSION,
      round:        1,
      turnIdx:      0,
      dice:         [0, 0],
      diceRolled:   false,
      isDouble:     false,
      doubleCount:  0,
      pendingAction:  null,
      pendingMessage: '',
      popup:        null,
      eventMsg:     '새 게임이 시작되었습니다!',
      salary:       CFG.SALARY,
      bailCost:     CFG.BAIL_COST,
      players,
      tiles,
      logs:         ['[시스템] 게임 생성'],
      isMoving:     false,
      gameOver:     false,
      winner:       null,
      spotlight:    null,
      moveAnim:     null,
      _step:        'dice',
      _donateAmount: 0,
      _donateCount:  0,
      _landingPending: false,
    };
  },

  /* ═══ 주사위 ══════════════════════════ */
  rollDice(state) {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    state.dice = [d1, d2];
    state.diceRolled = true;
    state.isDouble = d1 === d2;
    if (state.isDouble) state.doubleCount++;
    else state.doubleCount = 0;
    const p = this.currentPlayer(state);
    this.addLog(state, `${p.name} 🎲 ${d1}+${d2}=${d1+d2}${state.isDouble?' (더블!)':''}`);
    state.popup = { type:'dice', d1, d2, sum: d1+d2, isDouble: state.isDouble };
    return d1 + d2;
  },

  setDice(state, d1, d2) {
    state.dice = [d1, d2];
    state.diceRolled = true;
    state.isDouble = d1 === d2;
    if (state.isDouble) state.doubleCount++;
    else state.doubleCount = 0;
    const p = this.currentPlayer(state);
    this.addLog(state, `${p.name} 수동 🎲 ${d1}+${d2}=${d1+d2}${state.isDouble?' (더블!)':''}`);
    state.popup = { type:'dice', d1, d2, sum: d1+d2, isDouble: state.isDouble };
    return d1 + d2;
  },

  diceSum(state) { return state.dice[0] + state.dice[1]; },

  /* ═══ 이동 (로직만, 애니메이션은 UI) ═══ */
  // 최종 위치 계산 (출발 통과 체크 포함)
  calcMove(state, steps) {
    const p = this.currentPlayer(state);
    const start = p.position;
    const total = CFG.TOTAL_TILES;
    const passedStart = (start + steps) >= total;
    const dest = (start + steps) % total;
    return { start, dest, passedStart, steps };
  },

  // applyMove — 미사용 (animateMove에서 직접 처리)

  /* ═══ 착지 효과 ═══════════════════════ */
  applyLanding(state) {
    const p    = this.currentPlayer(state);
    const tile = state.tiles[p.position];

    switch (tile.type) {
      case 'START':
        p.money += CFG.SALARY_LAND;
        p.totalEarned += CFG.SALARY_LAND;
        state.eventMsg = `${p.name} 출발지 도착! +${CFG.SALARY_LAND.toLocaleString()}P`;
        state.popup = { type:'action', title:'⭐ 출발지 도착!', text:`급여 +${CFG.SALARY_LAND.toLocaleString()}P 획득!` };
        this.addLog(state, state.eventMsg);
        break;

      case 'SIG':
        this._landSig(state, p, tile);
        break;

      case 'EVENT':
        this._landEvent(state, p);
        break;

      case 'DESERT':
        p.desertTurn = CFG.DESERT_TURNS;
        state.eventMsg = `${p.name} 무인도 표류! ${CFG.DESERT_TURNS}턴 쉼`;
        state.popup = { type:'action', title:'🏝 무인도!', text:`${CFG.DESERT_TURNS}턴 쉬어갑니다` };
        this.addLog(state, state.eventMsg);
        break;

      case 'JAIL':
        state.eventMsg = `${p.name} 감옥 방문 (처벌 없음)`;
        state.popup = { type:'action', title:'감옥 방문', text:'방문만, 처벌 없음' };
        this.addLog(state, state.eventMsg);
        break;

      case 'TRAVEL':
        state.pendingAction = { type:'TRAVEL' };
        state.pendingMessage = '세계여행! 원하는 SIG 칸으로 이동하세요.';
        state.eventMsg = state.pendingMessage;
        state.popup = { type:'action', title:'✈ 세계여행!', text:'원하는 칸으로 이동!' };
        this.addLog(state, state.eventMsg);
        break;
    }
  },

  _landSig(state, p, tile) {
    if (!tile.owner) {
      // 빈 땅 — 구매
      if (p.money >= tile.price) {
        state.pendingAction = { type:'BUY', tileId: tile.id };
        state.pendingMessage = `'${tile.name}' 구매 (${tile.price.toLocaleString()}P)?`;
      } else {
        state.eventMsg = `${p.name} — '${tile.name}' 자금 부족`;
        state.popup = { type:'action', title:'자금 부족', text:`${tile.price.toLocaleString()}P 필요` };
        this.addLog(state, state.eventMsg);
      }
    } else if (tile.owner === p.id) {
      // 자기 땅 — 업그레이드
      if (tile.level < 3) {
        const cost = this.getUpgradeCost(tile);
        if (p.money >= cost) {
          state.pendingAction = { type:'UPGRADE', tileId: tile.id, cost };
          state.pendingMessage = `'${tile.name}' 업그레이드 (${cost.toLocaleString()}P)?`;
        } else {
          state.eventMsg = `${p.name} — 업그레이드 자금 부족`;
          this.addLog(state, state.eventMsg);
        }
      } else {
        state.eventMsg = `${p.name} — '${tile.name}' 이미 최대 레벨`;
        this.addLog(state, state.eventMsg);
      }
    } else {
      // 남의 땅 — 통행료
      const toll = this.calcToll(state, tile);
      const takeoverCost = toll + tile.price; // 인수 = 통행료 + 땅가격
      if (p.shield > 0) {
        state.pendingAction = { type:'TOLL_SHIELD', tileId: tile.id, toll, takeoverCost };
        state.pendingMessage = `통행료 발생! 방어막 사용 가능 (보유: ${p.shield}개)`;
      } else {
        const canTakeover = p.money >= takeoverCost;
        state.pendingAction = { type: canTakeover ? 'TOLL_OR_BUY' : 'TOLL', tileId: tile.id, toll, takeoverCost };
        state.pendingMessage = `'${tile.name}' (${tile.ownerName}) 통행료: ${toll.toLocaleString()}P`;
      }
    }
  },

  _landEvent(state, p) {
    state.pendingAction = { type:'EVENT_DRAW' };
    state.pendingMessage = '이벤트 카드를 뽑으세요!';
  },

  /* ═══ 액션 처리 ═══════════════════════ */

  buyTile(state) {
    const p = this.currentPlayer(state);
    const tile = state.tiles[state.pendingAction.tileId];
    p.money -= tile.price;
    p.totalPaid += tile.price;
    tile.owner = p.id;
    tile.ownerName = p.name;
    state.eventMsg = `${p.name}이(가) '${tile.name}' 구매! (${tile.price.toLocaleString()}P)`;
    state.popup = { type:'action', title:'구매 완료!', text: state.eventMsg };
    this.addLog(state, state.eventMsg);
    state.pendingAction = null;
    state.pendingMessage = '';
    this.checkBankruptcy(state);
  },

  skipBuy(state) {
    state.pendingAction = null;
    state.pendingMessage = '';
    state.eventMsg = `${this.currentPlayer(state).name} — 구매 패스`;
    this.addLog(state, state.eventMsg);
  },

  upgradeTile(state) {
    const p = this.currentPlayer(state);
    const tile = state.tiles[state.pendingAction.tileId];
    const cost = state.pendingAction.cost;
    p.money -= cost;
    p.totalPaid += cost;
    tile.level++;
    const bld = CFG.BUILDING[tile.level];
    state.eventMsg = `${p.name} '${tile.name}' → ${bld.icon} ${bld.name} (${cost.toLocaleString()}P)`;
    state.popup = { type:'action', title:'건설 완료!', text: state.eventMsg };
    this.addLog(state, state.eventMsg);
    state.pendingAction = null;
    state.pendingMessage = '';
    this.checkBankruptcy(state);
  },

  payToll(state) {
    const p = this.currentPlayer(state);
    const tile = state.tiles[state.pendingAction.tileId];
    const toll = state.pendingAction.toll || this.calcToll(state, tile);
    const owner = state.players.find(x => x.id === tile.owner);
    p.money -= toll;
    p.totalPaid += toll;
    if (owner) { owner.money += toll; owner.totalEarned += toll; }
    state.eventMsg = `${p.name} → ${tile.ownerName}에게 통행료 ${toll.toLocaleString()}P`;
    state.popup = { type:'action', title:'통행료 지불', text: state.eventMsg };
    this.addLog(state, state.eventMsg);
    if (tile.doubled) tile.doubled = false;
    state.pendingAction = null;
    state.pendingMessage = '';
    this.checkBankruptcy(state);
  },

  useShield(state) {
    const p = this.currentPlayer(state);
    p.shield--;
    state.eventMsg = `${p.name} 방어막 사용! 통행료 면제`;
    state.popup = { type:'action', title:'🛡 방어막!', text:'통행료 면제' };
    this.addLog(state, state.eventMsg);
    state.pendingAction = null;
    state.pendingMessage = '';
  },

  takeover(state) {
    const p = this.currentPlayer(state);
    const act = state.pendingAction;
    const tile = state.tiles[act.tileId];
    const prevOwner = state.players.find(x => x.id === tile.owner);
    const toll = act.toll || this.calcToll(state, tile);
    const totalCost = toll + tile.price;
    // 통행료는 소유자에게, 땅값도 소유자에게
    p.money -= totalCost;
    p.totalPaid += totalCost;
    if (prevOwner) { prevOwner.money += totalCost; prevOwner.totalEarned += totalCost; }
    tile.owner = p.id;
    tile.ownerName = p.name;
    if (tile.level > 0) tile.level--;
    state.eventMsg = `${p.name}이(가) '${tile.name}' 인수! (통행료 ${toll.toLocaleString()} + 땅값 ${tile.price.toLocaleString()} = ${totalCost.toLocaleString()}P)`;
    state.popup = { type:'action', title:'인수 완료!', text: state.eventMsg };
    this.addLog(state, state.eventMsg);
    state.pendingAction = null;
    state.pendingMessage = '';
    this.checkBankruptcy(state);
  },

  /* ── 이벤트 뽑기 ───────────────────── */
  drawEvent(state) {
    const pool = CFG.EVENT_POOL;
    const evt  = pool[Math.floor(Math.random() * pool.length)];
    const p    = this.currentPlayer(state);

    state.popup = { type:'event', title: evt.title, text: evt.text, key: evt.key };

    switch (evt.key) {
      case 'GAIN_SMALL': case 'GAIN_MEDIUM': case 'GAIN_BIG':
        p.money += evt.amount; p.totalEarned += evt.amount;
        state.eventMsg = `${p.name} ${evt.title}: ${evt.text}`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        break;

      case 'LOSE_SMALL': case 'LOSE_MEDIUM':
        p.money += evt.amount; p.totalPaid += Math.abs(evt.amount);
        state.eventMsg = `${p.name} ${evt.title}: ${evt.text}`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        this.checkBankruptcy(state);
        break;

      case 'SALARY_ALL':
        state.players.forEach(pl => { if (!pl.bankrupt) { pl.money += evt.amount; pl.totalEarned += evt.amount; } });
        state.eventMsg = `${evt.title}: 전원 +${evt.amount.toLocaleString()}P`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        break;

      case 'TAX_ALL':
        state.players.forEach(pl => { if (!pl.bankrupt) { pl.money += evt.amount; pl.totalPaid += Math.abs(evt.amount); } });
        state.eventMsg = `${evt.title}: 전원 ${evt.amount.toLocaleString()}P`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        state.players.forEach(() => this.checkBankruptcy(state));
        break;

      case 'GO_START':
        p.position = 0;
        p.money += CFG.SALARY_LAND; p.totalEarned += CFG.SALARY_LAND;
        state.eventMsg = `${p.name} 출발지로 이동! +${CFG.SALARY_LAND.toLocaleString()}P`;
        state.popup = { type:'event', title:'⭐ 출발지로 이동!', text:`급여 +${CFG.SALARY_LAND.toLocaleString()}P 획득!` };
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        break;

      case 'GO_JAIL':
        state.pendingAction = { type:'GO_JAIL' };
        state.pendingMessage = '감옥으로 이동합니다!';
        break;

      case 'BACK_3': {
        const newPos = (p.position - 3 + CFG.TOTAL_TILES) % CFG.TOTAL_TILES;
        p.position = newPos;
        state.eventMsg = `${p.name} 3칸 후진 → [${newPos}] ${state.tiles[newPos].name}`;
        state.popup = { type:'event', title:'3칸 후진!', text:`[${newPos}] ${state.tiles[newPos].name}` };
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        // 후진 도착지에서는 추가 랜딩 없음 (통행료/구매 발생 안 함)
        break;
      }

      case 'DOUBLE_TOLL': {
        const dblTargets = state.tiles.filter(t => t.type === 'SIG' && t.owner);
        if (dblTargets.length) {
          state.pendingAction = { type:'DOUBLE_TOLL' };
          state.pendingMessage = '통행료 2배를 적용할 SIG 칸을 선택하세요.';
        } else {
          state.eventMsg = `${p.name} 강화 — 대상 칸 없음`;
          this.addLog(state, state.eventMsg);
          state.pendingAction = null; state.pendingMessage = '';
        }
        break;
      }

      case 'DESTROY': {
        const destroyTargets = state.tiles.filter(t => t.type === 'SIG' && t.level > 0);
        if (destroyTargets.length) {
          state.pendingAction = { type:'DESTROY' };
          state.pendingMessage = '건물 파괴할 SIG 칸을 선택하세요.';
        } else {
          state.eventMsg = `${p.name} 지진 — 파괴할 건물 없음`;
          this.addLog(state, state.eventMsg);
          state.pendingAction = null; state.pendingMessage = '';
        }
        break;
      }

      case 'FREE_BUILD': {
        const owned = state.tiles.filter(t => t.owner === p.id && t.level < 3);
        if (owned.length) {
          state.pendingAction = { type:'FREE_BUILD' };
          state.pendingMessage = '무료 업그레이드할 소유 칸을 선택하세요.';
        } else {
          state.eventMsg = `${p.name} 건축허가 — 업그레이드 가능한 칸 없음`;
          this.addLog(state, state.eventMsg);
          state.pendingAction = null; state.pendingMessage = '';
        }
        break;
      }

      case 'GET_SHIELD':
        p.shield++;
        state.eventMsg = `${p.name} 방어막 +1 🛡`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        break;

      case 'GET_ANGEL':
        p.angel++;
        state.eventMsg = `${p.name} 천사카드 +1 😇`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null; state.pendingMessage = '';
        break;
    }
  },

  /* ── 이벤트 즉시 적용 ─────────────── */
  applyEventAction(state, actionType, data = {}) {
    const p = this.currentPlayer(state);

    if (actionType === 'GO_JAIL') {
      p.position = 29; // 감옥 칸
      p.jailTurn = CFG.JAIL_TURNS;
      state.eventMsg = `${p.name} 감옥행! ${CFG.JAIL_TURNS}턴 갇힘`;
      state.popup = { type:'action', title:'⛓ 감옥!', text: state.eventMsg };
      this.addLog(state, state.eventMsg);
    }

    if (actionType === 'DOUBLE_TOLL' && data.tileId != null) {
      const t = state.tiles[data.tileId];
      if (t && t.type === 'SIG') {
        t.doubled = true;
        state.eventMsg = `'${t.name}' 통행료 2배 적용!`;
        this.addLog(state, state.eventMsg);
      }
    }

    if (actionType === 'DESTROY' && data.tileId != null) {
      const t = state.tiles[data.tileId];
      if (t && t.type === 'SIG' && t.level > 0) {
        t.level--;
        state.eventMsg = `'${t.name}' 건물 파괴! → LV${t.level}`;
        this.addLog(state, state.eventMsg);
      }
    }

    if (actionType === 'FREE_BUILD' && data.tileId != null) {
      const t = state.tiles[data.tileId];
      if (t && t.owner === p.id && t.level < 3) {
        t.level++;
        const bld = CFG.BUILDING[t.level];
        state.eventMsg = `${p.name} '${t.name}' 무료 건설 → ${bld.icon} ${bld.name}`;
        this.addLog(state, state.eventMsg);
      }
    }

    if (actionType === 'TRAVEL' && data.tileId != null) {
      p.position = data.tileId;
      const t = state.tiles[data.tileId];
      state.eventMsg = `${p.name} ✈ '${t.name}'으로 이동!`;
      this.addLog(state, state.eventMsg);
      // 세계여행 도착지에서는 구매만 가능 (통행료 X)
      if (t.type === 'SIG' && !t.owner && p.money >= t.price) {
        state.pendingAction = { type:'BUY', tileId: t.id };
        state.pendingMessage = `'${t.name}' 구매 (${t.price.toLocaleString()}P)?`;
        return;
      }
    }

    if (actionType === 'USE_ANGEL') {
      if (p.angel > 0) {
        p.angel--;
        p.jailTurn = 0;
        state.eventMsg = `${p.name} 천사카드 사용! 감옥 탈출 😇`;
        this.addLog(state, state.eventMsg);
      }
    }

    if (actionType === 'PAY_BAIL') {
      if (p.money >= state.bailCost) {
        p.money -= state.bailCost;
        p.totalPaid += state.bailCost;
        p.jailTurn = 0;
        state.eventMsg = `${p.name} 보석금 ${state.bailCost.toLocaleString()}P 지불! 탈출`;
        this.addLog(state, state.eventMsg);
        this.checkBankruptcy(state);
      }
    }

    state.pendingAction = null;
    state.pendingMessage = '';
  },

  /* ═══ 통행료 계산 ═════════════════════ */
  calcToll(state, tile) {
    if (!tile.owner || tile.type !== 'SIG') return 0;
    // 통행료 = 가격 × 건물배율 × 독점 × 더블
    const bldMult = CFG.BUILDING[tile.level].tollMult;
    const monoMult = this.hasMonopoly(state, tile) ? CFG.MONOPOLY_MULT : 1;
    const dblMult  = tile.doubled ? 2 : 1;
    return Math.floor(tile.price * bldMult * monoMult * dblMult);
  },

  hasMonopoly(state, tile) {
    if (!tile.group || !tile.owner) return false;
    const grp = CFG.GROUPS[tile.group];
    if (!grp) return false;
    return grp.tiles.every(id => state.tiles[id].owner === tile.owner);
  },

  getUpgradeCost(tile) {
    const nextLevel = tile.level + 1;
    if (nextLevel > 3) return Infinity;
    return Math.floor(tile.price * CFG.BUILDING[nextLevel].costRate);
  },

  getTileValue(tile) {
    if (tile.type !== 'SIG') return 0;
    let val = tile.price;
    for (let l = 1; l <= tile.level; l++) {
      val += Math.floor(tile.price * CFG.BUILDING[l].costRate);
    }
    return val;
  },

  /* ═══ 턴 관리 ═════════════════════════ */
  currentPlayer(state) { return state.players[state.turnIdx]; },

  nextPlayer(state) {
    // 더블이면 같은 플레이어 유지
    if (state.isDouble && state.doubleCount < 3) {
      state.diceRolled = false;
      state.dice = [0, 0];
      state.isDouble = false;
      this.addLog(state, `더블! ${this.currentPlayer(state).name} 추가 턴`);
      return;
    }
    // 3연속 더블 → 감옥
    if (state.doubleCount >= 3) {
      const p = this.currentPlayer(state);
      p.position = 29;
      p.jailTurn = CFG.JAIL_TURNS;
      state.eventMsg = `${p.name} 3연속 더블! 감옥행!`;
      this.addLog(state, state.eventMsg);
    }

    state.doubleCount = 0;
    state.isDouble = false;
    state.diceRolled = false;
    state.dice = [0, 0];
    state.pendingAction = null;
    state.pendingMessage = '';

    const total = state.players.length;
    let idx = (state.turnIdx + 1) % total;
    let safety = 0;
    while (state.players[idx].bankrupt && safety++ < total) {
      idx = (idx + 1) % total;
    }
    if (idx <= state.turnIdx || safety >= total) state.round++;
    state.turnIdx = idx;

    // 감옥/무인도 체크
    const np = state.players[idx];
    if (np.jailTurn > 0) {
      state.eventMsg = `${np.name}은(는) 감옥 (남은: ${np.jailTurn}턴)`;
      state.pendingAction = { type:'JAIL_TURN' };
      state.pendingMessage = `감옥 (남은: ${np.jailTurn}턴) — 주사위 더블/보석금/천사카드`;
    } else if (np.desertTurn > 0) {
      state.eventMsg = `${np.name}은(는) 무인도 표류 중 (남은: ${np.desertTurn}턴)`;
      state.pendingAction = { type:'DESERT_TURN' };
      state.pendingMessage = `무인도 (남은: ${np.desertTurn}턴) — 더블 나오면 탈출!`;
    }

    this.checkGameOver(state);
  },

  /* ═══ 감옥 턴 처리 ═══════════════════ */
  jailRollDice(state) {
    const p = this.currentPlayer(state);
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    state.dice = [d1, d2];
    state.popup = { type:'dice', d1, d2, sum: d1+d2, isDouble: d1===d2 };

    if (d1 === d2) {
      p.jailTurn = 0;
      state.diceRolled = true;
      state.isDouble = false; // 감옥 탈출 더블은 추가턴 없음
      state.doubleCount = 0;
      state.eventMsg = `${p.name} 더블로 감옥 탈출! 🎲${d1}+${d2}`;
      this.addLog(state, state.eventMsg);
      state.pendingAction = null;
      state.pendingMessage = '';
      return true; // 이동 가능
    } else {
      p.jailTurn--;
      if (p.jailTurn <= 0) {
        p.jailTurn = 0;
        state.diceRolled = true;
        state.eventMsg = `${p.name} 감옥 만기 출소! 🎲${d1}+${d2}`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null;
        state.pendingMessage = '';
        return true; // 이동 가능
      }
      state.eventMsg = `${p.name} 감옥 실패 🎲${d1}+${d2} (남은: ${p.jailTurn}턴)`;
      this.addLog(state, state.eventMsg);
      state.pendingAction = null;
      state.pendingMessage = '';
      state.diceRolled = false;
      return false; // 이동 불가
    }
  },

  /* ═══ 무인도 턴 처리 ═══════════════════ */
  desertRollDice(state) {
    const p = this.currentPlayer(state);
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    state.dice = [d1, d2];
    state.popup = { type:'dice', d1, d2, sum: d1+d2, isDouble: d1===d2 };

    if (d1 === d2) {
      // 더블 → 탈출! 이동 가능
      p.desertTurn = 0;
      state.diceRolled = true;
      state.isDouble = false; // 무인도 탈출 더블은 추가턴 없음
      state.doubleCount = 0;
      state.eventMsg = `${p.name} 더블로 무인도 탈출! 🎲${d1}+${d2}`;
      this.addLog(state, state.eventMsg);
      state.pendingAction = null;
      state.pendingMessage = '';
      return true; // 이동 가능
    } else {
      p.desertTurn--;
      if (p.desertTurn <= 0) {
        // 만기 탈출 → 이동 가능
        p.desertTurn = 0;
        state.diceRolled = true;
        state.eventMsg = `${p.name} 무인도 만기 탈출! 🎲${d1}+${d2}`;
        this.addLog(state, state.eventMsg);
        state.pendingAction = null;
        state.pendingMessage = '';
        return true;
      }
      // 탈출 실패
      state.eventMsg = `${p.name} 무인도 탈출 실패 🎲${d1}+${d2} (남은: ${p.desertTurn}턴)`;
      this.addLog(state, state.eventMsg);
      state.pendingAction = null;
      state.pendingMessage = '';
      state.diceRolled = false;
      return false;
    }
  },

  /* ═══ 파산 / 게임 종료 ════════════════ */
  checkBankruptcy(state) {
    state.players.forEach(p => {
      if (!p.bankrupt && p.money < 0) {
        p.bankrupt = true;
        state.tiles.forEach(t => {
          if (t.owner === p.id) {
            t.owner = null; t.ownerName = ''; t.level = 0; t.doubled = false;
          }
        });
        state.eventMsg = `💀 ${p.name} 파산!`;
        state.popup = { type:'action', title:'💀 파산!', text:`${p.name}이(가) 파산했습니다` };
        this.addLog(state, state.eventMsg);
      }
    });
    this.checkGameOver(state);
  },

  checkGameOver(state) {
    const alive = state.players.filter(p => !p.bankrupt);
    if (alive.length <= 1 && state.players.length > 1) {
      state.gameOver = true;
      state.winner = alive[0]?.id || null;
      const name = alive[0]?.name || '?';
      state.eventMsg = `🏆 ${name} 승리!`;
      state.popup = { type:'action', title:'🏆 게임 종료!', text:`${name}이(가) 최후의 승자!` };
      this.addLog(state, state.eventMsg);
    }
  },

  /* ═══ 유틸 ════════════════════════════ */
  addLog(state, msg) {
    const ts = new Date().toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' });
    state.logs.push(`[${ts}] R${state.round} ${msg}`);
    if (state.logs.length > 200) state.logs.splice(0, state.logs.length - 200);
  },
};
