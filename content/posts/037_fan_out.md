---
title: "빠르게 메시지를 전파하고 싶어"
date: 2024-09-27T23:20:37+09:00
tags: ["golang", "go", "channel", "fan-out", "concurrency"]
draft: false
---

## 배경

### NATS는 정말 아름다워

NATS는 Go 언어로 작성된 메시지큐입니다. 그리고 제가 개인적으로 좋아하는 오픈소스 프로젝트이기도 합니다. 한때 NATS에서 서브스크립션이 메시지를 받는 방식이 단순 채널이 아닌 독특한 자료구조가 따로 있는 걸 봤었던 적이 있습니다. 이 자료구조는 연결리스트를 통해 특정 서브스크립션에 전달될 메시지를 저장합니다. 그리고 `sync.Cond`를 이용하여 별도의 대기 중인 서브스크립션을 위한 고루틴에게 알려줍니다.

1. 서브스크립션은 생성될 때, 별도 고루틴에서 `sync.Cond`의 `Wait()` 메서드를 통해 메시지가 추가되길 대기합니다.
2. 커넥션은 외부 연결을 통해 서브스크립션에 대한 메시지를 받아옵니다.
3. 커넥션은 해당 서브스크립션의 연결리스트에 메시지를 추가하고, `sync.Cond`의 `Signal()` 메서드로 해당 고루틴을 깨웁니다.
4. 서브스크립션은 연결리스트를 순회해서 메시지를 읽어 처리합니다.

### 쓰는 사람 따로, 읽는 사람 따로

이 구조는 쓰는 주체가 가지는 상태와 읽는 주체가 가지는 상태가 별도로 존재한다는 것에 의의를 느꼈습니다. 물론 `channel`도 버퍼를 주게 되면 상태를 따로 가질 수 있습니다만, 기본적으로 내부에서 락을 가지는 구조이며 반쯤 동기식으로 동작하도록 코드가 작성됩니다. 그리고 무엇보다 채널은 팬아웃(fan out)에 적합한 구조가 아닙니다.

이는 Go의 채널이 CSP를 따르기 때문에 발생한 어쩔 수 없는 구조라고도 생각합니다. 그래서 팬아웃을 빠르게 할 수 있는 패키지를 만들어 보고 싶었습니다. 물론 이 이유 뿐만 아니라, NATS가 가지는 어떠한 동작 때문에 비효율적일 수 있는 동작을 해소하기 위해 팬아웃을 지원하는 패키지가 필요합니다. 

## 구현

### 아이디어

그래서 제가 고안한 방법은 다음과 같았습니다.

1. 버퍼는 연결리스트로 구성하고, 데이터가 추가될 때마다 꼬리에 추가하고, `sync.Cond`의 `Broadcast()` 메서드를 실행하여 대기 중인 구독자들을 깨웁니다.
2. 깨어난 구독자 고루틴들은 연결리스트에서 데이터를 읽어서 함수를 실행합니다.
3. 만약 실행할 때, 최대 원소 수를 넘으면 최대 원소 수에 도달할 때까지 앞 부분부터 삭제합니다.

### 구현

```go
type FakeLock struct{}

func (fl FakeLock) Lock() {}

func (fl FakeLock) Unlock() {}
```

코드는 완성된 걸 베이스로 작성하겠습니다. 먼저 이 코드에선 `FakeLock`이라는 실제로는 크리티컬 섹션을 관리하지 않는 가짜 라커를 사용합니다. 이 구조를 통해 `sync.Cond`의 `Wait()`을 호출할 때, 거의 즉시 호출하는 효과를 가져올 것입니다.

```go
type Node[T any] struct {
	Value  T
	Next   *Node[T]
	Closed bool
}

type AsyncLinkedList[T any] struct {
	head               atomic.Pointer[Node[T]]
	tail               atomic.Pointer[Node[T]]
	bufferLength       atomic.Int64
	maxBuf             int64
	lock               sync.Locker
	cond               *sync.Cond
	wheel              *timingwheel.TimingWheel
	latestNotification time.Time
}
```

그리고 `Node[T]`와 `AsyncLinkedList[T]`를 선언합니다.

1. 노드의 `Next` 필드는 `atomic.Pointer`로 둘 수 있으나, 일반적으로 CPU가 연산하는 데에 있어, 포인터 하나 크기만큼은 atomic에 가깝게 비교할 거라는 고려가 있었습니다.
2. 연결리스트의 `head`와 `tail`은 그럼에도 `atomic.Pointer`로 처리했습니다. 이는 추후 CAS를 통해 추가 삭제를 관리하기 위함입니다.

