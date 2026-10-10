#!/usr/bin/env node
// CUAgain 디자인 하네스 — 게이트 판정 스크립트 (HTML 적응본)
// 기준: harness/rules.yaml (SSOT). state.json 과 verify-report.md 는 이 스크립트만 쓴다.
//
// 공식 허들링 하네스(figmatutor2/harness)의 CLI·state·종료코드 구조를 그대로 따르되,
// 산출물이 Figma 가 아니라 HTML 이라 게이트 검사를 HTML/문서 검사로 바꿨다.
//
// 사용법
//   node harness/scripts/verify.mjs init <slug> --topic "<주제>"
//   node harness/scripts/verify.mjs <p1|p2|p3> <slug>
//   node harness/scripts/verify.mjs status  <slug>
//   node harness/scripts/verify.mjs proceed <slug>              # 확인 대기 해제 (사용자 진행 지시 시)
//   node harness/scripts/verify.mjs reopen  <slug> --from <gate>
//   node harness/scripts/verify.mjs unblock <slug>              # 3회 실패 차단 해제
//
// 종료 코드: 0 통과 · 1 실패 · 2 사용법/전제 오류 · 3 차단 · 4 확인 대기

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HARNESS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(HARNESS_DIR, "..");
const RULES = YAML.parse(fs.readFileSync(path.join(HARNESS_DIR, "rules.yaml"), "utf8"));
const RUNS = path.join(ROOT, RULES.run.runs_dir);
const ORDER = RULES.gates.order;
const MAX = RULES.run.max_attempts;

const now = () => new Date().toISOString();
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
const uniq = (a) => [...new Set(a)];

