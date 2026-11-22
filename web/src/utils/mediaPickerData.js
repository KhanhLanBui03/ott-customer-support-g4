const DEFAULT_GIPHY_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GIPHY_API_KEY) ||
  'Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g';

const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest';

const makeNotoSticker = (codepoint, title, tags = [], category = 'trending') => ({
  id: `noto-${category}-${codepoint}`,
  url: `${NOTO_BASE}/${codepoint}/512.gif`,
  previewUrl: `${NOTO_BASE}/${codepoint}/512.gif`,
  title,
  tags,
  category,
});

export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    label: '😀',
    keywords: 'mat cuoi cam xuc vui buon khoc gian yeu tim face smiley happy laugh cry love angry',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
      '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
      '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
      '👺', '👻', '👽', '👾', '🤖', '🫶', '🥹', '🫠', '🫡', '🫢', '🫣', '🫥',
    ],
  },
  {
    id: 'gestures',
    label: '👋',
    keywords: 'ban tay chao like ok vo tay cam on cau nguyen hand wave clap thumbs up ok pray',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕',
      '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
      '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄',
      '🫶', '🫰', '🫵', '🫳', '🫴', '🫱', '🫲',
    ],
  },
  {
    id: 'animals',
    label: '🐶',
    keywords: 'dong vat cho meo gau tho ech khi chim ca hoa la thien nhien animal dog cat bear frog nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵',
      '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦢', '🦉', '🦩', '🦚', '🦜',
      '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🐟', '🐠', '🐡', '🦈', '🐙',
      '🐚', '🦀', '🦞', '🦐', '🦑', '🦋', '🐝', '🐞', '🌸', '🌹', '🌻', '🍀', '🌈', '⭐', '🔥', '❄️',
    ],
  },
  {
    id: 'food',
    label: '🍏',
    keywords: 'do an thuc uong trai cay banh kem ca phe bia tra sua pho mi food drink fruit coffee beer cake',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
      '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🍟', '🍔', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗',
      '🥘', '🍲', '🍱', '🥣', '🍛', '🍜', '🍝', '🍠', '🍤', '🍣', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂',
      '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '☕', '🍵', '🧋', '🍶', '🍷', '🍸', '🍹',
      '🍺', '🍻', '🥂', '🥃', '🥐', '🥯', '🥞', '🧇', '🍗', '🍖', '🥟', '🍿',
    ],
  },
  {
    id: 'activities',
    label: '⚽',
    keywords: 'the thao giai tri bong da game am nhac tiec tung le hoi sport football game music party trophy',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '⛸️', '🎿', '🛷', '🥌', '🎯', '🎮', '🕹️',
      '🎰', '🎲', '🧩', '🧸', '♠️', '♥️', '♦️', '♣️', '♟️', '🃏', '🀄', '🎴', '🎭', '🎨', '🧵', '🧶',
      '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎸', '🎹', '🎤', '🎧', '🎬', '✈️', '🚀', '🚗',
    ],
  },
  {
    id: 'objects',
    label: '💡',
    keywords: 'do vat dien thoai may tinh tien den sach qua tang cong cu object phone laptop money gift book',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖱️', '🖲️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹',
      '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰',
      '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶',
      '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲',
      '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🩺', '💊',
      '💉', '🩸', '🧬', '🦠', '🧼', '🧽', '🪒', '🧺', '🧹', '🌡️', '🏷️', '🔖', '📌', '📍', '✏️', '📝',
    ],
  },
  {
    id: 'symbols',
    label: '❤️',
    keywords: 'trai tim bieu tuong dau tich canh bao sao hoi cham cam heart love symbol check warning star',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉',
      '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
      '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️',
      '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯',
      '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸',
      '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '✨',
    ],
  },
];

