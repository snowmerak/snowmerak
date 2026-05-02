---
title: "ElasticSearch/OpenSearch에서 ClickHouse로의 로그 마이그레이션: 성능과 경제성의 전환점"
date: 2026-05-02T13:08:40+09:00
tags: ["clickhouse", "elasticsearch", "opensearch", "logging", "data-warehouse", "migration"]
author: "snowmerak"
categories: ["Infrastructure", "Data Engineering"]
draft: false
---

## 개요

실시간 로그 수집과 분석은 현대 소프트웨어 시스템에서 필수적인 요소가 되었습니다. 많은 팀이 ElasticSearch나 OpenSearch를 로그 데이터 웨어하우스로 사용해 왔고, 이는 합당한 선택이었습니다. 전역 인덱싱(full-text search)과 유연한 스키마는 로그 탐색에 매우 유용했습니다.

하지만 로그 데이터의 규모가 기하급수적으로 증가하면서 ES/OS 기반 아키텍처의 한계가 명확해지고 있습니다. **메모리 사용량**, **스토리지 비용**, **집계 쿼리 성능** 등에서 ClickHouse를 비롯한 컬럼 기반 데이터베이스가 더 나은 대안으로 부상하고 있습니다.

이 글에서는 ElasticSearch/OpenSearch에서 ClickHouse로의 마이그레이션이 왜 성능과 경제성 모두에서 유리한지, 그리고 어떻게 단계적으로 전환할 수 있는지 살펴보겠습니다.

---

## ElasticSearch/OpenSearch의 현재 위치와 한계

### ES/OS가 로그 분석에 적합했던 이유

ElasticSearch(그리고 오픈소스 포크인 OpenSearch)는 다음과 같은 이유로 로그 분석 분야에서 장기간 지배적인 선택이었습니다:

- **전역 인덱싱**: 텍스트 기반 로그의 자유로운 검색 가능
- **유연한 스키마**: 구조화되지 않은 로그 데이터도 쉽게 저장
- **Kibana/Grafana와의 통합**: 시각화와 대시보드 생태계 풍부
- **실시간 색인**: 로그를 거의 실시간으로 검색 가능

### 하지만 대용량 로그에서는 문제가 발생합니다

#### 1. 메모리 사용량의 폭발

ES는 전역 인덱싱을 위해 많은 양의 힙(heap) 메모리를 사용합니다. 일반적으로 ES 클러스터의 JVM 힙 크기는 32GB를 넘지 않는 것이 권장되며, 이는 ES가 인덱스를 메모리에 최대한 올려놓으려는 전략 때문입니다. [^5]

대규모 샤드를 가진 클러스터에서는 GC(Garbage Collection) 압력까지 더해져 중간 정도의 쿼리 부하에서도 성능 저하가 발생합니다. [^5]

#### 2. 스토리지 비용의 비효율

ES는 Lucene 기반의 인덱스를 사용하므로 데이터 중복 저장이 발생합니다. 특히 로그 데이터는 구조가 유사한 경우가 많아 압축 효율이 낮습니다.

Tinybird의 분석에 따르면, 동일한 원시 데이터에 대해 Elasticsearch는 ClickHouse보다 **12배에서 19배 더 많은 디스크 공간**을 사용합니다. [^4]

#### 3. 집계 쿼리의 비효율

로그 분석에서 가장 많이 사용하는 패턴은 다음과 같습니다:

```json
// ES에서의 복잡한 집계 쿼리
{
  "size": 0,
  "aggs": {
    "status_codes": {
      "terms": { "field": "status_code" },
      "aggs": {
        "avg_response_time": { "avg": { "field": "response_time" } },
        "p95_response_time": { "percentile_ranks": { "field": "response_time", "values": [95] } }
      }
    }
  },
  "query": {
    "bool": {
      "filter": [
        { "range": { "@timestamp": { "gte": "now-1h" } } },
        { "term": { "service.name": "api-gateway" } }
      ]
    }
  }
}
```

이러한 쿼리는 ES에서 여러 단계의 샤드 간 집계(shard-level aggregation → reduce)를 거치므로 성능이 급격히 저하됩니다. [^5]

---

## ClickHouse가 로그 분석에 적합한 이유

