---
title: "Context 패키지 (실전)"
date: 2023-05-26T18:47:21+09:00
tags: ["go", "context"]
draft: false
---

## 기능 복기

`TODO` 컨텍스트의 경우에 특이 케이스이므로 여기에 포함시키지 않겠습니다.

### 컨텍스트 생성

```go
package main

import "context"

func main() {
	ctx := context.Background()
}
```

`context.Background()` 를 통해 새로운 컨텍스트를 생성할 수 있습니다.  
반드시 이 컨텍스트를 생성할 때는, 모든 작업의 최상단에서 생성해야 합니다.

### 취소 가능한 컨텍스트 생성

1. `context.WithCancel()`

```go
package main

import "context"

func main() {
	ctx := context.Background()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
}
```

`context.WithCancel()` 을 통해 취소 가능한 컨텍스트를 생성할 수 있습니다.  
이 함수는 새로운 컨텍스트와 취소 함수를 반환합니다.  
취소 함수를 통해 현재 컨텍스트를 포함한 하위 컨텍스트들에게 취소 시그널을 줄 수 있습니다.  
시그널은 `ctx.Done()` 메서드에서 반환된 `<-chan struct{}`에서 받을 수 있습니다.

2. `context.WithCancelCause()`

```go
package main

import (
	"context"
	"errors"
)

var errCanceled = errors.New("canceled")

func main() {
	ctx := context.Background()

	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(errCanceled)
}
```

`context.WithCancelCause()` 을 통해 취소 가능한 컨텍스트를 생성할 수 있습니다.  
이 함수는 새로운 컨텍스트와 취소 함수를 반환합니다.  
취소 함수를 통해 현재 컨텍스트를 포함한 하위 컨텍스트들에게 취소 시그널과 그 이유를 전파할 수 있습니다.

3. `context.WithTimeout()`, `context.WithDeadline()`

```go
package main

import (
	"context"
	"time"
)

func main() {
	ctx := context.Background()

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    // ctx, cancel := context.WithDeadline(ctx, time.Now().Add(5*time.Second))
	defer cancel()
}
```

`context.WithTimeout()` 을 통해 시간 제한을 가진 컨텍스트를 생성할 수 있습니다.  
함수의 동작은 `context.WithDeadline()`과 거의 동일합니다.  
해당 시간이 지나거나, 해당 시각에 도달할 경우 컨텍스트가 자동으로 취소됩니다.

4. `context.WithTimeoutCause()`, `context.WithDeadlineCause()`

```go
package main

import (
	"context"
	"errors"
	"time"
)

var errTimeout = errors.New("timeout")

func main() {
	ctx := context.Background()

	ctx, cancel := context.WithTimeoutCause(ctx, 5*time.Second, errTimeout)
	// ctx, cancel := context.WithDeadlineCause(ctx, time.Now().Add(5*time.Second), errTimeout)
	defer cancel()
}
```

`context.WithTimeoutCause()` 을 통해 시간 제한과 에러 메시지를 가진 컨텍스트를 생성할 수 있습니다.  
함수의 동작은 `context.WithDeadlineCause()`과 거의 동일합니다.
해당 시간이 지나거나, 해당 시각에 도달할 경우 자동으로 컨텍스트가 취소되며, 에러 메시지를 하위 컨텍스트에 전파합니다.

5. `context.WithoutCancel()`

```go
package main

import (
	"context"
	"errors"
)

var errCanceled = errors.New("canceled")

func main() {
	ctx := context.Background()

	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(errCanceled) // ignored cancellation

	ctx = context.WithoutCancel(ctx) // // ignore defer cancellation
}
```

`context.WithoutCancel()` 을 통해 취소 신호를 무시하는 컨텍스트를 생성할 수 있습니다.  
이 함수는 상위 컨텍스트의 스택은 유지하면서, 취소 신호만 무시하는 컨텍스트입니다.  
그래서 `defer cancel()` 을 통해 취소 함수를 호출해도, 취소 신호를 무시합니다.

### 컨텍스트에서 값 다루기

1. `context.WithValue()`

```go
package main

import (
	"context"
)

type CtxKey int

const (
	FirstKey CtxKey = iota
	SecondKey
)

func main() {
	ctx := context.Background()

	ctx = context.WithValue(ctx, FirstKey, "first value")
	ctx = context.WithValue(ctx, SecondKey, "second value")
}
```

`context.WithValue()` 를 통해 컨텍스트에 값을 추가할 수 있습니다.  
이 함수는 값을 포함하는 새로운 컨텍스트를 반환합니다.  
추가하는 키와 값은 `any` 타입이지만 키는 각 패키지와 타입 마다 커스텀 타입을 사용함을 권장합니다.

