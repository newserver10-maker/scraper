import { readFileSync } from 'fs';

// === 개선된 clientScraper.ts의 로직 이식 ===

const ARTIST_TRANSLATION_MAP = {
  '검정치마': ['the black skirts', 'black skirts'],
  '오존': ['o3ohn'],
  '아이유': ['iu'],
  '백예린': ['yerin baek', 'baek yerin'],
  '혁오': ['hyukoh'],
  '잔나비': ['jannabi'],
  '볼빨간사춘기': ['bolbbalgan4', 'bol4', 'bolbbalgan puberty'],
  '방탄소년단': ['bts'],
  '적재': ['jukjae'],
  '이소라': ['lee sora', 'lee so ra'],
  '10cm': ['십센치'],
  '선우정아': ['sunwoojunga', 'sunwoo junga'],
  '새소년': ['se so neon', 'sesoneon'],
  '기리보이': ['giriboy'],
  '우원재': ['woo', 'woo won jae'],
  '카더가든': ['car the garden'],
  '자이언티': ['zion.t', 'zion t'],
  '크러쉬': ['crush'],
  '태연': ['taeyeon'],
  '악뮤': ['akmu', 'akdong musician', '악동뮤지션'],
  '림킴': ['lim kim', 'limkim'],
  '미노이': ['meenoi', 'minoi'],
  '권진아': ['kwon jin ah', 'kwon jinah'],
  '샘김': ['sam kim', 'samkim'],
  '신해경': ['shin hae gyeong', 'shin hae kyung'],
  '안다영': ['ahn da young', 'ahn dayoung'],
  '김광석': ['kim kwang seok', 'kim kwangseok'],
  '곽진언': ['kwak jin eon', 'kwak jineon'],
  '디오': ['d.o.', 'do', 'd.o. (exo)'],
  '루시드폴': ['lucid fall'],
};

function romanizeHangul(text) {
  const chosungMap = [
    'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp',
    's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
  ];
  const jungsungMap = [
    'a', 'ae', 'ya', 'yae', 'eo', 'e', 'ye', 'ye', 'o', 'wa',
    'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
  ];
  const jongsungMap = [
    '', 'g', 'kk', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg',
    'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs',
    's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
  ];

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const hangulCode = code - 0xAC00;
      const cho = Math.floor(hangulCode / 588);
      const jung = Math.floor((hangulCode % 588) / 28);
      const jong = hangulCode % 28;

      result += chosungMap[cho] + jungsungMap[jung] + jongsungMap[jong];
    } else {
      result += text[i];
    }
  }
  return result;
}

function simplifyRoman(str) {
  return str
    .toLowerCase()
    .replace(/eo/g, 'u')
    .replace(/wo/g, 'u')
    .replace(/oo/g, 'u')
    .replace(/wi/g, 'u')
    .replace(/wa/g, 'a')
    .replace(/ae/g, 'e')
    .replace(/oe/g, 'e')
    .replace(/ee/g, 'i')
    .replace(/r/g, 'l')
    .replace(/g/g, 'k')
    .replace(/d/g, 't')
    .replace(/b/g, 'p')
    .replace(/h/g, '') // ahn -> an, ah -> a 생략 대응
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');
}

function isRomanizedMatch(hangul, english) {
  if (!/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(hangul)) return false;
  
  const rom = romanizeHangul(hangul);
  const simRom = simplifyRoman(rom);
  const simEng = simplifyRoman(english);
  
  return simRom.length >= 2 && simEng.length >= 2 && 
    (simRom === simEng || simRom.includes(simEng) || simEng.includes(simRom));
}

function extractAlternativeNames(name) {
  if (!name) return [];
  const results = [name];
  
  const regex = /([^([]+)(?:\(([^)]+)\)|\[([^\]]+)\])/;
  const match = name.match(regex);
  if (match) {
    if (match[1]) results.push(match[1].trim());
    const inside = match[2] || match[3];
    if (inside) results.push(inside.trim());
  }
  
  return Array.from(new Set(results));
}

function checkTranslationMap(name1, name2) {
  const n1Clean = normalizeForComparison(name1).replace(/\s+/g, '');
  const n2Clean = normalizeForComparison(name2).replace(/\s+/g, '');

  for (const [ko, engList] of Object.entries(ARTIST_TRANSLATION_MAP)) {
    const koClean = normalizeForComparison(ko).replace(/\s+/g, '');
    const engCleanList = engList.map(e => normalizeForComparison(e).replace(/\s+/g, ''));

    if (n1Clean === koClean && engCleanList.includes(n2Clean)) return true;
    if (n2Clean === koClean && engCleanList.includes(n1Clean)) return true;
  }
  return false;
}

function normalizeForComparison(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/feat\.?.*$/i, '')
    .replace(/ft\.?.*$/i, '')
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str) {
  const normalized = normalizeForComparison(str);
  return new Set(normalized.split(' ').filter(Boolean));
}

