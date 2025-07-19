---
title: "Introduce to Quantum Modular Architecture"
date: 2025-07-19T13:33:18+09:00
author: snowmerak
tags: ["architecture"]
categories: ["Information"]
draft: false
---

## 개요

소프트웨어 아키텍처는 마치 새로운 도시를 설계하는 것과 유사합니다. 어떤 기반 시설을 놓고, 어떻게 길을 놓으며, 어떤 건물을 허가해줄지 등을 논하는 것과 비슷하며, 이는 당장 설계 이후 건설 및 조성 단계에서 실제 시민의 생활과 유지보수에도 영향을 끼칩니다.

최근 소프트웨어 아키텍처를 선택할 때 주요하게 거론되는 2가지는 `Microservice Architecture`(이하 MSA)와 `Modular Monolith Architecture`입니다. 그리고 비교적 최근에 `Modular Monolith Architecture`(이하 MMA)가 모놀리스 아키텍처와 MSA의 중간 다리로써 등장하고 쓰여지고 있습니다.

각각의 아키텍처에는 저마다의 장단점이 있으며, 보통은 서비스 형태나 도메인에 따라 적합한 아키텍처를 선택하여 설계 및 운영하게 됩니다. 이 중 MSA와 MMA에는 다음과 같은 장단점이 있습니다.

- MSA
  - 장점
    - 독립적인 배포 및 확장 가능
    - 기술 스택을 유연하게 선택 가능
    - 장애 전파가 단일 마이크로 서비스에 제한
  - 단점
    - 많은 마이크로 서비스로 구성되는 분산 시스템인 만큼 복잡성 증가
    - 운영 오버헤드가 높음
    - 통합 테스트 시 복잡도 증가
    - 마이크로라는 단위의 오해로 인해 분산 정도가 제각각
- MMA
  - 장점
    - 개발 및 배포가 단순함
    - 운영 복잡성이 낮음
    - 단일 코드베이스에서 일관성 있게 개발 가능
  - 단점
    - 배포 시 전체 서비스가 변화
    - 기술 스택이 한정적으로 구성
    - 잠재적 확장이 비교적 어려움
    - 장애 전파가 특정 영역에 그치지 않음

이 중 최대한 장점만을 선별적으로 취하는 것을 목표로 삼았습니다.

- MMA의 `개발 및 배포의 단순함`, `단일 코드베이스에서의 일관성 있는 개발`
- MSA의 `장애 전파 제한`, `독립적인 배포 및 높은 확장성`

위 고려 사항을 기반으로 단일 코드베이스의 일관성과 단순함은 유지하면서, 각 기능은 독립적으로 배포하고 확장할 수 있는 아키텍처를 고민했습니다.

그 결과물이 `빌드 시점에는 강하게 결합하지만, 런타임 시점에는 느슨하게 결합한다`는 기반 철학을 만들어냈습니다. 그리고 그 아키텍처의 이름을 `Quantum Modular Architecture`(이하 QMA)로 지었습니다.

## 본론

### 아키텍처 퀀텀

QMA의 핵심 중 하나는 아키텍처 퀀텀입니다. 아키텍처 퀀텀은 `독립적으로 배포하고 운영할 수 있는 기능의 최소 단위`입니다. 이는 단순한 코드 수준의 모듈을 넘어, 하나의 명확한 비즈니스 도메인 (주문이나 사용자, 스트리밍, 알림 등)을 포함하는 개념입니다. 더 들어가면 아래 영역이 포함된다 볼 수 있습니다.

- 쿠버네티스 시점에서 해당 도메인의 Namespace: 각 아키텍처 퀀텀은 쿠버네티스에서 여러 pod와 PVC, network 등을 포함할 수 있는 네임스페이스에 대응하는 것이 적합합니다. 이 안에서 실행되는 모든 pod, 구성되는 pvc, ingress 등도 이 안에 포함됩니다.
- 해당 퀀텀에서만 사용하는 데이터베이스와 분산 캐시, 메시지 브로커 등도 당연히 이에 포함됩니다.
- 또한 배포 관리를 위한 CI/CD 파이프라인
- 운영을 위한 모니터링 대시보드
- 타 퀀텀과의 커뮤니케이션을 위한 파사드

각 도메인은 서로 간에 할일과 데이터를 저장 및 생산합니다. 이에 대한 데이터 소유권과 책임만 가질 뿐, 다른 도메인에게 영향을 주거나 소유권을 행사하지 않습니다.

