# CUAgain 디자인 하네스 — yuna.page

> 4차 사이클 "AI 디자인 하네스 만들기" · **트랙 A 산출물**

CUAgain(아이 QR 명함+페이지 서비스)의 1호 사례 **yuna.page** 공개 화면을,
`PRD → 스토리(서비스/작업) → design.md → 하네스(페이즈·게이트·에이전트) → 실제 디자인 산출물`
까지 **실제로 돌려** 만든 결과물입니다.

## 이 하네스의 형태
공식 허들링 디자인 하네스(`figmatutor2/harness`)의 **구조·스크립트·hook·state·`npm run verify`를 그대로** 채택하고,
내용을 CUAgain/yuna.page로 교체했습니다. 원 하네스는 산출물이 **Figma**지만, yuna.page는 실제 **HTML 웹**(Cloudflare Workers)이라
게이트 판정을 **HTML/문서 검사**로 적응시켰습니다.

```
CLAUDE.md                      오케스트레이터 안내 (P1→P2→P3)
.claude/
  settings.json                저장 권한·확인 대기 hook
  agents/                      spec-writer · designer · judge
  skills/run-harness/SKILL.md  실행 절차
docs/
  prd.md · design.md           제품·디자인 설명
  story-service.md             서비스 도메인 (유저스토리 + ★어기면 안 되는 것)
  story-work.md                작업 도메인 (손작업 → 산출물·멈칫·넘김)
harness/
  rules.yaml                   규칙 SSOT (게이트 판정 기준)
  defaults.yaml                기본값
  scripts/verify.mjs           게이트 판정 (HTML/문서 검사)
  scripts/guard-*.mjs          hook (저장 권한·확인 대기)
  templates/                   Phase 산출물 양식
runs/
  yuna-page/                   실제 실행 (p1-spec · p2-design · p3-verify · state.json)
```

## 돌려보기
```bash
cd harness && npm install
node harness/scripts/verify.mjs status yuna-page        # 완료 실행 상태
# 처음부터 다시 돌리려면:
node harness/scripts/verify.mjs reopen yuna-page --from p1
node harness/scripts/verify.mjs p1 yuna-page && node harness/scripts/verify.mjs proceed yuna-page
node harness/scripts/verify.mjs p2 yuna-page && node harness/scripts/verify.mjs proceed yuna-page
node harness/scripts/verify.mjs p3 yuna-page            # verify-report.md 생성
```

## 산출물
- `runs/yuna-page/p2-design/index.html` — yuna.page 공개 화면(소개+요청+완료) · 미리보기 `preview-*.jpg`
- `runs/yuna-page/p3-verify/verify-report.md` — 게이트 판정 결과(전부 통과)

## 범위 / 주의
- **공개 화면까지.** 관리자 요청함·상세(US-4·US-5)는 run-02.
- CUAgain의 "수락 후 연결·안심번호 중계"는 특허 출원 전이라 **범위에서 제외**(공지예외 2027-10-05). 공개 yuna.page 수준(메시지 전달)까지만.
- 산출물의 연아 실제 사진·소개·장래희망은 공개 저장소라 **자리표시자**.