2. `context.Value()`

```go
package main

import (
	"context"
	"fmt"
)

type CtxKey int

const (
	FirstKey CtxKey = iota
	SecondKey
)

func main() {
	ctx := context.Background()

	ctx = context.WithValue(ctx, FirstKey, "first value")
	ctx = context.WithValue(ctx, SecondKey, "second value")

	fmt.Println(ctx.Value(FirstKey))
	fmt.Println(ctx.Value(SecondKey))
}
```

`context.Value()` 메서드를 통해 컨텍스트에 값을 가져올 수 있습니다.  
이 메서드는 `any` 타입을 반환하므로 적절한 타입 단언이 필요합니다.  
그리고 키를 비교할 때, 타입과 값을 동시에 검사하므로 정확하게 일치하는 타입과 값으로 넣어줘야합니다.  
예를 들어 지금 위의 예시에서 `FirstKey`를 가져오기 위해, `0`을 넣게 되면 값을 가져오지 못합니다.

### 컨텍스트 사후 처리

```go
package main

import (
	"context"
	"log"
	"time"
)

func main() {
	ctx := context.Background()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	stop := context.AfterFunc(ctx, func() {
		log.Println("cancellation function called")
	})

    _ = stop
    // stop() // cancel AfterFunc function
	cancel()
	time.Sleep(1 * time.Second)
}
```

`context.AfterFunc()` 을 통해 컨텍스트가 취소될 때, 실행할 함수를 등록할 수 있습니다.  
이 함수는 자신 포함 상위 컨텍스트에서 오는 취소 신호를 받으면 딱 한번 실행됩니다.  
`stop()` 함수를 반환하는데, 이 함수를 호출함으로 `AfterFunc()`로 등록한 함수의 실행을 취소할 수 있습니다.  
마지막으로, 취소 신호에 동작하기 때문에 `WithTimeout()`이나 `WithDeadline()`의 시간 초과에도 동작합니다.

## 문맥 지향

고 프로그램을 하나의 큰 작업으로 본다면, `main` 엔트리 포인트에서 컨텍스트가 생성되어 전체 프로그램에 전파됩니다.

그래서 이제부터 `main` 함수에서 컨텍스트를 생성하고, 하위 작업(단순 유틸리티는 제외입니다. 예를 들어, 문자열을 합친다거나, 정렬한다거나 하는 함수)에 컨텍스트를 무조건 전달한다고 가정하고 작성하겠습니다.

### 작업 관점에서의 문맥

컨텍스트를 전달함으로 특정 작업을 하나의 그룹으로 묶을 수 있습니다.

![01](/img/019/01.svg)

인증 서버와 검색 서버, 업데이트 서버를 각각 하나의 그룹으로 묶고 있습니다. 이때, 메인 함수에서 각 서버를 실행할 때, `WithCancel`을 통해 취소 함수를 생성하고, 각 서버에 전달합니다.

그러면 메인 함수에서 원할 때, 각 서버를 단순히 종료할 수 있으며, 필요에 따라 다시 실행할 수 있습니다, 매우 우아하게 말이죠!

당연히 `Done()` 메서드를 통해 작업이 종료되는 처리만 잘 되어 있다면, `WithTimeout`이나 `WithDeadline`을 통해 타임아웃을 설정할 수도 있습니다.

이런 케이스는 주로 `sql` 패키지나 레디스, `http` 패키지의 요청을 처리하는 등, 외부 IO 작업을 처리할 때 많이 사용됩니다.

### 요청 관점에서의 문맥

컨텍스트가 값을 포함할 수 있고, 값을 탐색하는 방향이 추가의 역순, 즉 스택 형식이기 때문에 해당 요청에 필요한 값을 컨텍스트에 넣고, 하위 작업에 전달할 수 있습니다.

![02](/img/019/02.svg)

`WithValue`를 통해 메인 함수에서 레디스 커넥션 풀과 포스트그레스 커넥션 풀을 컨텍스트에 포함해서 인증 서버에 제공했습니다.

그러면 인증 서버는 서버가 동작하는 동안 각 커넥션 풀에 대해 `key` 외에는 아무 정보도 몰라도 됩니다.

필요에 따라
1. 인증 토큰을 검사할 때, `TokenCheck` 함수에 컨텍스트를 같이 넘겨주면, 해당 함수가 컨텍스트에서 레디스 커넥션 풀을 `Value()` 메서드를 통해 가져와서 사용할 수 있습니다.
2. 특정 유저의 정보를 조회하고 싶다면, `GetUserInfo` 함수에 컨텍스트를 같이 넘겨주면, 해당 함수가 컨텍스트에서 포스트그레스 커넥션 풀을 `Value()` 메서드를 통해 가져와서 사용할 수 있습니다.

