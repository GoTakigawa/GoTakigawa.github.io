// Instruments, tunings, and technique presets.
// Presets are original examples organised by technique, not transcriptions of any song.

export const TUNINGS = {
  6: [
    { id: 'e-std',  name: 'E Standard',  notes: [40,45,50,55,59,64] },
    { id: 'drop-d', name: 'Drop D',      notes: [38,45,50,55,59,64] },
    { id: 'drop-c', name: 'Drop C',      notes: [36,43,48,53,57,62] },
    { id: 'drop-b', name: 'Drop B',      notes: [35,42,47,52,56,61] },
    { id: 'drop-a6',name: 'Drop A (6)',  notes: [33,40,45,50,54,59] },
    { id: 'drop-g6',name: 'Drop G (6)',  notes: [31,38,43,48,52,57] }
  ],
  7: [
    { id: 'b-std',  name: 'B Standard',  notes: [35,40,45,50,55,59,64] },
    { id: 'drop-a', name: 'Drop A',      notes: [33,40,45,50,55,59,64] },
    { id: 'a-std',  name: 'A Standard',  notes: [33,38,43,48,53,57,62] },
    { id: 'drop-gs',name: 'Drop G#',     notes: [32,39,44,49,54,58,63] },
    { id: 'drop-g', name: 'Drop G',      notes: [31,38,43,48,53,57,62] }
  ],
  8: [
    { id: 'fs-std', name: 'F# Standard', notes: [30,35,40,45,50,55,59,64] },
    { id: 'drop-e', name: 'Drop E',      notes: [28,35,40,45,50,55,59,64] },
    { id: 'e-std8', name: 'E Standard (8)', notes: [28,33,38,43,48,53,57,62] }
  ]
};

export const findTuning = (strings, id) => (TUNINGS[strings] || TUNINGS[7]).find(t => t.id === id) || (TUNINGS[strings] || TUNINGS[7])[0];

// bars: [scale degree index, chord type]
export const PRESETS = [
  { id: 'pedal', name: '開放弦ペダル', icon: '◼', mode: 'phrygian', bpm: 120, meter: [4,4],
    bars: [[0,'5'],[1,'5'],[6,'5'],[0,'5']], grouping: '3+3+3+3+2+2',
    desc: '最低音の開放弦でチャグを続け、上のコードを i → bII → bVII と動かす。フリジアンの重さ。' },
  { id: 'lydian', name: 'リディアンの浮遊感', icon: '✧', mode: 'lydian', bpm: 96, meter: [4,4],
    bars: [[0,'eleven'],[1,'add9'],[0,'eleven'],[1,'add9']], grouping: '4+4+4+4',
    desc: 'Imaj7#11 と II メジャーの往復。#4 が開けた空気を作るクリーンパート向け。' },
  { id: 'epic', name: 'エオリアンの壮大系', icon: '▲', mode: 'aeolian', bpm: 140, meter: [4,4],
    bars: [[5,'seventh'],[6,'add9'],[0,'add9'],[0,'add9']], grouping: '2+2+2+2+2+2+2+2',
    desc: 'bVImaj7 → bVII → i。サビや大きな展開で使える、上昇していく王道の流れ。' },
  { id: 'loop', name: 'エオリアンのループ', icon: '↻', mode: 'aeolian', bpm: 128, meter: [4,4],
    bars: [[0,'58'],[5,'58'],[2,'58'],[6,'58']], grouping: '3+3+2+3+3+2',
    desc: 'i → bVI → bIII → bVII。ヴァースからサビまで回せる定番ループ。' },
  { id: 'descend', name: '下降するベース', icon: '↘', mode: 'harmonicMinor', bpm: 110, meter: [4,4],
    bars: [[0,'triad'],[6,'triad'],[5,'seventh'],[4,'triad']], grouping: '4+4+4+4',
    desc: 'ルートを半音・全音で下げていき、最後に V メジャーで中心へ引き戻す。' },
  { id: 'phrydom', name: 'フリジアンドミナント', icon: '☾', mode: 'phrygianDominant', bpm: 132, meter: [4,4],
    bars: [[0,'triad'],[1,'triad'],[0,'triad'],[6,'triad']], grouping: '3+3+2+2+2+2+2',
    desc: 'i と bII の往復に長3度の主和音。エキゾチックで攻撃的な響き。' },
  { id: 'planing', name: 'sus2 の平行移動', icon: '≡', mode: 'dorian', bpm: 104, meter: [7,8],
    bars: [[0,'sus2'],[1,'sus2'],[3,'sus2'],[1,'sus2']], grouping: '2+2+3',
    desc: '同じ sus2 の形をスケールに沿って動かす。7/8 のクリーンアルペジオ向け。' },
  { id: 'onechord', name: '1コード＋ポリメーター', icon: '◆', mode: 'phrygian', bpm: 125, meter: [4,4],
    bars: [[0,'5'],[0,'5'],[0,'5'],[0,'5']], grouping: '3+2+2+3+2+3',
    desc: 'コードは固定。15ステップのリフが16分の小節に対してずれていき、何周かで頭が揃う。' },
  { id: 'mixo', name: 'ミクソリディアンの推進力', icon: '◐', mode: 'mixolydian', bpm: 116, meter: [4,4],
    bars: [[0,'add9'],[6,'add9'],[3,'add9'],[0,'add9']], grouping: '4+2+2+4+4',
    desc: 'メジャーの響きに b7 の bVII を差し込み、明るさに力強さを足す。' }
];