const EMOJI_KEYWORDS = {
  '😀': 'cuoi vui grin smile happy',
  '😃': 'cuoi vui smile happy',
  '😄': 'cuoi tuoi vui laugh happy',
  '😁': 'cuoi rang grin happy',
  '😆': 'cuoi ha ha laugh lol',
  '😅': 'cuoi mo hoi ngai sweat smile',
  '🤣': 'cuoi lan lon haha rofl lol',
  '😂': 'cuoi ra nuoc mat haha joy lol',
  '🙂': 'cuoi nhe slight smile',
  '😉': 'nhay mat wink',
  '😊': 'cuoi hien de thuong blush happy',
  '😇': 'thien than angel',
  '🥰': 'yeu thuong tim love heart cute',
  '😍': 'mat trai tim me love heart eyes',
  '🤩': 'ngo sao tuyet voi star wow',
  '😘': 'hon gio kiss love',
  '😋': 'ngon them yum food',
  '😜': 'le luoi tinh nghich wink tongue',
  '🤪': 'dien vui zany crazy',
  '🤗': 'om hug warm',
  '🤔': 'suy nghi thac mac think hmm',
  '😐': 'bo tay binh thuong neutral',
  '🙄': 'liem mat ngan ngam eye roll',
  '😴': 'ngu buon ngu sleep',
  '😷': 'khau trang benh mask sick',
  '🥳': 'tiec chuc mung sinh nhat party celebrate',
  '😎': 'ngau kinh ram cool sunglasses',
  '🥺': 'nan ni dang thuong please cute',
  '😢': 'buon khoc cry sad',
  '😭': 'khoc to buon qua cry sob sad',
  '😱': 'so hai hot hoang scream omg',
  '😤': 'buc minh huff angry',
  '😡': 'gian du tuc angry mad rage',
  '😠': 'gian angry mad',
  '🤬': 'chui tuc dien swear angry',
  '😈': 'ac quy tinh nghich devil',
  '💀': 'dau lau chet cuoi skull dead',
  '💩': 'cut hai poop funny',
  '👻': 'ma ghost',
  '🤖': 'robot ai',
  '👋': 'chao tam biet hello hi bye wave',
  '👌': 'ok duoc tuyet perfect',
  '✌️': 'chien thang peace hi',
  '🤞': 'may man chuc luck',
  '👍': 'thich dong y ok like thumbs up',
  '👎': 'khong thich dislike thumbs down',
  '👏': 'vo tay chuc mung clap bravo',
  '🙌': 'hoan ho tuyet voi hooray hands',
  '🤝': 'bat tay hop tac handshake deal',
  '🙏': 'cam on lam on cau nguyen please thanks pray',
  '💪': 'co len manh me strong muscle',
  '👀': 'nhin xem hong eyes look',
  '🐶': 'cho cun dog puppy',
  '🐱': 'meo cat kitty',
  '🐰': 'tho rabbit bunny',
  '🐻': 'gau bear',
  '🐼': 'gau truc panda',
  '🐸': 'ech pepe frog',
  '🙈': 'che mat ngai monkey',
  '🔥': 'chay hot dinh fire lit',
  '⭐': 'sao star',
  '✨': 'lap lanh dep sparkle magic',
  '🌈': 'cau vong rainbow',
  '🍔': 'burger do an nhanh',
  '🍕': 'pizza',
  '🍜': 'pho mi bun ramen noodle',
  '🎂': 'banh sinh nhat birthday cake',
  '☕': 'ca phe coffee',
  '🧋': 'tra sua boba milk tea',
  '🍺': 'bia nhau beer cheers',
  '🍻': 'cung ly bia cheers beer',
  '⚽': 'bong da football soccer',
  '🎮': 'choi game gaming',
  '🎉': 'chuc mung tiec party congrats',
  '🎁': 'qua tang gift present',
  '🏆': 'cup vo dich trophy win',
  '🚀': 'ten lua rocket launch',
  '📱': 'dien thoai phone',
  '💻': 'laptop may tinh computer',
  '💡': 'y tuong den idea bulb',
  '💰': 'tien giau money rich',
  '❤️': 'trai tim yeu do red heart love',
  '🧡': 'tim cam orange heart',
  '💛': 'tim vang yellow heart',
  '💚': 'tim xanh la green heart',
  '💙': 'tim xanh duong blue heart',
  '💜': 'tim tim purple heart',
  '💔': 'tan vo buon broken heart',
  '💕': 'yeu thuong hearts love',
  '💖': 'tim lap lanh sparkling heart love',
  '💯': 'chuan 100 diem perfect',
  '✅': 'dung xong ok check done',
  '❌': 'sai huy x cross no',
  '⚠️': 'canh bao chu y warning',
  '❓': 'hoi cham question',
};

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

