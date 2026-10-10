# CUAgain 디자인 하네스 (yuna.page)

이 폴더는 yuna.page 공개 화면을 **P1 화면 스펙 → P2 디자인(HTML) → P3 검증 리포트** 순서로 만드는 하네스입니다.

> 공식 허들링 디자인 하네스(`figmatutor2/harness`)의 **구조·스크립트·hook·state·`npm run verify`를 그대로** 따르되,
> 이 프로젝트의 산출물은 Figma가 아니라 **HTML**(yuna.page는 Cloudflare Workers로 띄우는 실제 웹)이라,
> 게이트 판정을 Figma 대조에서 **HTML/문서 검사**로 바꿨습니다. (Figma 전면 실행은 Figma 파일·쓰기 MCP가 없어 불가)

## 자연어 요청 라우팅
"yuna.page 하네스 돌려줘 / 디자인 시작해줘 / 이어서 해줘 / 상태 알려줘" → `run-harness` 스킬 절차대로 진행합니다.

## 파일 역할
| 파일 | 역할 | 수정 |
|---|---|---|
| `docs/story-service.md` | 무엇을 위한 일인지 (유저스토리 US-1~5, ★ 어기면 안 되는 것) | 사람 |
| `docs/story-work.md` | 실제로 어떻게 하는지 (①~⑧ 작업 흐름) | 사람 |
| `docs/prd.md`, `docs/design.md` | 제품·디자인 설명 문서 | 사람 |
| `harness/rules.yaml` | **규칙 SSOT** — 게이트 판정 기준 | 사람 |
| `harness/defaults.yaml` | 정하지 않은 값의 기본값 (`source: 임의` = 확인 대상) | 사람 |
| `harness/scripts/verify.mjs` | 게이트 판정 스크립트 | — |
| `harness/scripts/guard-write.mjs` | 현재 게이트 폴더에만 저장하도록 강제(hook) | — |
| `harness/scripts/guard-review.mjs` | 확인 대기 중 작업 에이전트 호출 차단(hook) | — |
| `harness/scripts/save-blocks.mjs` | 큰 반환 블록을 경로 검사 후 저장 | — |
| `harness/templates/` | Phase 산출물 양식 | — |
| `runs/<slug>/state.json` | 진행 상태 (재개 기준) | **스크립트만** |
| `runs/<slug>/p3-verify/verify-report.md` | 최종 검증 리포트 | **스크립트만** |

## 에이전트와 편집 폴더
작업 에이전트는 파일을 직접 쓰지 않고 `=== FILE: … ===` 블록으로 반환하고, 오케스트레이터가 해당 게이트 폴더에만 저장합니다.

| 에이전트 | Phase | 저장 위치 |
|---|---|---|
| `spec-writer` | P1 | `runs/<slug>/p1-spec/` |
| `designer` | P2 | `runs/<slug>/p2-design/` |
| `judge` | 모든 게이트 | 없음 (읽기 + `verify.mjs` 실행·판정만) |

## 명령
```bash
cd harness && npm install          # 처음 1회 (yaml 패키지)
node harness/scripts/verify.mjs init <slug> --topic "<주제>"
node harness/scripts/verify.mjs <p1|p2|p3> <slug>
node harness/scripts/verify.mjs proceed <slug>              # P1·P2 산출물 확인 후 진행 지시 시
node harness/scripts/verify.mjs status  <slug>
node harness/scripts/verify.mjs reopen  <slug> --from <gate>
node harness/scripts/verify.mjs unblock <slug>              # 3회 실패 차단 해제
```

## 참고
- 저장 권한은 `.claude/settings.json` hook으로 강제됩니다 (guard-write: `runs/` 안은 현재 게이트 폴더만 · `state.json`/`verify-report.md`는 스크립트만 / guard-review: 확인 대기 중 작업 에이전트 차단).
- 게이트는 전부 **숫자/파일 존재 여부**로 판정합니다 (`rules.yaml` SSOT). 문서의 수치를 바꾸면 `rules.yaml`도 함께 고칩니다.
- **완성 실행 예시**: `runs/yuna-page/` (P1·P2·P3 전부 통과, `p3-verify/verify-report.md` 참조).