```go
func (all *AsyncLinkedList[T]) getNode() *Node[T] {
	return new(Node[T])
}

func (all *AsyncLinkedList[T]) putNode(_ *Node[T]) {
}
```

이는 중요한 코드는 아니나, 갑자기 등장하는 걸로 보일 수 있어 작성합니다.

1. `getNode`는 새로운 노드를 만드는 메서드입니다.
2. `putNode`는 노드를 반환하는 메서드입니다.

이 두 메서드는 `sync.Pool`같은 오브젝트 풀을 사용할 수 있는 아이디어가 생기면, 적용하기 위해 작성해놓았습니다.

```go
func New[T any](maxBufferSize int64) *AsyncLinkedList[T] {
	l := FakeLock{}
	tw := timingwheel.NewTimingWheel(50*time.Millisecond, 60)
	all := &AsyncLinkedList[T]{
		maxBuf: maxBufferSize,
		lock:   l,
		cond:   sync.NewCond(l),
		wheel:  tw,
	}
	tw.ScheduleFunc(all, func() {
		if all.latestNotification.Add(10 * time.Millisecond).Before(time.Now()) {
			all.latestNotification = time.Now()
			all.cond.Broadcast()
		}
	})
	tw.Start()
	return all
}
```

새로운 연결리스트를 생성하는 `New` 함수는 한가지 특이점이 있습니다. `timingwheel` 패키지를 사용하여, 10ms마다 구독자 고루틴들을 일괄적으로 깨우고 있는 것입니다. 이에 대해선 설명에 필요한 더 많은 코드가 나왔을 때, 후술하도록 하겠습니다.

```go
func (all *AsyncLinkedList[T]) Push(value T) {
	all.push(value, false)
}

func (all *AsyncLinkedList[T]) Close() {
	all.push(*new(T), true)
}

func (all *AsyncLinkedList[T]) push(value T, closed bool) {
	node := all.getNode()
	node.Value = value
	node.Closed = closed

outer:
	for {
		tail := all.tail.Load()
		if all.tail.CompareAndSwap(tail, node) {
			switch tail {
			case nil:
				all.head.Store(node)
			default:
				tail.Next = node
			}
			all.latestNotification = time.Now()
			all.cond.Broadcast()
			if all.bufferLength.Add(1) > all.maxBuf {
				all.bufferLength.Add(-1)
			inner:
				for {
					head := all.head.Load()
					if all.head.CompareAndSwap(head, head.Next) {
						all.putNode(head)
						break inner
					}
					fmt.Println("failed to swap head")
				}
			}
			break outer
		}
	}
}
```

`push` 메서드는 `Push`와 `Close` 메서드로 확장됩니다. 이 중 베이스가 되는 `push`는 단순한 형태의 CAS 기반의 연결리스트로 구현됩니다. 한가지 특이한 것은 수가 넘어가서 `head`를 제거하는 코드가 `push`에서 syncronize하게 수행되는 점입니다. 매우 많은 입력이 동시에 일어나면 부하가 될 가능성이 있어 보이지만, 실제 유스케이스에서는 그렇게 동작될 가능성은 낮아보입니다.

```go
func (all *AsyncLinkedList[T]) Subscribe(callback func(value T, closed bool)) <-chan struct{} {
	cursor := all.head.Load()
	last := (*Node[T])(nil)
	closed := make(chan struct{}, 1)

	go func() {
		for {
			all.lock.Lock()
			all.cond.Wait()
			all.lock.Unlock()

			switch last {
			case nil:
				cursor = all.head.Load()
			default:
				cursor = last.Next
			}

			for cursor != nil {
				last = cursor
				callback(cursor.Value, cursor.Closed)
				switch cursor.Closed {
				case true:
					close(closed)
					return
				}
				cursor = cursor.Next
			}
		}
	}()

	return closed
}
```

마지막으로 `Subscribe` 메서드입니다. 해당 메서드는 콜백 함수를 받아서, 연결리스트가 갱신될 때마다 실행합니다.

1. `cursor`는 한 사이클에서 임시로 쓰이는 임시 변수입니다. 가장 마지막으로 읽었던 노드의 다음 노드, 만약 처음 읽는다면 `head` 노드부터 읽기 시작합니다.
2. 순회를 하다가 `cursor`가 `nil`을 맞이하기 전 가장 마지막으로 실행된 노드를 `last`에 저장합니다.
3. 마지막으로 사이클을 시작하기 전, `sync.Cond`를 통해 연결리스트에 노드가 추가되는 것을 대기합니다.