function calculateSimilarity(str1, str2) {
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  let intersectionSize = 0;
  tokens1.forEach((token) => {
    if (tokens2.has(token)) intersectionSize++;
  });

  const unionSize = new Set([...tokens1, ...tokens2]).size;
  return intersectionSize / unionSize;
}

function isSingleArtistMatch(query, result, original = '') {
  const qAlternatives = extractAlternativeNames(query);
  const rAlternatives = extractAlternativeNames(result);
  const oAlternatives = original ? extractAlternativeNames(original) : [];

  for (const qAlt of qAlternatives) {
    for (const rAlt of rAlternatives) {
      const qClean = normalizeForComparison(qAlt);
      const rClean = normalizeForComparison(rAlt);
      const qNoSpace = qClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (qNoSpace === rNoSpace && qNoSpace.length > 0) return true;
      if (checkTranslationMap(qAlt, rAlt)) return true;
      if (isRomanizedMatch(qAlt, rAlt)) return true;
      if (calculateSimilarity(qAlt, rAlt) >= 0.4) return true;
      if (qClean.length >= 2 && rClean.length >= 2) {
        if (qClean.includes(rClean) || rClean.includes(qClean)) return true;
      }
    }
  }

  for (const oAlt of oAlternatives) {
    for (const rAlt of rAlternatives) {
      const oClean = normalizeForComparison(oAlt);
      const rClean = normalizeForComparison(rAlt);
      const oNoSpace = oClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (oNoSpace === rNoSpace && oNoSpace.length > 0) return true;
      if (checkTranslationMap(oAlt, rAlt)) return true;
      if (isRomanizedMatch(oAlt, rAlt)) return true;
      if (calculateSimilarity(oAlt, rAlt) >= 0.4) return true;
      if (oClean.length >= 2 && rClean.length >= 2) {
        if (oClean.includes(rClean) || rClean.includes(oClean)) return true;
      }
    }
  }

  return false;
}

function checkArtistMatch(queryArtist, resultArtist, originalArtist = '') {
  const queryMembers = queryArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
  const resultMembers = resultArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
  const originalMembers = originalArtist ? originalArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean) : [];

  return queryMembers.some(qMem =>
    resultMembers.some(rMem => isSingleArtistMatch(qMem, rMem))
  ) || (originalMembers.length > 0 && originalMembers.some(oMem =>
    resultMembers.some(rMem => isSingleArtistMatch(oMem, rMem))
  ));
}

function normalizeTitle(title) {
  let cleaned = normalizeForComparison(title);
  cleaned = cleaned.replace(/트랙\s*(\d+)/g, 'track $1');
  cleaned = cleaned.replace(/(\d+)시/g, '$1');
  return cleaned;
}

function isSingleTitleMatch(query, result, original = '') {
  const qAlternatives = extractAlternativeNames(query);
  const rAlternatives = extractAlternativeNames(result);
  const oAlternatives = original ? extractAlternativeNames(original) : [];

  for (const qAlt of qAlternatives) {
    for (const rAlt of rAlternatives) {
      const qClean = normalizeTitle(qAlt);
      const rClean = normalizeTitle(rAlt);
      const qNoSpace = qClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (qNoSpace === rNoSpace && qNoSpace.length > 0) return true;
      if (isRomanizedMatch(qAlt, rAlt)) return true;
      if (calculateSimilarity(qAlt, rAlt) >= 0.35) return true;
      if (qClean.length >= 2 && rClean.length >= 2) {
        if (qClean.includes(rClean) || rClean.includes(qClean)) return true;
      }
    }
  }

  for (const oAlt of oAlternatives) {
    for (const rAlt of rAlternatives) {
      const oClean = normalizeTitle(oAlt);
      const rClean = normalizeTitle(rAlt);
      const oNoSpace = oClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (oNoSpace === rNoSpace && oNoSpace.length > 0) return true;
      if (isRomanizedMatch(oAlt, rAlt)) return true;
      if (calculateSimilarity(oAlt, rAlt) >= 0.35) return true;
      if (oClean.length >= 2 && rClean.length >= 2) {
        if (oClean.includes(rClean) || rClean.includes(oClean)) return true;
      }
    }
  }

  return false;
}

function checkTitleMatch(queryTitle, resultTitle, originalTitle = '') {
  return isSingleTitleMatch(queryTitle, resultTitle, originalTitle);
}

