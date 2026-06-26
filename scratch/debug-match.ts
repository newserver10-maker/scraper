import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForComparison(str: string): string {
  return removeDiacritics(str)
    .normalize("NFC")
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
  return removeDiacritics(str)
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
    if (n1Clean === koClean && engCleanList.includes(n2Clean)) {
      console.log(`        [checkTranslationMap TRUE 1] n1Clean("${n1Clean}") === koClean("${koClean}") && engCleanList(${JSON.stringify(engCleanList)}).includes(n2Clean("${n2Clean}"))`);
      return true;
    }
    if (n2Clean === koClean && engCleanList.includes(n1Clean)) {
      console.log(`        [checkTranslationMap TRUE 2] n2Clean("${n2Clean}") === koClean("${koClean}") && engCleanList(${JSON.stringify(engCleanList)}).includes(n1Clean("${n1Clean}"))`);
      return true;
    }
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
  console.log(`      isSingleArtistMatch: "${query}" vs "${result}" (original: "${original}")`);
  const qAlternatives = extractAlternativeNames(query);
  const rAlternatives = extractAlternativeNames(result);
  const oAlternatives = original ? extractAlternativeNames(original) : [];

  for (const qAlt of qAlternatives) {
    for (const rAlt of rAlternatives) {
      const qClean = normalizeForComparison(qAlt);
      const rClean = normalizeForComparison(rAlt);
      const qNoSpace = qClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (qNoSpace === rNoSpace && qNoSpace.length > 0) {
        console.log(`        -> Match: qNoSpace === rNoSpace ("${qNoSpace}")`);
        return true;
      }
      if (checkTranslationMap(qAlt, rAlt)) {
        console.log(`        -> Match: checkTranslationMap ("${qAlt}" <-> "${rAlt}")`);
        return true;
      }
      if (isRomanizedMatch(qAlt, rAlt)) {
        console.log(`        -> Match: isRomanizedMatch ("${qAlt}" <-> "${rAlt}")`);
        return true;
      }
      if (calculateSimilarity(qAlt, rAlt) >= 0.4) {
        console.log(`        -> Match: calculateSimilarity >= 0.4 (${calculateSimilarity(qAlt, rAlt)})`);
        return true;
      }
      if (qClean.length >= 2 && rClean.length >= 2) {
        if (qClean.includes(rClean) || rClean.includes(qClean)) {
          console.log(`        -> Match: includes ("${qClean}" / "${rClean}")`);
          return true;
        }
      }
    }
  }

  for (const oAlt of oAlternatives) {
    for (const rAlt of rAlternatives) {
      const oClean = normalizeForComparison(oAlt);
      const rClean = normalizeForComparison(rAlt);
      const oNoSpace = oClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (oNoSpace === rNoSpace && oNoSpace.length > 0) {
        console.log(`        -> Match (original): oNoSpace === rNoSpace ("${oNoSpace}")`);
        return true;
      }
      if (checkTranslationMap(oAlt, rAlt)) {
        console.log(`        -> Match (original): checkTranslationMap ("${oAlt}" <-> "${rAlt}")`);
        return true;
      }
      if (isRomanizedMatch(oAlt, rAlt)) {
        console.log(`        -> Match (original): isRomanizedMatch ("${oAlt}" <-> "${rAlt}")`);
        return true;
      }
      if (calculateSimilarity(oAlt, rAlt) >= 0.4) {
        console.log(`        -> Match (original): calculateSimilarity >= 0.4 (${calculateSimilarity(oAlt, rAlt)})`);
        return true;
      }
      if (oClean.length >= 2 && rClean.length >= 2) {
        if (oClean.includes(rClean) || rClean.includes(oClean)) {
          console.log(`        -> Match (original): includes ("${oClean}" / "${rClean}")`);
          return true;
        }
      }
    }
  }
  return false;
}

