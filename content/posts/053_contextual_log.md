---
title: "문맥 기반 로깅"
date: 2025-12-26T13:16:49+09:00
author: snowmerak
tags: ["log", "logging", "context"]
categories: ["Design"]
draft: true
---

## 배경

### 왜?

이 또한 제가 조직에서 기본적으로 사용하고 있던 로그 자체에 대한 불합리에 의거하여 설계한 내용입니다. 기존 로그는 단순히 필요에 따라 에러를 남기거나, 스냅샷을 남기는 정도에 불과 했습니다. 그 때문에 매번 예상치 못한 경우에 대한 추적이 불가능에 가까웠죠.

또한 명확한 관측성을 확보하지 못 하다보니 어떤 부분을 개선해야하고, 어떤 부분이 실제로 많이 쓰이고 있는지, 장애가 발생했을 때 어떤 상황이었는지에 대한 정보를 취득하고 통합하기에 큰 어려움이 있었습니다. 단순하게 4개 정도의 인프라 구성 요소와 통신하여 응답을 주는 API에 대해 레이턴시가 갑자기 증가했을 때 어디가 문제인지 조차 파악하기 어려울 정도였습니다.

당연히 각 요청 체인과 응답 경로에서의 상관 관계를 증명하는 것도 어려웠구요. 이에 대해 변명은 할 수 있겠지만, 결국 초기에 제대로 잡고 가지 못한 제 실책이 조직적으론 크다고 생각합니다. 추후 후술할 내용에 대해 어느 정도 적용한 뒤에도 `그래서 무엇이 좋아졌는가`를 제대로 증명하지 못 해서 허들에 걸리기도 했거든요.

### 그래서 어떻게?

초기 로그 구성은 정말 형편 없었습니다. 정말 단순히 다음과 같은 정보만 남기고 있었죠:
1. 어플리케이션/클라이언트/서버 등의 초기화 시도 및 결과
2. 요청 정보, 응답 결과
3. 발생한 에러 및 피치못할 패닉에 대한 정보

그래서 저는 관측성에 대한 생각을 했습니다. 당시 이 로그 구성에서 마음에 안 드는 부분은 이런 부분이었습니다:
1. 실제 각 스코프의 실행 시간을 측정하고 싶다
2. 외부 요청과 응답이 얼마나 걸렸는지 측정하고 싶다
3. 내부 메서드나 외부 API 호출 과정에서 동일한 요청임을 확인해서 문맥을 잇고 싶다
4. 지난 N분/N시간 동안 특정 요청이나 메서드, API 호출이 많았는지 확인하고 싶다
5. 지난 N분/N시간 동안 평균 레이턴시가 어떻게 변화되었는 지 알고 싶다

4번과 5번은 사실 산출된 로그에서 충분히 집계해서 확인할 수 있는 내용이었지만, 여기서 서술된 내용은 로그로 남기기엔 쓰레기 값에 가까우면서 그 수도 많아서 굳이 남기기 어려운 것들에 해당됩니다. 자세한 내용은 아래 `Trend`에서 작성하겠습니다.

## Prism

위 내용을 요구사항으로 설정하고 3가지 로그 타입에 대해 설계했습니다:
- Span: 어떤 요청, 메서드, API 호출의 시작에 선언하며 끝에 `실행 시간`과 함께 출력합니다.
- State: 어떤 요청, 메서드, API 호출 내에서 상태의 변화가 발생할 때 `변화 내용`을 출력합니다.
- Trend: 전체 프로그램 내에서 `특정 주기 내에서의 변화량`을 확인하기 위해 주기적으로 출력합니다.
- Context: 해당 로그들을 하나의 흐름으로 이어 붙이기 위해 `ServiceName`과 랜덤한 `RequestID`를 필수 필드로 추가하여 느슨한 연관성을 부여합니다.

### Span

OpenTelemetry의 그것과 유사합니다. 마찬가지로 하나의 요청이나 메서드, API 호출의 라이프 사이클을 추적합니다.