### 컬럼 기반 저장소의 장점

ClickHouse는 행 기반(row-based)이 아닌 **컬럼 기반(columnar)** 저장소를 사용합니다. 이는 로그 분석 워크로드에 다음과 같은 이점을 제공합니다:

#### 1. 압축률의 우위

같은 데이터를 동일한 인스턴스에서 비교했을 때, ClickHouse가 ES보다 **3~5배 높은 압축률**을 보입니다. 로그 데이터는 구조가 유사한 레코드가 많기 때문에 컬럼 기반 압축이 특히 효과적입니다. [^4]

#### 2. 필터링 쿼리의 효율성

로그 분석에서 자주 사용하는 패턴은 특정 필드(예: `status_code`, `service_name`)로 필터링한 후 집계하는 것입니다. 컬럼 기반 저장소는 필요한 컬럼만 읽으므로 I/O가 획기적으로 줄어듭니다. [^4]

```sql
-- ClickHouse에서의 동일한 쿼리 (훨씬 간결하고 빠름)
SELECT 
    status_code,
    count() as request_count,
    avg(response_time) as avg_ms,
    percentileExactWeighted(95)(response_time) as p95_ms
FROM logs
WHERE service_name = 'api-gateway'
  AND event_time >= now() - INTERVAL 1 HOUR
GROUP BY status_code
ORDER BY request_count DESC
```

#### 3. 병렬 처리 최적화

ClickHouse는 쿼리를 여러 코어로 분할하여 처리하는 것이 기본입니다. 단일 노드에서도 다중 코어를 효율적으로 활용하므로, ES 클러스터의 여러 노드를 필요로 하는 작업을 단일 또는 소수 노드로 처리할 수 있습니다. [^4]

---

## 성능 비교: 실제 벤치마크

### 인서트 성능 (로그 적재 속도)

| 측정 항목 | ElasticSearch 8.x | ClickHouse 23.x |
|-----------|------------------|-----------------|
| 초당 삽입량 (single node) | 100K~300K docs/sec [^1] | 1M+ rows/sec [^1][^4] |
| 배치 크기 최적화 필요 | 예 (bulk API) | 예 (batch insert) |
| 동시 작성자 수 제한 | 높음 (인덱싱 병목) | 매우 높음 |

ClickHouse는 `INSERT` 시 대용량 배치를 한 번에 처리하는 방식이 기본이며, 이는 로그 수집기(Fluentd, Logstash, Vector 등)와의 호환성이 뛰어납니다. [^4]

### 쿼리 성능: 실제 OTel 벤치마크 (50B rows)

ClickHouse 공식 블로그에서 공개한 OpenTelemetry 기반 500억 행 벤치마크 데이터입니다. [^3]

| 쿼리 유형 | ES (동일 하드웨어) | ClickHouse | 개선율 |
|-----------|---------------------|------------|---------|
| Count last hour | ~200ms | ~50ms | 4x 빠름 [^1] |
| Aggregation (1B rows) | 2~5초 | ~200ms | 10~25x 빠름 [^1] |
| Full-text search | 50~200ms | 100~500ms | ES 우위 [^1] |

**Cold Query (데이터가 disk에 있는 경우):** 4x~6x 더 빠릅니다. [^3]
관측 가능성 분야에서 cold query는 일상적입니다. 데이터가 캐시에 올라가지 않은 상태에서도 ClickHouse가 압도적인 성능을 보입니다.

**Hot Query (캐시가 워밍된 상태):** 1.7x~2.6x 더 빠릅니다. [^3]
대시보드, 드릴다운, 반복 분석에서 여전히 ClickHouse가 우위를 유지합니다.

50B 행 테이블에서 Full-text index 분석만으로도 **5.8x 속도 향상**이 측정되었습니다. [^3]

### 스토리지 효율성

| 비교 항목 | ElasticSearch | ClickHouse | 비율 |
|-----------|--------------|------------|------|
| 1TB 원시 데이터 저장 | 300~500GB [^1] | 50~100GB [^1] | ES가 3~6배 더 많음 |
| 인덱스 오버헤드 포함 시 | ~1TB 이상 | ~200GB | ES가 5x 더 많음 [^3] |