export const filterEmojis = (activeCategory, searchTerm = '') => {
  const query = normalizeText(searchTerm);
  if (!query) {
    return (EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0]).emojis;
  }

  const exactMatched = [];
  const categoryMatched = [];
  const seenExact = new Set();
  const seenCat = new Set();

  for (const cat of EMOJI_CATEGORIES) {
    const catMatch = normalizeText(cat.keywords).includes(query) || normalizeText(cat.id).includes(query);
    for (const emoji of cat.emojis) {
      const emojiKw = normalizeText(EMOJI_KEYWORDS[emoji] || '');
      if (emoji.includes(searchTerm.trim()) || (emojiKw && emojiKw.includes(query))) {
        if (!seenExact.has(emoji)) {
          seenExact.add(emoji);
          exactMatched.push(emoji);
        }
      } else if (catMatch && !seenCat.has(emoji)) {
        seenCat.add(emoji);
        categoryMatched.push(emoji);
      }
    }
  }

  return exactMatched.length > 0 ? exactMatched : categoryMatched;
};

export const STICKER_SETS = [
  { id: 'trending', label: '🔥', query: 'trending' },
  { id: 'cute', label: '🐱', query: 'cute cat' },
  { id: 'funny', label: '🤣', query: 'funny meme' },
  { id: 'love', label: '❤️', query: 'love heart' },
  { id: 'cry', label: '😢', query: 'sad cry' },
  { id: 'angry', label: '😡', query: 'angry' },
  { id: 'pepe', label: '🐸', query: 'frog pepe' },
];

export const GIF_CATEGORIES = [
  { id: 'trending', label: '🔥', query: '' },
  { id: 'happy', label: '😄', query: 'happy' },
  { id: 'love', label: '❤️', query: 'love' },
  { id: 'funny', label: '🤣', query: 'funny' },
  { id: 'cat', label: '🐱', query: 'cat' },
  { id: 'sad', label: '😢', query: 'sad' },
  { id: 'ok', label: '👍', query: 'ok' },
  { id: 'wow', label: '😮', query: 'wow' },
  { id: 'party', label: '🎉', query: 'party' },
];

