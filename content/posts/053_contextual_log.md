---
title: "문맥 기반 로깅"
date: 2025-12-26T13:16:49+09:00
author: snowmerak
tags: ["log", "logging", "context"]
categories: ["Design"]
draft: false
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

OpenTelemetry의 그것과 유사합니다. 마찬가지로 하나의 요청이나 메서드, API 호출의 라이프 사이클을 추적합니다. 이 구조를 통해 전체 요청은 얼마나 오래 걸렸고, 해당 요청이 실행되는 동안 각 메서드나 API 중 무엇이 오래 걸렸는지 등을 추적하여 서비스 개선이나 인프라 확장을 선제적으로 수행할 수 있습니다.

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
    // Log format: {"level":"INFO", "service":"{Service}", "scope":"{Scope}", "method":"{Method}", "request_id":"{RequestID}", "status":"completed", "duration_ms":{Duration}}
}

// 작업 실패 시 호출: 에러 원인과 소요 시간을 함께 기록
func (s *Span) Fail(err error) {
    duration := time.Since(s.StartTime)
    // Log format: {"level":"ERROR", "service":"{Service}", "scope":"{Scope}", "method":"{Method}", "request_id":"{RequestID}", "status":"failed", "error":"{Error}", "duration_ms":{Duration}}
}
```

### State

조금 특이한 형태일 수 있으나, 어떠한 행동의 결과로 상태가 변화되었을 때 그 결과를 로그로 남기기 위해 존재합니다. 평시에는 그다지 유용하지 않을 로그지만, 어떠한 장애가 발생했을 경우에 유용하게 사용될 수 있습니다. 아래 코드에는 두가지 상태 로그를 남길 수 있도록 되어 있습니다:
1. Transition: 상태 전이에 대해 기록합니다. 로직이 실행되는 도중에 DB에서 데이터를 읽거나, 삭제되거나, 필터링 등을 거치면서 수정된 내용에 대해 작성합니다.
2. Snapshot: 현재 상태 자체를 기록합니다. 처음 실행되거나 종료되었을 때 초기 상태와 최종 상태를 로깅할 때 쓰입니다.

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
    // Log format: {"type":"transition", "service":"{Service}", "request_id":"{RequestID}", "entity":"{Entity}", "from":"{From}", "to":"{To}", "reason":"{Reason}"}
}

// 상태 스냅샷(Snapshot): 특정 시점의 객체 상태 전체를 덤프
// 데이터 정합성 확인이나 디버깅 시점의 데이터 확인용
func (l *StateLogger) Snapshot(entity string, data interface{}) {
    // Log format: {"type":"snapshot", "service":"{Service}", "request_id":"{RequestID}", "entity":"{Entity}", "data":{JSON_Dump}}
}
```

### Trend

자잘하거나 불필요한 개별 이벤트를 모두 기록하기보다 앱 내에서 어느 정도 집계하여 제공하는 역할을 합니다. 아래 코드는 다음 몇가지 메트릭 유형을 지원합니다:
1. Counter: 누적 값 (예: 요청 수, 에러 수, 캐시 히트/미스 등)
2. Gauge: 현재 상태 값 (예: CPU/메모리 사용량, 고루틴 수, 큐 크기 등)
3. Histogram: 분포 (예: 요청 레이턴시, 응답 크기 등) - 버킷별 카운팅
4. Summary: 요약 통계 (예: p50, p90, p99 등) - Histogram에서 파생 가능
   1. 그래서 아래 코드에는 포함하지 않았습니다.

