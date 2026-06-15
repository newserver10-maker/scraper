/**
 * master_plan.txt를 새 파서로 파싱하여 결과를 출력하는 테스트 스크립트 v4
 */
import { readFileSync } from 'fs';

const BLACKLIST_KEYWORDS = [
  '공간 서사', '공간서사', '알고리즘', '프로젝트명', '부제',
  '기획의 본질', '기획의본질', '시각적 무드', '시각적무드',
  '영상 제목', '영상제목', '알고리즘 전술',
  '보컬 가창법', '보컬가창법', '보컬 가창', '보컬가창',
  '가창자 성별', '가창자성별', '가창법', '창법',
  '벨팅', '팔세토', '비브라토', '포르타멘토', '멈블링',
  '위스퍼', '스타카토', '레이백', '스트레이트 톤',
  '보컬 런', 'Vocal Runs', '스포큰 워드',
  '주요 악기', '주요악기', '연주법',
  '피아노', '기타', '베이스', '드럼', '신디사이저', '신스',
  '바이브라폰', '첼로', '콘트라베이스', '윈드차임',
  '아르페지오', '피치카토', '핑거 피킹', '핑거피킹',
  '페달', '하모닉스', '플래졸레',
  '청각적 후킹', '청각적후킹', '후킹 요소', '후킹요소',
  '음악 장르', '음악장르', '템포', 'BPM',
  '음악 구성', '음악구성',
  '리버브', '딜레이', '이펙터', '컴프레서', '필터',
  '코러스 파트', '브릿지 구간', '인트로', '아웃트로',
  'Intro', 'Outro', 'Verse', 'Chorus', 'Bridge',
  '사이드체인', '로우패스', '하이패스',
  '스테레오', '패닝', '믹싱',
];

function isValidReference(artist, title) {
  if (!artist || !title) return false;
  if (artist.length < 1 || title.length < 1) return false;
  // 아티스트명에만 블랙리스트 적용
  const isBlacklisted = BLACKLIST_KEYWORDS.some((keyword) => artist.includes(keyword));
  if (isBlacklisted) return false;
  const strippedArtist = artist.replace(/[\s\-_()&]/g, '');
  if (/^\d+$/.test(strippedArtist)) return false;
  if (artist.length > 40) return false;
  if (/\d+s\)/.test(title) || /➔/.test(title)) return false;
  // 괄호 안 마침표 제외
  const artistWithoutParens = artist.replace(/\(.*?\)/g, '');
  const punctuationCount = (artistWithoutParens.match(/[。.!?]/g) || []).length;
  if (punctuationCount >= 2) return false;
  return true;
}