export const FALLBACK_STICKERS = {
  trending: [
    makeNotoSticker('1f525', 'Fire Hot', ['hot', 'fire', 'chay', 'trending'], 'trending'),
    makeNotoSticker('1f973', 'Party Celebrate', ['party', 'chuc mung', 'sinh nhat'], 'trending'),
    makeNotoSticker('1f602', 'Laughing Tears', ['laugh', 'haha', 'cuoi', 'funny'], 'trending'),
    makeNotoSticker('2764_fe0f', 'Red Heart', ['love', 'heart', 'yeu', 'tim'], 'trending'),
    makeNotoSticker('1f44d', 'Thumbs Up', ['ok', 'like', 'dong y', 'good'], 'trending'),
    makeNotoSticker('1f44f', 'Clapping', ['clap', 'vo tay', 'chuc mung'], 'trending'),
    makeNotoSticker('1f389', 'Party Popper', ['party', 'congrats', 'tiec'], 'trending'),
    makeNotoSticker('1f60d', 'Heart Eyes', ['love', 'cute', 'yeu', 'me'], 'trending'),
    makeNotoSticker('1f929', 'Star Struck', ['wow', 'star', 'tuyet voi'], 'trending'),
    makeNotoSticker('1f60e', 'Cool Sunglasses', ['cool', 'ngau', 'chat'], 'trending'),
    makeNotoSticker('1f64f', 'Thank You', ['thanks', 'please', 'cam on'], 'trending'),
    makeNotoSticker('1f4af', '100 Perfect', ['100', 'perfect', 'chuan'], 'trending'),
    makeNotoSticker('2728', 'Sparkles', ['sparkle', 'magic', 'lap lanh'], 'trending'),
    makeNotoSticker('1f680', 'Rocket', ['rocket', 'launch', 'nhanh'], 'trending'),
    makeNotoSticker('1f483', 'Dancing', ['dance', 'party', 'nhay'], 'trending'),
    makeNotoSticker('1f31f', 'Glowing Star', ['star', 'sao', 'dep'], 'trending'),
  ],
  cute: [
    makeNotoSticker('1f97a', 'Pleading Eyes', ['cute', 'please', 'nan ni', 'thuong'], 'cute'),
    makeNotoSticker('1f970', 'Smiling Hearts', ['cute', 'love', 'yeu', 'am ap'], 'cute'),
    makeNotoSticker('1f63b', 'Heart Eyes Cat', ['cat', 'cute', 'meo', 'love'], 'cute'),
    makeNotoSticker('1f63a', 'Smiley Cat', ['cat', 'meo', 'cute', 'happy'], 'cute'),
    makeNotoSticker('1f638', 'Grinning Cat', ['cat', 'meo', 'smile'], 'cute'),
    makeNotoSticker('1f63d', 'Kissing Cat', ['cat', 'kiss', 'meo', 'hon'], 'cute'),
    makeNotoSticker('1f415', 'Cute Dog', ['dog', 'cho', 'cun', 'cute'], 'cute'),
    makeNotoSticker('1f407', 'Cute Rabbit', ['rabbit', 'bunny', 'tho', 'cute'], 'cute'),
    makeNotoSticker('1f43b', 'Bear', ['bear', 'gau', 'cute'], 'cute'),
    makeNotoSticker('1f43c', 'Panda', ['panda', 'gau truc', 'cute'], 'cute'),
    makeNotoSticker('1f425', 'Baby Chick', ['chick', 'ga con', 'cute'], 'cute'),
    makeNotoSticker('1f984', 'Unicorn', ['unicorn', 'ky lan', 'cute'], 'cute'),
    makeNotoSticker('1f338', 'Cherry Blossom', ['flower', 'hoa', 'cute'], 'cute'),
    makeNotoSticker('1f496', 'Sparkling Heart', ['heart', 'cute', 'love'], 'cute'),
    makeNotoSticker('1f60a', 'Blush Smile', ['smile', 'cute', 'cuoi'], 'cute'),
    makeNotoSticker('1f917', 'Warm Hug', ['hug', 'om', 'cute'], 'cute'),
  ],
  funny: [
    makeNotoSticker('1f923', 'Rolling Laughing', ['funny', 'rofl', 'haha', 'cuoi'], 'funny'),
    makeNotoSticker('1f602', 'Tears of Joy', ['funny', 'lol', 'haha', 'cuoi'], 'funny'),
    makeNotoSticker('1f639', 'Joy Cat', ['cat', 'funny', 'meo cuoi'], 'funny'),
    makeNotoSticker('1f61c', 'Winking Tongue', ['funny', 'silly', 'treu'], 'funny'),
    makeNotoSticker('1f92a', 'Zany Face', ['funny', 'crazy', 'hai'], 'funny'),
    makeNotoSticker('1f921', 'Clown', ['clown', 'funny', 'he'], 'funny'),
    makeNotoSticker('1f4a9', 'Poop', ['poop', 'funny', 'hai'], 'funny'),
    makeNotoSticker('1f47b', 'Ghost', ['ghost', 'boo', 'ma'], 'funny'),
    makeNotoSticker('1f47d', 'Alien', ['alien', 'funny'], 'funny'),
    makeNotoSticker('1f648', 'See No Evil', ['monkey', 'shy', 'ngai'], 'funny'),
    makeNotoSticker('1f649', 'Hear No Evil', ['monkey', 'funny'], 'funny'),
    makeNotoSticker('1f64a', 'Speak No Evil', ['monkey', 'oops'], 'funny'),
    makeNotoSticker('1f92f', 'Mind Blown', ['mind blown', 'wow', 'soc'], 'funny'),
    makeNotoSticker('1f635_200d_1f4ab', 'Dizzy', ['dizzy', 'chong mat'], 'funny'),
    makeNotoSticker('1f974', 'Woozy', ['woozy', 'say', 'funny'], 'funny'),
    makeNotoSticker('1f60f', 'Smirk', ['smirk', 'deu', 'funny'], 'funny'),
  ],
  love: [
    makeNotoSticker('2764_fe0f', 'Red Heart', ['love', 'heart', 'yeu', 'tim'], 'love'),
    makeNotoSticker('1f495', 'Two Hearts', ['love', 'hearts', 'yeu'], 'love'),
    makeNotoSticker('1f496', 'Sparkling Heart', ['love', 'sparkle', 'tim'], 'love'),
    makeNotoSticker('1f497', 'Growing Heart', ['love', 'heart', 'tim'], 'love'),
    makeNotoSticker('1f493', 'Beating Heart', ['love', 'heartbeat', 'tim'], 'love'),
    makeNotoSticker('1f49e', 'Revolving Hearts', ['love', 'hearts', 'yeu'], 'love'),
    makeNotoSticker('1f498', 'Cupid Heart', ['love', 'cupid', 'yeu'], 'love'),
    makeNotoSticker('1f49d', 'Heart Gift', ['love', 'gift', 'qua'], 'love'),
    makeNotoSticker('1f60d', 'Heart Eyes', ['love', 'yeu', 'me'], 'love'),
    makeNotoSticker('1f970', 'Smiling Hearts', ['love', 'yeu thuong'], 'love'),
    makeNotoSticker('1f618', 'Blow Kiss', ['kiss', 'love', 'hon'], 'love'),
    makeNotoSticker('1f48b', 'Kiss Mark', ['kiss', 'hon', 'love'], 'love'),
    makeNotoSticker('1f339', 'Rose', ['rose', 'hoa hong', 'love'], 'love'),
    makeNotoSticker('1f490', 'Bouquet', ['flowers', 'bo hoa', 'love'], 'love'),
    makeNotoSticker('1fac2', 'People Hugging', ['hug', 'om', 'love'], 'love'),
    makeNotoSticker('1f9e1', 'Orange Heart', ['love', 'heart', 'tim'], 'love'),
  ],
  cry: [
    makeNotoSticker('1f62d', 'Loudly Crying', ['cry', 'sad', 'khoc', 'buon'], 'cry'),
    makeNotoSticker('1f622', 'Crying Face', ['cry', 'sad', 'khoc', 'buon'], 'cry'),
    makeNotoSticker('1f63f', 'Crying Cat', ['cry', 'cat', 'meo khoc', 'sad'], 'cry'),
    makeNotoSticker('1f972', 'Happy Cry', ['cry', 'smile', 'cam dong'], 'cry'),
    makeNotoSticker('1f97a', 'Pleading', ['sad', 'plead', 'buon'], 'cry'),
    makeNotoSticker('1f625', 'Sad Relieved', ['sad', 'buon'], 'cry'),
    makeNotoSticker('1f614', 'Pensive', ['sad', 'buon', 'chan'], 'cry'),
    makeNotoSticker('1f61e', 'Disappointed', ['sad', 'that vong'], 'cry'),
    makeNotoSticker('1f62b', 'Tired', ['tired', 'met', 'sad'], 'cry'),
    makeNotoSticker('1f629', 'Weary', ['weary', 'met moi'], 'cry'),
    makeNotoSticker('1f630', 'Anxious', ['anxious', 'lo lang'], 'cry'),
    makeNotoSticker('1f494', 'Broken Heart', ['heartbreak', 'buon', 'tan vo'], 'cry'),
  ],
  angry: [
    makeNotoSticker('1f621', 'Pouting Rage', ['angry', 'rage', 'gian', 'tuc'], 'angry'),
    makeNotoSticker('1f92c', 'Swearing', ['angry', 'mad', 'chui', 'tuc'], 'angry'),
    makeNotoSticker('1f620', 'Angry Face', ['angry', 'gian'], 'angry'),
    makeNotoSticker('1f624', 'Steam From Nose', ['angry', 'huff', 'buc'], 'angry'),
    makeNotoSticker('1f63e', 'Pouting Cat', ['angry', 'cat', 'meo gian'], 'angry'),
    makeNotoSticker('1f47f', 'Angry Devil', ['angry', 'devil', 'gian'], 'angry'),
    makeNotoSticker('1f4a5', 'Collision Boom', ['boom', 'angry', 'no'], 'angry'),
    makeNotoSticker('1f4a3', 'Bomb', ['bomb', 'angry', 'bom'], 'angry'),
    makeNotoSticker('1f644', 'Rolling Eyes', ['annoyed', 'ngan ngam'], 'angry'),
    makeNotoSticker('1f612', 'Unamused', ['annoyed', 'chan', 'gian'], 'angry'),
    makeNotoSticker('1f928', 'Raised Eyebrow', ['suspicious', 'nghi ngo'], 'angry'),
    makeNotoSticker('1f62c', 'Grimacing', ['awkward', 'ngai'], 'angry'),
  ],
  pepe: [
    makeNotoSticker('1f438', 'Frog Pepe', ['pepe', 'frog', 'ech'], 'pepe'),
    makeNotoSticker('1f422', 'Turtle', ['turtle', 'rua', 'pepe'], 'pepe'),
    makeNotoSticker('1f419', 'Octopus', ['octopus', 'bach tuoc'], 'pepe'),
    makeNotoSticker('1f98b', 'Butterfly', ['butterfly', 'buom'], 'pepe'),
    makeNotoSticker('1f41d', 'Honeybee', ['bee', 'ong'], 'pepe'),
    makeNotoSticker('1f989', 'Owl', ['owl', 'cu meo'], 'pepe'),
    makeNotoSticker('1f427', 'Penguin', ['penguin', 'chim canh cut'], 'pepe'),
    makeNotoSticker('1f98a', 'Fox', ['fox', 'cao'], 'pepe'),
    makeNotoSticker('1f981', 'Lion', ['lion', 'su tu'], 'pepe'),
    makeNotoSticker('1f405', 'Tiger', ['tiger', 'ho'], 'pepe'),
    makeNotoSticker('1f412', 'Monkey', ['monkey', 'khi'], 'pepe'),
    makeNotoSticker('1f640', 'Shocked Cat', ['cat', 'shock', 'soc'], 'pepe'),
  ],
};

