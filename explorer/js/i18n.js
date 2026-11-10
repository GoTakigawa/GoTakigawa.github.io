// JA / EN switch. The UI is written in Japanese; in English mode every text node / title / aria-label that reaches the DOM is
// translated here (exact match first, then sentence patterns, then phrase-by-phrase). Switching language reloads the page.
const KEY = 'gti-explorer:lang';
const JA_RE = /[぀-ヿ一-鿿＀-￯　-〿]/;

export const LANG = (() => {
  try { const s = localStorage.getItem(KEY); if (s === 'ja' || s === 'en') return s; } catch (e) {}
  return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
})();
export const setLang = l => { try { localStorage.setItem(KEY, l); } catch (e) {} location.reload(); };

// ── exact strings ──
const EX = {
  'ギターカスタム / リペア料金表': 'Guitar custom / repair pricing',
  'スケール・コード・単音のポジションを、チューニングや範囲の条件を変えながら確認できる指板ツールです。': 'A fretboard tool to check the positions of scales, chords and single notes while changing the tuning and range.',
  'テーマ・色': 'Theme & colors', 'テーマ': 'Theme', 'ダーク': 'Dark', 'ライト': 'Light', '端末に合わせる': 'Match device',
  'アクセントカラー（ボタン・選択中の表示）': 'Accent color (buttons, selected items)', '自由に選ぶ': 'Custom', '既定に戻す': 'Reset to default',
  'サブカラー（青系：見出し・枠・コードトーン）': 'Sub color (blue: headings, frames, chord tones)',
  'サブカラー（緑系：ルート音・OK表示）': 'Sub color (green: root notes, OK mark)',
  '背景色（ダーク／ライトそれぞれに保存）': 'Background (saved for dark / light separately)',
  'テンプレート（モード・色・背景をまとめて切り替え）': 'Templates (mode, colors and background together)',
  '既定': 'Default', 'ミッドナイト': 'Midnight', 'フォレスト': 'Forest', 'サンセット': 'Sunset', 'ローズ': 'Rose', 'モノクロ': 'Monochrome',
  'ペーパー': 'Paper', 'サンド': 'Sand', 'ミント': 'Mint', 'すべて初期設定に戻す': 'Reset everything',
  'パープル（既定）': 'Purple (default)', 'パープル': 'Purple', 'レッド': 'Red', 'オレンジ': 'Orange', 'イエロー': 'Yellow', 'グリーン': 'Green',
  'シアン': 'Cyan', 'ブルー': 'Blue', 'ピンク': 'Pink', 'チャコール': 'Charcoal', 'スレート': 'Slate', 'ネイビー': 'Navy', 'ブラウン': 'Brown',
  'ワイン': 'Wine', 'ホワイト': 'White', 'グレー': 'Gray', 'スカイ': 'Sky', 'クリーム': 'Cream', 'ラベンダー': 'Lavender',
  '楽器': 'Instrument', 'ギター': 'Guitar', 'ベース': 'Bass', '弦数': 'Strings', 'チューニング': 'Tuning', 'カスタム': 'Custom',
  'フレット数': 'Frets', '左利き表示': 'Left-handed',
  'マイナスフレット（ロー側に伸ばしたフレット）': 'Minus frets (frets extended toward the headstock)',
  '開放弦より低い音を、ナットの手前（ヘッド側）に伸ばしたフレットとして表示します。弦ごとに本数を決められます。': 'Notes lower than the open string are shown as frets extended past the nut (headstock side). The number can be set per string.',
  'スケール': 'Scale', 'コード': 'Chord', '単音': 'Single note', 'ルート（中心の音）': 'Root (center note)', '最低弦に合わせる': 'Match lowest string',
  '▶ 再生': '▶ Play', '5（パワー）': '5 (power)', 'メジャー': 'Major', '4度堆積': 'Quartal',
  '探したい音（複数選べます）': 'Notes to look for (pick several)', '選択をクリア': 'Clear selection',
  '全体': 'All', 'フレット範囲': 'Fret range', 'ポジション型': 'Position shapes', '開始フレット': 'Start fret', '終了フレット': 'End fret',
  '← 1フレット低く': '← 1 fret lower', '1フレット高く →': '1 fret higher →',
  '3音ずつ弦を上がっていく3NPS型です。最低弦の開始音で切り替えます。': 'A 3-notes-per-string shape that climbs the strings. Switch it by the starting note on the lowest string.',
  '範囲外の音も薄く表示': 'Show out-of-range notes faintly',
  'ポジション型はスケールのみ。5音のスケールは2音ずつ、7・8音は3音ずつ弦を上がる型です。': 'Position shapes are for scales only. 5-note scales use 2 notes per string; 7- and 8-note scales use 3.',
  '押すと表示を切り替え': 'Click to toggle', 'すべての弦を表示': 'Show all strings',
  '音名': 'Note names', '音程': 'Intervals', '番号': 'Numbers', 'なし': 'None', '初期状態に戻す': 'Reset',
  '☕ コーヒーを作者に奢る': '☕ Buy me a coffee', '💳 カードで応援する': '💳 Support via card', 'か所': 'positions',
  '弾いている音と位置をリアルタイム表示': 'Show the notes you play and their positions in real time',
  'ギター入力をオンにする': 'Turn guitar input on', 'ギター入力をオフにする': 'Turn guitar input off', '停止中': 'Stopped', '入力中': 'Listening',
  '入力の種類': 'Input type', '自動': 'Auto', '入力デバイス（オーディオインターフェースはここで選びます）': 'Input device (choose your audio interface here)',
  '既定の入力': 'Default input', '入力デバイス': 'Input device', '基準音 A4（Hz）': 'Reference pitch A4 (Hz)', '指板に位置を表示': 'Show position on fretboard',
  'ギター入力をオンにして、ギターを弾いてください。音声はこのページの中で処理するだけで、どこにも送られません。': 'Turn guitar input on and play. Audio is processed inside this page only and is never sent anywhere.',
  '生音（クリーンな音）のほうが、音程やコードを認識しやすくなります。': 'A clean (dry) signal makes pitch and chord recognition easier.',
  'メーター': 'Meter', 'ストロボ': 'Strobe', 'コード認識': 'Chord recognition',
  'コードを鳴らすと、聞こえた音とコード名の候補を出します。': 'Play a chord and the heard notes and chord-name candidates will appear.',
  '弾いた音の履歴': 'Played-note history', '再生': 'Play', 'スケールを推定': 'Estimate scale', 'クリア': 'Clear', '停止': 'Stop',
  'ギター入力にエフェクトをかけて聞く': 'Hear your guitar input through effects',
  '初期状態は「入力のみ」で、音は出ません。モニターを始めたときだけ、エフェクトを通した音が出ます（音程の認識には、エフェクト前の音を使います）。': 'By default it is "input only" and no sound is played. Sound with effects is output only while monitoring (pitch recognition uses the sound before the effects).',
  'モニターを始める': 'Start monitoring', 'モニターを止める': 'Stop monitoring', '出力しない（入力のみ）': 'No output (input only)', '出力レベル': 'Output level',
  'ハウリング検知': 'Feedback guard', '出力先': 'Output', '既定の出力': 'Default output', 'モニターを始める前に': 'Before you start monitoring',
  'ギターやマイクの近くにあるスピーカーから音を出すと、その音を拾って「キーン」と鳴り続けること（ハウリング）があります。ヘッドホン、またはモニタースピーカー（ギターから離れた位置・向き）でお使いください。ノートPCの内蔵スピーカーは、おすすめしません。最初は、出力レベルを低めにしておくと安心です。': 'If sound comes out of a speaker near your guitar or mic, it can be picked up again and ring on (feedback). Please use headphones or monitor speakers (placed away from the guitar and facing away). Laptop built-in speakers are not recommended. Start with a low output level to be safe.',
  'ヘッドホン／モニタースピーカーで始める': 'Start with headphones / monitor speakers', 'やめる': 'Cancel',
  'ノイズゲート': 'Noise gate', 'しきい値': 'Threshold', 'コンプ': 'Comp', 'レシオ': 'Ratio', 'アタック': 'Attack', 'リリース': 'Release', '出力': 'Output',
  'オーバードライブ': 'Overdrive', 'ドライブ': 'Drive', 'トーン': 'Tone', 'レベル': 'Level', 'ディストーション': 'Distortion', 'アンプシミュ': 'Amp sim',
  'ミドル': 'Mid', 'トレブル': 'Treble', 'ゲイン': 'Gain', 'ワイド': 'Width', 'クリーン': 'Clean', '歪み': 'Drive', '既定IR': 'Default IR', 'ユーザーIR': 'User IR',
  'ディレイ': 'Delay', 'タイム': 'Time', 'リピート': 'Repeat', 'ミックス': 'Mix', 'リバーブ': 'Reverb', '長さ': 'Length', 'ブライト': 'Bright',
  'ルーム': 'Room', 'ホール': 'Hall', 'プレート': 'Plate', 'スプリング': 'Spring', 'セッティング': 'Settings', 'サンプル': 'Sample', '保存': 'Save',
  'エフェクトの設定を初期化': 'Reset effect settings', '並び：プラグイン式（左→右）': 'Order: plugin style (left → right)', '並び：実機式（右→左）': 'Order: hardware style (right → left)',
  'つまみ・フェーダーは上下にドラッグ（ダブルクリックで初期値）。◀ ▶ で順番を入れ替えられ、IN側から順に通ります。': 'Drag knobs and faders up / down (double-click for the default). Use ◀ ▶ to reorder; the signal passes from the IN side in order.',
  '▶ 表示中の音を鳴らす': '▶ Play shown notes', '押したとき': 'On click', '鳴らす': 'Play', '隠す': 'Hide', '選ぶ': 'Pick', '表示': 'Show',
  'すべて隠す': 'Hide all', 'すべて表示': 'Show all', '選択': 'Selection', '選択を解除': 'Clear selection', 'ルート': 'Root',
  '強調・コードの構成音': 'Emphasis / chord tones', 'スケール・対象の音': 'Scale / target notes', '隠している位置': 'Hidden positions', '選んだ音': 'Picked notes',
  '押すと強調': 'Click to emphasize', '押すと隠す': 'Click to hide', '1・3・5 を強調': 'Emphasize 1, 3, 5', '強調を解除': 'Clear emphasis',
  '音を押すと、その音を紫で強調します（もう一度押すと解除）。': 'Click a note to emphasize it in purple (click again to clear).',
  'ダイアトニックコードを重ねる': 'Overlay diatonic chords', '4和音にする': 'Use 7th chords',
  '押すとそのコードの構成音を紫で強調し、Shapes の対象にもなります。もう一度押すと解除します。': 'Click to emphasize that chord\'s tones in purple; it also becomes the Shapes target. Click again to clear.',
  '10件': '10 items', 'Show の設定に戻す': 'Back to the Show settings', '形の選択を解除': 'Clear shape selection', '対象：': 'Target:',
  'コードフォーム': 'Chord forms', '転回形': 'Inversions', 'スウィープ': 'Sweeps', '検索（選んだ音から）': 'Search (from picked notes)',
  '音の選び方': 'Note selection', 'コードトーンすべて': 'All chord tones', 'パワーコード系（3度抜き）': 'Power-chord style (no 3rd)',
  '使う弦の本数': 'Number of strings', '自動（音の数）': 'Auto (number of notes)', '2本': '2 strings', '3本': '3 strings', '4本': '4 strings', '5本': '5 strings', '6本': '6 strings',
  '使う弦の組': 'String set', 'すべて': 'All', '押さえる幅': 'Fret span', '3フレット以内': 'Within 3 frets', '4フレット以内': 'Within 4 frets', '5フレット以内': 'Within 5 frets',
  '6フレット以内': 'Within 6 frets', '7フレット以内': 'Within 7 frets', '開放弦を使う': 'Use open strings', '押さえやすい形だけ': 'Easy-to-play shapes only', 'ノート数': 'Number of notes',
  '3音': '3 notes', '4音': '4 notes', '5音': '5 notes', '6音': '6 notes', '7音': '7 notes', '8音': '8 notes', '9音': '9 notes', '10音': '10 notes', '11音': '11 notes', '12音': '12 notes',
  '一般的な形だけ': 'Common shapes only', '1弦まで上がる形だけ': 'Shapes reaching the 1st string only', 'ルートから始まる形だけ': 'Shapes starting on the root only',
  '▶ 鳴らす': '▶ Play', 'スケール候補': 'Scale candidates',
  '一般的なコードフォーム（E型・A型・D型・C型・G型など）を、いまのチューニングに置き直して並べています。7・8弦では上の6本で作ります。': 'Common chord forms (E, A, D, C and G shapes etc.) are re-mapped to the current tuning. On 7- and 8-string instruments they are built on the upper 6 strings.',
  'カードの見かた': 'How to read the cards',
  'カードの見かた：': 'How to read the cards:',
  '図は上が1弦で、緑がルート、紫がほかのコードトーン。スウィープは番号が弾く順です。その下にコード名、コードトーン（1弦から順。スウィープは弾く順）、位置、TAB（低い弦から順、x はミュート）。カードを押すと、指板にコードトーンで表示して鳴らします。': 'In the diagram the top is the 1st string; green is the root and purple the other chord tones. For sweeps the numbers show the playing order. Below it: chord name, chord tones (from the 1st string; in playing order for sweeps), position and TAB (from the low string; x = muted). Click a card to show the chord tones on the fretboard and play them.',
  'コード進行・スケール進行を流して、指板を追従させる': 'Play chord / scale progressions and let the fretboard follow',
  'コード進行': 'Chord progression', 'プリセット': 'Presets', 'スケール進行': 'Scale progression',
  'I – V – vi – IV（ポップスの王道）': 'I – V – vi – IV (pop staple)', 'I – vi – IV – V（50年代）': 'I – vi – IV – V (50s)', 'ii – V – I（ジャズ）': 'ii – V – I (jazz)',
  'I – vi – ii – V（ターンアラウンド）': 'I – vi – ii – V (turnaround)', 'I – ♭VII – IV – I（ロック）': 'I – ♭VII – IV – I (rock)',
  'i – ♭VII – ♭VI – V（マイナー／メタル）': 'i – ♭VII – ♭VI – V (minor / metal)', 'i – iv – v – i（マイナー）': 'i – iv – v – i (minor)',
  'アンダルシア（vi – V – IV – III）': 'Andalusian (vi – V – IV – III)', 'カノン進行（8小節）': 'Canon progression (8 bars)', '12小節ブルース': '12-bar blues',
  'ブルース（I – IV – I – V）': 'Blues (I – IV – I – V)', 'マイナー（Aeolian ↔ Phrygian）': 'Minor (Aeolian ↔ Phrygian)', 'ダイアトニック・モード（7小節）': 'Diatonic modes (7 bars)',
  'マイナーペンタ（I – ♭VII – ♭VI – V）': 'Minor pentatonic (I – ♭VII – ♭VI – V)',
  'テンポ': 'Tempo', '拍子（拍）': 'Time signature (beats)', 'ループ': 'Loop', 'カウントイン': 'Count-in', 'ドラム・クリック': 'Drum / click', '音色': 'Sound',
  'ピアノ': 'Piano', 'オルガン': 'Organ', 'コードの鳴らし方': 'Chord playback', 'ストラム': 'Strum', 'アルペジオ': 'Arpeggio', 'ルートのみ': 'Root only', '鳴らさない': 'Off',
  'スケールのガイド音': 'Scale guide notes', 'ルートを鳴らす': 'Play the root', 'ポジションも追従': 'Follow positions too',
  'メトロノーム': 'Metronome', '8ビート': '8-beat', '4つ打ち': 'Four on the floor', '16ビート': '16-beat', 'シャッフル': 'Shuffle', '空': 'Empty', '編集済み': 'Edited',
  '音価': 'Note value', '8分': '8th', '8分3連': '8th triplet', '16分': '16th', '16分3連': '16th triplet', '32分': '32nd', 'パターンの長さ（小節）': 'Pattern length (bars)',
  'スウィング': 'Swing', 'なし（ストレート）': 'Off (straight)', '8分の裏を跳ねる': 'Swing the 8th offbeats', '16分の裏を跳ねる': 'Swing the 16th offbeats', '強さ（％）': 'Amount (%)',
  '＝ストレート': '= straight', '＝3連の中抜き': '= triplet feel', '＝付点（強いハネ）': '= dotted (hard swing)',
  '＋ 楽器を追加': '+ Add instrument', 'クラッシュ': 'Crash', 'ライド': 'Ride', 'ハット（オープン）': 'Hi-hat (open)', 'ハット': 'Hi-hat', 'ハイタム': 'High tom', 'ロータム': 'Low tom',
  'フロアタム': 'Floor tom', 'スネア': 'Snare', 'キック': 'Kick', 'クリック': 'Click', 'ウッドブロック': 'Wood block', 'ハイハット': 'Hi-hat', 'リムショット': 'Rim shot',
  'MIDI を書き出す': 'Export MIDI', '共有リンクをコピー': 'Copy share link',
  '出された音をギターで弾いて答える': 'Answer by playing the shown note on your guitar', '出題': 'Questions', '音名（スケール内のみ）': 'Note name (within the scale)',
  '音名（全音程）': 'Note name (all 12)', '度数（いまのキーで）': 'Degree (in the current key)', 'インターバル': 'Interval', '問題数': 'Number of questions',
  'クイズを始める': 'Start quiz', 'やめる ': 'Quit', 'いま選んでいるルートとスケールの構成音が出ます。': 'Notes from the current root and scale are asked.',
  '「クイズを始める」を押すと、ギター入力が入って出題が始まります。': 'Press "Start quiz" to turn on guitar input and begin.', 'わからない（答えを見る）': 'Skip (show the answer)',
  '設定はこのブラウザに自動保存されます。音名はキーに合わせて ♭・♯ を書き分けています。': 'Settings are saved automatically in this browser. Note names use ♭ / ♯ according to the key.',
  'ブロックの並びと開閉を初期状態に戻す': 'Reset block order and open / closed state',
  '1弦のマイナスフレット': 'String 1 minus frets', '2弦のマイナスフレット': 'String 2 minus frets', '3弦のマイナスフレット': 'String 3 minus frets',
  '4弦のマイナスフレット': 'String 4 minus frets', '5弦のマイナスフレット': 'String 5 minus frets', '6弦のマイナスフレット': 'String 6 minus frets',
  '表示する対象': 'What to show', '最低弦の開放音をルートにする': 'Use the lowest open string as the root', 'このスケールを再生（上って、戻る）': 'Play this scale (up and back)', 'スケールを再生': 'Play scale',
  '表示する範囲': 'Range to show', '上げる': 'Raise', '下げる': 'Lower', '前のパターン': 'Previous pattern', 'パターン': 'Pattern', '次のパターン': 'Next pattern',
  '丸の中に表示する文字': 'Label inside the dots', 'ドラッグで並べ替え（キーボードは↑↓）': 'Drag to reorder (↑ ↓ on keyboard)', 'ブロックを移動': 'Move block',
  '入力の大きさ': 'Input level', '単音かコードかを聞き分けて、自動で切り替えます': 'Detects single notes vs chords and switches automatically',
  '単音だけを認識します（コードは認識しません）': 'Recognizes single notes only (no chords)', '常にコードとして認識します（試作）': 'Always recognizes chords (experimental)',
  'チューナーの表示': 'Tuner display', 'ストロボ表示': 'Strobe display', 'スペクトラム': 'Spectrum', 'ゴニオメーター': 'Goniometer',
  'ノイズゲートのオン・オフ': 'Noise gate on / off', '左へ': 'Move left', '右へ': 'Move right', 'コンプのオン・オフ': 'Comp on / off',
  'オーバードライブのオン・オフ': 'Overdrive on / off', 'ディストーションのオン・オフ': 'Distortion on / off',
  'キャビネットIRの切り替え（ユーザーIRはファイルを読み込みます）': 'Switch cabinet IR (User IR loads a file)', 'アンプシミュのオン・オフ': 'Amp sim on / off', 'EQのオン・オフ': 'EQ on / off',
  'ディレイのオン・オフ': 'Delay on / off', 'リバーブの種類': 'Reverb type', 'リバーブのオン・オフ': 'Reverb on / off',
  '空き（クリックで選択）': 'Empty (click to select)', 'サンプルの設定を呼び出します（初期値・1〜3とは別）': 'Load the sample setting (separate from the defaults and slots 1–3)',
  '選んでいるスロットに、今の設定（ペダルの順番・オンオフ・つまみ）を保存します': 'Save the current setting (pedal order, on / off, knobs) to the selected slot',
  '指板図を PNG 画像で保存': 'Save the fretboard as a PNG image', '指板図を PDF で保存': 'Save the fretboard as a PDF', '指板の操作': 'Fretboard actions', '指板を押したときの動作': 'Action when a fretboard position is clicked',
  '音を押したときの動作': 'Action when a note is clicked', '形の種類': 'Shape type', 'スケール推測のルート': 'Root for scale search',
  '例: Am7 D7 Gmaj7 Cmaj7　／　I V vi IV　／　Am7 D7 | Gmaj7 Cmaj7': 'e.g. Am7 D7 Gmaj7 Cmaj7  /  I V vi IV  /  Am7 D7 | Gmaj7 Cmaj7',
  '例: A Dorian | D Mixolydian | G Lydian | C Ionian': 'e.g. A Dorian | D Mixolydian | G Lydian | C Ionian',
  'コード進行のプリセット': 'Chord progression presets', 'スケール進行のプリセット': 'Scale progression presets', '小節': 'bar', 'この小節から再生': 'Play from this bar',
  'テンポを上げる': 'Raise tempo', 'テンポを下げる': 'Lower tempo', '1小節の拍数': 'Beats per bar', '増やす': 'Increase', '減らす': 'Decrease', 'パターンのひな形': 'Pattern template',
  '楽器を追加': 'Add instrument', '前の小節へ': 'Previous bars', '次の小節へ': 'Next bars', 'この楽器を外す': 'Remove this instrument', 'クリックを外す': 'Remove click',
  'いまの進行を MIDI ファイルで保存': 'Save the progression as a MIDI file', '進行・テンポ・楽器の設定を含むリンクをコピー': 'Copy a link that includes progression, tempo and instrument settings',
  '音量': 'Volume', 'ミュート': 'Mute', '更新する': 'Update', '新しいバージョンがあります': 'A new version is available',
  '2.0秒': '2.0 s', '日本語': '日本語', '指定なし': 'Not set', '最低音': 'Lowest note', '指板で選んだ音': 'Notes picked on the fretboard', '開放': 'open',
  '3種類以上の音を選ぶと、それを含むスケールを推測します。': 'Pick 3 or more different notes to estimate scales that contain them.',
  '押した音を指板から隠します（もう一度押すと戻ります）。点線の丸は隠している位置です。': 'Click a note to hide it from the fretboard (click again to restore). Dotted circles are hidden positions.',
  '押した音を選びます。Shapes の「検索」に推測したコードが出ます': 'Click to pick notes. The estimated chord appears under "Search" in Shapes.',
  '指板の上で音を押して選ぶと（もう一度押すと外れます）、何のコードになっているかを推測します。いちばん低い音をベースとして扱い、ルートと違う場合は分数コードで表示します。': 'Pick notes on the fretboard (click again to remove) and the chord they form is estimated. The lowest note is treated as the bass and shown as a slash chord when it differs from the root.',
  '指板の上で音を押して選んでください（もう一度押すと外れます）。': 'Pick notes on the fretboard (click again to remove).',
  '選んだ音です。最初に選んだ音を基準に音程を表示します。': 'The picked notes. Intervals are shown relative to the first note you picked.',
  '※ダイアトニックで選んだコードに切り替わります': '* Switches to the chord chosen in the diatonic row',
  'ii – V – I（Dorian → Mixolydian → Ionian）': 'ii – V – I (Dorian → Mixolydian → Ionian)', 'I – IV – V（Mixolydian）': 'I – IV – V (Mixolydian)',
  'モニター中（ヘッドホン／モニタースピーカー推奨）': 'Monitoring (headphones / monitor speakers recommended)',
  'ダイアトニックコードを重ねています。解除すると、音を押して強調を自由に選べます。': 'Diatonic chords are overlaid. Clear them to pick emphasized notes freely.',
  'このコードの形を見る': 'See shapes for this chord', 'スケール音': 'scale tone', 'スケール外': 'outside the scale',
  'スケール表示にすると、そのスケールに合うコードで解釈します。': 'Switch to scale display and chords are interpreted within that scale.',
  'をルートとすると、': 'as the root,',
  'このコードは定番フォームの登録がないため、E型・A型などの基本フォームの音を近いコードトーンへずらして作った形（変形）を並べています。7・8弦では上の6本で作ります。': 'This chord has no registered standard forms, so these are variants of basic forms (E, A shapes etc.) with notes shifted to nearby chord tones. On 7- and 8-string instruments they are built on the upper 6 strings.',
  'パワーコード系：3度（短3度）を抜いて、ルート・5度とあれば7度などの音だけで隣り合う弦に置いた形です。3本ならルート・5度・ルート（またはその転回）の形になり、低音弦側から並べています。「使う弦の本数」を増やすと、同じ音をオクターブで重ねた形も出ます。': 'Power-chord style: the 3rd is left out and only the root, 5th (and 7th if present) are placed on adjacent strings. With 3 strings you get root–5th–root (or an inversion), listed from the low strings. Increase "Number of strings" to also get shapes that double notes in octaves.',
  '転回形：隣り合う弦に構成音を重ねずに置いた形です。どの音が一番下・一番上に来るかの違いで並びます（3和音ならトライアドの転回形、4和音ならクローズやドロップ2・3の形）。「使う弦の本数」を音の数より増やすと、同じ音を重ねた形（たとえば3和音を2〜5弦の4本で）も出ます。高音弦側から並べています。': 'Inversions: shapes with the chord tones placed on adjacent strings without doubling. They are ordered by which note is lowest / highest (triad inversions for 3-note chords; close and drop-2 / drop-3 shapes for 4-note chords). Increase "Number of strings" beyond the number of notes to also get shapes with doubled notes (e.g. a triad on 4 strings). Listed from the high strings.',
  '5音以上のコードは、5度・9度・11度の順に省いて4音にしています。': 'For chords of 5 or more notes, the 5th, 9th and 11th are dropped in that order to make 4 notes.',
  'コードトーンを順番に1弦1〜2音ずつ上がっていくスウィープの形です。高音弦側から並べ、同じ弦の範囲では一般的な形を先頭にしています。': 'Sweep shapes that climb through the chord tones 1–2 notes per string. Listed from the high strings; within the same string range the common shapes come first.',
  '定番': 'Standard', 'このスケールを再生': 'Play this scale', '連続正解': 'Best streak', '連続': 'streak', '平均（秒）': 'Avg (sec)',
  'コードトーンを順番に1弦1〜2音ずつ上がっていくスウィープの形です。高音弦側から並べ、同じ弦の範囲では一般的な形（コードフォームの範囲に収まる・ルートから始まる・幅が狭い）を先にしています。番号が弾く順番です。': 'Sweep shapes that climb through the chord tones 1–2 notes per string. Listed from the high strings; within the same string range common shapes (fitting a chord form, starting on the root, narrow span) come first. Numbers show the playing order.',
  'コードトーンを順番に1弦1〜2音ずつ上がっていくスウィープの形です。高音弦側から並べ、同じ弦の範囲では一般的な形（コードフォームの範囲に収まる・ルートから始まる・幅が狭い）を先にしています。「一般的な形だけ」をオフにすると、ほかの形も出ます。番号が弾く順番です。': 'Sweep shapes that climb through the chord tones 1–2 notes per string. Listed from the high strings; within the same string range common shapes (fitting a chord form, starting on the root, narrow span) come first. Turn off "Common shapes only" to see other shapes too. Numbers show the playing order.',
  // scale group names
  'モード': 'Modes', 'メロディックマイナー系': 'Melodic minor family', 'ハーモニック系': 'Harmonic family', '民族（中東・東欧）': 'World (Middle East / Eastern Europe)',
  '民族（インド）': 'World (India)', '民族（日本・アジア）': 'World (Japan / Asia)', 'ペンタ・ブルース': 'Pentatonic / Blues', '対称・その他': 'Symmetric / other',
  // chord / interval names
  'ユニゾン/オクターブ': 'Unison / octave', '短2度': 'minor 2nd', '長2度': 'major 2nd', '短3度': 'minor 3rd', '長3度': 'major 3rd', '完全4度': 'perfect 4th', '増4度/減5度': 'aug 4th / dim 5th',
  '増4度（減5度）': 'aug 4th (dim 5th)', '完全5度': 'perfect 5th', '短6度': 'minor 6th', '長6度': 'major 6th', '短7度': 'minor 7th', '長7度': 'major 7th', '完全8度': 'perfect octave',
  '4和音': '7th chord', '3和音': 'triad', 'テンション': 'tension', 'スケール音': 'scale tone',
  '（ルートなし）': ' (no root)', '（5度省略）': ' (no 5th)', '（3度抜き）': ' (no 3rd)', '（オクターブ以上離れています）': ' (an octave or more apart)',
  'E型': 'E shape', 'A型': 'A shape', 'D型': 'D shape', 'C型': 'C shape', 'G型': 'G shape',
  '6弦ルート': '6th-string root', '5弦ルート': '5th-string root', '4弦ルート': '4th-string root',
};

