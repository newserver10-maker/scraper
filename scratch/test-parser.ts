import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parsePlaylistText } from '../src/utils/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function testParser() {
  const filePath = path.join(__dirname, '../master_plan.txt');
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  console.log('--- master_plan.txt 파싱 테스트 시작 ---');
  const tracks = parsePlaylistText(fileContent);

  console.log(`파싱된 트랙 수: ${tracks.length}`);

  let hasError = false;

  tracks.forEach((track) => {
    console.log(`Track ${String(track.number).padStart(2, '0')}: ${track.titleKo} (${track.titleEn})`);
    console.log(`  - 장르: ${track.genre}`);
    console.log(`  - BPM: ${track.bpm}`);
    console.log(`  - 블록: ${track.block}`);
    console.log(`  - 레퍼런스 수: ${track.references.length}`);
    track.references.forEach((ref, idx) => {
      console.log(`    [${idx + 1}] ${ref.artist} - ${ref.title} (${ref.language})`);
    });

    if (track.references.length === 0) {
      console.error(`  ❌ 에러: Track ${track.number}에 레퍼런스가 존재하지 않습니다!`);
      hasError = true;
    }
  });

  if (tracks.length !== 20) {
    console.error(`❌ 에러: 파싱된 트랙 수가 20개가 아닙니다 (현재: ${tracks.length}개)`);
    hasError = true;
  }

  if (hasError) {
    console.log('❌ 테스트 실패: 파싱 도중 일부 데이터 누락이 발견되었습니다.');
  } else {
    console.log('✅ 테스트 성공: 모든 트랙 및 레퍼런스가 정상 파싱되었습니다.');
  }
}

testParser();