const makeGiphyFallback = (id, title, tags, category) => ({
  id: `giphy-fb-${id}`,
  url: `https://i.giphy.com/media/${id}/giphy.gif`,
  previewUrl: `https://i.giphy.com/media/${id}/200w.gif`,
  title,
  tags,
  category,
});

export const FALLBACK_GIFS = [
  makeGiphyFallback('EjMxK3pUeAC1MN5W9H', 'Happy Celebration', ['happy', 'vui', 'birthday', 'party'], 'happy'),
  makeGiphyFallback('fUQ4rhUZJYiQsas6WD', 'Happy Dance', ['happy', 'vui', 'excited'], 'happy'),
  makeGiphyFallback('dwI09ZWZ93gIt7uhQm', 'Happy Party', ['happy', 'party', 'chuc mung'], 'happy'),
  makeGiphyFallback('Mjcv3Dg6irEG6Bb9In', 'Celebrate Joy', ['happy', 'party', 'vui'], 'happy'),
  makeGiphyFallback('IarkL8sxk3LJ6LLFv8', 'Cat Love', ['love', 'cat', 'yeu', 'meo', 'cute'], 'love'),
  makeGiphyFallback('t8xgPfC5oNIRMrNooe', 'Dog Love', ['love', 'dog', 'yeu', 'cho', 'cute'], 'love'),
  makeGiphyFallback('Z21HJj2kz9uBG', 'I Love Hearts', ['love', 'heart', 'yeu', 'tim'], 'love'),
  makeGiphyFallback('4N1wOi78ZGzSB6H7vK', 'Hearts Love', ['love', 'heart', 'yeu', 'tim'], 'love'),
  makeGiphyFallback('SggILpMXO7Xt6', 'Funny Dog', ['funny', 'dog', 'hai', 'cuoi'], 'funny'),
  makeGiphyFallback('WXB88TeARFVvi', 'Dance Party Cat', ['funny', 'cat', 'dance', 'meo', 'hai'], 'funny'),
  makeGiphyFallback('BY0I4J5rnxd8k', 'Funny Laugh', ['funny', 'laugh', 'hai', 'cuoi'], 'funny'),
  makeGiphyFallback('fHoqSTQTsgSbfUoiTw', 'Funny Puppet', ['funny', 'hai', 'lol'], 'funny'),
  makeGiphyFallback('774uK11mxE3W0cjE8L', 'Cat High Five', ['cat', 'meo', 'high five', 'cute'], 'cat'),
  makeGiphyFallback('tphCApwvdtC1VJabZ1', 'Cat Meme', ['cat', 'meme', 'meo', 'funny'], 'cat'),
  makeGiphyFallback('62bRBJV1ccA9nyLmKy', 'Funny Cat Meme', ['cat', 'meme', 'meo'], 'cat'),
  makeGiphyFallback('GB0XWhoCDNNAW8M9vv', 'Ice Cream Cats', ['cat', 'cute', 'meo'], 'cat'),
  makeGiphyFallback('Lz6971fkGSgCMOOncl', 'Sad Cat', ['sad', 'cat', 'buon', 'meo'], 'sad'),
  makeGiphyFallback('13t22jOjxpkAN2', 'Crying Sad', ['sad', 'cry', 'buon', 'khoc'], 'sad'),
  makeGiphyFallback('W7KqOEzpG9iC9H58zc', 'Sad Puppet', ['sad', 'buon', 'cry'], 'sad'),
  makeGiphyFallback('lGBecpB2dIMwt6ohfI', 'Cute Cat Smile', ['cat', 'cute', 'sad', 'smile'], 'sad'),
  makeGiphyFallback('tIeCLkB8geYtW', 'Thumbs Up OK', ['ok', 'good', 'like', 'dong y'], 'ok'),
  makeGiphyFallback('L3X9GvVhP1nY23Ah6u', 'Okay Mood', ['ok', 'okay', 'duoc'], 'ok'),
  makeGiphyFallback('DFNd1yVyRjmF2', 'Thumbs Up Yes', ['ok', 'yes', 'like', 'good'], 'ok'),
  makeGiphyFallback('3ohhwfwxg4d1h82LxS', 'Yes Agree', ['ok', 'yes', 'dong y'], 'ok'),
  makeGiphyFallback('oYtVHSxngR3lC', 'Wow Surprised', ['wow', 'omg', 'bat ngo'], 'wow'),
  makeGiphyFallback('5VKbvrjxpVJCM', 'Wow Amazing', ['wow', 'amazing', 'tuyet'], 'wow'),
  makeGiphyFallback('PUBxelwT57jsQ', 'Cat Wow', ['wow', 'cat', 'meo', 'soc'], 'wow'),
  makeGiphyFallback('l3q2K5jinAlChoCLS', 'Excuse Me Blink', ['wow', 'blink', 'what', 'ngo ngac'], 'wow'),
  makeGiphyFallback('blSTtZehjAZ8I', 'Dance Party', ['party', 'dance', 'tiec', 'vui'], 'party'),
  makeGiphyFallback('M4VE9kDeC9T0B4c2sz', 'Happy Dance', ['party', 'dance', 'happy'], 'party'),
  makeGiphyFallback('xUA7aT1vNqVWHPY1cA', 'Party Time', ['party', 'celebrate', 'tiec'], 'party'),
  makeGiphyFallback('13Iu9mjLpXF0ek', 'Minions Dancing', ['party', 'dance', 'funny', 'vui'], 'party'),
];

