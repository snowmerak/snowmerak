---
title: "logstream"
date: 2022-01-06T13:08:40+09:00
tags: ["go", "log"]
draft: true
---

이 글은 [제 로그 라이브러리](https://github.com/snowmerak/logstream)를 작성하며 생각한 것을 작성한 것입니다.

## 개요

`logstream` 라이브러리는 로그를 생성하고 소비하는 패턴을 구현하기 위해 만든 일종의 고 프로그램 전역에서 돌아가는 메시지 큐입니다. 다른 메시지 큐와 마찬가지로 여러 생산자가 토픽에 값을 추가하고 소비자가 토픽에서 값을 꺼내서 사용합니다.

![logstream](/img/006/logstream.png)

생산자(producer)는 코드 상 어디라도 될 수 있으며 스트림을 내포하고 있는 객체는 글로벌큐(global queue)로 전역 객체로 생성될 것입니다. 소비자(customer)는 글로벌큐 내부 스트림을 통해 순차적으로 생산자가 만들어낸 로그를 받아서 소비합니다. 소비는 가급적이면 모든 소비자 중 하나가 한번 소비하면 로그가 사라지는 게 아니라 모든 소비자에게 돌아가는 걸 목표로 합니다.

## 구조

```bash
.
├── LICENSE
├── README.md
├── go.mod
├── go.sum
├── log
│   ├── interface.go
│   ├── logbuffer
│   │   ├── logbuffer.go
│   │   ├── logqueue
│   │   │   ├── pq.go
│   │   │   └── readme.md
│   │   ├── logring
│   │   │   ├── rb.go
│   │   │   └── readme.md
│   │   └── logstream
│   │       ├── globalque
│   │       │   └── globalque.go
│   │       └── logstream.go
│   ├── loglevel
│   │   ├── level.go
│   │   └── readme.md
│   ├── readme.md
│   ├── struct.go
│   └── writable
│       ├── nats
│       │   └── nats.go
│       ├── readme.md
│       ├── stdout
│       │   └── stdout.go
│       └── writable.go
└── test
    └── main.go
```

제 프로젝트 구조는 레이어드 구조를 흉내낸 의식의 흐름 기법으로 되어 있습니다. 상위 디렉토리일수록 더욱 코어에 가깝고 하위 디렉토리일수록 더욱 활용에 가깝습니다.

## log

`log` 패키지에는 로그 구조체를 정의하는 부분과 하위 패키지에서 사용할 인터페이스를 정의한 부분이 있습니다.

### Log

```go
type Log struct {
	Message string
	Level   loglevel.LogLevel
	Time    time.Time
}
```

원래 로그에는 메시지만 존재했습니다. 그러다가 논란의 중심이었던 `log4j`를 참고해서 로그 레벨을 넣게 되었고 언제 생성되었는지 파악하기 위한 `time.Time` 객체도 추가하게 되었습니다. 그리고 다른 로그 라이브러리들을 보던 중 로그에 매개변수를 넣는 것을 보았고 유용한 기능일 수도 있다는 생각에 매개변수를 추가하게 되었습니다. 하지만 이걸 어떠한 생성자 패턴도 없이 작성하는 건 엔드유저에게 가혹한 일이었기에 빌더 패턴도 만들게 되었습니다.

#### LogFactory

```go
type LogFactory struct {
	Time    time.Time
	Message strings.Builder
	Level   loglevel.LogLevel

	hasParam bool
}

func New(level loglevel.LogLevel, message string) *LogFactory
```

로그 팩토리는 생성될 때 로그 레벨과 메시지를 받고 시간을 `New` 호출 시기로 지정합니다.

```go
func (l *LogFactory) AddParamString(key string, value string) *LogFactory

func (l *LogFactory) AddParamInt(key string, value int) *LogFactory

func (l *LogFactory) AddParamUint(key string, value uint) *LogFactory

func (l *LogFactory) AddParamBool(key string, value bool) *LogFactory

func (l *LogFactory) AddParamFloat(key string, value float64) *LogFactory

func (l *LogFactory) AddParamComplex(key string, value complex128) *LogFactory

func (l *LogFactory) End() Log
```

그리고 총 6개의 메서드를 통해 매개변수를 메시지에 추가할 수 있게 하였습니다. 마지막으로 `End()` 메서드를 호출함으로 로그 인스턴스를 생성한 후 스택이 사라지면 소멸합니다. 

## loglevel

로그 레벨 패키지는 로그 디렉토리의 바로 한단계 하위에 존재합니다. 로그 레벨 패키지는 `LogLevel` 타입의 `enum`만을 위한 패키지로 내부에 선언된 코드는 이게 전부입니다.

```go
package loglevel

type LogLevel int8

const (
	All LogLevel = iota
	Debug
	Info
	Warn
	Error
	Fatal
	Off
)

func WrapColor(level LogLevel, message string) string {
	switch level {
	case Debug:
		return "\033[0;36m" + message + "\033[0m"
	case Info:
		return "\033[0;32m" + message + "\033[0m"
	case Warn:
		return "\033[0;33m" + message + "\033[0m"
	case Error:
		return "\033[0;31m" + message + "\033[0m"
	case Fatal:
		return "\033[0;35m" + message + "\033[0m"
	default:
		return "\033[0;37m" + message + "\033[0m"
	}
}

func Available(criterion, loglevel LogLevel) bool {
	return criterion <= loglevel
}
```

다른 프레임워크나 라이브러리와 달리 하나의 enum 타입을 위해 패키지를 분리한 이유는 로그 레벨이 로그에 바로 쓰이기 때문이고 로그 패키지에서 호출하는 것보다 로그 레벨이라는 패키지에서 불러와서 쓰는 게 더 직관적이기 때문이라고 판단했습니다. 실제로 `log.LogLevelDebug`보다 `loglevel.Debug`로 쓰는 게 더 읽기 쉽고 자동 완성도 활용할 수 있을 거라 생각합니다.

추가적으로 `WrapColor` 함수는 각 로그 레벨에 따른 색상을 입히는 함수이고 `Available` 함수는 기준이 되는 로그 레벨에서 입력받은 로그 레벨이 출력 가능한지를 반환합니다. 두 함수 다 각 소비자 구현체에 하드코딩해도 좋지만 일관성을 위해 로그 레벨 패키지에 함수로 선언하고 불러오는 방식을 취했습니다.

## logbuffer

로그 버퍼 패키지에는 하나의 인터페이스만 존재합니다. 

```go
package logbuffer

import "github.com/snowmerak/logstream/log"

type LogBuffer interface {
	Push(log log.Log) error
	Pop() (log.Log, error)
	Size() int
}
```

이 디렉토리부터 하위에 존재하는 패키지는 2가지 종류로 나뉘게 됩니다. 이 인터페이스는 구현한 객체이거나 이 인터페이스를 구현한 객체를 활용하는 패키지입니다. `LogBuffer` 인터페이스가 요구하는 건 로그를 넣는 메서드와 로그를 추출하는 메서드 뿐입니다. `Size()` 메서드의 구현 여부는 중요하지 않습니다.

### logqueue

먼저 `LogBuffer`를 구현한 객체 중 하나인 로그 큐입니다.

```go
package logqueue

import (
	"errors"

	"github.com/Workiva/go-datastructures/queue"
	"github.com/snowmerak/logstream/log"
	"github.com/snowmerak/logstream/log/logbuffer"
)

type LogQueue struct {
	queue *queue.PriorityQueue
}

func New(size int) logbuffer.LogBuffer {
	return &LogQueue{
		queue: queue.NewPriorityQueue(size, false),
	}
}

func (lq *LogQueue) Push(log log.Log) error {
	if lq == nil {
		return errors.New("LogQueue.Push: LogQueue is nil")
	}
	return lq.queue.Put(log)
}

func (lq *LogQueue) Pop() (log.Log, error) {
	if lq == nil {
		return log.Log{}, errors.New("LogQueue.Pop: LogQueue is nil")
	}
	item, err := lq.queue.Get(1)
	if err != nil {
		return log.Log{}, err
	}
	return item[0].(log.Log), nil
}

func (lq *LogQueue) Size() int {
	if lq == nil {
		return 0
	}
	return lq.queue.Len()
}
```

로그 큐 구조체는 `github.com/Workiva/go-datastructures/queue`의 우선순위 큐를 래핑한 구조체입니다. 빈 인터페이스를 처리하게 만들어진 우선순위 큐를 가지고 와서 `LogBuffer` 인터페이스가 충족되도록 로그를 넣고 뺼 수 있는 구조체로 만들었습니다. 

### logring

로그 링 패키지 또한 로그 큐와 마찬가지로 로그를 주고 받게 `github.com/Workiva/go-datastructures/queue`의 링버퍼를 래핑한 것입니다.

```go
package logring

import (
	"fmt"

	"github.com/Workiva/go-datastructures/queue"
	"github.com/snowmerak/logstream/log"
	"github.com/snowmerak/logstream/log/logbuffer"
)

type LogRingBuffer struct {
	ringbuffer *queue.RingBuffer
}

func New(size int) logbuffer.LogBuffer {
	return &LogRingBuffer{
		ringbuffer: queue.NewRingBuffer(uint64(size)),
	}
}

func (lrb *LogRingBuffer) Push(value log.Log) error {
	return lrb.ringbuffer.Put(value)
}

func (lrb *LogRingBuffer) Pop() (log.Log, error) {
	item, err := lrb.ringbuffer.Get()
	if err != nil {
		return log.Log{}, fmt.Errorf("LogRingBuffer.Pop: %w", err)
	}
	return item.(log.Log), nil
}

func (lrb *LogRingBuffer) Size() int {
	return int(lrb.ringbuffer.Len())
}
```

큰 차이는 존재하지 않습니다. 그리고 이건 따로 추상화하거나 정규화하지는 않은 규칙이지만 뒤에 나올 로그 스트림 패키지에서 이 둘을 활용하기 위해 두 구조체의 생성자가 동일한 시그니처(`func(int) logbuffer.LogBuffer`)를 하고 있습니다.

### 왜 두가지 구현체가 필요한지

원래는 링버퍼만 있었습니다. 링버퍼 구현체만 가지고 테스트를 하던 중 당연하지만 무심코 넘긴 부분을 발견했습니다. 당연히 동시적으로 실행하게 만들어져 있기에 뮤텍스 락을 누가 먼저 잡느냐에 따라 짧은 시간에 많은 로그가 들어오게 되면 순서가 엉키게 되는데 이걸 간과하고 있었던 것입니다. 그래서 같은 `github.com/Workiva/go-datastructures`의 큐 패키지에 있는 우선순위 큐를 가지고 와서 우선순위 큐를 기반으로 한 로그 스트림 코어를 만들게 되었습니다.

우선순위 큐로 만든 구현체는 당연하게도 대체로 스테어블하게 로그를 출력했습니다. 그럼에도 입출력 성능 자체는 링버퍼가 우선순위 큐보다 빠르고 순서가 꼬이는 경우가 그렇게 많이 존재하지는 않을 거라 판단해서 링버퍼 구현체도 그대로 유지하고 로그 스트림 백엔드로 둘 다 채용 가능하도록 작성했습니다. 이 부분은 이미 인터페이스로 추상화 시켜놓아서 크게 어렵지는 않았습니다.

## logstream

로그스트림은 `LogBuffer` 인터페이스를 활용하는 패키지입니다. 로그스트림 패키지는 따로 인터페이스를 가지지 않고 단일 구현체만을 가지게 설계 되었으므로 바로 구조체를 정의합니다.

```go
package logstream

import (
	"errors"

	"github.com/Workiva/go-datastructures/trie/ctrie"
	"github.com/snowmerak/logstream/log"
	"github.com/snowmerak/logstream/log/logbuffer"
	"github.com/snowmerak/logstream/log/logbuffer/logqueue"
)

type LogStream struct {
	trie              *ctrie.Ctrie
	bufferSize        int
	signals           map[string]chan struct{}
	bufferConstructor func(int) logbuffer.LogBuffer
}

func New(bufferSize int, bufferConstructor func(int) logbuffer.LogBuffer) *LogStream {
	return &LogStream{
		trie:              ctrie.New(nil),
		bufferSize:        bufferSize,
		signals:           map[string]chan struct{}{},
		bufferConstructor: bufferConstructor,
	}
}
```

로그 스트림 구조체는 `github.com/Workiva/go-datastructures` 라이브러리의 `ctrie`를 트라이 구현체로 사용합니다. 토픽 분류를 하기 위해 락프리에 가까운 트라이가 필요했는데 딱 락프리 트라이가 존재해서 적용했습니다. 버퍼 사이즈는 `LogBuffer` 구현체의 인스턴스를 만들 때 쓰는 크기이고 버퍼 생성자는 먼저 만든 `logqueue`, `logring`의 생성자를 받는 걸 전제로 하고 있습니다.

시그널은 각 토픽 별로 버퍼에 값이 들어왔음을 알리기 위한 채널을 저장합니다. `struct{}`를 주고 받음으로 메모리 사용을 최대한 줄여보려 했습니다.

### topic

```go
func (e *LogStream) AddTopic(topic string, signal chan struct{}) {
	key := []byte(topic)
	if _, ok := e.trie.Lookup(key); !ok {
		e.trie.Insert(key, e.bufferConstructor(e.bufferSize))
	}
	if _, ok := e.signals[topic]; !ok {
		e.signals[topic] = signal
	}
}

func (e *LogStream) RemoveTopic(topic string) {
	key := []byte(topic)
	if _, ok := e.trie.Lookup(key); ok {
		e.trie.Remove(key)
	}
	delete(e.signals, topic)
}
```

`AddTopic`으로 토픽을 추가하게 되면 각 토픽에 해당하는 트라이에 `LogBuffer` 인터페이스 구현체가 생성되고 시그널에는 매개변수로 입력받은 채널이 추가됩니다. `RemoveTopic`으로 토픽을 제거하면 이 과정을 반대로 수행합니다.

이 구조를 가지게 된 이유는 `LogStream` 객체가 그 자체로 토픽에 따라 로그를 넣고 빼는 일종의 pub/sub MQ 역할에 충실하게 만들기 위함입니다.

### enqueue, dequeue

```go
func (e *LogStream) EnQueue(topic string, value log.Log) {
	key := []byte(topic)
	if _, ok := e.trie.Lookup(key); !ok {
		e.trie.Insert(key, logqueue.New(e.bufferSize))
	}
	p, _ := e.trie.Lookup(key)
	ringBuffer := p.(logbuffer.LogBuffer)
	ringBuffer.Push(value)
	if e.signals[topic] != nil {
		e.signals[topic] <- struct{}{}
	}
}

func (e *LogStream) DeQueue(topic string) (log.Log, error) {
	key := []byte(topic)
	if _, ok := e.trie.Lookup(key); !ok {
		return log.Log{}, errors.New("LogBuffer.DeQueue: topic not found")
	}
	p, _ := e.trie.Lookup(key)
	ringBuffer := p.(logbuffer.LogBuffer)
	return ringBuffer.Pop()
}
```

두 메서드 다 토픽과 로그, 혹은 토픽을 받고 결과를 돌려줍니다. `Enqueue`는 특이하게 시그널에서 토픽에 해당하는 채널을 찾아 값이 들어옴을 알려줍니다. 그러면 사용자는 `AddTopic`을 했을 때 넘겨준 채널을 감시하여 로그 스트림의 각 버퍼에 값이 들어옴을 확인하고 추출할 수 있습니다. 로그 스트림으로 전체 구조 중 MQ 부분에 해당하는 코드를 만들었습니다.

## writable

로그 패키지의 바로 아래에 있는 소비자 부분을 담당해줄 `writable` 인터페이스를 선언한 패키지입니다.

```go
package writable

import "github.com/snowmerak/logstream/log"

type Writable interface {
	Write(log log.Log) error
	Close() error
}
```

### stdout

`Writable` 인터페이스를 구현한 `Stdout` 구조체가 선언된 패키지입니다.

```go
package stdout

import (
	"bufio"
	"context"
	"os"
	"sync"
	"time"

	"github.com/snowmerak/logstream/log"
	"github.com/snowmerak/logstream/log/loglevel"
	"github.com/snowmerak/logstream/log/writable"
)

type Stdout struct {
	sync.Mutex
	level     loglevel.LogLevel
	writer    *bufio.Writer
	converter func(log.Log) string
	ctx       context.Context
}

func New(ctx context.Context, level loglevel.LogLevel, converter func(log.Log) string) writable.Writable {
	s := &Stdout{
		writer:    bufio.NewWriter(os.Stdout),
		level:     level,
		converter: converter,
		ctx:       ctx,
	}
	return s
}

func (s *Stdout) Write(value log.Log) error {
	s.Lock()
	defer s.Unlock()
	if loglevel.Available(s.level, value.Level) {
		if s.converter == nil {
			s.writer.Write([]byte(value.Time.Format(time.RFC3339Nano)))
			s.writer.Write([]byte(" "))
			s.writer.Write([]byte(value.Message))
		} else {
			s.writer.Write([]byte(s.converter(value)))
		}
		s.writer.WriteByte('\n')
		s.writer.Flush()
	}
	return nil
}

func (s *Stdout) Close() error {
	return nil
}
```

특이한 건 없습니다. `bufio.NewWriter`로 buffered write를 표준 출력에 하는 객체를 저장하고 출력할 기준 로그 레벨, 이 로그 레벨을 기준으로 `loglevel.Available` 함수가 허용하는 로그만이 출력됩니다. 그리고 `converter`라는 함수를 받습니다. 컨버터는 로그를 받아서 문자열로 만드는 함수로 사용자가 자신에게 편한 방식으로 로그를 가공하여 출력할 수 있게 해줍니다.

`Write` 메서드에서는 컨버터가 `nil`인지 아닌지에 따라 결과가 달라집니다. `nil`이면 제가 기본으로 설정한 시간과 메시지를 출력하게 되고, 그렇지 않으면 컨버터의 실행결과가 출력됩니다. 이 코드가 가장 간단한 표준 출력 소비자를 담당하게 됩니다.

## globalque

마지막으로 스트림과 소비자를 이어줄 글로벌 큐 패키지입니다.

```go
package globalque

import (
	"context"
	"errors"
	"sync"

	"github.com/snowmerak/logstream/log"
	"github.com/snowmerak/logstream/log/logbuffer"
	"github.com/snowmerak/logstream/log/logbuffer/logstream"
	"github.com/snowmerak/logstream/log/loglevel"
	"github.com/snowmerak/logstream/log/writable"
)

type GlobalQueue struct {
	ctx     context.Context
	buf     *logstream.LogStream
	writers map[string]writer
	lock    *sync.Mutex
	bufSize int
}

func New(ctx context.Context, bufConstructor func(int) logbuffer.LogBuffer, bufSize int) *GlobalQueue {
	return &GlobalQueue{
		ctx:     ctx,
		buf:     logstream.New(bufSize, bufConstructor),
		writers: map[string]writer{},
		lock:    &sync.Mutex{},
		bufSize: bufSize,
	}
}
```

글로벌 큐는 컨텍스트와 스트림 백엔드로 쓰일 로그 버퍼의 생성자, 버퍼의 크기를 받습니다. 이 중 뒤의 두가지는 바로 스트림을 생성하는데 쓰입니다.

```go
type writer struct {
	list   []writable.Writable
	signal chan struct{}
}

func (ls *GlobalQueue) ObserveTopic(topic string, writers ...writable.Writable) error {
	ls.lock.Lock()
	defer ls.lock.Unlock()
	if _, ok := ls.writers[topic]; ok {
		return errors.New("LogStream.AddTopic: topic already exists")
	}
	ls.writers[topic] = writer{
		list:   writers,
		signal: make(chan struct{}, ls.bufSize),
	}
	ls.buf.AddTopic(topic, ls.writers[topic].signal)
	go func() {
		for {
			select {
			case <-ls.ctx.Done():
				ls.lock.Lock()
				for _, w := range ls.writers[topic].list {
					w.Close()
				}
				ls.buf.RemoveTopic(topic)
				close(ls.writers[topic].signal)
				delete(ls.writers, topic)
				ls.lock.Unlock()
				return
			case <-ls.writers[topic].signal:
				l, err := ls.buf.DeQueue(topic)
				if err != nil {
					l = log.New(loglevel.Fatal, err.Error()).End()
				}
				for _, w := range ls.writers[topic].list {
					w.Write(l)
				}
			}
		}
	}()
	return nil
}
```

글로벌 큐의 `ObserveTopic` 메서드로 각 토픽에 대해 소비자(`writable.Writable`)을 연결할 수 있습니다. `writer` 구조체는 이때 넘겨 받은 라이터블 리스트와 시그널 채널을 저장하는 역할을 합니다. 미리 로그 스트림에 만들어놓은 `AddTopic` 메서드를 호출하여 토픽과 채널을 등록하고 고루틴 하나를 만들어 감시합니다.

고루틴 내부는 무한반복하면서 두가지 경우 중 하나를 실행하게 되는데, 하나는 `writer` 구조체의 시그널 채널에서 값을 받을 때 로그 스트림에서 토픽에 해당하는 값을 추출하여 각 소비자의 `Write` 메서드를 통해 로그를 소비시킵니다. 또 다른 경우는 초기에 입력받은 `context.Context`의 `Cancel`이 실행되었을 때로 연결된 모든 `writable.Writable`을 닫고 토픽을 지우고 채널을 닫은 후 고루틴을 종료합니다.

### 생산자

```go
func (ls *GlobalQueue) Write(topic string, l log.Log) {
	ls.buf.EnQueue(topic, l)
}
```

생산자 포지션은 로그를 전송하기만 하면 되기에 간단하게 글로벌 큐에 `Write` 메서드를 만들어서 사용도록 두었습니다. 미리 로그 스트림에 정의해놓은 대로 토픽에 해당하는 로그 버퍼에 값이 추가되고 시그널 채널을 통해 값이 들어옴을 확인한 고루틴이 값을 소비하도록 할 것입니다.

## 후회

좀 더 패키지 구성을 잘 설계했으면 더 직관적으로 쉬운 구성과 코드를 만들 수 있을 거란 아쉬움이 많이 남습니다. 역할 배분도 로그 스트림에서 시그널 채널 부분을 사실 글로벌 큐에서 관리했어야 하는 게 아닌가 하는 부분도 아쉽습니다.  
마지막으로 문서를 만들면서 작성한게 아니라 일단 코드를 짜고 그 뒤 리팩토링을 하고 작성하다보니 헷갈리는 부분이 생기는 것입니다. godoc이라도 제대로 작성해놔야 덜 고생하겠다 싶었습니다.