// ── sentence patterns (first match wins) ──
const PAT = [
  [/^((\d+)弦(\d+))( \d+弦\d+)*$/, m => m[0].replace(/(\d+)弦(\d+)/g, 's$1f$2')],
  [/^(.+)・(.+)型$/, (m, a, b) => `${a} · ${b} shape`],
  [/^(.+)型（変形）$/, (m, a) => `${a} shape (variant)`],
  [/^すべて表示（(音\d+)?(・)?(位置\d+)?）$/, (m, a, d, b) => `Show all (${a ? a.replace('音', '') + ' notes' : ''}${d ? ' · ' : ''}${b ? b.replace('位置', '') + ' positions' : ''})`],
  [/^は (.+)。$/, (m, a) => `is ${tr(a)}.`],
  [/^(.+) では、(.+) はスケール外、(.+) はスケール(音|外の音)です。$/, (m, s, r, h, k) => `In ${s}, ${r} is outside the scale and ${h} is ${k === '音' ? 'a scale tone' : 'not in the scale'}.`],
  [/^(.+) では、(.+) は (.+)、(.+) はスケール(音|外の音)です。$/, (m, s, r, d, h, k) => `In ${s}, ${r} is ${tr(d)} and ${h} is ${k === '音' ? 'a scale tone' : 'not in the scale'}.`],
  [/^ダイアトニックコード(（(.+)）)?$/, (m, a, d) => `Diatonic chords${d ? ' (' + d + ')' : ''}`],
  [/^(ほかにスケールに合うコード|上の音を含むコード)（(.+) がルート）$/, (m, k, r) => `${k === 'ほかにスケールに合うコード' ? 'Other chords that fit the scale' : 'Chords containing the upper note'} (${r} as root)`],
  [/^(\d+)音（(.*)）です。低い方をルートとして読んでいます。(.*)$/, (m, n, iv, rest) => `${n} notes (${tr(iv)}). The lower one is read as the root. ${tr(rest)}`],
  [/^入力を開始できませんでした：(.*)$/, (m, e) => `Could not start input: ${e}`],
  [/^(.+)に切り替えました$/, (m, x) => `Switched to ${x}`],
  [/^(\d+)音ずつ弦を上がっていく$/, (m, n) => `Climbing ${n} notes per string`],
  [/^(\d+)〜(\d+)弦スウィープ（(.+)）$/, (m, a, b, s) => `${a}–${b} string sweep (${tr(s)})`],
  [/^(\d+)弦スウィープ（(.+)）$/, (m, a, s) => `${a}-string sweep (${tr(s)})`],
  [/^(.+) · (\d+)音 · (.+)$/, (m, a, n, r) => `${tr(a)} · ${n} notes · ${tr(r)}`],
  [/^(\d+)–(\d+)弦$/, (m, a, b) => `Strings ${a}–${b}`],
  [/^(\d+)弦$/, (m, n) => `String ${n}`],
  [/^(\d+)〜(\d+)弦$/, (m, a, b) => `Strings ${a}–${b}`],
  [/^(\d+)弦 (\d+)f$/, (m, s, f) => `S${s} ${f}f`],
  [/^(\d+)フレット$/, (m, n) => `${n} frets`],
  [/^(\d+)〜(\d+)フレット$/, (m, a, b) => `Frets ${a}–${b}`],
  [/^(\d+)本$/, (m, n) => `${n} strings`],
  [/^(\d+)音$/, (m, n) => `${n} notes`],
  [/^(\d+)件$/, (m, n) => `${n} items`],
  [/^300件以上$/, () => '300+ items'],
  [/^(\d+)小節$/, (m, n) => `${n} bars`],
  [/^パターン (\d+)（(.+) から）$/, (m, n, r) => `Pattern ${n} (from ${r})`],
  [/^パターン (\d+)（(.+)）$/, (m, n, r) => `Pattern ${n} (${r})`],
  [/^([\d.]+)秒$/, (m, n) => `${n} s`],
  [/^(.+) [·・] (\d+)弦$/, (m, a, n) => `${a} · ${n} strings`],
  [/^(.+)型(（(\d)弦）)?$/, (m, a, b, n) => `${a} shape${n ? ' (' + n + ' str)' : ''}`],
  [/^構成音：(.*)$/, (m, x) => `Chord tones: ${x}`],
  [/^(.+) から$/, (m, r) => `from ${r}`],
  [/^(\d+)弦のマイナスフレット$/, (m, n) => `String ${n} minus frets`],
  [/^クリック (\d+)小節 (\d+)拍 (\d+)$/, (m, b, t, s) => `Click bar ${b} beat ${t} step ${s}`],
  [/^(\d+)–(\d+) 小節目 \/ 全(\d+)小節$/, (m, a, b, n) => `Bars ${a}–${b} of ${n}`],
  [/^(.+)を外す$/, (m, x) => `Remove ${x}`],
  [/^(.+)の指板$/, (m, x) => `${x} fretboard`],
  [/^(.+) の指板$/, (m, x) => `${x} fretboard`],
  [/^新しいバージョン（BETA (\d+)）があります$/, (m, n) => `A new version (BETA ${n}) is available`],
  [/^（最大 −(\d+)）$/, (m, n) => `(max −${n})`],
  [/^すべて表示（(.*)）$/, (m, x) => `Show all (${tr(x)})`],
  [/^音(\d+)$/, (m, n) => `${n} notes`],
  [/^(\d+)音ずつ弦を上がっていく(3NPS|ボックス)型です。最低弦の開始音で切り替えます。$/, (m, n, k) => `A ${k === 'ボックス' ? 'box' : '3NPS'} shape that climbs the strings ${n} notes at a time. Switch it by the starting note on the lowest string.`],
  [/^押した位置を隠します。点線の丸を押すと戻ります$/, () => 'Click a position to hide it. Click a dotted circle to bring it back.'],
  [/^押した音を指板から隠します（もう一度押すと戻ります）。点線の丸は隠している音です。$/, () => 'Click a note to hide it from the fretboard (click again to restore). Dotted circles are hidden notes.'],
  [/^コードの構成音です。押すと鳴ります。$/, () => 'The chord tones. Click to play.'],
  [/^音を選んでください$/, () => 'Pick some notes'],
  [/^1音だけ聞こえています。$/, () => 'Only one note is heard.'],
  [/^1音だけです。もう1音以上選ぶとコードを推測します。$/, () => 'Only one note. Pick one or more to estimate the chord.'],
  [/^登録しているコードの形には当てはまりませんでした。$/, () => 'No registered chord shape matches.'],
  [/^あと (\d+) 音以上弾くと、推定できます。$/, (m, n) => `Play ${n} more note${n > 1 ? 's' : ''} or more to estimate.`],
  [/^当てはまるスケールが見つかりませんでした。$/, () => 'No matching scale was found.'],
  [/^弾いた音の (\d+)% が一致 · (\d+)音中 (\d+)音を使用$/, (m, p, s, u) => `${p}% of played notes match · uses ${u} of ${s} notes`],
  [/^Show をこのスケールにする$/, () => 'Set Show to this scale'],
  [/^Show をそのスケールにしました$/, () => 'Show was set to that scale'],
  [/^(\d+)音中 (\d+)音が一致(（すべて）)?(.*)$/, (m, s, p, all, rest) => `${p} of ${s} notes match${all ? ' (all)' : ''}${rest ? tr(rest) : ''}`],
  [/^足りない音：(.*)$/, (m, x) => `Missing: ${x}`],
  [/^ほか (\d+) 件。ルートを指定すると絞り込めます。$/, (m, n) => `${n} more. Specify a root to narrow down.`],
  [/^ほか (\d+) 件$/, (m, n) => `${n} more`],
  [/^(3|2)種類以上の音を選ぶと、そのスケール候補を出します。$/, (m, n) => `Pick ${n} or more different notes to see scale candidates.`],
  [/^選んだ音をすべて含むスケールは見つかりませんでした。$/, () => 'No scale contains all of the picked notes.'],
  [/^この(.*)の定番フォームはまだ登録していません。「転回形」や「検索」を使ってください。$/, (m, x) => `No standard forms are registered for this ${x}yet. Try "Inversions" or "Search".`],
  [/^条件に合う形が見つかりませんでした。条件をゆるめてみてください。$/, () => 'No shapes match. Try loosening the conditions.'],
  [/^単音モードです。コードは認識しません。$/, () => 'Single-note mode. Chords are not recognized.'],
  [/^すべての音を隠しました。「押すと隠す」のまま、見せたい位置を押すと戻ります$/, () => 'All notes are hidden. With "Click to hide" still on, click a position to bring it back.'],
  [/^表示中の音がありません$/, () => 'No notes are shown'],
  [/^Shapes だけをそのコードに切り替えました（Show の設定と選んだ音はそのままです）$/, () => 'Only Shapes was switched to that chord (Show settings and picked notes are unchanged).'],
  [/^Shapes だけをそのコードに切り替えました（Show の設定はそのままです）$/, () => 'Only Shapes was switched to that chord (Show settings are unchanged).'],
  [/^コード進行かスケール進行を入力してください。$/, () => 'Enter a chord or scale progression.'],
  [/^進行が空です。コード進行かスケール進行を入力してください$/, () => 'The progression is empty. Enter a chord or scale progression.'],
  [/^読み取れなかった表記：(.*)$/, (m, x) => `Could not read: ${x}`],
  [/^(\d+)小節までを使います。$/, (m, n) => `Only up to ${n} bars are used.`],
  [/^度数（I、V、vi など）は、キー (.+)（Show のルート）として読み取っています。$/, (m, k) => `Roman numerals (I, V, vi …) are read in the key of ${k} (the Show root).`],
  [/^MIDI を書き出しました（(\d+)小節・(\d+) BPM）$/, (m, b, t) => `MIDI exported (${b} bars · ${t} BPM)`],
  [/^共有リンクをコピーしました（進行・テンポ・楽器の設定が入っています）$/, () => 'Share link copied (includes progression, tempo and instruments).'],
  [/^アドレスバーのリンクをコピーしてください$/, () => 'Please copy the link from the address bar.'],
  [/^共有された進行と設定を読み込みました$/, () => 'Loaded the shared progression and settings.'],
  [/^指板図を PNG で保存しました$/, () => 'Fretboard saved as PNG'], [/^指板図を PDF で保存しました$/, () => 'Fretboard saved as PDF'], [/^書き出しに失敗しました$/, () => 'Export failed'],
  [/^カウントイン…$/, () => 'Count-in…'],
  [/^第 (\d+) \/ (\d+) 問 ・ 一発正解 (\d+) ・ 連続 (\d+)$/, (m, a, b, ok, s) => `Question ${a} / ${b} · first-try ${ok} · streak ${s}`],
  [/^(.+) の (.+)度$/, (m, a, b) => `${a} ${b}`],
  [/^(.+) から (.+) 上$/, (m, a, b) => `${b} above ${a}`],
  [/^(.+)  を弾く$/, (m, a) => `Play ${a}`],
  [/^答え：(.*)$/, (m, a) => `Answer: ${a}`],
  [/^✓ 正解（(.+)秒）$/, (m, s) => `✓ Correct (${s}s)`], [/^✓ 正解（やり直し）$/, () => '✓ Correct (retry)'], [/^✗ 違います$/, () => '✗ Not quite'],
  [/^結果$/, () => 'Result'], [/^一発正解$/, () => 'First-try'], [/^平均（秒）$/, () => 'Avg (sec)'],
  [/^入力（マイク）の使用が許可されていません。.*$/, () => 'Microphone / input access is not allowed. Allow it in the browser address-bar settings and try again.'],
  [/^入力デバイスが見つかりません。.*$/, () => 'No input device found. Check the connection of your audio interface or microphone.'],
  [/^モニター中です。.*$/, () => 'Monitoring. Use headphones or monitor speakers; speakers close to the guitar can cause feedback.'],
  [/^IRファイルを読み込めませんでした。$/, () => 'Could not load the IR file.'], [/^保存したIRを読み込めませんでした。$/, () => 'Could not load the saved IR.'],
  [/^このスロットに保存したIRが、ブラウザ内に見つかりません。$/, () => 'The IR saved for this slot was not found in this browser.'],
  [/^ユーザーIRをブラウザに保存できませんでした（設定のみ保存しました）。$/, () => 'Could not store the user IR in this browser (settings were saved).'],
  [/^保存済み(（ユーザーIR：(.+)）)?（クリックで呼び出し）$/, (m, a, n) => `Saved${n ? ' (user IR: ' + n + ')' : ''} (click to load)`],
  [/^(.+)の指板$/, (m, x) => `${x} fretboard`],
  [/^(.+)（検索から選んだコード）$/, (m, x) => `${x} (chosen from search)`],
  [/^(.+) の指板$/, (m, x) => `${x} fretboard`],
];

