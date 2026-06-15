// Track 8 디버깅
const refText = "디오 (D.O.) - 괜찮아도 괜찮아, Frank Ocean - Swim Good, The Weeknd - Call Out My Name";

const songPattern = /([^,]+?)\s+[-–—~]\s+(.+?)(?=,\s*[^,]+?\s+[-–—~]\s|$)/g;

let match;
while ((match = songPattern.exec(refText)) !== null) {
  console.log(`artist: "${match[1].trim()}" | title: "${match[2].trim()}"`);
}

// Track 19 디버깅
console.log('\n---\n');
const refText19 = "안다영 - 밤 패닝, Mazzy Star - Fade Into You, Lana Del Rey - Video Games";

const songPattern2 = /([^,]+?)\s+[-–—~]\s+(.+?)(?=,\s*[^,]+?\s+[-–—~]\s|$)/g;

while ((match = songPattern2.exec(refText19)) !== null) {
  console.log(`artist: "${match[1].trim()}" | title: "${match[2].trim()}"`);
}