function checkArtistMatch(queryArtist: string, resultArtist: string, originalArtist: string = ''): boolean {
  console.log(`  checkArtistMatch: queryArtist="${queryArtist}", resultArtist="${resultArtist}", originalArtist="${originalArtist}"`);
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
  console.log(`      isSingleTitleMatch: "${query}" vs "${result}" (original: "${original}")`);
  const qAlternatives = extractAlternativeNames(query);
  const rAlternatives = extractAlternativeNames(result);
  const oAlternatives = original ? extractAlternativeNames(original) : [];

  for (const qAlt of qAlternatives) {
    for (const rAlt of rAlternatives) {
      const qClean = normalizeTitle(qAlt);
      const rClean = normalizeTitle(rAlt);
      const qNoSpace = qClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (qNoSpace === rNoSpace && qNoSpace.length > 0) {
        console.log(`        -> Match: qNoSpace === rNoSpace ("${qNoSpace}")`);
        return true;
      }
      if (isRomanizedMatch(qAlt, rAlt)) {
        console.log(`        -> Match: isRomanizedMatch ("${qAlt}" <-> "${rAlt}")`);
        return true;
      }
      if (calculateSimilarity(qAlt, rAlt) >= 0.35) {
        console.log(`        -> Match: calculateSimilarity >= 0.35 (${calculateSimilarity(qAlt, rAlt)})`);
        return true;
      }
      if (qClean.length >= 2 && rClean.length >= 2) {
        if (qClean.includes(rClean) || rClean.includes(qClean)) {
          console.log(`        -> Match: includes ("${qClean}" / "${rClean}")`);
          return true;
        }
      }
    }
  }

  for (const oAlt of oAlternatives) {
    for (const rAlt of rAlternatives) {
      const oClean = normalizeTitle(oAlt);
      const rClean = normalizeTitle(rAlt);
      const oNoSpace = oClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (oNoSpace === rNoSpace && oNoSpace.length > 0) {
        console.log(`        -> Match (original): oNoSpace === rNoSpace ("${oNoSpace}")`);
        return true;
      }
      if (isRomanizedMatch(oAlt, rAlt)) {
        console.log(`        -> Match (original): isRomanizedMatch ("${oAlt}" <-> "${rAlt}")`);
        return true;
      }
      if (calculateSimilarity(oAlt, rAlt) >= 0.35) {
        console.log(`        -> Match (original): calculateSimilarity >= 0.35 (${calculateSimilarity(oAlt, rAlt)})`);
        return true;
      }
      if (oClean.length >= 2 && rClean.length >= 2) {
        if (oClean.includes(rClean) || oClean.includes(rClean)) {
          console.log(`        -> Match (original): includes ("${oClean}" / "${rClean}")`);
          return true;
        }
      }
    }
  }
  return false;
}

function checkTitleMatch(queryTitle: string, resultTitle: string, originalTitle: string = ''): boolean {
  console.log(`  checkTitleMatch: queryTitle="${queryTitle}", resultTitle="${resultArtist}", originalTitle="${originalTitle}"`);
  return isSingleTitleMatch(queryTitle, resultTitle, originalTitle);
}

// 억지 이름 매핑으로 resultArtist가 정의 안 됨 에러 방지용 임시 변수
const resultArtist = "Dummy";

console.log("=== TEST 1: 미노이 & 우원재 vs 쇼미더머니 (동전한닢) ===");
// queryArtist는 5단계에서 빈값으로 감
const r1 = checkArtistMatch("", "쇼미더머니 (Show Me The Money)", "미노이 & 우원재");
console.log(`Result 1: ${r1}\n`);

console.log("=== TEST 2: 잠수이별 vs 동전한닢 ===");
const r2 = isSingleTitleMatch("잠수이별", "동전한닢 (A Coin)", "잠수이별");
console.log(`Result 2: ${r2}\n`);

console.log("=== TEST 3: 유라 (youra) vs 쇼미더머니 ===");
const r3 = checkArtistMatch("", "쇼미더머니 (Show Me The Money)", "유라 (youra)");
console.log(`Result 3: ${r3}\n`);

console.log("=== TEST 4: 하류 vs 동전한닢 ===");
const r4 = isSingleTitleMatch("하류 (The Bottom)", "동전한닢 (A Coin)", "하류 (The Bottom)");
console.log(`Result 4: ${r4}\n`);

console.log("=== TEST 5: 림킴 (Lim Kim) vs 우효 (민들레) ===");
const r5 = checkArtistMatch("", "OOHYO (우효)", "림킴 (Lim Kim)");
console.log(`Result 5: ${r5}\n`);

console.log("=== TEST 6: 샘김 (Sam Kim) vs 아이엠 (I.M) ===");
const r6 = checkArtistMatch("", "I.M (아이엠)", "Sam Kim");
console.log(`Result 6: ${r6}\n`);

console.log("=== TEST 7: awoo vs Awoo (민들레) ===");
const r7 = isSingleTitleMatch("awoo", "Awoo", "민들레");
console.log(`Result 7: ${r7}\n`);

console.log("=== TEST 8: Daniel Caesar - Neu Bleach vs Neu Roses ===");
const isArtMatched = checkArtistMatch("Daniel Caesar", "Daniel Caesar", "Daniel Caesar");
const isTiMatched = checkTitleMatch("neu roses (transgressor's song)", "Neu Roses (Transgressor’s Song)", "Neu Bleach");
console.log(`Artist Matched: ${isArtMatched}, Title Matched: ${isTiMatched}\n`);
