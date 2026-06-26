import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parsePlaylistText } from '../src/utils/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// V4 기획안 파싱 테스트
const planPath = path.join(__dirname, '../v4_plan.txt');
const text = fs.readFileSync(planPath, 'utf-8');
const tracks = parsePlaylistText(text);

console.log('--- V4 기획안 (16번 플레이리스트) 파싱 테스트 ---');
console.log(`파싱된 트랙 수: ${tracks.length}`);

let totalRefs = 0;
let tracksWithIssues: string[] = [];

for (const track of tracks) {
  console.log(`\nTrack ${String(track.number).padStart(2, '0')}. ${track.titleKo} (${track.titleEn})`);
  console.log(`  - 장르: ${track.genre}`);
  console.log(`  - BPM: ${track.bpm}`);
  console.log(`  - 블록: ${track.block}`);
  console.log(`  - 레퍼런스 수: ${track.references.length}`);
  
  if (track.references.length < 3) {
    tracksWithIssues.push(`Track ${track.number}: ${track.titleKo} — 레퍼런스 ${track.references.length}개 (3개 미만!)`);
  }
  
  for (let i = 0; i < track.references.length; i++) {
    const ref = track.references[i];
    console.log(`    [${i + 1}] ${ref.artist} - ${ref.title} (${ref.language})`);
    totalRefs++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`총 ${tracks.length}개 트랙, ${totalRefs}개 레퍼런스`);

if (tracksWithIssues.length > 0) {
  console.log(`\n⚠️ 문제 있는 트랙 (레퍼런스 3개 미만):`);
  tracksWithIssues.forEach(issue => console.log(`  * ${issue}`));
} else if (tracks.length === 20 && totalRefs === 60) {
  console.log('✅ 완벽: 20트랙 × 3레퍼런스 = 60곡 전부 파싱 성공!');
} else {
  console.log(`❌ 기대: 20트랙/60레퍼런스, 실제: ${tracks.length}트랙/${totalRefs}레퍼런스`);
}