```go
type TrendCollector struct {
    // 1. Counter: 누적 값 (요청 수, 에러 수, 캐시 히트/미스 등)
    counters map[string]*atomic.Uint64
    counterMetrics map[string]struct{}
    // 2. Gauge: 현재 상태 값 (CPU/메모리 사용량, 고루틴 수, 큐 크기 등)
    gauges map[string]*atomic.Int64
    gaugeMetrics map[string]struct{}
    // 3. Histogram: 분포 (요청 레이턴시, 응답 크기 등) - 버킷별 카운팅
    histograms map[string]*Histogram
    histogramsLock sync.RWMutex
}

type Histogram struct {
    buckets []float64
    counts  []*atomic.Uint64
}

func NewTrendCollector(cm []string, gm []string) *TrendCollector {
    counterMetrics := make(map[string]struct{}, len(cm))
    counters := make(map[string]*atomic.Uint64, len(cm))
    for _, m := range cm {
        counterMetrics[m] = struct{}{}
        counters[m] = &atomic.Uint64{}
    }

    gaugeMetrics := make(map[string]struct{}, len(gm))
    gauges := make(map[string]*atomic.Int64, len(gm))
    for _, m := range gm {
        gaugeMetrics[m] = struct{}{}
        gauges[m] = &atomic.Int64{}
    }

    return &TrendCollector{
        counters:      counters,
        counterMetrics: counterMetrics,
        gauges:        gauges,
        gaugeMetrics:  gaugeMetrics,
        histograms:    make(map[string]*Histogram),
    }
}

// Counter: 단순히 1씩 증가 (예: http_requests_total, cache_hits)
func (t *TrendCollector) IncCounter(metric string) {
    if _, ok := t.counterMetrics[metric]; !ok {
        return
    }

    t.counters[metric].Add(1)
}

// Gauge: 특정 값으로 설정 (예: memory_usage_bytes, active_goroutines)
func (t *TrendCollector) SetGauge(metric string, value int64) {
    if _, ok := t.gaugeMetrics[metric]; !ok {
        return
    }

    t.gauges[metric].Store(value)
}

// Histogram: 관측된 값을 버킷에 기록 (예: request_duration_ms)
func (t *TrendCollector) ObserveHistogram(metric string, value float64) {
    t.histogramsLock.RLock()
    hist, ok := t.histograms[metric]
    t.histogramsLock.RUnlock()

    if !ok {
        t.histogramsLock.Lock()
        if hist, ok = t.histograms[metric]; !ok {
            // 예시를 위해 고정된 버킷 사용 (실제로는 설정 필요)
            hist = &Histogram{
                buckets: []float64{10, 50, 100, 500, 1000},
                counts:  make([]*atomic.Uint64, 5),
            }
            for i := range hist.counts {
                hist.counts[i] = &atomic.Uint64{}
            }
            t.histograms[metric] = hist
        }
        t.histogramsLock.Unlock()
    }

    for i, bound := range hist.buckets {
        if value <= bound {
            hist.counts[i].Add(1)
            break
        }
    }
}

// 별도의 고루틴에서 주기적으로(예: 1분) 집계된 데이터를 로그로 배출(Flush)
func (t *TrendCollector) StartFlushLoop(ctx context.Context, interval time.Duration) {
    ticker := time.NewTicker(interval)
    for {
        select {
        case <-ticker.C:
            // Histogram은 맵 교체가 필요하므로 Lock 사용
            t.histogramsLock.Lock()
            // currentHistograms := t.histograms
            // t.histograms = make(map[string]*Histogram)
            t.histogramsLock.Unlock()

            // Counter와 Gauge는 Atomic 연산이므로 Lock 없이 값만 읽고 초기화 가능
            // (단, 엄밀한 일관성이 필요하다면 Lock 사용 고려)
            
            // Log format example:
            // {
            //   "type": "trend",
            //   "service": "payment-service",
            //   "window": "1m",
            //   "counters": { "http_req_total": 1500, "cache_hit": 1450, "cache_miss": 50 },
            //   "gauges": { "goroutines": 120, "heap_alloc_bytes": 52428800 },
            //   "histograms": { "latency_ms": { "p50": 15, "p99": 120 } }
            // }
        case <-ctx.Done():
            return
        }
    }
}
```

### Context

로그의 연관성을 확보하기 위해 Go 언어에서는 `context.Context`를 적극적으로 활용합니다. 단순히 취소 신호나 데드라인 전파용으로만 쓰는 것이 아니라, 요청의 고유 식별자(Request ID)와 서비스 식별자(Service Name)를 운반하는 컨테이너로 사용합니다.

주요 특징은 다음과 같습니다:
1. 생성 및 주입: 요청이 진입하는 시점(예: HTTP Middleware)에서 UUID v7 기반의 고유한 Request ID를 생성하여 Context에 주입합니다.
2. 전파 (Propagation):
    - In-Process: 함수 호출 시 `ctx`를 첫 번째 인자로 전달하여 고루틴 간에도 ID를 공유합니다.
    - Cross-Process: 마이크로서비스 간 통신 시 HTTP Header(`X-Request-ID`) 등을 통해 ID를 전파하여 분산 추적(Distributed Tracing)을 가능하게 합니다.
3. 활용: 모든 로거(Span, State, Trend)는 Context에서 이 ID를 추출하여 로그에 포함시킵니다. 이를 통해 수만 건의 로그 속에서 특정 요청의 전체 흐름을 한 번에 검색할 수 있습니다.

## 마치며

원본 설계에서는 이 뿐만 아니라 로그 전달과 저장에 대한 부분도 포함되어 있습니다.

전체 그림은 다음과 같습니다:
1. Logos (App): 어플리케이션 내에서 `Span`, `State`, `Trend` 형태의 구조화된 로그를 생성합니다.
2. Kafka: 생성된 로그를 실시간으로 수집하고 버퍼링합니다.
3. ClickHouse: 대용량 로그를 컬럼 기반으로 저장하여 초고속 검색과 집계를 지원합니다.
4. Grafana: 저장된 데이터를 시각화하여 대시보드로 제공합니다.

하지만 아무리 좋은 파이프라인과 저장소가 있어도, 그 안에 담기는 데이터가 정제되지 않았다면(Garbage In) 결과물 또한 의미가 없습니다(Garbage Out). 그래서 인프라 구축에 앞서 "무엇을, 어떤 형태로, 왜 남겨야 하는가?"에 대한 고민을 먼저 해결하고자 했습니다.

이 글이 여러분의 로깅 전략 수립에 작은 영감이 되었기를 바랍니다.