ClickHouse 공식 벤치마크에서도 OTel 로그 워크로드(50B rows) 기준 ClickHouse가 약 **5배 적은 디스크 공간**을 사용함이 확인되었습니다. [^3]

이것은 단순히 저장 비용 절감을 넘어, 쿼리 시 읽어야 할 I/O가 줄어든다는 의미이며, 더 많은 데이터를 캐시에 올려둘 수 있다는 뜻입니다.

### 메모리 사용량

| 구성 요소 | ES 클러스터 | ClickHouse |
|-----------|------------|------------|
| JVM 힙 필요량 | 32GB/노드 (최대 권장) [^5] | 16~32GB/노드 |
| RAM 총 필요량 (동일 처리량) | 256~512GB [^5] | 64~128GB [^5] |

---

## 경제적 분석: TCO(총 소유 비용) 비교

ClickHouse 공식 벤치마크와 여러 출처의 분석에 따르면, ClickHouse는 ES 대비 **스토리지 비용을 10~20x 절감**할 수 있습니다. [^4][^5] 또한 쿼리 성능이 5배 이상 향상되면서 필요한 노드 수도 크게 줄어듭니다.

### 운영 복잡도와 유지보수 비용

ES/OS 클러스터 관리의 숨겨진 비용:

- **인덱스.lifecycle 관리**: 자동 삭제를 위한 ILM 정책 설정 및 모니터링
- **클러스터 리밸런싱**: 노드 추가/제거 시 데이터 재배치
- **인덱스 분할 전략**: 시간 기반 인덱스 생성 및 관리
- **메모리 튜닝**: JVM 힙 크기, 캐시 크기 최적화

ClickHouse는 이러한 운영 부담이 현저히 적습니다:

- 테이블 파티션 자동 관리 (`PARTITION BY toYYYYMM(event_time)`)
- 데이터 복제는 ReplicatedMergeTree로 단순화
- 인덱스 관리가 최소화 (Primary Key + Skip Index)

---

## 마이그레이션 전략

### 단계 1: 병행 운영 시작

기존 ES/OS 시스템을 유지하면서 ClickHouse에도 로그를 동시 기록합니다. 이를 위해 다음과 같은 아키텍처를 사용합니다:

```
[Application] → [Log Agent (Vector/Fluentd)] 
                    ↓
            ┌───────┴───────┐
            ↓               ↓
    [ElasticSearch]   [ClickHouse]
```

**Vector**를 사용하면 단일 파이프라인에서 여러 출력처로 분기하기가 매우 쉽습니다:

```toml
# Vector configuration
sources:
  app_logs:
    type: file
    include: ["/var/log/app/*.log"]

sinks:
  elasticsearch:
    type: elasticsearch
    inputs: ["app_logs"]
    endpoint: "http://es-cluster:9200"
    
  clickhouse:
    type: clickhouse
    inputs: ["app_logs"]
    endpoint: "http://clickhouse:8123"
    database: "logs"
    table: "events"
```

### 단계 2: 쿼리 마이그레이션

ES에서 ClickHouse로 자주 사용하는 쿼리를 점진적으로 전환합니다. 일반적으로 다음 순서로 진행하는 것이 좋습니다:

1. **타임라인 조회** (가장 단순한 집계)
2. **서비스/엔드포인트별 통계**
3. **에러율 및 이상 징후 감지**
4. **전체 로그 검색** (ES와 병행 운영)

### 단계 3: ES 점진적 축소

ClickHouse에서 모든 분석 쿼리가 정상적으로 동작하는 것을 확인한 후, ES 인덱스 보관 기간을 줄이고 노드를 축소합니다. 최종적으로는 ES를 다음과 같은 용도로만 남길 수 있습니다:

- **전체 로그 검색** (특정 요청의 상세 내용 조회)
- **메타데이터 탐색** (인덱싱이 필요한 비정형 데이터)

### 단계 4: 완전 전환 또는 하이브리드 운영

두 가지 옵션이 있습니다:

#### Option A: 완전 ClickHouse 전환
- ES/OS 제거, 모든 로그 분석을 ClickHouse로 통합
- 가장 경제적이며 관리가 단순화됨

