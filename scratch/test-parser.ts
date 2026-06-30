import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parsePlaylistText } from '../src/utils/parser';

try {
  const planPath = resolve('v4_plan.txt');
  const planText = readFileSync(planPath, 'utf-8');
  console.log('--- Plan Text Loaded ---');
  
  const tracks = parsePlaylistText(planText);
  console.log(`Total Tracks Parsed: ${tracks.length}`);
  
  const track3 = tracks.find(t => t.number === 3);
  if (track3) {
    console.log('\nTrack 3 Details:');
    console.log(`Title (Ko): ${track3.titleKo}`);
    console.log(`Title (En): ${track3.titleEn}`);
    console.log('References:');
    track3.references.forEach((ref, idx) => {
      console.log(`  [${idx + 1}] Artist: "${ref.artist}", Title: "${ref.title}", Language: "${ref.language}"`);
    });
  } else {
    console.log('Track 3 not found!');
  }
} catch (error) {
  console.error('Error running parser test:', error);
}