이런식으로 작성하면, 하나의 컨텍스트에서 싱글톤 인스턴스와 의존성을 관리할 수 있습니다.

이 구조를 적극 활용하면, 객체만을 위한 패키지와 행위만을 위한 패키지를 분리할 수 있습니다.

### 객체 관점에서의 문맥

컨텍스트를 활용하면 효과적으로 특정 객체에 대한 생명 주기를 관리할 수 있습니다. 보통 다른 객체 지향 언어들의 경우에는 소멸자(destructor)를 통해 객체가 소멸할 때, 필요한 작업을 처리합니다.

하지만 고의 경우엔 소멸자가 없기도 하고, `runtime.SetFinalizer`를 사용하기에는 GC 타이밍에 동작하는 특성 때문에, 타이밍 예측이 어렵고 GC에 영향을 준다는 단점이 있습니다.

![03](/img/019/03.svg)

위 UML에서 사용자가 서버에 요청을 하면 사용자 요청에 대한 컨텍스트가 생성됩니다. 그리고 이 컨텍스트는 요청이 수행되는 동안 유지됩니다. 요청이 완료되면 컨텍스트가 자동으로 취소 되게 `defer`를 통해 처리될 것입니다. 

여튼, 사용자의 요청을 받아줄 요청 객체와 응답을 담아줄 응답 객체를 각각 `sync.Pool`로 만든 풀에서 가져와서 사용합니다. 그리고 요청이 완료되면 다시 풀에 반환합니다. 컨텍스트가 없었다면, 적절한 위치에서 손으로 풀에 반환하거나 `runtime.SetFinalizer`를 통해 GC에 반환을 맡겨야 했을 것입니다.

그러면 `sync.Pool`을 확장하여 `context.AfterFunc`를 활용해, 작업이 종료되면 자동으로 풀에 반환하는 패키지를 작성해 보겠습니다.

```go
package pool

import (
	"context"
	"sync"
)

type Pool[T any] struct {
	inner sync.Pool
}

func New[T any]() *Pool[T] {
	return &Pool[T]{
		inner: sync.Pool{
			New: func() interface{} {
				return new(T)
			},
		},
	}
}

func (p *Pool[T]) Get(ctx context.Context) *T {
	v := p.inner.Get().(*T)
	context.AfterFunc(ctx, func() {
		p.inner.Put(v)
	})
	return v
}
```

위 `pool` 패키지는 `Get` 메서드를 호출할 때 받은 컨텍스트를 기반으로 `AfterFunc`을 통해 컨텍스트가 취소되면 자동으로 풀에 반환하도록 작성되어 있습니다. 이를 통해 풀에 반환하는 작업을 자동화할 수 있습니다.

여기서 작성한 것처럼 단순 풀링만이 아니라, 어떤 객체가 가지는 수명을 특정 컨텍스트에 포함시킴으로 해당 객체에 대한 관리를 더욱 편리하게 할 수 있습니다.

### 예외 관점에서의 문맥

고에서 일반적으로 에러가 발생하면 상향식으로 전파됩니다. 그래서 일반적으로는 에러가 발생한 지점에서부터 에러를 처리하는 상단까지의 경로 밖에서는 에러가 발생한 것이나 정보를 파악할 수 없습니다. 하지만 `context.WithCancelCause`와 `context.Cause`를 사용하면 에러를 처리하는 곳에서부터 하향식으로 에러를 전파할 수 있습니다.

![04](/img/019/04.svg)

위 UML은 메인 함수에서 `context.WithCancelCause`를 통해 루트 컨텍스트를 생성하고, 그 컨텍스트들을 `JobA`, `JobB`에게 전달합니다. 그리고 두 작업은 각각의 하위에 `~1`과 `~2`라는 이름의 작업을 다시 병렬적으로 실행시킨 그림입니다.

작업을 수행하던 중, `JobA1`이 모종의 이유로 에러가 발생했습니다. 발생된 에러는 상향식으로 `JobA`를 거쳐, 메인 함수에 도달하여 `cancel(err)` 함수를 호출하여 컨텍스트를 취소합니다. 

그럼 해당 컨텍스트에 에러가 등록되어 상향식으로 에러가 전파된 경로 외에 존재하는 `JobA2`, `JobB`, `JobB1`, `JobB2`가 `Done()`을 받은 후, `context.Cause`를 통해 에러를 확인할 수 있습니다.

이렇게 에러를 전파하게 되면, 병렬적으로 수행되던 작업이 어떤 이유로 인해 중단되었는지를 파악하여 디버깅을 더욱 효율적으로 할 수 있습니다.
