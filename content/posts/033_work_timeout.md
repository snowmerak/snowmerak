---
title: "라이프타임에 대한 고찰"
date: 2024-07-27T23:59:19+09:00
tags: ["ttl", "timeout", "lifetime"]
author: "snowmerak"
categories: ["Suggestions"]
draft: false
---

## 개요

이전 포스팅과 동일한 프로젝트에 대한 회고를 내용으로 합니다. 이 포스트에선 비교적 안일하게 생각했던 라이프타임에 대해 생각했던 걸 적어보려합니다. 여기서 말하는 라이프타임은 객체의 라이프사이클, 캐시 수명, 요청의 타임아웃 등을 포함하는 어떤 것의 발생과 소멸까지의 시간을 의미합니다.

### 뭐가 문제였지?

대부분의 라이프타임 관리는 괜찮게 했습니다. 하지만 몇몇 경우에 대해서 시스템을 맹신한 나머지 안일하게 관리를 했고, 관련 부분에 대한 내용이 주가 될 것같습니다.

## 본문

해당 프로젝트가 Go로 구현된 만큼 `context` 패키지를 주로 활용하였고, `context` 패키지에 대해 처음 보신다면, 제가 이전에 작성한 [포스트](https://snowmerak.pages.dev/posts/018_context/)를 같이 읽으시면 좋아 보입니다.

### 제대로 한 것들은?

#### 캐시 TTL

모든 캐시 데이터는 Redis를 통해 구성되었습니다. 그리고 기본적으로 프로젝트 내에서 데이터를 생산하는 서비스와 데이터를 소비하는 서비스가 분리되어 있습니다. 이 때문에 `producer` -> `redis` -> `consumer` 흐름을 서비스 간에 명확하게 구성할 수 있었습니다. 여기서 저는 레디스 클라이언트로 `rueidis`를 선택했고, Redis의 Server Assisted Client Side Cache를 적극적으로 활용할 수 있게 되었습니다. 제가 직접 `tracking`을 할 필요가 없어졌기 때문이죠.

그래서 결과적으로 캐시 관련 TTL은 2가지가 발생합니다.

1. Redis 키에 걸리는 TTL: 각 데이터의 특성에 맞게 적절한 TTL을 지정합니다. 주의할 점은 TTL 수치가 작업이 의도치 않게 종료된 후에 다음 작업 시작 가능 시점을 합리적으로 유추할 수 있는 값으로 해야합니다. 예를 들어, 분산 락을 구현한다고 가정합니다. 그러면 초기에 5분의 TTL을 설정하면, 중간에 작업을 수행 중인 시스템이 다운되어도 최대 5분 뒤에는 다른 시스템이 다시 수행할 수 있습니다. 하지만 TTL을 갱신하지 않으면 분산 락 설정 5분 후에 다른 시스템이 중복으로 작업을 수행할 수 있으니, TTL의 75~80% 쯔음 지나갔을 때 TTL을 갱신할 수 있도록 합니다.
2. Client Side Cache에 걸리는 TTL: 해당 키가 Redis에서 할당받은 TTL보다 최대 10%까지 짧게 작성합니다. 자주 데이터가 갱신될 것같은지에 따라 TTL의 값을 조절합니다. 그래도 일반적으로 모든게 정상적으로 돌아간다면, Redis의 TTL이 만료되거나 데이터가 갱신되면, Client Side Cache가 만료되기 때문에 우선 순위가 높은 계산은 아닙니다.

#### 객체 생명주기

고 언어의 `context.Context`는 `func AfterFunc(ctx Context, f func()) (stop func() bool)` 함수가 존재합니다. 이 함수는 해당 컨텍스트가 만료 되었을때 동작합니다. 이 만료에는 명시적인 `cancel()` 함수 호출, timeout 도달 등이 포함됩니다. 

이 기능을 이용해서 거의 대부분의 객체는 생성될 때, 최소 하나의 `context.Context`를 받도록 합니다. 그리고 생성 후 `Close()`나 `Disconnect()` 등을 호출해야 하는 객체면 `AfterFunc` 함수를 호출하여 컨텍스트가 만료될 때, 객체가 소멸되도록 설정합니다. 개인적으로 `runtime.SetFinalizer` 함수를 큰 코스트 없이 대체할 수 있으며, 컨텍스트 단위로 논리적 스코프를 명시적으로 분리할 수 있다는 것에 큰 의의가 있다 생각합니다.

#### API 호출에 대한 timeout

1. http 요청에 대해선 `http.Client` 생성 시 timeout 설정을 이용합니다.
2. gRPC 요청에 대해선 `grpc.WithTimeout` 옵션과 `context.WithTimeout` 함수를 사용합니다.
3. 보편적으로 `context.WithTimeout`을 적극적으로 활용하여, 해당 논리적 스코프에 전역 타임아웃을 걸어 사용합니다.

### 제대로 하지 못한 것들은?

#### 스토리지에 대한 timeout

이전에 작성한 포스트에 나왔던 파일 업로드 부분입니다. 단순하게 서술해서 제가 오브젝트 스토리지를 사용하는 중인데, '업로드가 제때 될 것이다'라는 안일함에 timeout과, 그에 관련된 로그를 전혀 남기지 않았었습니다. 이 부분에서 늦게 업로드 되는 케이스가 수시로 존재했고, 그로 인해 이슈가 되었던 적이 있습니다. 사실상 이로 인해 모든 요청 스코프에 대한 timeout 적용을 고민 했었습니다.

### 그에 대한 대안은?

사실상 모든 논리적 스코프에 `context.Context` 사용 강제와 어느정도의 timeout 수치 적용을 하면 해결할 수 있다고 생각합니다. 그리고 이를 받쳐주기 위해 서비스적으로 각 동작들이 얼마나 빠르게 동작해야하며, 최대 대기 시간이 얼마나 되는 지 등을 세세하게 파악해야할 필요성이 있습니다. 물론 설계 단계에서 이게 되지 않았다는 것에 회의를 느끼기도 합니다.

## 결론

모든 작업에 대한 스코프 적용은 사실 `context.Context`만 잘 사용하면 문제 없이 할 수 있습니다. 모두가 당연히 첫 인자로 `ctx context.Context`를 받고 그에 대한 처리만 빈틈없이 잘 해줄 수 있다면, 사실 문제 없어야 하는 게 맞다고 생각합니다. 하지만 이 글을 쓰는 저도 실수를 통해 더 엄격하게 해야겠다고 느껴 코드 스타일 상으로 강제할 수 있는 방법을 찾아야 했습니다.

그 중 간단한 방법은 linter를 사용하는 것입니다. 하지만 이는 상황에 따라 내가 작성하지 않았거나, 체크하지 않는 게 더 나은 경우에 대해 예외 처리를 하는 게 번거로울 수 있으며, 이것 또한 새로운 스트레스가 될 수 있다는 가능성이 존재합니다. 그렇기에 저는 라이브러리 사용이라는 코드 상의 강제성을 부여할 수 있는 방법을 선택하는 게 어떤가 생각합니다.

### 오랜만에..

제가 작성한 [scope](https://github.com/snowmerak/scope)를 이용하면, 전통적인 `try ... catch ... finally`의 구조를 적용합니다. 어떠한 상태를 만들고, 해당 상태 중심으로 가공, 활용 및 재설정하는 일련의 흐름을 함수로써 작성하여 흐름대로 처리할 수 있게 합니다.

#### example

```go
// riddle.go
package riddle

import (
	"context"
	"fmt"
	"github.com/snowmerak/scope"
	"log"
	"sync/atomic"
)

type State struct {
	number atomic.Int64
}

func NewState() *State {
	return &State{}
}

var _ scope.Work[State] = AddOne

func AddOne(ctx context.Context, state *State) error {
	state.number.Add(1)
	return nil
}

var _ scope.Work[State] = AddTwo

func AddTwo(ctx context.Context, state *State) error {
	state.number.Add(2)
	return nil
}

var _ scope.Work[State] = SubOne

func SubOne(ctx context.Context, state *State) error {
	state.number.Add(-1)
	return nil
}

var _ scope.Work[State] = SetZero

func SetZero(ctx context.Context, state *State) error {
	state.number.Store(0)
	return nil
}

var _ scope.CleanUp[State] = ResetAndPrint

func ResetAndPrint(ctx context.Context, state *State) {
	log.Printf("State: %d\n", state.number.Load())
	state.number.Store(0)
}

var _ scope.CleanUp[State] = JustPrint

func JustPrint(ctx context.Context, state *State) {
	fmt.Printf("State: %d\n", state.number.Load())
}

var _ scope.Checker[State] = SimpleChecker

func SimpleChecker(err error, state *State) {
	log.Printf("SimpleChecker: %v\n", err)
	state.number.Store(0)
}
```

```go
package main

import (
	"context"
	"github.com/snowmerak/scope"
	"github.com/snowmerak/scope/prac/riddle"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	r := riddle.NewState()

	scope.Sequence(ctx, r, riddle.SimpleChecker, riddle.JustPrint, riddle.AddOne, riddle.AddTwo, riddle.SubOne)

	scope.Sequence(ctx, r, riddle.SimpleChecker, riddle.ResetAndPrint, riddle.AddOne, riddle.AddTwo, riddle.SubOne)

	scope.Sequence(ctx, r, riddle.SimpleChecker, riddle.JustPrint, riddle.AddOne, riddle.AddTwo, riddle.SubOne)
}
```

```shell
State: 2
2024/07/28 16:17:28 State: 4
State: 2
```