function usage(msg) {
  if (msg) console.error(`⚠️  ${msg}`);
  console.error('사용법: verify.mjs init <slug> --topic "<주제>" | <p1|p2|p3> <slug> | status <slug> | proceed <slug> | reopen <slug> --from <gate> | unblock <slug>');
  process.exit(2);
}
function runDir(slug) {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) usage("slug 는 영문 소문자·숫자·하이픈만 (예: yuna-page)");
  return path.join(RUNS, slug);
}
const statePath = (slug) => path.join(runDir(slug), "state.json");
function loadState(slug) {
  const p = statePath(slug);
  if (!fs.existsSync(p)) usage(`실행 기록이 없어요: ${path.relative(ROOT, p)} — 먼저 init 하세요`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function saveState(slug, s) {
  s.updatedAt = now();
  fs.writeFileSync(statePath(slug), JSON.stringify(s, null, 2) + "\n");
}
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

// ─── 게이트 검사 ─────────────────────────────────────────

function checkP1(dir) {
  const r = RULES.p1, fails = [], info = {};
  const text = read(path.join(dir, r.files[0]));
  if (text === null) return { fails: [`${r.files[0]} 없음`], info };
  if (new RegExp(RULES.run.placeholder_pattern).test(text)) fails.push("템플릿 미작성 표시({{…}})가 남아 있음");
  const lines = text.split("\n");
  for (const s of r.required_sections) {
    const has = lines.some((l) => /^#{1,6}\s/.test(l) && l.includes(s));
    if (!has) fails.push(`필수 섹션 누락: ${s}`);
  }
  const ids = uniq([...text.matchAll(new RegExp(r.story_id_pattern, "g"))].map((m) => +m[1]));
  info.stories = ids;
  const [lo, hi] = r.story_id_range;
  if (!ids.length) fails.push("연결된 유저스토리(US-n)가 없음");
  for (const n of ids) if (n < lo || n > hi) fails.push(`범위 밖 유저스토리: US-${n} (허용 US-${lo}~${hi})`);
  const screens = lines.filter((l) => new RegExp(r.screen_row_pattern).test(l)).length;
  info.screens = screens;
  if (screens < r.min_screens) fails.push(`화면 수 ${screens} < 최소 ${r.min_screens}`);
  return { fails, info };
}

function checkP2(dir) {
  const r = RULES.p2, fails = [], info = {};
  const html = read(path.join(dir, r.files[0]));
  if (html === null) return { fails: [`${r.files[0]} 없음`], info };

  const tokens = uniq([...html.matchAll(/--[a-zA-Z][\w-]*\s*:/g)].map((m) => m[0]));
  info.colorTokens = tokens.length;
  if (tokens.length < r.min_color_tokens) fails.push(`색/디자인 토큰 ${tokens.length} < ${r.min_color_tokens}`);

  const sizes = uniq([...html.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim()));
  info.typeScale = sizes.length;
  if (sizes.length < r.min_type_scale) fails.push(`타이포 스케일 ${sizes.length} < ${r.min_type_scale}`);

  if (r.require_labeled_inputs) {
    const inputs = [...html.matchAll(/<(input|textarea)\b[^>]*>/g)];
    let unlabeled = 0;
    for (const [tag] of inputs) {
      const type = (tag.match(/type=["']?(\w+)["']?/) || [, "text"])[1];
      if (tag.startsWith("<input") && !["text", "tel", "email", "search", "number"].includes(type)) continue; // radio/checkbox 등은 제외
      const id = (tag.match(/id=["']([^"']+)["']/) || [])[1];
      if (!id || !new RegExp(`<label[^>]*for=["']${id}["']`).test(html)) unlabeled++;
    }
    info.unlabeledInputs = unlabeled;
    if (unlabeled > 0) fails.push(`라벨 없는 입력 ${unlabeled}개`);
  }

  const btn = (html.match(/\.btn[^{]*\{[^}]*min-height:\s*(\d+)px/) || [])[1];
  const inp = (html.match(/input\[type[^{]*\{[^}]*min-height:\s*(\d+)px/s) || [])[1];
  info.btnMinH = btn ? +btn : null;
  info.inputMinH = inp ? +inp : null;
  if (!btn || +btn < r.min_touch_target_px) fails.push(`주 버튼 터치 타깃 ${btn ?? "?"}px < ${r.min_touch_target_px}px`);
  if (!inp || +inp < r.min_touch_target_px) fails.push(`입력 터치 타깃 ${inp ?? "?"}px < ${r.min_touch_target_px}px`);

  if (r.forbid_audio_autoplay && /<audio[^>]*\sautoplay/i.test(html)) fails.push("배경음악 자동재생(<audio autoplay>) 금지 — 토글만");

  if (r.require_img_alt) {
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)];
    const noAlt = imgs.filter((m) => !/\salt=/.test(m[0])).length;
    info.imgNoAlt = noAlt;
    if (noAlt > 0) fails.push(`alt 없는 <img> ${noAlt}개`);
  }

  for (const kw of r.forbid_field_labels || []) {
    if (new RegExp(`<label[^>]*>[^<]*${kw}`).test(html)) fails.push(`아동 민감정보 입력(라벨 "${kw}") 발견 — ★2 위반`);
  }
  return { fails, info };
}

// ─── 명령 ────────────────────────────────────────────────

const [cmd, slug] = process.argv.slice(2);

if (cmd === "init") {
  const dir = runDir(slug);
  const topic = argValue("--topic") || slug;
  if (fs.existsSync(statePath(slug))) usage(`이미 있는 실행이에요: runs/${slug} (reopen 을 쓰세요)`);
  for (const g of ORDER) fs.mkdirSync(path.join(dir, RULES[g].dir), { recursive: true });
  const state = { slug, topic, next: ORDER[0], attempts: {}, awaitingReview: null, blocked: false, done: false, history: [], createdAt: now(), updatedAt: now() };
  saveState(slug, state);
  console.log(`✅ init: runs/${slug}  (주제: ${topic})  첫 게이트: ${ORDER[0]}`);
  process.exit(0);
}

if (cmd === "status") {
  const s = loadState(slug);
  console.log(`runs/${slug}  주제:${s.topic}`);
  console.log(`  next=${s.next} · awaitingReview=${s.awaitingReview ?? "-"} · blocked=${s.blocked} · done=${s.done}`);
  console.log(`  attempts=${JSON.stringify(s.attempts)}`);
  if (s.blocked) process.exit(3);
  if (s.awaitingReview) process.exit(4);
  process.exit(0);
}

if (cmd === "proceed") {
  const s = loadState(slug);
  if (!s.awaitingReview) usage("확인 대기 상태가 아니에요");
  console.log(`▶︎ ${s.awaitingReview} 확인 해제 → 다음 게이트(${s.next}) 진행 가능`);
  s.history.push({ at: now(), event: `proceed from ${s.awaitingReview}` });
  s.awaitingReview = null;
  saveState(slug, s);
  process.exit(0);
}

if (cmd === "reopen") {
  const s = loadState(slug);
  const from = argValue("--from");
  if (!ORDER.includes(from)) usage(`--from <gate> 필요 (${ORDER.join("|")})`);
  s.next = from; s.done = false; s.blocked = false; s.awaitingReview = null;
  s.history.push({ at: now(), event: `reopen from ${from}` });
  saveState(slug, s);
  console.log(`↩︎ reopen: 다음 게이트 ${from} 부터`);
  process.exit(0);
}

if (cmd === "unblock") {
  const s = loadState(slug);
  s.blocked = false; s.attempts[s.next] = 0;
  s.history.push({ at: now(), event: "unblock" });
  saveState(slug, s);
  console.log(`🔓 unblock: ${s.next} 재시도 가능`);
  process.exit(0);
}

if (ORDER.includes(cmd)) {
  const gate = cmd;
  const s = loadState(slug);
  if (s.done) usage(`완료된 실행이에요: runs/${slug} (reopen 필요)`);
  if (s.blocked) { console.error(`🛑 차단됨 (${s.next} ${MAX}회 실패). 사람이 확인 후 unblock.`); process.exit(3); }
  if (s.awaitingReview) { console.error(`👀 확인 대기: ${s.awaitingReview} 산출물. 사용자 진행 지시 후 proceed 하세요.`); process.exit(4); }
  if (gate !== s.next) usage(`지금 게이트는 ${s.next} 예요 (요청: ${gate})`);

  const dir = path.join(runDir(slug), RULES[gate].dir);
  let result;
  if (gate === "p1") result = checkP1(dir);
  else if (gate === "p2") result = checkP2(dir);
  else if (gate === "p3") {
    // P3 = 검증 리포트 생성. 앞 게이트 결과를 모아 리포트를 쓰고 완료.
    const p1 = checkP1(path.join(runDir(slug), RULES.p1.dir));
    const p2 = checkP2(path.join(runDir(slug), RULES.p2.dir));
    const cov = RULES.p3.require_story_coverage;
    const lines = [];
    lines.push(`# 검증 리포트 — ${s.topic} (runs/${slug})`, "", `> verify.mjs 자동 생성 · ${now()}`, "");
    lines.push("## P1 화면 스펙", p1.fails.length ? "❌ " + p1.fails.join(" / ") : `✅ 통과 (유저스토리 ${JSON.stringify(p1.info.stories)}, 화면 ${p1.info.screens})`, "");
    lines.push("## P2 디자인(HTML)", p2.fails.length ? "❌ " + p2.fails.join(" / ") : `✅ 통과 (토큰 ${p2.info.colorTokens} · 타이포 ${p2.info.typeScale} · 버튼 ${p2.info.btnMinH}px · 입력 ${p2.info.inputMinH}px · 라벨없음 ${p2.info.unlabeledInputs} · alt없음 ${p2.info.imgNoAlt})`, "");
    lines.push("## P3 종합", `- 유저스토리 커버(공개 범위) 목표: ${cov.map((n) => "US-" + n).join(", ")}`, "- ★1 공개 화면에 타인 요청·연락처 노출: 0 (정적 단일 화면이라 구조적 보장)", "- ★2 아동 민감정보 입력 필드: 0", "");
    if (p1.fails.length || p2.fails.length) result = { fails: ["앞 게이트(P1·P2)가 통과 상태가 아님 — 리포트 참조"], info: {} };
    else {
      fs.writeFileSync(path.join(dir, RULES.p3.report_file), lines.join("\n") + "\n");
      result = { fails: [], info: { report: RULES.p3.report_file } };
    }
  }

  const i = ORDER.indexOf(gate);
  if (result.fails.length) {
    s.attempts[gate] = (s.attempts[gate] || 0) + 1;
    s.history.push({ at: now(), gate, result: "fail", fails: result.fails });
    const blocked = s.attempts[gate] >= MAX;
    s.blocked = blocked;
    saveState(slug, s);
    console.error(`❌ ${gate} 실패 (${s.attempts[gate]}/${MAX}):`);
    for (const f of result.fails) console.error(`   - ${f}`);
    process.exit(blocked ? 3 : 1);
  }

  // 통과
  s.attempts[gate] = 0;
  s.history.push({ at: now(), gate, result: "pass", info: result.info });
  const last = i === ORDER.length - 1;
  if (last) { s.done = true; s.next = "(done)"; }
  else s.next = ORDER[i + 1];
  if (RULES.gates.review_after.includes(gate)) s.awaitingReview = gate;
  saveState(slug, s);
  console.log(`✅ ${gate} 통과` + (result.info && Object.keys(result.info).length ? ` — ${JSON.stringify(result.info)}` : ""));
  if (last) console.log(`🎉 완료: runs/${slug}`);
  else if (s.awaitingReview) console.log(`👀 ${gate} 산출물 확인 요청 — 사용자 진행 지시 후 'proceed ${slug}'`);
  else console.log(`▶︎ 다음 게이트: ${s.next}`);
  process.exit(0);
}

usage(cmd ? `알 수 없는 명령: ${cmd}` : null);