function parsePlaylistText(text) {
  const tracks = [];
  const trackBlocks = text.split(/(?=Track \d+:)/g);
  
  for (const block of trackBlocks) {
    if (!block.trim().startsWith('Track')) continue;
    const headerMatch = block.match(/Track (\d+):\s*([^\(\n\r]+)(?:\(([^\)\n\r]+)\))?/);
    if (!headerMatch) continue;
    const trackNum = parseInt(headerMatch[1], 10);
    const titleKo = headerMatch[2].trim();
    const titleEn = headerMatch[3] ? headerMatch[3].trim() : titleKo;
    const genreMatch = block.match(/(?:장르|음악 장르):\s*([^\n\r]+)/);
    const genre = genreMatch ? genreMatch[1].trim() : '알 수 없음';
    const bpmMatch = block.match(/(?:템포|BPM):\s*(\d+)/);
    const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : 80;
    const refMatch = block.match(
      /가사 레퍼런스:\s*([\s\S]*?)(?=\n\s*[●•◆▶○■◇▷★☆]\s|\n\s*Track\s|\n\s*BLOCK\s|\n\s*---|\n\s*\n\s*\n|$)/
    );
    const references = [];
    
    if (refMatch) {
      let refText = refMatch[1].trim();
      refText = refText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      refText = refText.replace(/\.\s*$/, '');
      
      const songPattern = /([^,]+?)\s+[-–—~]\s+(.+?)(?=,\s*[^,]+?\s+[-–—~]\s|$)/g;
      const songsRaw = [];
      let match;
      while ((match = songPattern.exec(refText)) !== null) {
        songsRaw.push(`${match[1].trim()} - ${match[2].trim()}`);
      }
      if (songsRaw.length === 0) {
        songsRaw.push(...refText.split(/\s*,\s*|;/));
      }
      
      for (const songRaw of songsRaw) {
        const cleaned = songRaw.trim().replace(/^[-•*#▪▸▹◦\d+).\s]+/, '');
        if (!cleaned || cleaned.length < 3) continue;
        const parts = cleaned.split(/\s*[-–—~]\s*/);
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          const songTitle = parts.slice(1).join('-').trim();
          if (!isValidReference(artist, songTitle)) continue;
          const language = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(artist + songTitle) ? 'ko' : 'en';
          references.push({ artist, title: songTitle, language });
        }
      }
    }
    
    let blockGroup = 'A';
    if (trackNum > 5 && trackNum <= 10) blockGroup = 'B';
    else if (trackNum > 10 && trackNum <= 15) blockGroup = 'C';
    else if (trackNum > 15) blockGroup = 'D';
    tracks.push({ number: trackNum, titleKo, titleEn, block: blockGroup, genre, bpm, references });
  }
  return tracks.sort((a, b) => a.number - b.number);
}

// 전체 기대값
const EXPECTED = {
  1: [['오존 (O3ohn)', 'Down'], ['Cigarettes After Sex', 'K.'], ['Radiohead', 'Lift']],
  2: [['림킴 (Lim Kim)', '민들레'], ['Jhené Aiko', 'Stay Ready'], ['Imogen Heap', 'Hide and Seek']],
  3: [['루시드폴', '보이지 않는 날들'], ['Damien Rice', 'Delicate'], ['Jose Gonzalez', 'Stay Alive']],
  4: [['백예린', 'Our Love Is Great'], ['Corinne Bailey Rae', 'Like A Star'], ['Billie Eilish', 'Ocean Eyes']],
  5: [['미노이 & 우원재', '잠수이별'], ['Daniel Caesar', 'Neu Bleach'], ['James Blake', 'Lindisfarne']],
  6: [['검정치마', '섬 (Island)'], ['Beach House', 'Myth'], ['Novo Amor', 'Carry You']],
  7: [['유라 (youra)', '하류 (The Bottom)'], ['FKA Twigs', 'Cellophane'], ['Joji', 'Will He']],
  8: [['디오 (D.O.)', '괜찮아도 괜찮아'], ['Frank Ocean', 'Swim Good'], ['The Weeknd', 'Call Out My Name']],
  9: [['딘 (DEAN)', '풀어 (Pour Up)'], ['Khalid', 'Coaster'], ['SZA', 'Saturn']],
  10: [['카더가든 & 오존', '의연한 악수'], ['Sufjan Stevens', 'Fourth of July'], ['Sigur Ros', 'Svefn-g-englar']],
  11: [['선우정아', '도망가자'], ['Tom Misch', 'Lost in Paris'], ['Chet Baker', 'Alone Together']],
  12: [['샘김 (Sam Kim)', '향수'], ['Mac Miller', 'We'], ['Erykah Badu', "Didn't Cha Know"]],
  13: [['이소라', '트랙 9'], ['FKJ', 'Skyline'], ["D'Angelo", 'Untitled (How Does It Feel)']],
  14: [['백예린', '야간비행'], ['Musiq Soulchild', 'Love'], ['Amy Winehouse', 'Love Is A Losing Game']],
  15: [['권진아 & 샘김', '여기까지'], ['Bruno Major', 'Nothing'], ['Daniel Caesar', 'Japanese Denim']],
  16: [['곽진언', '자유롭게'], ['Iron & Wine', 'Flightless Bird, American Mouth'], ['Bon Iver', 'Holocene']],
  17: [['신해경', '낭만파'], ['Slowdive', 'Space Station'], ['Cocteau Twins', 'Sea, Swallow Me']],
  18: [['김광석', '거리에서'], ['Kings of Convenience', 'Homesick'], ['Fleet Foxes', 'Tiger Mountain Peasant Song']],
  19: [['안다영', '밤 패닝'], ['Mazzy Star', 'Fade Into You'], ['Lana Del Rey', 'Video Games']],
  20: [['새소년', '이방인'], ['Jonsi', 'Go Do'], ['Sufjan Stevens', 'Mystery of Love']],
};

const text = readFileSync('master_plan.txt', 'utf8');
const tracks = parsePlaylistText(text);

let totalRefs = 0;
for (const track of tracks) {
  for (const ref of track.references) totalRefs++;
}

console.log(`\n===== 요약 =====`);
console.log(`총 트랙: ${tracks.length}개 | 총 레퍼런스: ${totalRefs}개 | 기대: 60`);

let pass = 0, fail = 0;
for (const [trackNum, expected] of Object.entries(EXPECTED)) {
  const track = tracks.find(t => t.number === parseInt(trackNum));
  if (!track) { console.log(`❌ Track ${trackNum} 누락`); fail += expected.length; continue; }
  for (let i = 0; i < expected.length; i++) {
    const [expA, expT] = expected[i];
    const actual = track.references[i];
    if (!actual) { console.log(`❌ T${trackNum}[${i}] 누락 — 기대: "${expA} - ${expT}"`); fail++; }
    else if (actual.artist === expA && actual.title === expT) { pass++; }
    else { console.log(`⚠  T${trackNum}[${i}] "${actual.artist} - ${actual.title}" ≠ "${expA} - ${expT}"`); fail++; }
  }
}
console.log(`\n✅ ${pass}/${pass+fail} 통과 (${((pass/(pass+fail))*100).toFixed(1)}%)`);
