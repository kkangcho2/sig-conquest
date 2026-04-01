/*  SIG CONQUEST V2 — config.js
    36칸 보드 (위12 아래12 좌8 우8, 코너 공유)
    최대 15인 · 주사위 2개 · 모두의마블 스타일
    ──────────────────────────────────────── */

const CFG = {

  VERSION: 40,
  SCHEMA: 40,
  MAX_PLAYERS: 15,
  MIN_PLAYERS: 2,
  TOTAL_TILES: 36,

  /* ── 15인 컬러 팔레트 ─────────────────── */
  COLORS: [
    '#FF2B55', '#20A8FF', '#FFD700', '#CC44FF', '#FF69B4',
    '#FF8C00', '#00CED1', '#E040FB', '#87CEEB', '#DC143C',
    '#4169E1', '#FFB6C1', '#8A2BE2', '#FF4500', '#DA70D6',
  ],

  COLOR_NAMES: [
    '빨강','파랑','금색','보라','핑크',
    '주황','청록','매젠타','하늘','진홍',
    '로열블루','연분홍','바이올렛','주홍','연보라',
  ],

  DEFAULT_NAMES: [
    '플레이어1','플레이어2','플레이어3','플레이어4','플레이어5',
    '플레이어6','플레이어7','플레이어8','플레이어9','플레이어10',
    '플레이어11','플레이어12','플레이어13','플레이어14','플레이어15',
  ],

  /* ── 기본 설정값 ──────────────────────── */
  DEFAULT_MONEY:  50000,
  SALARY:         3000,    // 출발 통과 급여
  SALARY_LAND:    6000,    // 출발 도착 시 (2배)
  BAIL_COST:      5000,    // 보석금
  JAIL_TURNS:     3,       // 감옥 턴
  DESERT_TURNS:   3,       // 무인도 턴

  /* ── 건물 ──────────────────────────────── */
  BUILDING: [
    { level: 0, name: '땅',   icon: '',   costRate: 1.0, tollMult: 1 },
    { level: 1, name: '별장', icon: '🏠', costRate: 1.5, tollMult: 2 },
    { level: 2, name: '빌딩', icon: '🏢', costRate: 2.0, tollMult: 3 },
    { level: 3, name: '호텔', icon: '🏨', costRate: 2.5, tollMult: 4 },
  ],

  MONOPOLY_MULT: 1.5,  // 독점 보너스 배율

  /* ── SIG 그룹 (컬러 + 독점 단위) ─────── */
  GROUPS: {
    A: { name: 'A', color: '#8B6914', tiles: [1, 2]          },
    B: { name: 'B', color: '#87CEEB', tiles: [4, 5, 6]       },
    C: { name: 'C', color: '#FF69B4', tiles: [8, 9, 10]      },
    D: { name: 'D', color: '#FFA500', tiles: [12, 14, 15]    },
    E: { name: 'E', color: '#FF0000', tiles: [16, 19, 20]    },
    F: { name: 'F', color: '#FFFF00', tiles: [21, 23, 24]    },
    G: { name: 'G', color: '#20B2AA', tiles: [25, 27, 28]    },
    H: { name: 'H', color: '#4169E1', tiles: [31, 32, 33, 35]},
  },

  /* ── 36칸 타일 정의 ────────────────────
     상단→(0~11)  우측↓(12~17)
     하단←(18~29)  좌측↑(30~35)           */
  DEFAULT_TILES: [
    // ── 상단 → (id 0~11) ──
    { id: 0,  type:'START',   name:'출발',        price:0,     group:null },
    { id: 1,  type:'SIG',     name:'불꽃 평원',   price:5000,  group:'A'  },
    { id: 2,  type:'SIG',     name:'유성 숲',     price:8000,  group:'A'  },
    { id: 3,  type:'EVENT',   name:'황금열쇠',    price:0,     group:null },
    { id: 4,  type:'SIG',     name:'번개 항구',   price:10000, group:'B'  },
    { id: 5,  type:'SIG',     name:'은빛 늪',     price:12000, group:'B'  },
    { id: 6,  type:'SIG',     name:'달빛 마을',   price:14000, group:'B'  },
    { id: 7,  type:'EVENT',   name:'이벤트',      price:0,     group:null },
    { id: 8,  type:'SIG',     name:'황금 협곡',   price:16000, group:'C'  },
    { id: 9,  type:'SIG',     name:'용암 제단',   price:18000, group:'C'  },
    { id: 10, type:'SIG',     name:'왕관 광산',   price:20000, group:'C'  },
    { id: 11, type:'DESERT',  name:'무인도',      price:0,     group:null },

    // ── 우측 ↓ (id 12~17) ──
    { id: 12, type:'SIG',     name:'별빛 호수',   price:22000, group:'D'  },
    { id: 13, type:'EVENT',   name:'황금열쇠',    price:0,     group:null },
    { id: 14, type:'SIG',     name:'천공 탑',     price:24000, group:'D'  },
    { id: 15, type:'SIG',     name:'해무 해안',   price:26000, group:'D'  },
    { id: 16, type:'SIG',     name:'심연 도시',   price:28000, group:'E'  },
    { id: 17, type:'EVENT',   name:'이벤트',      price:0,     group:null },

    // ── 하단 ← (id 18~29) ──
    { id: 18, type:'TRAVEL',  name:'세계여행',    price:0,     group:null },
    { id: 19, type:'SIG',     name:'태양 시장',   price:30000, group:'E'  },
    { id: 20, type:'SIG',     name:'수정 계곡',   price:32000, group:'E'  },
    { id: 21, type:'SIG',     name:'오로라 언덕', price:34000, group:'F'  },
    { id: 22, type:'EVENT',   name:'이벤트',      price:0,     group:null },
    { id: 23, type:'SIG',     name:'천둥 요새',   price:36000, group:'F'  },
    { id: 24, type:'SIG',     name:'화염 성채',   price:38000, group:'F'  },
    { id: 25, type:'SIG',     name:'폭풍 만',     price:40000, group:'G'  },
    { id: 26, type:'EVENT',   name:'이벤트',      price:0,     group:null },
    { id: 27, type:'SIG',     name:'서리 봉우리', price:42000, group:'G'  },
    { id: 28, type:'SIG',     name:'진주 섬',     price:44000, group:'G'  },
    { id: 29, type:'JAIL',    name:'감옥',        price:0,     group:null },

    // ── 좌측 ↑ (id 30~35) ──
    { id: 30, type:'EVENT',   name:'황금열쇠',    price:0,     group:null },
    { id: 31, type:'SIG',     name:'미스릴 광맥', price:46000, group:'H'  },
    { id: 32, type:'SIG',     name:'에메랄드 숲', price:48000, group:'H'  },
    { id: 33, type:'SIG',     name:'다이아 궁전', price:50000, group:'H'  },
    { id: 34, type:'EVENT',   name:'황금열쇠',    price:0,     group:null },
    { id: 35, type:'SIG',     name:'드래곤 왕좌', price:55000, group:'H'  },
  ],

  /* ── 이벤트 풀 ─────────────────────────── */
  EVENT_POOL: [
    { key:'GAIN_SMALL',  title:'용돈',     text:'+3,000P 획득',            amount: 3000  },
    { key:'GAIN_MEDIUM', title:'보너스',   text:'+8,000P 획득',            amount: 8000  },
    { key:'GAIN_BIG',    title:'로또당첨', text:'+20,000P 획득',           amount: 20000 },
    { key:'LOSE_SMALL',  title:'벌금',     text:'-3,000P 손실',            amount:-3000  },
    { key:'LOSE_MEDIUM', title:'세금',     text:'-8,000P 손실',            amount:-8000  },
    { key:'GO_START',    title:'출발이동', text:'출발로 이동 (급여 수령)'               },
    { key:'GO_JAIL',     title:'체포',     text:'감옥으로 이동!'                        },
    { key:'BACK_3',      title:'후진',     text:'3칸 뒤로 이동'                         },
    { key:'DOUBLE_TOLL', title:'강화',     text:'랜덤 SIG 통행료 2배'                   },
    { key:'DESTROY',     title:'지진',     text:'랜덤 건물 1단계 하락'                  },
    { key:'FREE_BUILD',  title:'건축허가', text:'소유 SIG 무료 업그레이드'              },
    { key:'GET_SHIELD',  title:'방어',     text:'방어막 +1 🛡'                         },
    { key:'GET_ANGEL',   title:'천사',     text:'천사카드 +1 😇'                       },
    { key:'SALARY_ALL',  title:'급여날',   text:'전원 +2,000P',            amount: 2000  },
    { key:'TAX_ALL',     title:'세금징수', text:'전원 -2,000P',            amount:-2000  },
  ],

  /* ── 보드 그리드 배치 (CSS grid area) ──── */
  // [row, col]  1-indexed for CSS grid
  GRID_POS: {
    // 상단 행 (row 1, col 1~12)
    0:  [1,1],  1:  [1,2],  2:  [1,3],  3:  [1,4],
    4:  [1,5],  5:  [1,6],  6:  [1,7],  7:  [1,8],
    8:  [1,9],  9:  [1,10], 10: [1,11], 11: [1,12],
    // 우측 열 (row 2~7, col 12)
    12: [2,12], 13: [3,12], 14: [4,12], 15: [5,12],
    16: [6,12], 17: [7,12],
    // 하단 행 (row 8, col 12~1 역순)
    18: [8,12], 19: [8,11], 20: [8,10], 21: [8,9],
    22: [8,8],  23: [8,7],  24: [8,6],  25: [8,5],
    26: [8,4],  27: [8,3],  28: [8,2],  29: [8,1],
    // 좌측 열 (row 7~2, col 1 역순)
    30: [7,1],  31: [6,1],  32: [5,1],  33: [4,1],
    34: [3,1],  35: [2,1],
  },

  /* ── 게임 설명 텍스트 ──────────────────── */
  RULES: {
    basic: {
      title: '기본 규칙',
      lines: [
        '주사위 2개를 던져 나온 합만큼 이동합니다.',
        '빈 땅에 도착하면 구매할 수 있습니다.',
        '다른 사람의 땅에 도착하면 통행료를 냅니다.',
        '출발을 지나가면 급여를 받습니다.',
        '더블이 나오면 한 번 더 던질 수 있습니다!',
        '3번 연속 더블이 나오면 감옥행!',
        '돈이 없으면 파산! 마지막 1인이 승리!',
      ]
    },
    building: {
      title: '건물 시스템',
      lines: [
        '자기 땅에 도착하면 건물을 지을 수 있습니다.',
        '땅 → 별장(🏠) → 빌딩(🏢) → 호텔(🏨)',
        '통행료: 땅 1배 / 별장 2배 / 빌딩 3배 / 호텔 4배',
        '건설비: 땅 1배 / 별장 1.5배 / 빌딩 2배 / 호텔 2.5배',
        '같은 색 그룹을 모두 소유하면 통행료 1.5배 추가!',
      ]
    },
    event: {
      title: '이벤트',
      lines: [
        '이벤트 칸에 도착하면 랜덤 카드를 뽑습니다.',
        '💰 돈을 받거나 잃을 수 있습니다.',
        '🚀 특정 칸으로 이동하거나 뒤로 갈 수 있습니다.',
        '🏗 건물이 파괴되거나 무료 건설 기회를 얻습니다.',
        '🛡 유용한 아이템을 획득할 수 있습니다.',
      ]
    },
    item: {
      title: '아이템',
      lines: [
        '🛡 방어막 — 통행료를 1회 면제합니다.',
        '😇 천사카드 — 감옥에서 즉시 탈출합니다.',
      ]
    },
    special: {
      title: '특수 칸',
      lines: [
        '⭐ 출발 — 지나가면 급여 획득, 도착하면 2배!',
        '🏝 무인도 — 3턴 쉬어갑니다. 더블 나오면 탈출!',
        '✈ 세계여행 — 원하는 SIG 칸으로 이동!',
        '⛓ 감옥 — 3턴 쉬거나 보석금 지불 또는 더블 탈출!',
      ]
    },
  },
};
