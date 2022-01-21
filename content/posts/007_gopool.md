---
title: "고루틴 풀링"
date: 2022-01-21T01:16:36+09:00
tags: ["go", "goroutine", "pool"]
draft: falst
---

이 글은 제 [레포](https://github.com/snowmerak/gopool)를 기반으로 작성되었습니다.

## 왜?

오픈톡방에서 고루틴에 대한 이야기가 나왔었습니다. 고루틴을 안전하게 관리하기 위한 보일러플레이트에 대한 것과 join과 반환값의 처리에 대한 것이었습니다.

그래서 한번 해당 건에 대해 나름의 해답을 라이브러리로 만들어봤습니다.

## gopool

### GoPool

```go
type GoPool struct {
	pool    sync.Pool
	max     int64
	count   int64
	running int64
    sync.Mutex
}
```

고풀 구조체는 고루틴을 풀링할 `sync.Pool`, 그리고 `int64` 타입의 `max`, `count`, `running`을 가집니다.  
`max`는 최대 고루틴 수, `count`는 현재 생성된 고루틴 수, `running`은 현재 실행되고 있는 고루틴 수를 의미합니다.

### parameter

```go
type parameter struct {
	f  func() interface{}
	ch chan<- interface{}
}
```

패러미터 구조체는 빈 인터페이스를 반환하는 함수 하나와 빈 인터페이스를 전달하는 채널 하나를 가집니다. 이 중 함수는 실제로 고루틴 내에서 실행할 함수이며 채널은 반환값을 전달할 것입니다.

### New

```go
func New(max int64) *GoPool {
	gp := &GoPool{}
	gp.pool.New = func() interface{} {
		ch := make(chan parameter, 1)
		atomic.AddInt64(&gp.count, 1)
		go func() {
			defer close(ch)
			param := parameter{}
			defer func() {
				r := recover()
				param.ch <- r
				atomic.AddInt64(&gp.count, -1)
				atomic.AddInt64(&gp.running, -1)
			}()
			for p := range ch {
				param = p
				rs := p.f()
				gp.Lock()
				if gp.count > gp.max {
					gp.Unlock()
					return
				}
				gp.Unlock()
				p.ch <- rs
				close(p.ch)
				gp.pool.Put(ch)
				atomic.AddInt64(&gp.running, -1)
			}
		}()
		return ch
	}
	gp.max = max
	gp.count = 0
	return gp
}
```

`New` 함수로 새로운 gopool 객체를 생성합니다. 최대값은 매개변수로 받고 초기 카운트는 0으로 설정합니다. 그리고 `sync.Pool`에 쓰일 생성자를 설정합니다.

생성자는 필수적으로 `func() interface{}` 시그니처를 만족해야합니다. 생성자에서는 패러미터 객체를 전달하는 채널 하나를 생성하고 현재 고루틴 수를 체크하는 `count` 변수를 1 증가시킵니다.

그리고 고루틴 하나를 실행하여 미리 생성한 채널에서 패러미터를 하나씩 전달 받아 실행합니다. 생성된 고루틴에서는 입력받은 함수를 실행한 후 `count`와 `max`를 비교하여 최대 수를 넘지 않도록 설정합니다.

만약 패닉이 발생했을 경우를 대비하여 `defer`를 이용하여 `recover()`를 실행합니다. 당연히 패닉이 발생할 때는 실행 중이므로 `count`와 `running`, 둘 다 감소합니다. 정상적으로 실행이 완료될 경우 `running`만 감소합니다.

### Go

```go
func (gp *GoPool) Go(f func() interface{}) <-chan interface{} {
	for {
		gp.Lock()
		if gp.running < gp.max {
			gp.Unlock()
			break
		}
		gp.Unlock()
		runtime.Gosched()
	}
	atomic.AddInt64(&gp.running, 1)
	ch := gp.pool.Get().(chan parameter)
	rs := make(chan interface{}, 1)
	ch <- parameter{
		f:  f,
		ch: rs,
	}
	return rs
}
```

`Go` 메서드는 입력 받은 함수를 고루틴 풀의 고루틴에서 실행합니다. `count`가 `max`를 넘을 경우 고루틴이 최대수를 초과하게 되므로 다른 고루틴에게 차례를 넘깁니다. `runtime.Gosched()`는 자신의 차례에 실행하지 않고 다른 고루틴에게 차례를 넘기는 함수입니다. 그리고 `running`을 1 증가시킵니다. 이후엔 일반적인 `sync.Pool` 객체의 흐름입니다. 마지막으로 고루틴에서 반환하는 값을 전달하는 채널을 반환합니다.

### Wait

```go
func (gp *GoPool) Wait() {
	for atomic.LoadInt64(&gp.running) > 0 {
		runtime.Gosched()
	}
}
```

`Wait` 함수는 `running` 변수를 확인하여 모든 고루틴이 멈출 때까지 반복문을 반복합니다. 결과적으로 이 코드는 `GoPool` 객체의 모든 고루틴에 대한 `WaitGroup.Wait` 메서드와 동일한 동작을 보장합니다.

## 끝

```go
package main

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"time"

	"github.com/snowmerak/gopool"
)

func main() {
	logger := log.New(os.Stderr, "gopool: ", log.LstdFlags)
	gp := gopool.New(100)
	s := time.Now()
	for i := 0; i < 1000; i++ {
		gp.Go(func() interface{} {
			time.Sleep(time.Millisecond * 100)
			return nil
		})
	}
	gp.Wait()
	e := time.Now()
	fmt.Println(e.Sub(s))
	fmt.Println(gp.GetCurrnet())

	ret := gp.Go(func() interface{} {
		panic("test error")
	})
	logger.Println(<-ret)

	memstat := new(runtime.MemStats)
	runtime.ReadMemStats(memstat)
	fmt.Println(memstat.Alloc)

	runtime.GC()

	memstat = new(runtime.MemStats)
	runtime.ReadMemStats(memstat)
	fmt.Println(memstat.Alloc)
}
```

시연 코드는 총 100개의 고루틴을 생성할 수 있는 고루틴 풀에 1000개의 100 밀리세컨드 동안 슬립하는 고루틴을 실행한 후, 패닉을 한번 발생시키고 반환값을 확인한 후, `runtime.GC` 함수를 실행하여 힙얼록의 변화를 확인하는 코드입니다.

```bash
1.0202307s
100
gopool: 2022/01/21 02:35:29 test error
595008
370320
```

시간은 적절한 오차가 있을 수 있으나 100 밀리세컨드 1000회를 100회씩 나눠서 실행했으니 기대값인 1초와 같음을 확인할 수 있습니다. 그리고 총 고루틴 수 또한 100개로 설정한 대로 되어 있음을 알 수 있습니다. 마지막으로 패닉의 반환값도 제대로 반환되어 출력되었습니다.

힙얼록의 수치는 총 `595008`에서 `370320`으로 줄어들었습니다. 이 수치 변화가 발생한 이유는 반환값을 반환하기 위해 생성한 채널에 있습니다. 패러미터 객체를 만들 때 반환값을 전달하는 채널을 생성하고 실제로 `nil`일지라도 버퍼를 채웠기 때문에 눈에 보이는 힙얼록이 발생하였습니다. 그럼에도 제때 `close`를 해주었고 따로 참조하고 있는 변수가 없었기에 쓰레기 수집기에 말려들어갔음을 수치로 추측할 수 있습니다.

