---
title: "Context 패키지 (기초)"
date: 2023-05-26T14:14:06+09:00
tags: ["go", "context"]
draft: false
---

## 패키지 구성

> Package context defines the Context type, which carries deadlines, cancellation signals, and other request-scoped values across API boundaries and between processes.

컨텍스트 패키지는 `Context` 타입을 구현하고 있는 패키지입니다. 이 컨텍스트 타입은 인터페이스로 실제로는 하부에 크게 5가지 타입의 컨텍스트 구현체가 존재합니다.

## 컨텍스트 종류

1. 아무 상태도 가지지 않은, `backgroundCtx`와 `todoCtx`
2. 취소 시그널을 보내거나 무시할 수 있는, `cancelCtx`와 `withoutCancelCtx`
3. 특정 시간만 동작하거나 특정 시각까지만 동작하는, `timerCtx`
4. 키와 값을 저장하는, `valueCtx`
5. 사후 처리를 담당하는, `afterFuncCtx`

### backgroud, todo

아마 세상에서 가장 많이 쓰이는 컨텍스트입니다.

```go
import "context"

func main() {
    ctx := context.Background()
}
```

> It is typically used by the main function, initialization, and tests, and as the top-level Context for incoming requests.

`background` 컨텍스트에 대해서 패키지 주석으로 위와 같이 작성되어 있습니다.  
즉, `main` 함수나 초기화, 테스트 등에서 사용되며, 들어오는 요청에 대한 최상위 컨텍스트로 사용됩니다.  
원래 의도대로 라면 어떤 컨텍스트가 필요한 요청(예를 들면, DB 쿼리 등)에 `background` 컨텍스트를 사용하면 안됩니다.

> Code should use context.TODO when it's unclear which Context to use or it is not yet available (because the surrounding function has not yet been extended to accept a Context parameter).

그리고 `todo` 컨텍스트에 대해서는 위의 주석이 작성되어 있습니다.  
즉, 어떤 컨텍스트를 사용해야 할지 모르거나, 아직 상위 컨텍스트를 사용할 수 없는 경우에 사용하라고 되어 있습니다.  
그래서 위의 백그라운드 컨텍스트를 사용하면 안되는 예에 쓸 수 있는 적합한 컨텍스트입니다.  
물론 어디까지나 컨텍스트를 어디서 가져오기 어려운 경우에서만 사용해야 합니다.

그러면 `main` 엔트리 포인트에서는 `Background()`로 컨텍스트 하나를 생성 하겠습니다.

```go
package main

import "context"

func main() {
    ctx := context.Background()
}
```

### cancel

`cancel` 컨텍스트는 취소 시그널을 보내어, 자기자신을 포함한 하위 컨텍스트의 작업을 중단 시킬 수 있습니다.

해당 컨텍스트는 `WithCancel` 함수(`func WithCancel(parent Context) (ctx Context, cancel CancelFunc)`)와 `WithCancelCause` 함수(`func WithCancelCause(parent Context) (ctx Context, cancel CancelCauseFunc)`) 통해 생성할 수 있습니다.

```go
package main

import (
    "context"
    "errors"
    "sync"
)

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    ctx, cancelCause := context.WithCancelCause(ctx)

    wg := new(sync.WaitGroup)
    wg.Add(2)
    go func() {
        defer wg.Done()
        done := ctx.Done()
        <-done
        println("context canceled")
    }()
    go func() {
        defer wg.Done()
        done := ctx.Done()
        <-done
        println(context.Cause(ctx))
    }()

    cancelCause(errors.New("context canceled")) // 아래 고루틴만 취소합니다.
    cancel() // 두 고루틴 모두 취소합니다.
    wg.Wait()
}
```

위의 예제는 `context`를 생성하고, `context`가 취소되면 `context canceled`를 출력하는 예제입니다.

`cancel` 함수로 `ctx`가 취소되면, `ctx`를 포함한 모든 하위 컨텍스트의 `Done()` 메서드로 생성된 채널에 `struct{}` 타입의 값을 보냅니다. 그리고 해당 채널에서 값을 받으면, 컨텍스트가 취소 되었다고 판단하여 작업을 중단하게 됩니다.

`cancelCause` 함수로 `ctx`가 취소되면, `cancel` 때와 동일한 동작을 보여줍니다. 한가지 다른 점은 `context.Cause` 함수로 취소된 이유를 알 수 있다는 점입니다. 이 구조는 에러를 전파하는 과정에 매우 중요한 역할을 합니다.

