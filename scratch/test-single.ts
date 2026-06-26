import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.GENIUS_API_TOKEN || '';

const ARTIST_TRANSLATION_MAP: Record<string, string[]> = {
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

function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/feat\.?.*$/i, '')
    .replace(/ft\.?.*$/i, '')
    .replace(/[^\w\s\u3130-\u318F\uAC00-\uD7A3]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str: string): Set<string> {
  const normalized = normalizeForComparison(str);
  return new Set(normalized.split(' ').filter(Boolean));
}

function calculateSimilarity(str1: string, str2: string): number {
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

function containsSubstring(query: string, target: string): boolean {
  const q = normalizeForComparison(query);
  const t = normalizeForComparison(target);
  return t.includes(q) || q.includes(t);
}

function romanizeHangul(text: string): string {
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

function simplifyRoman(str: string): string {
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
    .replace(/h/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');
}

function isRomanizedMatch(hangul: string, english: string): boolean {
  if (!/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(hangul)) return false;
  const rom = romanizeHangul(hangul);
  const simRom = simplifyRoman(rom);
  const simEng = simplifyRoman(english);
  return simRom.length >= 2 && simEng.length >= 2 && 
    (simRom === simEng || simRom.includes(simEng) || simEng.includes(simRom));
}

function checkTranslationMap(name1: string, name2: string): boolean {
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

function extractAlternativeNames(name: string): string[] {
  if (!name) return [];
  const results: string[] = [name];
  const regex = /([^([]+)(?:\(([^)]+)\)|\[([^\]]+)\])/;
  const match = name.match(regex);
  if (match) {
    if (match[1]) results.push(match[1].trim());
    const inside = match[2] || match[3];
    if (inside) results.push(inside.trim());
  }
  return Array.from(new Set(results));
}

function isSingleArtistMatch(query: string, result: string, original: string = ''): boolean {
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

function checkArtistMatch(queryArtist: string, resultArtist: string, originalArtist: string = ''): boolean {
  const queryMembers = queryArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
  const resultMembers = resultArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
  const originalMembers = originalArtist ? originalArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean) : [];

  return queryMembers.some(qMem =>
    resultMembers.some(rMem => isSingleArtistMatch(qMem, rMem))
  ) || (originalMembers.length > 0 && originalMembers.some(oMem =>
    resultMembers.some(rMem => isSingleArtistMatch(oMem, rMem))
  ));
}

function normalizeTitle(title: string): string {
  let cleaned = normalizeForComparison(title);
  cleaned = cleaned.replace(/트랙\s*(\d+)/g, 'track $1');
  cleaned = cleaned.replace(/(\d+)시/g, '$1');
  return cleaned;
}

function isSingleTitleMatch(query: string, result: string, original: string = ''): boolean {
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

function checkTitleMatch(queryTitle: string, resultTitle: string, originalTitle: string = ''): boolean {
  return isSingleTitleMatch(queryTitle, resultTitle, originalTitle);
}

async function debugSearch(artist: string, title: string, searchArtist: string, searchTitle: string) {
  console.log(`\n======================= [디버그 검색: ${artist} - ${title}] (쿼리: "${searchArtist} ${searchTitle}") =======================`);
  const query = searchArtist ? `${searchArtist} ${searchTitle}` : searchTitle;
  const targetUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}&access_token=${token}`;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      console.log(`❌ API 호출 에러: ${response.statusText}`);
      return;
    }
    const data = (await response.json()) as any;
    const hits = data?.response?.hits || [];
    console.log(`검색 반환 개수: ${hits.length}`);

    for (let i = 0; i < Math.min(hits.length, 5); i++) {
      const result = hits[i].result;
      const resArtist = result.primary_artist?.name;
      const resTitle = result.title;

      const artistMatch = checkArtistMatch(searchArtist, resArtist, artist);
      const titleMatch = checkTitleMatch(searchTitle, resTitle, title);

      const artistSim = calculateSimilarity(searchArtist, resArtist);
      const titleSim = calculateSimilarity(searchTitle, resTitle);
      const artistContains = containsSubstring(searchArtist, resArtist) ? 0.3 : 0;
      const titleContains = containsSubstring(searchTitle, resTitle) ? 0.3 : 0;

      const combinedScore = Math.max(
        artistSim * 0.4 + titleSim * 0.6,
        artistContains * 0.4 + titleContains * 0.6
      );

      console.log(`\n  후보 ${i + 1}: "${resArtist} - ${resTitle}"`);
      console.log(`    - 아티스트 일치 판정: ${artistMatch}`);
      console.log(`      * query: "${searchArtist}", result: "${resArtist}", original: "${artist}"`);
      console.log(`    - 곡명 일치 판정: ${titleMatch}`);
      console.log(`      * query: "${searchTitle}", result: "${resTitle}", original: "${title}"`);
      console.log(`    - 결합 유사도 점수: ${combinedScore.toFixed(3)}`);
      console.log(`      * artistSim: ${artistSim.toFixed(3)}, titleSim: ${titleSim.toFixed(3)}`);
    }
  } catch (err) {
    console.error('❌ 에러:', err);
  }
}

async function startDebug() {
  await debugSearch('안다영', '밤 패닝', 'ahn da young', 'panorama');
}

startDebug();
