---
title: "로그 정책에 대한 고찰"
date: 2024-07-26T18:24:08+09:00
tags: ["error"]
author: "snowmerak"
categories: ["Suggestions"]
draft: false
---

## 개요

최근 그래도 규모가 조금 있는 프로젝트를 처음부터 설계하고, 구현 및 운영한 경험이 생겼습니다. 상당히 많은 부분에서 하고 싶은 걸 했고, 부족한 점을 느끼기고 했고, 발전했다고 생각합니다. 하지만 안타깝게도, 기반 시스템(혹은 라이브러리)에 대해서 조직 내에서도 명확히 어떻게 해왔다는 게 없었어서 상당히 아쉬운 결과를 낳게 되었습니다. 지금에 와서 매우 많은 부분에 스며들어 있어서 일일이 교체하기에도 비용이 큰 작업이 되었구요. 그 중 하나가 로그입니다.

### 뭐가 문제?

해당 프로젝트의 로그 라이브러리는 [`zerolog`](https://github.com/rs/zerolog)를 사용하고 있습니다. 그리고 필요한 곳에서, 물론 실제 코드와는 다르지만, 단순하게 `log.Error().Str("error", err).Str("ip", ip).Int("port", port).Msg("not expected connection closed")`처럼 그 자리에서 필요한 필드를 넣고 로그를 남기는 형태입니다.  
그리고 이벤트 로그에 대한 개념도 필요했습니다. 저에게 이벤트 로그에 대한 개념이 부족 했던 것도 있지만, 과연 '모든 행동에 로그를 찍는 것이, 이벤트 로그를 작성하는 바람직한 방식인가'에 대해서 고찰의 시간이 필요했습니다.

### 그래서 어떻게?

단순하게 요즘 핫한 생성형 AI 중 하나인 google gemini와 대화를 좀 했습니다. 제가 마침 google gemini 구독 중이라..

## 로그란 무엇일까

### 무엇을 남겨야 하는가?

- 필수 정보
  1. timestamp: 해당 로그가 언제 발생 했는 지, 다른 로그와의 상관 관계는 어떤지 등을 추적하기 위해 필요합니다.
  2. level: 해당 로그의 심각도 및 성격을 나타냅니다. 주로 다음 몇가지 레벨을 사용합니다.
     1. debug: 디버그 과정에서 필요한 로그입니다.
     2. info: 사용자 행동, 요청 등을 추적하기 위해 사용합니다.
     3. warning: 지금 당장 문제는 되지 않으나, error로 발전할 수 있는 정보를 남길 때 사용합니다.
     4. error: 일부 함수나 서비스, 혹은 파이프라인이 정상적으로 동작할 수 없는 상황에 사용합니다.
     5. fatal(혹은 panic): 프로그램이 더 이상 정상적으로 동작할 수 없을 때 사용합니다.
  3. message: 이 로그가 왜 남아야 하는 지 서술합니다.
  4. stack trace(혹은 call stack): 함수 호출 순서를 기록해서 어떤 흐름으로 발생했는지 파악할 수 있게 합니다.
  5. line number: 어떤 파일의 몇번 라인에서 발생했는지 작성하여, 문제 해결을 위한 실마리를 제공합니다.

- 주의 사항
  1. 개인 정보 보호: 로그에 개인 정보가 남지 않도록 가리거나, 필터링 합니다.
  2. 출력 레벨 설정: 적절한 레벨을 지정해서 추적이나 통계, 이슈 파악을 하기 용이하게 합니다.
  3. 저장 용량 관리: 너무 큰 로그를 가지지 않도록, 적절히 압축이나 삭제를 하도록 합니다.

### 언제 남겨야 하는가?

대략적인 예시로, 다음과 같은 상황에 로그를 남길 수 있습니다.

- 예외 발생 시
  - 프로그램 실행 중 예키지 못한 예외가 발생했을 때
  - 외부 시스템으로부터 에러 코드를 받았을 때
  - 프로그램이 비정상적으로 종료되었을 때
- 중요 이벤트 발생 시
  - 시스템 시작/종료되었을 때
  - 설정이 변경되었을 때
  - 외부 시스템과의 상호작용 및 상태 변화가 발생했을 때
- 성능 문제 발생 시
  - 응답이 지연 되었을 때
  - CPU 사용량이 높을 때
  - 가용 메모리가 부족할 때
- 보안 관련 이벤트 발생 시
  - 인증에 실패했을 때
  - 중요 데이터가 변경되었을 때

### 왜 남겨야 하나?

- 서비스 운영 중 발생하는 이슈에 대한 알림과 원인 파악 및 빠른 해결에 도움
- 시스템 안정성 및 성능 향상을 위한 데이터 분석
- 사고 발생 시 증거 자료 확보 및 추적
- 시스템 운영 및 관리에 대한 책임 소재 명확화

## 로그 설계

### 이론

이제 로그를 분리할 시간입니다. 저는 나름대로 에러를 2가지로 분류했습니다.

- 이벤트 로그: 시스템 상태 변화, 사용자 행동, 시스템 운영 등 서비스 운영과 관련된 모든 중요 이벤트
- 시스템 (오류) 로그: 예외 상황(Exception), 에러 코드, 비정상 종료 등 시스템 오류와 관련된 모든 정보

다만 이 로그들에 대해서 몇가지 의문 사항을 제미나이에게 제기했었습니다.  
모든 이벤트(요청, 상태 변화 성공 및 실패)에 로그를 남기는 건 공간에 비효율적이라 보입니다.

예를 들어, 큰 파일을 사용자가 업로드하고 빠른 시간 안에 제공해야하는 기능이 있다고 가정합시다. 그럼 우리는 어느정도 시간 안에는 올라갈 것이라는 timeout을 잡게 될 것입니다. 그 시간을 넘어가면 실패로 간주하고, 재시도를 요청할 것이구요.

이 과정에서 저희는 아래 2가지 로그를 남기게 될 전망이라 가정합시다.

1. 유저 업로드 요청에 대한 info 로그
2. timeout이 발생한 error 로그

하지만 timeout에만 남기게 되면, 잠재적으로 사용량이 점점 늘어나 임계치에 가까워져 서서히 성능이 줄어드는 경고를 알아채지 못할 수 있습니다. 그래서 임계치 기반의 로그 두가지를 추가할 수 있습니다.

1. 유저 업로드 요청에 대한 info 로그
2. timeout이 발생한 error 로그
3. timeout의 75%만큼 시간이 걸린 업로드에 대한 warn 로그
4. timeout의 50%만큼 시간이 걸린 업로드에 대한 warn 로그

이 모든 로그를 남길 수도 있습니다만, 몇가지 제안을 추가로 할 수 있습니다.

1. 중요하지 않다면 업로드 요청 데이터와 시간을 기록한 채로 timeout이 발생 했을 때만 error 로그에 포함하여 로깅
2. 3번과 4번 로그에 대해 집계 로그 형태로 분당, 혹은 시간당 얼마나 발생했는 지와 평균 파일 크기 등을 로깅

만약 전체 요청 수를 info 로그로 확인하고 있었다면, 데이터베이스나 스토리지 등을 활용하여 전체 수를 지정하는 것도 좋은 방법으로 고려됩니다.

### 구성

로그의 종류는 크게 2가지, event log와 system log로 나뉩니다.  
`kind` 필드를 추가해서 `event`와 `system`을 가지도록 합니다.

```go
type Kind string

const (
    KindEvent Kind = "event"
    KindSystem Kind = "system"
)
```

그리고 `type` 필드를 추가해서 어떤 로그인지 구체화 합니다. 방금 나왔던 파일 업로드를 예로 들면 `user_content_upload`같은 형식으로 쓸 수 있어 보입니다. 제미나이는 아래와 같은 타입들을 예제로 만들었습니다.

- user_login
- user_logout
- file_upload_success
- file_upload_failure
- file_download
- search_query
- payment_success
- payment_failure
- system_start
- system_shutdown

### 구현

이 부분 또한 이전 프로젝트를 진행하며 아쉬웠던 부분 중 하나입니다. 좀 더 정규화된 로그 출력 함수나 메서드를 만들어 관리하지 못한 것이 매우 아쉽습니다.

```go
import "github.com/rs/zerolog/log"

func Write(ev *zerolog.Event, timestamp time.Time, kind Kind, typ string) {
    ev.Time("timestamp", timestmap).Str("kind", string(kind)).Str("type", typ).Send()
}
```

먼저 zerolog의 `*zerolog.Event`를 받아서 제공할 함수를 작성합니다.

```go
func WriteFileUploadTimeout(ev *zerolog.Event, requestTime time.Time, requestUser string, requestSession string, duration time.Duration) {
	Write(ev.Time("request_time", requestTime).
        Str("request_user", requestUser).
        Str("request_session", requestSession).
        Dur("duration", duration), time.Now(), log.KindEvent, "file_upload_timeout")
}
```

그리고 필요한 패러미터를 받아 `*zerolog.Event`에 추가하며, 정해진 값으로 미리정의한 `Write` 함수를 호출하도록 합니다. 그리고 실제 에러를 남길 때는 다음과 같이 호출합니다.

```go
func main() {
    WriteFileUploadTimeout(log.Error(), time.Now(), "user", "session", time.Second)
}
```

로그 레벨은 최종적으로 호출할 때 설정합니다. 필요하다면 첫번째 인자인 `*zerolog.Event`를 활용하여 함수를 중첩해 나가는 방식으로 로그를 확장할 수 있습니다. 필요하다면, 구조체나 함수형 패러미터를 이용하는 것도 좋은 방법이라 생각합니다.