따라서 각 퀀텀은 다른 퀀텀의 눈치를 보지 않고, 저마다의 속도와 기술에 맞춰서 서비스를 개발하고 배포할 수 있습니다. 이는 자연스럽게 조직의 구조와 아키텍처 구조를 어느 정도 일치시킬 수 있으며, 불필요한 커뮤니케이션 비용을 줄이고, 개발의 자율성과 책임을 극대화시킬 수 있습니다.

### 플랫폼과 비즈니스

#### 플랫폼

모든 퀀텀은 각자 독립적으로 존재하지만, 각 퀀텀 간에 커뮤니케이션이 아예 발생하지 않으면 비즈니스로써는 의미를 가지기 어렵습니다. 그렇기에 퀀텀 중 하나를 플랫폼에 할당하여, 플랫폼 퀀텀을 만듭니다.

이 플랫폼 퀀텀은 다음 역할을 담당합니다.
- API Gateway: 하나의 비즈니스 서비스로써 외부의 퍼블릭한 곳에서 오는 요청을 받는 곳
- Kafka & NATS를 비롯한 Global Message Broker & Message Queue: 각 퀀텀 간의 비동기 통신을 책임지는 영역
- Service Mesh: 각 퀀텀과 퀀텀 사이의 동기식 직접 통신과 신뢰성을 보장하는 영역
- Observability Stack: 각 퀀텀 및 퀀텀 내 서비스와 인프라에 대한 시스템 & audit 로그 등을 저장 및 모니터링 하는 영역

그래서 이 플랫폼 퀀텀은 공유 인프라의 안정성과 성능 및 보안을 책임지며, 외부 요청을 직접 처리하여 적절히 오케스트레이션하는 역할 등을 합니다. 덕분에 플랫폼을 개발하고 운영하는 담당자는 각 비즈니스의 구체적인 로직을 알 필요 없이, 오직 약속된 인터페이스(API, 이벤트 명세)에만 집중하여 전체 시스템을 조율하고 유지보수할 수 있습니다.

#### 비즈니스

이제 플랫폼 퀀텀을 기반으로 통신하며, 각각의 영역을 담당할 비즈니스 퀀텀 차례입니다. 기술한 플랫폼 퀀텀을 제외한 모든 퀀텀은 비즈니스 퀀텀에 해당합니다. 

이들은 각 비즈니스 도메인에 따라 별개의 구역을 이루며, 이 안에는 전용 데이터베이스 및 분산 캐시, 필요에 따라 퀀텀 내의 메시지 큐(혹은 메시지 브로커), 서비스 메시 등과 그들을 활용하는 서비스가 존재합니다.

### 커뮤니케이션 방식

각 퀀텀 및 내부 서비스 간에는 협력하기 위한 충분한 방식과 명확한 규칙이 필요합니다.

#### 퀀텀 내 서비스 간에

- 일반적인 코레오그래피(choreography)와 오케스트레이션(orchestration) 방식 중 어떤 걸 선택해도 무관합니다.
- 다만, 동일 레벨 간에 서비스 메시 등을 통한 직접 통신을 금지합니다.

#### 서로 다른 퀀텀 간 통신

각 퀀텀은 독립적이지만, 비즈니스를 완성하기 위해선 서로 소통해야 합니다. QMA에서는 무분별한 직접 호출 대신, 잘 정의된 두 가지 통로, 즉 '파사드'와 '비동기 이벤트'만을 허용합니다.

1. 파사드

다른 퀀텀이 한 퀀텀의 서비스를 호출해야하거나, 데이터베이스에 접근을 해야할 때에 그 퀀텀의 내부에 직접 접근하는 것은 금지됩니다. 각 퀀텀은 자신이 외부에 공개할 기능을 정의 및 구현해놓은 일종의 API Gateway를 구성합니다.

다른 퀀텀은 동기적으로 다른 퀀텀 내 서비스의 기능을 호출하거나, 데이터에 접근을 해야한다면 이제 파사드를 통해 요청하고 응답을 받게 됩니다. 이러한 구성은 주로 gRPC나 HTTP/2를 통해 효율적이고 낮은 지연 시간을 통해 제공되며, 플랫폼 퀀텀의 서비스 메시를 통해 관리됩니다.

2. 비동기 이벤트 통신

아마 대부분의 경우, 즉각적인 통신보다는 비동기적인 통신이 필요한 케이스가 많을 것입니다. 이에 대해 두가지 안이 있습니다.

- 단순 이벤트 전파 (Kafka, Pular, etc...)
  