많은 프로그래밍 언어는 에러가 기본적으로 상향식(bottom-up) 방식으로 전파됩니다. 그렇기에 문제가 발생해도 서로다른 스코프에 있거나, 수평적인 위치에 있는 다른 코드에서는 어떤 에러가 발생했는지 알 수 없습니다.

하지만 `WithCancelCause`로 생성된 `cancelCtx`의 경우엔 에러가 하향식(top-down) 방식으로 전파됩니다. 에러는 하위 영역에서 발생하고, 그로 인해 상위 영역의 작업이 중지됩니다. 그리고 상위 영역에서 해당 에러를 이유로 컨텍스트를 취소 하게 되면, 모든 하위 영역에서 어떤 에러로 작업이 중지 되었는지 알 수 있게 됩니다.

훌륭하게 해당 작업 영역 전체에 걸쳐 에러를 전파할 수 있는 것입니다!

### withoutCancel

`cancelCtx` 형태는 상위 영역에서의 작업이 취소되면, 이후에 작업을 계속 수행할 필요 없는 하위 영역에서의 작업들이 일괄적으로 종료되어 하드웨어 자원을 절약할 수 있습니다.

하지만 상위 영역의 작업이 취소되어도, 하위 영역에서 무조건 작업을 완료해야 하는 경우가 존재합니다.  
그 경우에는 `Done()` 메서드를 호출하지 않고 채널에서 값을 안 받아와도 됩니다. 하지만 하위 영역에 상위 영역의 컨텍스트를 상속 받으면서, 취소 시그널은 무시해야 하는 경우엔 문제가 될 수 있습니다.

그럴 때 사용할 수 있는 컨텍스트가 `withoutCancel` 컨텍스트입니다.  
해당 컨텍스트는 `WithoutCancel` 함수(`func WithoutCancel(parent Context) Context`)로 생성할 수 있습니다.

```go
package main

import (
    "context"
    "time"
)

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    ctx = context.WithoutCancel(ctx)

    go func() {
        <-ctx.Done()
        println("context canceled")
    }()

    cancel()
    time.Sleep(1 * time.Second)
}
```

위 예제는 `context`를 생성하고, `context`가 취소되면 `context canceled`를 출력하는 예제입니다. 하지만 `context`가 취소되어도 `context canceled`를 출력하지 않습니다. `WithoutCancel` 함수로 생성된 `ctx`는 `Done()` 메서드를 호출해도 `nil` 채널을 받아와서 `cancel` 함수가 호출되어도 영향을 받지 않습니다.

이 상태로 `ctx`를 상속 받은 하위 영역에서 작업을 수행하면, 기존 상위 컨텍스트가 취소되어도 하위 영역의 작업은 별도의 작업으로 분리되어 계속 수행됩니다.

### withDeadline, withTimeout

`timerCtx`는 다음 4가지 함수로 생성할 수 있습니다.

1. `WithDeadlineCause(parent Context, d time.Time, cause error) (Context, CancelFunc)`  
   1. `WithDeadlineCause` 함수가 이 중 가장 베이스가 되는 함수입니다.  
   2. 입력받은 컨텍스트를 상속받아서, `d` 시각이 되면 `ctx`를 입력받은 이유(`cause`)로 취소하는 `timerCtx`를 생성합니다.  
   3. `context.Cause`를 통해 해당 이유를 조회할 수 있습니다.
2. `WithDeadline(parent Context, d time.Time) (Context, CancelFunc)`
   1. `WithDeadline` 함수는 위 `WithDeadlineCause` 함수를 호출하고, `cause`를 `nil`로 전달하는 함수입니다.  
   2. 그래서 `context.Cause`로 취소 사유를 조회할 수 없습니다.
3. `WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc)`
   1. `WithTimeout`은 `WithDeadline` 함수를 내부적으로 호출합니다.
   2. `d`의 값으로 현재 시각(`time.Now()`)에 `timeout` 값을 더한 시각을 전달합니다.
4. `WithTimeoutCause(parent Context, timeout time.Duration, cause error) (Context, CancelFunc)`
   1. `WithTimeoutCause` 함수는 `WithTimeout` 함수처럼 시각을 계산해서 `WithDeadlineCause`의 `d` 매개변수로 넘겨주고, `cause`를 그대로 넘겨줍니다.

