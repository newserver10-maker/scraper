import * as fs from 'fs';
import * as cheerio from 'cheerio';

async function main() {
  const html = fs.readFileSync('scratch/melon_detail.html', 'utf-8');
  const $ = cheerio.load(html);
  
  // d_video_lyric id를 가진 엘리먼트와 .lyric 클래스를 가진 엘리먼트를 검사
  const lyricDivById = $('#d_video_lyric');
  const lyricDivByClass = $('.lyric');
  const lyricDivByClassEx = $('.lyric_txt'); // 혹시 다른 클래스명이 있는지
  
  console.log('Lyric Div by ID exists:', lyricDivById.length);
  if (lyricDivById.length > 0) {
    console.log('Lyric Div by ID HTML (partial):', lyricDivById.html()?.substring(0, 500));
    
    // br 태그 개행문자 처리 후 텍스트 추출 검증
    const clone = lyricDivById.clone();
    clone.find('br').replaceWith('\n');
    console.log('Processed Lyric text (first 300 chars):\n', clone.text().trim().substring(0, 300));
  }
  
  console.log('Lyric Div by Class exists:', lyricDivByClass.length);
  if (lyricDivByClass.length > 0) {
    console.log('Lyric Div by Class HTML (partial):', lyricDivByClass.html()?.substring(0, 500));
  }
}

main().catch(console.error);
