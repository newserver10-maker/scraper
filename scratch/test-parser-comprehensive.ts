import { parsePlaylistText } from '../src/utils/parser';

/**
 * 다양한 기획안 형식 변형에 대한 파서 범용성 테스트
 * 
 * WHY: 기획안마다 형식이 조금씩 바뀔 수 있으므로, 다양한 변형 패턴을 테스트하여
 *      파서가 범용적으로 동작하는지 검증합니다.
 */

let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => boolean) {
  totalTests++;
  try {
    if (fn()) {
      console.log(`  ✅ ${name}`);
      passedTests++;
    } else {
      console.log(`  ❌ ${name}`);
    }
  } catch (e) {
    console.log(`  ❌ ${name} — 에러: ${(e as Error).message}`);
  }
}

// === 테스트 1: 기존 14번 기획안 형식 (마침표 구분) ===
console.log('\n[테스트 1] 기존 형식 — 마침표 구분, ● 불릿');
{
  const text = `
Track 01: 관제탑의 불빛 (Tower Lights)
● 음악 장르: Ambient Pop
● 템포: 80 BPM
● 가사 레퍼런스: 오존 (O3ohn) - Down, Cigarettes After Sex - K., Radiohead - Lift.
Track 02: 중력 이탈 (Zero Gravity)
● 음악 장르: Downtempo R&B
● 템포: 82 BPM
● 가사 레퍼런스: 림킴 (Lim Kim) - 민들레, Jhené Aiko - Stay Ready, Imogen Heap - Hide and Seek.
`;
  const tracks = parsePlaylistText(text);
  test('2개 트랙 파싱', () => tracks.length === 2);
  test('Track 01: 3개 레퍼런스', () => tracks[0].references.length === 3);
  test('Track 01: K. 곡명 보존', () => tracks[0].references[1].title === 'K.');
  test('Track 02: 3개 레퍼런스', () => tracks[1].references.length === 3);
  test('Track 02: 림킴 아티스트명', () => tracks[1].references[0].artist === '림킴 (Lim Kim)');
}

// === 테스트 2: 콤마 없이 마침표만으로 구분하는 형식 ===
console.log('\n[테스트 2] 마침표 구분 형식');
{
  const text = `
Track 01. 새벽의 주파수 (Dawn Frequency)
* 음악 장르: Ambient Pop
* 템포: 78 BPM
* 가사 레퍼런스: 잔나비 - 주저하는 연인들을 위해. 검정치마 - 기다린 만큼, 더. Radiohead - Creep.
`;
  const tracks = parsePlaylistText(text);
  test('1개 트랙 파싱', () => tracks.length === 1);
  test('3개 레퍼런스', () => tracks[0].references.length === 3);
  test('잔나비 아티스트', () => tracks[0].references[0].artist === '잔나비');
}

// === 테스트 3: D.O. 같은 마침표 포함 아티스트명 ===
console.log('\n[테스트 3] 마침표 포함 아티스트명 (D.O.)');
{
  const text = `
Track 08: 날개 위의 경고등 (Strobe Light)
● 음악 장르: Future Dream Pop
● 템포: 75 BPM
● 가사 레퍼런스: 디오 (D.O.) - 괜찮아도 괜찮아, Frank Ocean - Swim Good, The Weeknd - Call Out My Name.
`;
  const tracks = parsePlaylistText(text);
  test('Track 08: 3개 레퍼런스', () => tracks[0].references.length === 3);
  test('디오 (D.O.) 아티스트명 보존', () => tracks[0].references[0].artist === '디오 (D.O.)');
  test('괜찮아도 괜찮아 곡명', () => tracks[0].references[0].title === '괜찮아도 괜찮아');
}

// === 테스트 4: 줄바꿈이 포함된 레퍼런스 (PDF 복사 형식) ===
console.log('\n[테스트 4] 줄바꿈 포함 레퍼런스 (PDF 복사 형식)');
{
  const text = `
Track 17: 흰색 가운의 촉감 (White Linen)
●​ 음악 장르: Shoegaze Ambient
●​ 템포: 65 BPM
●​ 가사 레퍼런스: 신해경 - 낭만파, Slowdive - Space Station, Cocteau Twins - Sea, 
Swallow Me.
Track 18: 낯선 베란다 (Foreign Balcony)
`;
  const tracks = parsePlaylistText(text);
  test('Track 17: 3개 레퍼런스', () => tracks[0].references.length === 3);
  // "Sea, Swallow Me"는 줄바꿈을 거쳐 이어진 곡명
  test('Cocteau Twins 곡명', () => tracks[0].references[2].title === 'Sea, Swallow Me');
}

// === 테스트 5: * 불릿 사용 형식 ===
console.log('\n[테스트 5] 별표(*) 불릿 사용 형식');
{
  const text = `
Track 03: 활주로의 직선 (The Runway)
* 음악 장르: Ethereal Chill Pop
* 템포: 81 BPM
* 가사 레퍼런스: 루시드폴 - 보이지 않는 날들, Damien Rice - Delicate, Jose Gonzalez - Stay Alive.
* 주요 악기: 나일론 기타
`;
  const tracks = parsePlaylistText(text);
  test('1개 트랙 파싱', () => tracks.length === 1);
  test('3개 레퍼런스', () => tracks[0].references.length === 3);
}