이러한 `timerCtx`들은 특정 시점까지, 혹은 특정 시간 동안 작업을 수행해야하고 그 외에는 장애일 때 사용하게 됩니다.

### withValue

`valueCtx`는 `WithValue` 함수(`func WithValue(parent Context, key, val interface{}) Context`)로 생성할 수 있습니다.  
그리고 저장된 값은 `context.Value` 함수(`func Value(key interface{}) interface{}`)로 조회할 수 있습니다.

이 컨텍스트는 다음과같이 정의되어 있습니다.

```go
type valueCtx struct {
	Context
	key, val any
}
```

대충 눈치채셨겠지만, `valueCtx` 하나 당 하나의 key-value 값을 가질 수 있습니다.  
여러 값을 추가할 때, `WithValue`를 여러번 중첩해서 호출하여 `valueCtx`를 스택처럼 쌓아서 추가하게 됩니다.

```go
package main

import (
    "context"
    "fmt"
)

type Key1 string
type Key2 string
type Key3 string

func main() {
    ctx := context.Background()
    ctx = context.WithValue(ctx, Key1("key1"), "value1")
    ctx = context.WithValue(ctx, Key2("key2"), "value2")
    ctx = context.WithValue(ctx, Key3("key3"), "value3")

    fmt.Println(ctx.Value(Key1("key1")))
    fmt.Println(ctx.Value(Key2("key2")))
    fmt.Println(ctx.Value(Key3("key3")))
}
```

위 예제는 `context`에 `key1`, `key2`, `key3`를 각각 `value1`, `value2`, `value3`로 저장하고, 조회하는 예제입니다.  
최종적으로 `ctx` 값은 `background` -> `valueCtx` -> `valueCtx` -> `valueCtx` 순으로 스택처럼 쌓이게 됩니다.  
그리고 `ctx.Value` 함수는 마지막 `valueCtx`부터 역순으로 `key`를 조회하면서 값을 찾습니다.

찾는 과정에서 `ctx.Value` 함수는 `key`의 값이 일치하는지 확인합니다.  
하지만 고는 엄격한 강타입 언어이자, 정적타입 언어이기에 단순 비교(`==`)에 있어, 값 뿐만 아니라 타입까지 일치해야 합니다.  
위 예시를 이렇게 수정해도 동일하게 동작합니다.

```go
package main

import (
    "fmt"
    "context"
)

type Key1 string
type Key2 string
type Key3 string

func main() {
    ctx := context.Background()
    ctx = context.WithValue(ctx, Key1("key"), "value1")
    ctx = context.WithValue(ctx, Key2("key"), "value2")
    ctx = context.WithValue(ctx, Key3("key"), "value3")

    fmt.Println(ctx.Value(Key1("key")))
    fmt.Println(ctx.Value(Key2("key")))
    fmt.Println(ctx.Value(Key3("key")))
}
```

그래서 컨텍스트에 값을 저장할 때는, 서로 다른 타입을 명시적으로 만들어 주는 것을 권장합니다.  
또한 연어처럼 거슬러 올라가서 일일이 대조하는 방식이기 때문에, `valueCtx`를 쌓을 때 여유를 두는 것이 좋습니다.

### afterFunc

`afterFuncCtx`는 `func AfterFunc(ctx Context, f func()) (stop func() bool)` 함수로 생성할 수 있습니다.  
`AfterFunc` 함수는 `ctx` 컨텍스트가 취소되면 `f` 함수를 호출합니다.  
호출 사유는 `cancelFunc` 호출이나, `deadline` 도달 등이 있습니다.

이러한 이유로 컨텍스트가 중지 되었을 경우 딱 한번 자동으로 실행됩니다.  
물론 명시적으로 `stop` 함수를 호출하여 실행시킬 수 있습니다.

```go
package main

import (
	"context"
	"log"
	"sync"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())

	wg := &sync.WaitGroup{}
	wg.Add(1)
	context.AfterFunc(ctx, func() {
		log.Println("AfterFunc")
		wg.Done()
	})

	log.Println("canceling context")
	cancel()
	log.Println("canceled context")
	wg.Wait()
}
```

위 예제는 `context`가 취소되면 `AfterFunc` 함수를 호출하는 예제입니다.  
`context`가 취소되면 `AfterFunc` 함수가 호출되고, `wg.Done` 함수가 호출되어 `wg.Wait` 함수가 종료됩니다.