#### Option B: 하이브리드 유지
- ClickHouse: 실시간 대시보드 및 집계 쿼리
- ES: 상세 로그 검색 및 인덱싱이 필요한 케이스
- 비용은 증가하지만 유연성 유지

---

## 마이그레이션 시 고려사항

### 1. 스키마 설계

ClickHouse는 ES보다 스키마가 엄격합니다. 로그 데이터를 ClickHouse 테이블에 저장할 때 다음을 고려하세요:

```sql
CREATE TABLE logs (
    event_time DateTime,
    service_name String,
    level String,
    message String,
    status_code UInt16,
    response_time Float64,
    trace_id String,
    user_id String,
    metadata Map(String, String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (service_name, event_time, trace_id)
TTL event_time + INTERVAL 90 DAY;
```

**핵심 포인트:**
- `Map` 타입으로 유연한 메타데이터 저장 가능
- `TTL`로 자동 데이터 삭제 설정
- `ORDER BY`에 자주 쿼리하는 필드 포함

### 2. 데이터 형식 변환

ES의 JSON 로그를 ClickHouse의 열 구조로 매핑할 때 주의사항:

| ES 필드 타입 | ClickHouse 매핑 |
|-------------|----------------|
| text | String 또는 LowCardinality(String) |
| date/time | DateTime64(3) |
| number (int) | UInt32 / Int32 |
| number (float) | Float64 |
| boolean | UInt8 (0/1) |
| nested object | Map(String, String) 또는 별도 테이블 조인 |

### 3. 기존 데이터 마이그레이션

과거 ES에 저장된 로그를 ClickHouse로 이동하려면:

```bash
# ES에서 JSON으로 덤프
curl -X GET "es-cluster:9200/logs-*/_search?size=10000" \
  -H 'Content-Type: application/json' \
  -d '{"query":{"match_all":{}}}' > es_dump.json

# ClickHouse로 로드 (batch 처리 권장)
clickhouse-client --query="INSERT INTO logs FORMAT JSONEachRow" < es_dump.json
```

대용량 데이터의 경우 **ClickHouse's `remote` 함수**나 **Kafka 엔진**을 활용한 스트리밍 마이그레이션이 더 효율적입니다.

---

## 텍스트 검색: ClickHouse의 한계와 ElasticSearch/OpenSearch의 가치

ClickHouse는 로그 분석에서 압도적인 성능을 보이지만, **텍스트 검색** 측면에서는 ES/OS와 명확한 차이가 있습니다. 마이그레이션을 고려할 때 이 차이를 정확히 이해해야 합니다.

### BM25 관련성 스코어링 부재

ES가 제공하는 가장 강력한 기능 중 하나는 **BM25(Best Matching 25) 알고리즘**을 통한 문서의 관련성 스코링입니다. ES는 각 문서 내 키워드의 빈도, 문서 길이, 전체 컬렉션에서의 희소성 등을 종합하여 "이 문서가 검색어와 얼마나 관련 있는가"를 점수로 매깁니다.

ClickHouse에는 **내장된 관련성 스코링 기능이 없습니다**. `hasToken()`, `LIKE` 등으로 텍스트 패턴을 매칭할 수는 있지만, 결과가 "관련성 순"으로 정렬되지 않습니다.

```sql
-- ClickHouse: 텍스트 패턴 매칭 (순서 보장 없음)
SELECT * FROM logs 
WHERE hasToken(message, 'connection timeout')
ORDER BY event_time DESC  -- 시간 기준 정렬만 가능
```

### 자연어 검색에서 ES가 얻는 것

BM25와 관련성 스코링은 단순한 "기능"이 아닙니다. **사용자 대상 검색 서비스**에서 다음과 같은 가치를 제공합니다:

- **검색 결과의 품질**: 사용자가 "connection timeout"을 검색했을 때, 가장 관련성이 높은 로그가 먼저 보입니다
- **오타 허용(Fuzzy Matching)**: `connnection timeout` (오타)이라도 자연스럽게 찾아줍니다
- **언어별 토크나이저**: 한국어(kkma), 영어(stemming) 등 언어 특화 처리로 정확한 매칭

