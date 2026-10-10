---
name: run-harness
description: "CUAgain 디자인 하네스 실행(오케스트레이터). 화면 주제 하나를 받아 P1 화면 스펙 → P2 디자인(HTML) → P3 검증 리포트까지 게이트를 통과시킨다. 작업은 서브에이전트(spec-writer·designer)에게, 판정은 verify.mjs/judge에게 맡기고, 중단된 실행은 state.json 기준으로 이어서 한다. '/run-harness <주제>' 또는 'yuna.page 하네스 돌려줘 / 디자인 시작해줘 / 이어서 해줘 / 상태 알려줘' 같은 요청에 반드시 이 스킬을 쓴다."
---

# run-harness — CUAgain 디자인 하네스 오케스트레이터

메인 Claude 세션이 이 절차를 직접 수행한다. 각 Phase의 작업은 서브에이전트에게, 판정은 `judge`(= `verify.mjs`)에게 맡긴다.
작업 에이전트는 파일을 직접 쓰지 않고 산출물을 `=== FILE: … ===` 블록으로 **반환**하며, 오케스트레이터는 그 블록을 **고치지 않고 해당 게이트 폴더에만 저장**한다.

## 기준 문서
`docs/story-service.md`(유저스토리 US-1~5, ★ 어기면 안 되는 것) · `docs/story-work.md`(작업 흐름) · `harness/rules.yaml`(규칙 SSOT) · `docs/prd.md`·`docs/design.md`.

## 0. 시작
1. 요청에서 **화면 주제**를 뽑고, 영문 kebab-case **slug**로 정한다. (예: `yuna.page 공개 화면` → `yuna-page`)
   - `runs/<slug>/`가 이미 있으면 그 slug로 **재개**.
2. 처음이면: `cd harness && npm install`(1회) → `node harness/scripts/verify.mjs init <slug> --topic "<주제>"`.
3. 재개면: `verify.mjs status <slug>` 결과의 `next`부터 이어간다. (종료 코드 3=차단 → 멈추고 보고 / 4=확인 대기 → 3번 확인 요청)

## 1. Phase 루프
`state.json`의 `next`에 따라 반복한다.

| next | 작업 에이전트 | 편집 폴더 | 이어서 |
|---|---|---|---|
| `p1` | `spec-writer` | `runs/<slug>/p1-spec/` (screen-spec.md) | `judge` → p1 |
| `p2` | `designer` | `runs/<slug>/p2-design/` (index.html) | `judge` → p2 |
| `p3` | — (스크립트) | `runs/<slug>/p3-verify/` (verify-report.md, 스크립트가 씀) | `judge` → p3 |

- 작업 에이전트에게 `slug`·주제·기준 문서·(복귀면) 마지막 실패 사유를 전달하고, "파일은 쓰지 말고 `=== FILE: runs/<slug>/<phase 폴더>/<파일명> ===` 블록으로 반환"하라고 한다.
- 반환 블록을 현재 게이트 폴더에 그대로 저장(크면 `save-blocks.mjs`) → `judge` 호출.

## 2. 판정 후 행동 (verify.mjs 종료 코드)
- **0 + 👀 확인 대기**(p1·p2): 멈추고 3번 확인 요청.
- **0**(p3): 완료.
- **1 실패**: 실패 항목 보고 후 같은 게이트 에이전트를 실패 사유와 함께 다시 호출.
- **3 차단**(3회 실패): 멈추고 보고. 스스로 unblock 하지 않는다.
- **4 확인 대기**: 멈추고 3번.

## 3. 사람 확인 지점 (P1·P2 통과 후)
산출물(스펙/디자인)은 사람이 보고 넘긴다 (`story-work.md` ② "무엇을 반영할지 판단").
통과 직후 **멈추고** 산출물 경로·핵심을 보고한다. 사용자가 진행을 지시하면 `verify.mjs proceed <slug>`, 수정 요청이면 `verify.mjs reopen <slug> --from <gate>`.
`proceed`는 사용자의 진행 지시 없이 실행하지 않는다. 지난 "쭉 해줘"를 다음 확인까지 끌고 오지 않는다.

## 완성 실행 예시
`runs/yuna-page/` — P1·P2·P3 전부 통과(`p3-verify/verify-report.md`).
