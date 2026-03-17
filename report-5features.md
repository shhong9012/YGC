# YGC 골프 리그 앱 — 5건 개선 보고서

## 변경 요약

### 1. 챔피언십 순위 정렬 버그 수정
**문제:**
- `sort()` 비교 함수의 연산자 우선순위 오류: `b.total - a.total || a.wins < b.wins ? 1 : -1`
- 게스트가 포함된 라운드에서 멤버 F1 포인트가 잘못 계산됨

**수정:**
- 정렬: `b.total - a.total || b.wins - a.wins || b.podiums - a.podiums`
- 순위 계산: 게스트 제외 멤버-only 랭킹으로 F1 포인트 부여 (standings + 지난 월례회 보기)

### 2. 동타 시 순위 선택 기능
- Step 2 순위 미리보기에서 동점자 `동타` 뱃지 + 배경 하이라이트
- `↕` 스왑 버튼으로 동점자 순위 교환 (관리자만)
- 교환 결과가 F1 포인트에 즉시 반영, 최종 저장 시 사용자 선택 순서 그대로 DB 반영

### 3. 게스트 기록 저장 및 재참가
- 게스트 추가 UI에 "기존 게스트 재참가" 섹션 추가
- 기존 게스트(is_guest=true) 목록을 버튼으로 표시 (avg, 목표타수 포함)
- 클릭 시 기존 멤버 ID와 연결 → 과거 기록(avg, bestScore) 자동 적용
- 카트 밸런스 시 실제 avg 우선 사용

### 4. 수동 팀(카트) 배치
- "자동 편성" / "수동 편성" 2개 버튼으로 분리
- 수동 모드: 카트 슬롯 자동 생성 → 카트 선택 → 미배치 인원 클릭 배치
- 배치 취소(✕), 카트 추가 가능
- 자동 편성은 기존 스네이크 드래프트 유지

### 5. 갤러리 탭
- "📸 갤러리" 탭 추가
- Supabase Storage `gallery` 버킷 사용
- 관리자: 다중 사진 업로드/삭제
- 사진 클릭 시 풀스크린 모달 뷰어
- 라운드별 사진 관리

## Supabase 설정 필요
갤러리 기능을 위해 Supabase 대시보드에서:
1. Storage → New bucket → "gallery" (Public 체크)
2. Policies → INSERT/SELECT/DELETE 허용 (authenticated users)

## 변경 파일
- `src/App.jsx`

## 빌드 확인
- `npm run build` 성공
