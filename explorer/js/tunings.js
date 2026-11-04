// Tunings: MIDI note of each string, low → high
export const TUNINGS = {
  6: [
    { id: 'e-std',   name: 'E Standard',   notes: [40,45,50,55,59,64] },
    { id: 'eb-std',  name: 'E♭ Standard',  notes: [39,44,49,54,58,63] },
    { id: 'd-std',   name: 'D Standard',   notes: [38,43,48,53,57,62] },
    { id: 'drop-d',  name: 'Drop D',       notes: [38,45,50,55,59,64] },
    { id: 'drop-c',  name: 'Drop C',       notes: [36,43,48,53,57,62] },
    { id: 'drop-b',  name: 'Drop B',       notes: [35,42,47,52,56,61] },
    { id: 'drop-a6', name: 'Drop A',       notes: [33,40,45,50,54,59] },
    { id: 'drop-g6', name: 'Drop G',       notes: [31,38,43,48,52,57] },
    { id: 'dadgad',  name: 'DADGAD',       notes: [38,45,50,55,57,62] },
    { id: 'open-g',  name: 'Open G',       notes: [38,43,50,55,59,62] }
  ],
  7: [
    { id: 'b-std',   name: 'B Standard',   notes: [35,40,45,50,55,59,64] },
    { id: 'drop-a',  name: 'Drop A',       notes: [33,40,45,50,55,59,64] },
    { id: 'a-std',   name: 'A Standard',   notes: [33,38,43,48,53,57,62] },
    { id: 'drop-gs', name: 'Drop G♯',      notes: [32,39,44,49,54,58,63] },
    { id: 'drop-g',  name: 'Drop G',       notes: [31,38,43,48,53,57,62] }
  ],
  8: [
    { id: 'fs-std',  name: 'F♯ Standard',  notes: [30,35,40,45,50,55,59,64] },
    { id: 'drop-e',  name: 'Drop E',       notes: [28,35,40,45,50,55,59,64] },
    { id: 'e-std8',  name: 'E Standard',   notes: [28,33,38,43,48,53,57,62] }
  ],
  4: [
    { id: 'bass-e',  name: 'Bass E Standard', notes: [28,33,38,43] },
    { id: 'bass-dd', name: 'Bass Drop D',     notes: [26,33,38,43] }
  ],
  5: [
    { id: 'bass5-b', name: 'Bass B Standard', notes: [23,28,33,38,43] }
  ]
};
export const STRING_COUNTS = [4, 5, 6, 7, 8];
export const findTuning = (n, id) => (TUNINGS[n] || TUNINGS[6]).find(t => t.id === id) || null;
const NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const midiLabel = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