단순이 상태가 변경되었다는 변경 사실에 대해 전파를 한다면, kafka나 pulsar를 통해 스트리밍하며 필요한 다른 퀀텀의 서비스가 받아서 처리하도록 합니다. 이 구조에서는 그 누구도 다른 퀀텀의 서비스를 참조하지 않았지만, 하나의 이벤트가 흘러 시스템 전체의 유기적인 협력을 만들어냅니다.

이때의 kafka나 pulsar 또한 플랫폼 퀀텀의 것을 사용합니다.

- 비동기 요청 및 응답 (NATS, RabbitMQ, etc...)

특정 작업에 대한 비동기 요청 및 응답을 받아야 한다면, NATS나 RabbitMQ처럼 이벤트 스트리밍보다는 라우팅에 강점을 가지는 메시지 큐들이 좋은 선택지가 됩니다. 이 경우에서 어떠한 데이터가 필요하다거나 코레오그래피 상 다음 역할을 수행해야하는 다른 퀀텀의 서비스를 호출할 때, 직접 참조보다 유연하게 쓰일 수 있습니다.

또한 이 영역에서 NATS를 사용하게 되면, 단순 리전 내 클러스터를 넘어서 리전 간 수퍼 클러스터 등을 구성하여 쉽고 빠른 네트워킹을 할 수 있어 리전 장애 대응에도 큰 도움이 될 것입니다.

이때의 NATS나 RabbitMQ 또한 플랫폼 퀀텀의 것을 사용합니다.

### Go 언어에서