// === 테스트 6: Part 구조 기반 기획안 ===
console.log('\n[테스트 6] Part 구조 기반 (V4 형식)');
{
  const text = `
Part 1: 로비 문을 밀기까지 (Track 01~05 / 80~83 BPM)
Track 01: 커피향의 기상 (Coffee Wake)
* 음악 장르: Acoustic Morning Pop
* 템포: 80 BPM
* 가사 레퍼런스: 적재 - 나랑 같이 걸을래, Ed Sheeran - Photograph, Norah Jones - Sunrise.
Track 06: 분주한 아침 (Morning Rush)
* 음악 장르: Lo-fi Jazzhop
* 템포: 84 BPM
* 가사 레퍼런스: 혁오 - TOMBOY, Tom Misch - It Runs Through Me, Mac DeMarco - Chamber of Reflection.
Part 2: 아침의 분주한 숨의 여백 (Track 06~10 / 84~87 BPM)
`;
  const tracks = parsePlaylistText(text);
  test('2개 트랙 파싱', () => tracks.length === 2);
  test('Track 01: Block A', () => tracks[0].block === 'A');
  test('Track 06: Block B', () => tracks[1].block === 'B');
  test('Track 01: 3개 레퍼런스', () => tracks[0].references.length === 3);
}

// === 테스트 7: 콜라보레이션 아티스트 (&) ===
console.log('\n[테스트 7] 콜라보레이션 아티스트 (&)');
{
  const text = `
Track 15: 체크인 타임 (04:00 AM)
● 음악 장르: Midnight R&B Duet
● 템포: 86 BPM
● 가사 레퍼런스: 권진아 & 샘김 - 여기까지, Bruno Major - Nothing, Daniel Caesar - Japanese Denim.
`;
  const tracks = parsePlaylistText(text);
  test('1개 트랙 파싱', () => tracks.length === 1);
  test('Track 15: 3개 레퍼런스', () => tracks[0].references.length === 3);
  test('콜라보 아티스트명', () => tracks[0].references[0].artist === '권진아 & 샘김');
}

// === 테스트 8: BLOCK 패턴 명시된 기획안 ===
console.log('\n[테스트 8] BLOCK 패턴 명시');
{
  const text = `
BLOCK A: 이륙과 이탈 (Track 01~05)
Track 01: 관제탑의 불빛 (Tower Lights)
● 음악 장르: Ambient Pop
● 템포: 80 BPM
● 가사 레퍼런스: 오존 (O3ohn) - Down, Cigarettes After Sex - K., Radiohead - Lift.
BLOCK B: 순항 고도 (Track 06~10)
Track 06: 고도 10,000ft (Cruising)
● 음악 장르: Atmospheric Synth Pop
● 템포: 72 BPM
● 가사 레퍼런스: 검정치마 - 섬 (Island), Beach House - Myth, Novo Amor - Carry You.
`;
  const tracks = parsePlaylistText(text);
  test('2개 트랙 파싱', () => tracks.length === 2);
  test('Track 01: Block A', () => tracks[0].block === 'A');
  test('Track 06: Block B', () => tracks[1].block === 'B');
}

// === 테스트 9: '음악 레퍼런스' 키워드 변형 ===
console.log('\n[테스트 9] "음악 레퍼런스" 키워드 변형');
{
  const text = `
Track 01: 새벽 산책 (Morning Walk)
* 장르: Ambient Folk
* 템포: 75 BPM
* 음악 레퍼런스: Fleet Foxes - White Winter Hymnal, Bon Iver - Skinny Love, Iron & Wine - Boy with a Coin.
`;
  const tracks = parsePlaylistText(text);
  test('1개 트랙 파싱', () => tracks.length === 1);
  test('Track 01: 3개 레퍼런스', () => tracks[0].references.length === 3);
}

// === 테스트 10: '참고곡' 키워드 변형 ===
console.log('\n[테스트 10] "참고곡" 키워드 변형');
{
  const text = `
Track 05: 새벽 바다 (Dawn Sea)
● 장르: Dream Pop
● 템포: 70 BPM
● 참고곡: Lana Del Rey - Video Games, Mazzy Star - Fade Into You, Beach House - Space Song.
`;
  const tracks = parsePlaylistText(text);
  test('1개 트랙 파싱', () => tracks.length === 1);
  test('Track 05: 3개 레퍼런스', () => tracks[0].references.length === 3);
}

// === 결과 요약 ===
console.log(`\n${'='.repeat(50)}`);
console.log(`총 ${totalTests}개 테스트 중 ${passedTests}개 통과 (${totalTests - passedTests}개 실패)`);
if (passedTests === totalTests) {
  console.log('✅ 모든 테스트 통과!');
} else {
  console.log('❌ 일부 테스트 실패');
}