### 하지만 로그 분석에서는 이것이 큰 문제가 되지 않는 이유

위 기능들이 모두 **사용자 대상 검색 서비스**(쇼핑몰 상품 검색, 뉴스 검색 등)에서 중요한 요소들입니다. 반면 로그 분석 워크로드에서는 다음과 같은 이유로 ClickHouse가 여전히 적합합니다:

1. **정확한 매칭이 대부분**: 로그는 구조화된 데이터이므로 `status_code=500`, `service_name=api-gateway` 등 정확한 필드 값으로 필터링하는 경우가 압도적입니다
2. **Relevance ranking이 필요 없는 경우**: 에러 패턴 검색은 "어떤 순서로 결과가 나오는지"보다 "모든 에러를 찾는 것"이 중요합니다
3. **시간 기반 정렬이 일반적**: 로그는 대부분 `ORDER BY event_time DESC`로 최신순 정렬하므로, 관련성 스코링의 필요성이 낮습니다

### ES/OS가 희생한 것 vs 얻은 것

ES/OS가 BM25, fuzzy matching, geo-search 등을 제공하는 대가로 **희생한 것**이 있습니다:

- **스토리지 오버헤드**: 인덱스 구축으로 인해 ClickHouse보다 10~20배 많은 디스크 공간 사용
- **메모리 사용량**: JVM 힙 메모리 관리의 복잡성, GC 압력
- **집계 쿼리 성능**: 샤드 간 집계(shard-level aggregation)로 인한 느린 응답 시간

ES/OS는 **"검색 엔진"**으로서의 가치를 위해 이 trade-off를 감수했습니다. 반면 ClickHouse는 **"분석 데이터베이스"**로서 가치를 위해 검색 기능을 희생했습니다.

---

## 결론

ElasticSearch/OpenSearch는 로그 분석의 초기 단계에서 매우 유용한 도구였습니다. 하지만 로그 데이터의 규모가 증가하고 실시간 분석에 대한 요구가 복잡해지면서, 그 한계가 명확해지고 있습니다. [^5]

ClickHouse로의 마이그레이션은 다음과 같은 이점을 제공합니다:

✅ **성능**: 집계 쿼리 10~25배 빠른 응답 시간 (OTel 50B rows 벤치마크 기준)  
✅ **경제성**: 스토리지 비용 10~20x 절감 [^4]  
✅ **운영 단순화**: 클러스터 관리 부담 감소  
✅ **확장성**: 단일 노드에서도 대용량 처리 가능  

마이그레이션은 하루아침에 완료될 수 없습니다. 하지만 **병행 운영**을 통해 점진적으로 전환하면 리스크를 최소화하면서 이러한 이점을 얻을 수 있습니다. [^2]

로그 데이터 웨어하우스 선택은 단순한 기술 선택이 아닙니다. 그것은 **운영 비용**, **팀의 생산성**, 그리고 **시스템의 신뢰성**에 직결되는 전략적 결정입니다. ES/OS에서 ClickHouse로의 전환은 그러한 결정 중 하나이며, 많은 팀에게 이미 그 가치가 입증되고 있습니다. [^2][^5]

---

## 참고 자료

[^1]: [OneUptime - ClickHouse vs Elasticsearch (2026-01-21)](https://oneuptime.com/blog/post/2026-01-21-clickhouse-vs-elasticsearch/view)
[^2]: [Tasrie IT Services - ClickHouse vs Elasticsearch 2026](https://tasrieit.com/blog/clickhouse-vs-elasticsearch-2026)
[^3]: [ClickHouse Blog - Elasticsearch Log Analytics Benchmark](https://clickhouse.com/blog/elasticsearch-log-analytics-clickhouse)
[^4]: [Tinybird - ClickHouse vs Elasticsearch Search](https://www.tinybird.co/blog/clickhouse-vs-elasticsearch-search)
[^5]: [Big Data Boutique - ClickHouse vs Elasticsearch](https://bigdataboutique.com/blog/clickhouse-vs-elasticsearch)

---

*이 글은 실제 벤치마크 데이터와 운영 환경에서의 경험을 바탕으로 작성되었습니다. 여러분의 환경에 맞게 수치는 조정하여 적용하시기 바랍니다.*