const getFallbackStickers = (category = 'trending', searchTerm = '') => {
  const q = normalizeText(searchTerm);
  if (q) {
    const all = Object.values(FALLBACK_STICKERS).flat();
    const unique = [];
    const seen = new Set();
    for (const item of all) {
      if (seen.has(item.url)) continue;
      const haystack = normalizeText(`${item.title} ${item.category} ${(item.tags || []).join(' ')}`);
      if (haystack.includes(q)) {
        seen.add(item.url);
        unique.push(item);
      }
    }
    return unique.length > 0 ? unique : FALLBACK_STICKERS.trending;
  }
  return FALLBACK_STICKERS[category] || FALLBACK_STICKERS.trending;
};

const getFallbackGifs = (category = 'trending', searchTerm = '') => {
  const q = normalizeText(searchTerm);
  if (q) {
    const matched = FALLBACK_GIFS.filter((item) =>
      normalizeText(`${item.title} ${item.category} ${(item.tags || []).join(' ')}`).includes(q)
    );
    return matched.length > 0 ? matched : FALLBACK_GIFS;
  }
  if (category && category !== 'trending') {
    const byCat = FALLBACK_GIFS.filter((item) => item.category === category);
    if (byCat.length > 0) return byCat;
  }
  return FALLBACK_GIFS;
};