// === 테스트 데이터 케이스 구성 ===
const TEST_CASES = [
  {
    name: '오존 (O3ohn) - Down',
    query: { artist: '오존 (O3ohn)', title: 'Down' },
    result: { artist: 'O3ohn', title: 'Down' }
  },
  {
    name: '림킴 (Lim Kim) - 민들레',
    query: { artist: '림킴 (Lim Kim)', title: '민들레' },
    result: { artist: 'Lim Kim', title: 'Dandelion (민들레)' }
  },
  {
    name: '루시드폴 - 보이지 않는 날들',
    query: { artist: '루시드폴', title: '보이지 않는 날들' },
    result: { artist: 'Lucid Fall', title: '보이지 않는 날들' }
  },
  {
    name: '백예린 - Our Love Is Great',
    query: { artist: '백예린', title: 'Our Love Is Great' },
    result: { artist: 'Yerin Baek', title: 'Our Love Is Great' }
  },
  {
    name: '미노이 & 우원재 - 잠수이별',
    query: { artist: '미노이 & 우원재', title: '잠수이별' },
    result: { artist: 'MEENOI & Woo', title: '잠수이별 (Breakup In The Box)' }
  },
  {
    name: '검정치마 - 섬 (Island)',
    query: { artist: '검정치마', title: '섬 (Island)' },
    result: { artist: 'The Black Skirts', title: 'Island' }
  },
  {
    name: '유라 (youra) - 하류 (The Bottom)',
    query: { artist: '유라 (youra)', title: '하류 (The Bottom)' },
    result: { artist: 'youra', title: 'The Bottom' }
  },
  {
    name: '디오 (D.O.) - 괜찮아도 괜찮아',
    query: { artist: '디오 (D.O.)', title: '괜찮아도 괜찮아' },
    result: { artist: 'D.O. (EXO)', title: "괜찮아도 괜찮아 (That's okay)" }
  },
  {
    name: '딘 (DEAN) - 풀어 (Pour Up)',
    query: { artist: '딘 (DEAN)', title: '풀어 (Pour Up)' },
    result: { artist: 'DEAN', title: '풀어 (Pour Up) (feat. ZICO)' }
  },
  {
    name: '카더가든 & 오존 - 의연한 악수',
    query: { artist: '카더가든 & 오존', title: '의연한 악수' },
    result: { artist: 'Car, the Garden & O3ohn', title: '의연한 악수' }
  },
  {
    name: '선우정아 - 도망가자',
    query: { artist: '선우정아', title: '도망가자' },
    result: { artist: 'sunwoojunga', title: '도망가자 (Run With Me)' }
  },
  {
    name: '샘김 (Sam Kim) - 향수',
    query: { artist: '샘김 (Sam Kim)', title: '향수' },
    result: { artist: 'Sam Kim', title: '향수 (Perfume)' }
  },
  {
    name: '이소라 - 트랙 9',
    query: { artist: '이소라', title: '트랙 9' },
    result: { artist: 'Lee Sora', title: 'Track 9' }
  },
  {
    name: '백예린 - 야간비행',
    query: { artist: '백예린', title: '야간비행' },
    result: { artist: 'Yerin Baek', title: '야간비행 (As I am)' }
  },
  {
    name: '권진아 & 샘김 - 여기까지',
    query: { artist: '권진아 & 샘김', title: '여기까지' },
    result: { artist: 'Kwon Jin Ah & Sam Kim', title: '여기까지 (For Now)' }
  },
  {
    name: '곽진언 - 자유롭게',
    query: { artist: '곽진언', title: '자유롭게' },
    result: { artist: 'Kwak Jin Eon', title: '자유롭게' }
  },
  {
    name: '신해경 - 낭만파',
    query: { artist: '신해경', title: '낭만파' },
    result: { artist: 'Shin Hae Gyeong', title: '낭만파' }
  },
  {
    name: '김광석 - 거리에서',
    query: { artist: '김광석', title: '거리에서' },
    result: { artist: 'Kim Kwang Seok', title: 'On the Street (거리에서)' }
  },
  {
    name: '안다영 - 밤 패닝',
    query: { artist: '안다영', title: '밤 패닝' },
    result: { artist: 'Ahn Da Young', title: '밤 패닝 (Night Panning)' }
  },
  {
    name: '새소년 - 이방인',
    query: { artist: '새소년', title: '이방인' },
    result: { artist: 'SE SO NEON', title: '이방인 (The Stranger)' }
  }
];

// === 테스트 실행 ===
console.log('===== 개선된 매칭 로직 테스트 시작 =====\n');
let passed = 0;

for (const tc of TEST_CASES) {
  const artistMatch = checkArtistMatch(tc.query.artist, tc.result.artist, tc.query.artist);
  const titleMatch = checkTitleMatch(tc.query.title, tc.result.title, tc.query.title);
  const matchSuccess = artistMatch && titleMatch;

  if (matchSuccess) {
    passed++;
    console.log(`✅ [통과] ${tc.name}`);
  } else {
    console.log(`❌ [실패] ${tc.name}`);
    console.log(`   └─ 아티스트 매칭: ${artistMatch ? 'OK' : 'FAIL'} ("${tc.query.artist}" vs "${tc.result.artist}")`);
    console.log(`   └─ 타이틀 매칭: ${titleMatch ? 'OK' : 'FAIL'} ("${tc.query.title}" vs "${tc.result.title}")`);
  }
}

console.log(`\n결과: ${passed} / ${TEST_CASES.length} 통과`);
