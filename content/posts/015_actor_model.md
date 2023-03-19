---
title: "고루틴과 채널을 활용한 유사 액터 모델"
date: 2023-03-19T18:28:34+09:00
tags: ["go", "concurrency", "goroutine", "channel", "select"]
draft: false
---

## 액터 모델?

액터 모델은 동시성 문제를 해결하기 위해 등장한 개념입니다. 각 액터는 독립된 스레드에서 실행되며, 메시지를 통해 상호작용합니다. 액터 모델은 다음과 같은 특징을 가집니다.

1. 액터는 메모리를 공유하지 않습니다.
2. 액터는 고유의 상태를 가질 수 있습니다.
3. 액터 간의 통신은 메시지를 통해 이루어집니다.
4. 액터 간의 통신은 비동기적입니다.
5. 액터는 해당 메시지에 대응하는 동작을 수행합니다.

### CSP와 너무 잘 맞지 않아?

고 언어는 기반 패러다임에 CSP가 있는 만큼, 고루틴과 채널이라는 강력한 도구가 있습니다. 이를 이용해 타 언어에 비해 손 쉽게 액터 모델을 구현할 수 있습니다. 액터는 고루틴으로 띄우고, 메시지는 채널로 주고 받습니다. 그러면 자연스럽게 액터 간의 통신은 비동기적으로 동작합니다. 해당 메시지에 대해 라우팅이 필요한 경우에도, 여러 채널을 이용하여 `select` 문법을 통해 처리할 수 있습니다.

## 간단한 동시성 처리 가능한 맵

간단하게 동시성을 지원하는 맵을 가지는 액터를 만들어 보겠습니다.

간단히 정리하면 다음 특징이 있습니다.

1. `Set`, `Delete`, `Get` 메서드를 통해 맵에 접근합니다.
2. 하나의 액터는 고루틴 하나로 이루어집니다.
3. 하나의 고루틴 내에 `map[string]string` 타입의 상태를 가집니다.
4. 사용이 끝난 후에는 `Stop` 메서드를 통해 액터를 종료 해야합니다.
5. 컨텍스트(`context`)를 통해 상위 컨텍스트의 영향을 받을 수 있습니다.

### tuple

맵의 `Get` 메서드는 값을 반환해야하는데, 값 반환을 위해 채널을 사용해야합니다. 이를 위해 `Tuple` 구조체를 만들어 처리하겠습니다.

```go
package tuple

type Tuple[K, V any] struct {
    Key K
    Value V
}
```

### actor

그리고 `cmap` 패키지를 만들어 아래 내용을 담습니다.

```go
package cmap

import "context"

type Map struct {
	ctx      context.Context
	cancel   context.CancelFunc
	setCh    chan string
	deleteCh chan string
	getChCh  chan tuple.Tuple[string, chan string]
	
    m        map[string]string
}

func NewMap(ctx context.Context, queueSize int) *Map {
	ctx, cancel := context.WithCancel(ctx)
	deleteCh := make(chan string, queueSize)
	getCh := make(chan tuple.Tuple[string, chan string], queueSize)
	setCh := make(chan string, tuple.Tuple[string, string], queueSize)
    m := make(map[string]string)

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case value := <-setCh:
                m[value.Key] = value.Value
			case value := <-deleteCh:
                delete(m, value)
			case value := <-getCh:
                value.Value <- m[value.Key]
			}
		}
	}()
	return &Map{
		ctx:      ctx,
		cancel:   cancel,
		getCh:    getCh,
		setCh:    setCh,
		deleteCh: deleteCh,
	}
}

func (m *Map) Set(value string) {
	m.setCh <- value
}

func (m *Map) Delete(value string) {
	m.deleteCh <- value
}

func (m *Map) Get(value tuple.Tuple[string, chan string]) {
	m.getCh <- value
}

func (m *Map) Stop() {
	m.cancel()
}
```

간단하게 `Set`, `Delete`, `Get` 메서드를 만들어 놓았습니다.  
`Get` 메서드는 `Tuple`을 받아 `Key`를 통해 맵에서 값을 가져와 `Value`에 채널로 값을 보내주는 역할을 합니다.  
`Set` 메서드는 `Tuple`을 받아 `Key`를 통해 맵에 값을 저장하는 역할을 합니다.  
`Delete` 메서드는 `Key`를 받아 맵에서 값을 삭제하는 역할을 합니다.  
`Stop` 메서드는 `context`를 취소하여 고루틴을 종료시킵니다.

### actor system

생성자를 통해 `ctx context.Context`를 받습니다.  
이를 통해 상위 컨텍스트에서 `cancel`을 호출하면, 액터의 컨텍스트에서 `ctx.Done()`이 호출되어 고루틴이 종료됩니다.

이 기능이 필요한 이유는 액터가 속한 액터 시스템이 액터를 컨트롤 할 수 있게 하기 위함입니다.  
액터 시스템은 액터를 생성하고 관리하는 곳입니다.  
액터 시스템의 특징으론 자신이 만든 액터의 전체 수명이 자신의 수명 범위에 포함되어야 합니다.  
그렇기에 액터 시스템의 컨텍스트를 공유함으로 하위 액터의 수명을 일괄적으로 관리할 수 있습니다.

마찬가지로 특정 액터가 하위 액터를 생성하는 경우에도 동일한 수명 한계를 가질 수 있게 도와줍니다.

## 마지막으로

간단한 `yaml` 파일로 액터 패키지를 만들 수 있는 `actor` 패키지를 만들어 보았습니다.

제 [깃헙 레포지토리](github.com/snowmerak/gotor)에 업로드 해 놓았으니, 관심 있으시다면 `readme.md` 한번 읽어주시면 감사하겠습니다.