const formatGiphyItems = (items = [], fallbackTitle = 'GIF') =>
  items
    .map((item) => {
      const images = item?.images || {};
      const url =
        images.original?.url ||
        images.downsized?.url ||
        images.fixed_height?.url ||
        images.fixed_width?.url;
      const previewUrl =
        images.fixed_width?.url ||
        images.fixed_height_small?.url ||
        images.preview_gif?.url ||
        url;
      if (!url) return null;
      return {
        id: item.id,
        url,
        previewUrl: previewUrl || url,
        title: item.title || fallbackTitle,
      };
    })
    .filter(Boolean);

const fetchWithTimeout = async (url, timeoutMs = 6000) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const fetchStickersData = async ({ category = 'trending', searchTerm = '', limit = 24 } = {}) => {
  const trimmedSearch = searchTerm.trim();
  const activeSet = STICKER_SETS.find((s) => s.id === category);
  const query = trimmedSearch || (activeSet && activeSet.id !== 'trending' ? activeSet.query : '');

  try {
    const endpoint = query
      ? `https://api.giphy.com/v1/stickers/search?api_key=${DEFAULT_GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g&lang=en`
      : `https://api.giphy.com/v1/stickers/trending?api_key=${DEFAULT_GIPHY_API_KEY}&limit=${limit}&rating=g`;

    const data = await fetchWithTimeout(endpoint);
    const formatted = formatGiphyItems(data?.data, 'Sticker');
    if (formatted.length > 0) {
      return formatted;
    }
  } catch (err) {
    console.warn('Giphy stickers unavailable, falling back to Noto animated stickers:', err?.message || err);
  }

  return getFallbackStickers(category, trimmedSearch);
};

export const fetchGifsData = async ({ category = 'trending', searchTerm = '', limit = 24 } = {}) => {
  const trimmedSearch = searchTerm.trim();
  const activeCat = GIF_CATEGORIES.find((c) => c.id === category);
  const query = trimmedSearch || (activeCat && activeCat.id !== 'trending' ? activeCat.query : '');

  try {
    const endpoint = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${DEFAULT_GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=g&lang=en`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${DEFAULT_GIPHY_API_KEY}&limit=${limit}&rating=g`;

    const data = await fetchWithTimeout(endpoint);
    const formatted = formatGiphyItems(data?.data, 'GIF');
    if (formatted.length > 0) {
      return formatted;
    }
  } catch (err) {
    console.warn('Giphy GIFs unavailable, falling back to curated GIF catalog:', err?.message || err);
  }

  return getFallbackGifs(category, trimmedSearch);
};