이 메서드 흐름에는 한가지 공백이 존재합니다. 연결리스트에 데이터가 추가될 때, 만약 구독자 고루틴은 사이클을 실행하고 있다면 상황은 확률적으로 변합니다.

1. for loop를 돌고 있다면, 높은 확률로 새로 추가된 노드도 읽어서 수행할 것입니다. 낮은 확률로 아래 케이스와 합쳐집니다.
2. for loop을 돌고 `sync.Cond`가 `Wait()` 메서드를 호출하기 전의 짧은 구간이라면, 새로 추가된 노드를 인지하지 못합니다.

이 가능성에 의해 저는 앞서 `timingwheel`을 통해 10ms마다 구독자 고루틴을 깨워서 새로운 노드의 추가 여부를 인지시킵니다.  
이 부분은 분명한 알고리즘 상 헛점이고 하드웨어 리소스를 낭비하는 요소가 됩니다. 차후, 분명히 인지시킬 수 있는 방법을 고안하여 적용해야할 것입니다.

### 벤치마크

이 패키지는 여러 채널을 이용하여 팬아웃하는 구조에 대응하여 만들어졌습니다. 그에 따라 벤치마크를 위한 `_test` 패키지를 이렇게 구성했습니다.

```go
package all_test

import (
	"sync"
	"testing"

	"github.com/snowmerak/all"
)

const (
	Subscribers = 1000
	Messages    = 10000
	Buffer      = 100
)

func BenchmarkAllLinkedList(b *testing.B) {
	ll := all.New[[]byte](Buffer)

	wg := sync.WaitGroup{}
	for i := 0; i < Subscribers; i++ {
		wg.Add(1)
		ll.Subscribe(func(value []byte, closed bool) {
			if closed {
				wg.Done()
			}

			mesg := value
			_ = mesg
		})
	}

	for i := 0; i < Messages; i++ {
		ll.Push([]byte("hello"))
	}
	ll.Close()

	wg.Wait()
}

func BenchmarkChannel(b *testing.B) {
	chList := make([]chan []byte, Subscribers)

	wg := sync.WaitGroup{}
	for i := 0; i < Subscribers; i++ {
		wg.Add(1)
		chList[i] = make(chan []byte, Buffer)
		go func(ch chan []byte) {
			defer wg.Done()
			for mesg := range ch {
				_ = mesg
			}
		}(chList[i])
	}

	for i := 0; i < Messages; i++ {
		for j := 0; j < Subscribers; j++ {
			chList[j] <- []byte("hello")
		}
	}
	for i := 0; i < Subscribers; i++ {
		close(chList[i])
	}

	wg.Wait()
}
```

간단하게 1000개의 구독자에게 10000개의 데이터를 전송하는 코드입니다. 각 버퍼(연결리스트 최대 길이, 각 구독자의 채널 버퍼 크기)는 100입니다.

1. `BenchmarkAllLinkedList`는 제가 기 작성한 `AsyncLinkedList`로 전파하는 벤치마크 코드입니다.
2. `BenchmarkChannel`은 각 구독자마다 생성된 채널을 통해 데이터를 전파하는 벤치마크 코드입니다.

이 코드는 제가 가진 기기 중 라데온과 M1 맥에서 실행했습니다.

```sh
goos: darwin
goarch: arm64
pkg: github.com/snowmerak/all
cpu: Apple M1
BenchmarkAllLinkedList-8   	1000000000	         0.04875 ns/op	       0 B/op	       0 allocs/op
BenchmarkChannel-8         	       1	2700985250 ns/op	56393016 B/op	10007084 allocs/op
PASS
ok  	github.com/snowmerak/all	3.843s
```

```sh
goos: windows
goarch: amd64
pkg: github.com/snowmerak/all
cpu: AMD Ryzen 7 8845HS w/ Radeon 780M Graphics
BenchmarkAllLinkedList-16       1000000000            0.05583 ns/op          0 B/op          0 allocs/op
BenchmarkChannel-16                    1   1288117300 ns/op   56304016 B/op   10005694 allocs/op
PASS
ok     github.com/snowmerak/all   1.913s
```

물론 구독자 수와 메시지 수가 늘어나면 연결리스트 방식도 비효율적인 벤치마크 결과가 나오게 됩니다. 앞으로 더 효율적으로 데이터 추가를 인지시키는 방식이나, 메모리 재활용 방법을 연구해야겠습니다.

## 외부 링크

- [snowmerak/all](https://github.com/snowmerak/all)
- [nats-io/nats-server](https://github.com/nats-io/nats-server)