// ── phrase glossary for what is left (longest first) ──
const PH = [
  ['構成音', 'chord tones'], ['ダイアトニックコード', 'diatonic chords'], ['ほかにスケールに合うコード', 'Other chords that fit the scale'], ['上の音を含むコード', 'Chords containing the upper note'],
  ['弦', ' str'], ['フレット', ' fret'], ['小節', ' bars'], ['から', ' from '], ['音', ' notes'],
].sort((a, b) => b[0].length - a[0].length);

export function tr(s) {
  if (LANG === 'ja' || typeof s !== 'string' || !JA_RE.test(s)) return s;
  const t = s.trim(); if (!t) return s;
  const lead = s.slice(0, s.indexOf(t)), trail = s.slice(s.indexOf(t) + t.length);
  if (EX[t] !== undefined) return lead + EX[t] + trail;
  for (const [re, fn] of PAT) { const m = re.exec(t); if (m) return lead + fn(...m) + trail; }
  // compound strings: translate each part
  for (const sep of [' · ', ' ・ ', '　', '  ', ' ／ ']) if (t.includes(sep)) { const out = t.split(sep).map(x => tr(x)).join(sep === '　' ? '  ' : sep === ' ／ ' ? ' / ' : sep); if (out !== t) return lead + out.replace(/〜/g, '–') + trail; }
  const out = t.replace(/〜/g, '–').replace(/（/g, ' (').replace(/）/g, ')').replace(/　/g, ' ').replace(/ ・ /g, ' · ');
  if (!JA_RE.test(out)) return lead + out + trail;
  return s;
}
export const T = tr;

// ── DOM walker ──
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
const seen = new WeakSet();
const doNode = n => {
  if (n.nodeType === 3) { const v = n.nodeValue; if (JA_RE.test(v)) { const r = tr(v); if (r !== v) n.nodeValue = r; } return; }
  if (n.nodeType !== 1) return;
  for (const a of ATTRS) { const v = n.getAttribute && n.getAttribute(a); if (v && JA_RE.test(v)) { const r = tr(v); if (r !== v) n.setAttribute(a, r); } }
  for (let c = n.firstChild; c; c = c.nextSibling) doNode(c);
};
export function initI18n() {
  document.documentElement.lang = LANG;
  if (LANG === 'ja') return;
  doNode(document.documentElement);
  if (document.title && JA_RE.test(document.title)) document.title = tr(document.title);
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(doNode);
      else if (m.type === 'characterData') doNode(m.target);
      else if (m.type === 'attributes') doNode(m.target);
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
