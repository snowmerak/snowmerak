---
title: "role playing go"
date: 2022-03-11T20:09:47+09:00
tags: ["go", "oop", "class", "package"]
draft: false
---

## 개요

고 언어를 사용하여 프로젝트를 구성할 때, 제가 주로 작성하는 스타일을 정리하는 글입니다.

대체로 `import cycle`을 해결하거나 어느정도의 OOP를 구현하는 데에도 용이하다고 생각합니다.

## 역할

각 패키지는 고유의 역할을 가지게 됩니다. 상위일수록 더욱 추상적인 역할을 가지고 하위일수록 더욱 구체적인 역할을 가지게 됩니다.

### 간단한 예시

`Tester`라는 역할이 있다고 가정합시다. 저는 `tester`라는 패키지를 만들게 될 것입니다.

```go
package tester

type Tester interface {
    Test(...interface{})
}
```

먼저 추상적인 테스터의 기능을 작성할 인터페이스를 선언합니다. 편의를 위해 매개변수는 빈 인터페이스 가변 인자로 작성합니다. 테스터에는 단순 입력한 걸 기반으로 동작하는 `SimpleTester`, 자동으로 입력 가능한 랜덤 값을 추출해서 동작하는 `FuzzTester`가 존재할 수 있습니다.

tester 패키지 하위 디렉토리에 `simple_tester`와 `fuzz_tester`를 작성하고 `tester` 인터페이스를 구현하여 작성합니다.

```go
package simple_tester

type SimpleTester struct {}

func New() tester.Tester {
    return new(SimpleTester)
}

func (s *SimpleTester) Test(values ...interface{}) {}
```

```go
package fuzz_tester

type FuzzTester struct {}

func New() tester.Tester {
    return new(FuzzTester)
}

func (f *FuzzTester) Test(values ...interface{}) {}
```

각각 테스터 역할을 수행할 수 있지만 세부 기능은 다른 형태로 작성되어 동작하게 될 것입니다. 

## 파생과 포함

각 패키지는 고유의 역할을 가지지만 각 역할 간에는 파생 혹은 포함 관계가 성립할 수 있습니다. 그럴 경우 양자 간의 관계일 경우엔 해당 역할의 루트 디렉토리의 하위 디렉토리에 작성합니다.

### 단일 역할에서 단일 역할이 파생될 경우

제가 작성한 로그스트림([github](https://github.com/diy-cloud/logstream))의 구조입니다.

```bash
.
├── LICENSE
├── README.md
├── consumer
│   ├── consumer.go
│   ├── nats
│   │   └── nats.go
│   └── stdout
│       └── stdout.go
├── go.mod
├── go.sum
├── log
│   ├── logbuffer
│   │   ├── logbuffer.go
│   │   ├── logqueue
│   │   │   ├── pq.go
│   │   │   └── readme.md
│   │   └── logring
│   │       ├── rb.go
│   │       └── readme.md
│   ├── loglevel
│   │   ├── level.go
│   │   └── readme.md
│   ├── readme.md
│   └── struct.go
├── logstream.go
└── trie.go
```

`log` 밑의 `logbuffer` 패키지와 `loglevel` 패키지의 경우 `log`의 객체를 직접 활용하고 있으므로 바로 하위에 위치하고 있습니다. 

### 여러 역할에서 파생될 경우 혹은 여러 역할을 포함할 경우

여러 역할에서 파생될 경우에는 최소 공통 최상위 디렉토리에 작성하게 됩니다. virtual-gate 레포([github](https://github.com/diy-cloud/virtual-gate))가 그런 구조입니다.

```bash
.
├── LICENSE
├── README.md
├── balancer
│   ├── balancer.go
│   ├── hashed
│   │   └── hashed.go
│   ├── least
│   │   └── least.go
│   └── round
│       └── round.go
├── breaker
│   ├── breaker.go
│   ├── count_breaker
│   │   └── breaker.go
│   └── simple_breaker
│       └── breaker.go
├── go.mod
├── go.sum
├── limiter
│   ├── bucket
│   │   └── bucket.go
│   ├── limiter.go
│   ├── slide_count
│   │   ├── acc
│   │   │   └── acc.go
│   │   └── slide.go
│   └── slide_log
│       └── log.go
├── lock
│   └── lock.go
└── proxy
    ├── http_proxy
    │   ├── extensions.go
    │   ├── http.go
    │   └── response.go
    ├── proxy.go
    └── tcp_proxy
        └── tcp.go
```

`balancer`, `limiter`, `breaker`는 모두 독립된 역할을 하지만 `proxy`는 앞의 3가지 역할을 포함합니다. 그렇기에 `proxy`도 동일하게 최소 공통 최상위 디렉토리에 위치하게 됩니다. 

### 여러 역할에서 포함하는 역할

`net/http` 베이스로 작성한 럭스([github](https://github.com/diy-cloud/lux))의 디렉토리 구조입니다.

```bash
.
├── LICENSE
├── LICENSES.md
├── context
│   ├── context.go
│   ├── get.go
│   ├── header.go
│   ├── reply.go
│   ├── status.go
│   └── websocket.go
├── go.mod
├── go.sum
├── handler
│   └── handler.go
├── logext
│   ├── logext.go
│   └── stdout
│       └── stdout.go
├── lux.go
├── middleware
│   ├── acl.go
│   ├── authorize.go
│   ├── compress.go
│   ├── cors.go
│   └── middleware.go
├── readme.md
├── router
│   ├── router.go
│   └── routergroup.go
├── signal
│   └── signal.go
└── util
    ├── ip.go
    └── mime.go
```

> `router`와 `middleware`, `context` 패키지의 구조는 이 글에서는 안티패턴입니다.

`util` 패키지는 각 패키지에서 사용할 유용한 기능을 담당하는 역할을 합니다. 다른 역할을 파생시키지는 않지만 포함되어 도와주는 역할을 하게 됩니다. 이 경우에도 공통된 최소 최상위 디렉토리에 위치하게 됩니다.

### 여러 독립적 기능을 가진 역할들이 파생될 때

> 기본적으로 이 글에서는 안티패턴입니다. 분리하는 게 맞지만 부득이하게 수정해야할 코드가 많을 경우 이렇게 작성합니다.

위 럭스의 구조에서 `context`는 2가지의 파생 역할이 포함되어 있습니다.

```go
package context

type LuxContext struct {
	Request     *http.Request
	Response    *Response
	RouteParams httprouter.Params
}

type WSContext struct {
	Conn net.Conn
}
```

럭스는 두가지 컨텍스트를 가집니다. 하나는 일반적인 HTTP 요청에서 사용하는 컨텍스트이고 다른 하나는 웹소켓 요청에서 사용하는 컨텍스트입니다. 서로 같은 컨텍스트라는 역할을 공유하지만 독립적으로 다른 기능을 제공합니다. 이 경우엔 같은 패키지에 작성하고 파일과 이름을 분리하여 관리합니다.
