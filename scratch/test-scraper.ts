import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import { parsePlaylistText } from '../src/utils/parser';

// === Node.js 환경에서 브라우저 DOMParser 모킹 ===
class MockDOMParser {
  parseFromString(html: string, mimeType: string) {
    const $ = cheerio.load(html);
    
    function wrapElement(el: any): any {
      if (!el || el.length === 0) return null;
      return {
        parentNode: {
          replaceChild(newNode: any, oldNode: any) {
            $(el).replaceWith(newNode);
          }
        },
        getAttribute(name: string) {
          return $(el).attr(name) || null;
        },
        get href() {
          return $(el).attr('href') || '';
        },
        cloneNode(deep: boolean = true) {
          const clone = $(el).clone();
          return {
            querySelectorAll(sel: string) {
              const subEls: any[] = [];
              clone.find(sel).each((_, subEl) => {
                subEls.push(wrapElement($(subEl)));
              });
              return subEls;
            },
            querySelector(sel: string) {
              const subEl = clone.find(sel).first();
              return wrapElement(subEl);
            },
            get textContent() {
              return clone.text();
            }
          };
        },
        querySelectorAll(sel: string) {
          const subEls: any[] = [];
          $(el).find(sel).each((_, subEl) => {
            subEls.push(wrapElement($(subEl)));
          });
          return subEls;
        },
        querySelector(sel: string) {
          const subEl = $(el).find(sel).first();
          return wrapElement(subEl);
        },
        get textContent() {
          return $(el).text();
        }
      };
    }

    return {
      createTextNode(text: string) {
        return text;
      },
      querySelectorAll(selector: string) {
        const subEls: any[] = [];
        $(selector).each((_, el) => {
          subEls.push(wrapElement($(el)));
        });
        return subEls;
      },
      querySelector(selector: string) {
        const el = $(selector).first();
        return wrapElement(el);
      }
    };
  }
}

// 전역 객체 모킹 주입
(global as any).DOMParser = MockDOMParser;
(global as any).document = {
  createTextNode: (text: string) => text
};

// clientScraper 직접 import
import { scrapeSongLyricsClient } from '../src/utils/clientScraper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runScrapeTest() {
  const token = process.env.GENIUS_API_TOKEN;
  if (!token) {
    console.error('❌ 에러: GENIUS_API_TOKEN이 .env에 설정되어 있지 않습니다.');
    return;
  }

  const planPath = path.join(__dirname, '../master_plan.txt');
  const text = fs.readFileSync(planPath, 'utf-8');
  const tracks = parsePlaylistText(text);

  console.log('--- Genius API 스크래핑 테스트 시작 (개선 후) ---');
  console.log(`총 ${tracks.length}개 트랙의 가사를 순차적으로 스크래핑 해봅니다...`);

  let successCount = 0;
  let failCount = 0;
  const failedList: string[] = [];

  for (const track of tracks) {
    console.log(`\n[Track ${track.number}] ${track.titleKo}`);
    for (const ref of track.references) {
      process.stdout.write(`  - 수집 시도: ${ref.artist} - ${ref.title} ... `);
      try {
        // 실제 프로덕션 스크래퍼 코드 호출!
        const result = await scrapeSongLyricsClient(ref.artist, ref.title, token);
        if (result.lyrics && result.lyrics.length > 50) {
          console.log(`✅ 성공 (가사 ${result.lyrics.length}자)`);
          successCount++;
        } else {
          console.log('❌ 실패 (가사 검색/파싱 안 됨)');
          failCount++;
          failedList.push(`${track.number}번 트랙: ${ref.artist} - ${ref.title}`);
        }
      } catch (err) {
        console.log(`❌ 실패 (에러: ${(err as Error).message})`);
        failCount++;
        failedList.push(`${track.number}번 트랙: ${ref.artist} - ${ref.title}`);
      }
      await delay(200);
    }
  }

  console.log('\n--- 테스트 결과 요약 ---');
  console.log(`성공: ${successCount}곡 / 실패: ${failCount}곡`);
  if (failedList.length > 0) {
    console.log('❌ 실패한 곡 목록:');
    failedList.forEach((f) => console.log(`  * ${f}`));
  } else {
    console.log('✅ 모든 가사를 정상적으로 수집 완료했습니다!');
  }
}

runScrapeTest();