```go
type Span struct {
    ServiceName string
    Scope       string
    Method      string
    RequestID   string
    StartTime   time.Time
    Payload     map[string]interface{}
}

func NewSpan(service, scope, method, requestID string) *Span {
    return &Span{
        ServiceName: service,
        Scope:       scope,
        Method:      method,
        RequestID:   requestID,
        Payload:     make(map[string]interface{}),
    }
}

// 시작 시점을 기록하고 Span 객체를 반환
func (s *Span) Start() *Span {
    s.StartTime = time.Now()
    return s
}

// 작업 완료 시 호출: 소요 시간(Duration)을 자동 계산하여 기록
func (s *Span) Complete() {
    duration := time.Since(s.StartTime)
    // Log format: [INFO] {Service} | {Scope}::{Method} | {RequestID} | Completed | {Duration}
}

// 작업 실패 시 호출: 에러 원인과 소요 시간을 함께 기록
func (s *Span) Fail(err error) {
    duration := time.Since(s.StartTime)
    // Log format: [ERROR] {Service} | {Scope}::{Method} | {RequestID} | Failed({Error}) | {Duration}
}
```

### State

조금 특이한 형태일 수 있으나, 어떠한 행동의 결과로 상태가 변화되었을 때 그 결과를 로그로 남기기 위해 존재합니다.

```go
type StateLogger struct {
    ServiceName string
    Scope       string
    RequestID   string
}

func NewStateLogger(service, scope, requestID string) *StateLogger {
    return &StateLogger{
        ServiceName: service,
        Scope:       scope,
        RequestID:   requestID,
    }
}

// 상태 전이(Transition): 이전 상태(From)와 이후 상태(To)를 명시적으로 기록
// 버그 추적 시 "어떤 상태에서 넘어왔는가"를 파악하는 데 핵심적임
func (l *StateLogger) Transition(entity string, from, to string, reason string) {
    // Log format: [STATE] {Service} | {RequestID} | {Entity}: {From} -> {To} ({Reason})
}

// 상태 스냅샷(Snapshot): 특정 시점의 객체 상태 전체를 덤프
// 데이터 정합성 확인이나 디버깅 시점의 데이터 확인용
func (l *StateLogger) Snapshot(entity string, data interface{}) {
    // Log format: [STATE] {Service} | {RequestID} | {Entity}: {JSON_Dump}
}
```

### Trend

자잘하거나 불필요한 개별 이벤트를 모두 기록하기보다 앱 내에서 어느 정도 집계하여 제공하는 역할을 합니다.

```go
type TrendCollector struct {
    // 동시성 처리를 위한 Atomic Counter 사용
    counters map[string]*atomic.Uint64
    gauges   map[string]*atomic.Int64
}

func NewTrendCollector(metrics ...string) *TrendCollector {
    counters := make(map[string]*atomic.Uint64, len(metrics))
    for _, metric := range metrics {
        counters[metric] = &atomic.Uint64{}
    }
    gauges := make(map[string]*atomic.Int64, len(metrics))
    for _, metric := range metrics {
        gauges[metric] = &atomic.Int64{}
    }

    return &TrendCollector{
        counters: counters,
        gauges:   gauges,
    }
}

// 호출 시점에는 I/O가 발생하지 않음 (Zero Allocation, Lock-free 지향)
func (t *TrendCollector) Increment(metric string) {
    t.counters[metric].Add(1)
}

// 별도의 고루틴에서 주기적으로(예: 1분) 집계된 데이터를 로그로 배출(Flush)
func (t *TrendCollector) StartFlushLoop(ctx context.Context, interval time.Duration) {
    ticker := time.NewTicker(interval)
    for {
        select {
        case <-ticker.C:
            // Log format: [TREND] {Service} | Window: 1m | req_total: 15000 | err_rate: 0.01%
            t.resetCounters()
        case <-ctx.Done():
            return
        }
    }
}
```