이 아키텍처 구조는 이전에 [gosuda/ako](https://github.com/gosuda/ako)로 구현을 시도한 바 있습니다. 당시의 경험을 통해 얻은 교훈을 반영하여, 현재는 AI Agent를 통한 코드 생성에 이 구조를 활용하고 있습니다. 해당 프롬프트는 말미에 작성해놓도록 하겠습니다.

기본적으로 `lib`, `internal`, `cmd` 폴더를 가지는 여러 실행 파일이 생성되는 구조와 크게 다르지 않습니다.

이 구조에는 `무엇을 할 것인가`, `어떻게 할 것인가`를 분리하고, 엔트리 포인트에서 `조립`하는 것입니다.

- lib

이 디렉토리는 시스템의 추상적인 계약을 정의하는 곳입니다. 오직 인터페이스와 DAO나 DTO가 될 수 있는 구조체, 즉 `무엇을 할 것인가`가 정의됩니다. 실제 구현은 간단한 유틸리티 외에 들어가면 안됩니다.

- pkg

`lib`에서 정의한 계약과 명세에 대한 구현체가 기술되는 곳입니다. 특정 자료구조나 기술(postgres, Redis, gRPC, 암호화 등)에 종속적인 `어떻게 할 것인가`를 담당합니다.

- internal

비즈니스 로직이 포함됩니다. `internal/service`에는 각 `lib`의 계약과 명세만 받아서 필요한 비즈니스 로직을 구성합니다. 절대 `pkg`의 구현체를 참조해선 안됩니다. 무엇을 할 건지를 조합해서 어떤 가치를 만들지 정의하는 곳입니다.

그리고 `internal/controller`에서는 `inernal/service`를 가지고 외부 요청에 대한 필요한 기능을 구현합니다. 외부의 요청을 어떻게 받을지 정의하고, 어떤 가치와 결합할지 결정하는 곳입니다.


- cmd

엔트리 포인트가 존재하는 조립 라인입니다. 각 하위 디렉토리는 하나의 독립적인 실행파일(서버, 서비스, 워커 등)이 됩니다. 이 곳은 `pkg`의 인스턴스를 실제 생성해서 `internal/controller`에 넣어주는 역할을 합니다. 그럼 컨트롤러 내부에 `lib`으로써 전파되어 각 역할을 수행하게 됩니다.

이 구조를 통해 MMA의 여러 장점을 취할 수 있지만, 기술된 아키텍처적 장점으로는 다음 2가지를 뽑을 수 있을 것같습니다.

1. `lib`에 대한 실제 구현을 교체할 때, 서로다른 `pkg`로 쉽게 교체할 수 있습니다.
2. 입력과 출력, 읽기와 쓰기에 대한 부분을 같은 `pkg`로 작성하고 다른 `lib`으로 대입하면, 구체적인 요구사항에 맞춰 유연하게 대응할 수 있습니다.

이 과정에서 `internal` 내부의 비즈니스 로직은 건들 필요가 없습니다. 이는 테스트를 용이하게 하며, 기술 변화에 유연하게 대처할 수 있는 QMA의 지향점입니다.

## 결론

이 아키텍처를 구체화하며 확실히 많은 걸 배웠습니다.

1. 개발 생산성: 모노레포를 통한 공통 모듈 재사용 및 유연한 배치로 개발 속도 및 배포 용이성을 확보했습니다.
2. 운영 안정성: 각 퀀텀의 장애가 전파되지 않아 전체 시스템의 안정성이 향상되었습니다.
3. 확장성: 독립적인 퀀텀 구조가 MSA의 각 서비스와 유사하기에 해당 퀀텀에 대한 부하가 증가할 수록 필요한 부분만 점진적으로 확장하여 대응할 수 있습니다.
4. 진화 가능성: 각 퀀텀은 미리 정의한 파사드의 인터페이스와 메시지 브로커에 대한 구독 및 발행 중인 정보만 확인하여 새로운 퀀텀에서 새로 구현한다면, 쉽게 새로운 기술 스택과 향상된 설계로 재구현된 새로운 퀀텀으로 교체할 수 있습니다.

물론 QMA를 모든 문제에 대한 정답으로써 제시하는 것은 아닙니다. 그래도 저의 현재 상황과 각 아키텍처의 성격을 보았을 때에 제가 선택할 수 있는 최적의 안을 고심 및 구체화 했음에 의미를 두고 있습니다.

이 글이 비슷한 고민을 하고 있는 분들에게 작게나마 영감을 줄 수 있길 기대합니다.

## 부록

### AI Agent 프롬프트

```markdown
# Go Project Structure Guide

This document defines a standard, production-ready package structure and a set of engineering principles for building robust, flexible, and scalable Go applications. Its purpose is to provide a clear and consistent blueprint that can be easily understood and automated by Large Language Models (LLMs) for code generation.

### Strict Rules to Follow

These are the non-negotiable rules of this architecture. They must be strictly followed to maintain the integrity of the structure.

1.  **Absolute Separation of Interface and Implementation**: All interfaces **must** be defined within the `lib` package. All concrete implementations of those interfaces **must** be created within the `pkg` package.
2.  **`internal/service` Dependency Rule**: The `internal/service` layer **must only** depend on the `lib` package. It must **never** depend on `internal/controller`.
3.  **`internal/controller` Dependency Rule**: The `internal/controller` layer can depend on `internal/service` and the `lib` package. It must **never** depend on `pkg` or `cmd`.
4.  **`cmd` Layer's Role**: The `cmd` layer is the **only** layer that can depend on all other internal layers (`internal/controller`, `internal/service`) and `pkg`. Its sole purpose is to "wire" everything together.

### Directory Structure and Roles

*   `**/cmd/**`: The application's entry point (`main` package). Its sole responsibility is to assemble dependencies (wiring `pkg` implementations into `internal` components) and start the application. Each subdirectory is a runnable application and must contain its own `Dockerfile`.
*   `**/internal/**`: Contains the application's business logic (`controller`, `service`).
    *   `**internal/controller/**`: Handles incoming requests (e.g., HTTP, gRPC), calls the appropriate `service`, and transforms the result into a response.
    *   `**internal/service/**`: Executes core business logic and orchestrates use cases. This is the **only** layer where multiple interfaces from `lib` are combined (composed) to create complex business flows. For example, a service might use a `repository` interface and a `notification` adapter interface together.
    *   `**internal/tests/**`: Contains integration tests that verify the interaction between multiple components (e.g., service and database).
*   `**/lib/**`: The project's most fundamental abstraction layer. Defines technology-agnostic **interfaces** and data structures. It contains **no concrete implementation code**.
    *   `**lib/domain/**`: Defines core business entities and their intrinsic business rules.
    *   `**lib/repository/**`: Defines interfaces for data persistence.
    *   `**lib/adapter/**`: Defines interfaces for external services like loggers or payment gateways.
        *   `**lib/adapter/gen/**`: Contains code generated by `buf`.
*   `**/pkg/**`: Contains the **concrete implementations** of the interfaces defined in `lib`. All infrastructure-related code resides here. 
    *   A `pkg` implementation must be a self-contained, minimal implementation of a single `lib` interface (e.g., implementing the `Repository` interface from the `lib/repository/{entity}` package using `sqlc` and `pgx`).
    *   It **must not** compose other `lib` interfaces by holding them as fields. The responsibility of combining different functionalities belongs exclusively to the `internal/service` layer.
    *   **Client Wrapping Pattern for Multiple Interfaces**: When a single technology package (e.g., `pkg/client/{technology}`) needs to implement multiple `lib` interfaces (e.g., `{entity1}.Cache`, `{entity2}.Cache`), a wrapping pattern **must** be used.
        1.  A central `client.go` file should define the core client struct (e.g., `type Client struct { ... }`) that manages the underlying connection (e.g., to Redis).
        2.  Each `lib` interface implementation should be in its own file (e.g., `{entity1}_cache.go`, `{entity2}_cache.go`).
        3.  Each implementation struct will wrap the core client (e.g., `type {Entity1}Cache struct { client *Client }`) and use it to implement the specific interface methods. This promotes code reuse and clear separation of concerns within the package.
    *   When implementing an interface from `lib`, it is **mandatory** to include a compile-time check to ensure the struct correctly implements the interface. Use the following pattern directly below the import statements: `var _ lib_package.InterfaceName = (*StructName)(nil)`. 
    *   Unit tests for each implementation must be located within the same package.
*   `**/proto/**`: Stores the original Interface Definition Language (IDL) files, such as Protocol Buffers (`.proto`).

### Tooling and Code Generation

#### Protobuf & gRPC (`buf`)

*   **Source Location**: All `.proto` source files **must** be located in the `proto/` directory.
*   **Generated Code Destination**: Code generated by `buf` **must** be placed in the `lib/adapter/gen/` directory.
*   **Configuration Template (`buf.yaml`)**:
    ```yaml
    version: v1
    name: buf.build/your-org/your-project
    deps:
      - buf.build/googleapis/googleapis
    breaking:
      use:
        - FILE
    lint:
      use:
        - DEFAULT
    ```
*   **Generation Template (`buf.gen.yaml`)**:
    ```yaml
    version: v1
    plugins:
      - plugin: buf.build/protocolbuffers/go:v1.31.0
        out: lib/adapter/gen
        opt: paths=source_relative
      - plugin: buf.build/grpc/go:v1.3.0
        out: lib/adapter/gen
        opt: paths=source_relative
    ```

*   **Tool Dependency Management (Go 1.24+ Recommended)**: It is recommended to manage the `buf` CLI as a versioned tool dependency. This ensures that all developers and CI environments use the exact same version of the tool.

    1.  **Add the tool to `go.mod`**: Run `go get -tool buf.build/buf/cmd/buf` to add it as a tool dependency.
    2.  **Usage**: Run `go tool buf generate` to execute the version defined in your `go.mod`.

### Code Style & Conventions

#### Error Handling Practices

*   **Error Wrapping**: When propagating an error from a lower layer to a higher one, it **must** be wrapped with context using `fmt.Errorf("description of what failed: %w", err)`. This creates a traceable error stack.

#### Documentation Style (godoc)

*   **`godoc` Comments**: All exported functions, types, variables, and constants **must** have a `godoc`-style comment that starts with the name of the element it is documenting. The comment should clearly explain its purpose and usage.

### Testing Strategy

*   **Unit Tests**: Located within the `pkg` package they are testing. They must test components in isolation by mocking external dependencies.
*   **Integration Tests**: Located in the `internal/tests/` directory. They test the interaction between multiple components, often with real external services like a database running in Docker.
*   **End-to-End (E2E) Tests**: Located within the relevant `cmd` package. They test the entire application by making requests to its public interface (e.g., HTTP API).

### Build and Deployment

*   **`Dockerfile`**: Each runnable application in a `cmd/*` directory **must** have its own `Dockerfile`. Multi-stage builds should be used to create lean production images.
*   **`docker-compose.yaml`**: Located at the project root with environment-specific names (e.g., `dev.docker-compose.yaml`). These files define the local development and testing environments.

### Conventional Main File Names

To maintain consistency, it is recommended to use standardized file names for the main logic within each package type. The file name should reflect the package's primary role.

*   `cmd/{app_name}/` → `app.go` (or `main.go`)
*   `internal/controller/{feature_api}/` → `controller.go` (or `handler.go`)
*   `internal/service/{business_logic}/` → `service.go`
*   `pkg/client/{technology}/` → `client.go`
*   `pkg/client/{technology}/` → `repository_{repository_name}.go`
*   `lib/repository/{entity}/` → `{entity}.go`
*   `lib/domain/{entity}/` → `{entity}.go`
```