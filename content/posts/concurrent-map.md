---
title: "Golang으로 구현한 concurrent map"
date: 2021-11-23T00:19:12+09:00
tags: ["go", "concurrent", "tree", "map"]
draft: false
---

## 서론

이전에 아는 분께 락프리(lock-free) 맵에 대해 들었습니다. 락(lock)을 쓰지 않고 데이터 레이스를 일으키지 않으면서 동시성을 지원하는 자료 구조라는 말에, 솔직히 말해서 빠져들었습니다. 하지만 락프리를 구현하는 건 저에게 지금은 무리였지만, 그래도 나름 만족할 만한 동시성 맵을 구현했습니다. 지금부터 제가 구현한 맵에 대해 작성해보겠습니다. 

## 뮤텍스(mutex)

고에는 여러가지 동시성 제어 코드가 있습니다. 고에서는 CSP 이론을 적극적으로 받아들인 채널(channel)이 가장 범용적인 코드로 문법 차원에서 지원하고 있습니다. 하지만 채널 자체가 내부적으로 값 복사와 힙 할당, 동시성 제어를 위한 뮤텍스 등으로 성능을 잡아먹는다고 판단한 사람들은 필요한 부분만 잘라서 쓰기 시작했고, 그 중에 가장 빠르게 볼 수 있는 것이 뮤텍스입니다.

```go
import (
	"fmt"
	"sync"
)

func main() {
	a := map[string]int{}
	m := sync.Mutex{}
	wg := sync.WaitGroup{}
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			m.Lock()
			a[fmt.Sprintf("%d", i)] = i
			m.Unlock()
		}(i)
	}
	wg.Wait()
	fmt.Println(a)
}
```

```bash
map[0:0 1:1 10:10 11:11 12:12 13:13 14:14 15:15 16:16 17:17 18:18 19:19 2:2 20:20 21:21 22:22 23:23 24:24 25:25 26:26 27:27 28:28 29:29 3:3 30:30 31:31 32:32 33:33 34:34 35:35 36:36 37:37 38:38 39:39 4:4 40:40 41:41 42:42 43:43 44:44 45:45 46:46 47:47 48:48 49:49 5:5 50:50 51:51 52:52 53:53 54:54 55:55 56:56 57:57 58:58 59:59 6:6 60:60 61:61 62:62 63:63 64:64 65:65 66:66 67:67 68:68 69:69 7:7 70:70 71:71 72:72 73:73 74:74 75:75 76:76 77:77 78:78 79:79 8:8 80:80 81:81 82:82 83:83 84:84 85:85 86:86 87:87 88:88 89:89 9:9 90:90 91:91 92:92 93:93 94:94 95:95 96:96 97:97 98:98 99:99]
```

간단하게 뮤텍스를 사용하여 맵(map) 자료구조를 이용한 코드입니다. 해당 코드는 총 100번 반복하며 100개의 고루틴에서 한번에 `a` 맵에 값을 추가합니다. 출력 결과를 보면 충돌 없이 모두 들어가 있음을 확인할 수 있습니다.  

뮤텍스에는 기본적으로 여러가지 기능들이 포함되어 있습니다. 스레드가 잠겨 있는 지 확인하는 기능, 해당 스레드가 현재 기아 상태인지 확인하는 기능, 현재 활동 중인지 확인하는 기능 등이 존재합니다. 그래서 다양한 상황에 유연하게 대처할 수 있습니다. 하지만 성능을 원하는 사람들에게 이는 과분한 기능이었습니다.

## CAS

```go
import (
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
)

func main() {
	a := map[string]int{}
	l := uint32(0)
	wg := sync.WaitGroup{}
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			for !atomic.CompareAndSwapUint32(&l, 0, 1) {
				runtime.Gosched()
			}
			a[fmt.Sprintf("%d", i)] = i
			atomic.StoreUint32(&l, 0)
		}(i)
	}
	wg.Wait()
	fmt.Println(a)
}
```

```bash
map[0:0 1:1 10:10 11:11 12:12 13:13 14:14 15:15 16:16 17:17 18:18 19:19 2:2 20:20 21:21 22:22 23:23 24:24 25:25 26:26 27:27 28:28 29:29 3:3 30:30 31:31 32:32 33:33 34:34 35:35 36:36 37:37 38:38 39:39 4:4 40:40 41:41 42:42 43:43 44:44 45:45 46:46 47:47 48:48 49:49 5:5 50:50 51:51 52:52 53:53 54:54 55:55 56:56 57:57 58:58 59:59 6:6 60:60 61:61 62:62 63:63 64:64 65:65 66:66 67:67 68:68 69:69 7:7 70:70 71:71 72:72 73:73 74:74 75:75 76:76 77:77 78:78 79:79 8:8 80:80 81:81 82:82 83:83 84:84 85:85 86:86 87:87 88:88 89:89 9:9 90:90 91:91 92:92 93:93 94:94 95:95 96:96 97:97 98:98 99:99]
```

뮤텍스에서 CAS(compare and swap) 코드만 분리해서 동기 처리에 사용한 코드입니다. 위에 적어놓은 뮤텍스의 기능들을 쓰지 않기 때문에 상대적으로 매우 가볍고 빠릅니다. 위 코드 중 특이한 코드는 `runtime.Goshed()`일텐데, 이 코드는 고루틴을 비활성(suspend)하지 않은 상태로 다른 고루틴에게 순서를 양도하는 코드입니다. 스케줄 상 `runtime.Goshed()`가 호출된다 하더라도 순서가 약간 뒤로 밀릴 뿐 `time.Sleep()`처럼 멈추지 않기에 즉시 다시 활동((resume)할 수 있습니다. 그렇기에 이 코드는 끊임없이 CPU 처리를 요구한다는 단점이 있습니다.  

이 부분이 부각될 수 있는 부분이 경쟁과 기아 상태입니다. 매우 많은 요청이 한번에 들어와서 기아 상태에 빠지게 되면 모든 고루틴이 조금이라도 더 빨리 선점하기 위해 끊임없이 CPU를 점유할 것이고 기아 상태를 컨트롤하는 코드가 존재하지 않는 특성 상 어떤 고루틴은 계속 선점하지 못 하고 기아 상태에 빠질 것입니다.

그럼에도 불구하고 저는 기아 상태도 해결하고 CPU 점유 문제도 해결하면서 비교적 빠르게 값을 넣고 뺄 수 있는 구조를 원했습니다. 그 결과로 나타난게 트리 구조를 가지는 해시맵입니다.

## concurrent tree map

```go
import (
	"sync"

	"github.com/mitchellh/hashstructure/v2"
	"github.com/segmentio/fasthash/fnv1"
	"github.com/snowmerak/concurrent/unlock"
)

type Map struct {
	mapNode
}

func NewMap() *Map {
	return &Map{}
}

func (m *Map) Set(k, v interface{}) error {
	hk, err := hashstructure.Hash(k, hashstructure.FormatV2, nil)
	if err != nil {
		return err
	}
	return m.set(hk, v)
}

func (m *Map) Get(k interface{}) (interface{}, bool) {
	hk, err := hashstructure.Hash(k, hashstructure.FormatV2, nil)
	if err != nil {
		return nil, false
	}
	return m.get(hk)
}

func (m *Map) Delete(k interface{}, weight int) bool {
	hk, err := hashstructure.Hash(k, hashstructure.FormatV2, nil)
	if err != nil {
		return false
	}
	return m.delete(hk, weight)
}
```

코드가 길어서 반으로 잘랐습니다. 이 코드는 [제 레포](github.com/snowmerak/concurrent)에 올라가 있으며 `unlock` 패키지는 CAS 코드를 구현한 [레몬민트](github.com/lemon-mint)님의 코드를 부분 포크한 패키지입니다. 편의상 락이라고 부르겠습니다. 일단 그래도 해시를 가지고 있기에 `hashstructure` 패키지를 사용하여 uint64 타입의 초기 해시를 생성하여 키로 사용합니다.

```go
type mapNode struct {
	unlock.TLock
	key      uint64
	value    interface{}
	count    int
	children []mapNode
}

var mapNodePool = sync.Pool{
	New: func() interface{} {
		return make([]mapNode, buf)
	},
}
```

`Map` 구조체가 가지고 있는 `mapNode` 구조체는 CAS를 이용한 락을 구현한 `TLock`, 해시키를 의미하는 `key`, 값을 의미하는 `value`, 수정 카운트를 기록하는 `count`, 자식 노드들의 슬라이스인 `childred`을 가집니다. 그리고 지속적으로 `[]mapNode` 인스턴스가 생성, 소멸을 반복하는데 `sync.Pool`을 사용하여 풀을 운영함으로 지속적인 힙 할당에 의한 성능 저하를 보완하였습니다.

```go
func (n *mapNode) set(k uint64, v interface{}) error {
	n.Lock()
	if n.count == 0 {
		n.key = k
		n.value = v
		n.count++
		n.Unlock()
		return nil
	}
	if n.key == k {
		n.value = v
		n.count++
		n.Unlock()
		return nil
	}
	if n.children == nil {
		n.children = mapNodePool.Get().([]mapNode)
	}
	n.Unlock()
	k = fnv1.HashUint64(k)
	return n.children[k%buf].set(k, v)
}
```

`set` 메서드는 값을 재귀적으로 기록하는 역할을 합니다. 두 가지 경우 중 하나, `count`가 0일 때 아무것도 기록되어 있지 않다는 뜻이니 값을 덧 씌웁니다. 그리고 또 다른 경우인 `key`가 동일할 경우 값은 키를 가지기에 값을 덮어 씌웁니다. 그리고 자식 노드 슬라이스가 소멸되었거나 초기화되지 않았을 경우에 할당합니다.  

마지막으로 락을 해제하고 인덱스 재설정을 위해 키를 다시 해싱하여 자식 노드에 넘겨줍니다.

```go
func (n *mapNode) get(k uint64) (interface{}, bool) {
	n.Lock()
	if n.key == k {
		v := n.value
		n.Unlock()
		return v, true
	}
	if n.children == nil {
		n.Unlock()
		return nil, false
	}
	n.Unlock()
	k = fnv1.HashUint64(k)
	return n.children[k%buf].get(k)
}
```

`get` 메서드는 `set` 메서드의 수정이므로 비교적 쉽습니다. 똑같이 락을 걸고 키가 동일할 경우 값을 반환하고 자식이 없을 경우엔 `nil, false`를 반환합니다.  

마지막으로 `set` 메서드와 동일하게 락을 해제하고 키를 다시 해싱한 후 자식 노드에 보냅니다.

```go
func (n *mapNode) delete(k uint64, weight int) bool {
	n.Lock()
	if n.key == k && n.count <= weight {
		n.count = 0
		n.key = 0
		n.Unlock()
		return true
	} else if n.count > weight {
		n.Unlock()
		return false
	}
	if n.children == nil {
		n.Unlock()
		return false
	}
	n.Unlock()
	k = fnv1.HashUint64(k)
	b := n.children[k%buf].delete(k, weight)
	n.Lock()
	if b {
		e := true
		for i := 0; i < buf; i++ {
			if !n.isEmpty() {
				e = false
				break
			}
		}
		if e {
			mapNodePool.Put(n.children)
			n.children = nil
		}
	}
	n.Unlock()
	return b
}
```

`delete` 메서드는 키가 같은 값을 찾아 초기화하고 돌아옵니다. `get` 메서드와 동일하게 자식이 없으면 `false`를 반환합니다. 그리고 해당 사항이 없으면 키를 다시 해싱하여 자식 노드에 넘깁니다.  

그리고 만약 자식 노드가 삭제에 성공했을 경우, 자식 노드를 모두 순회하여 모두 빈 노드일 경우 풀에 자식 노드 슬라이스를 반환합니다.

## 결론

이론상 CAS만을 통해 락을 지원하고 상수 회수 안에 모든 고루틴은 큰 딜레이 없이 값을 넣고 뺄 수 있습니다. 아직까지 테스트 케이스가 많지 않아서 제대로 돌아간다고 파악되지는 않았지만, 지속적인 추가 삭제에서 `sync.Map`이나 단순히 CAS를 붙인 맵에 비해 괜찮은 성능을 보여줄 것으로 기대하고 있습니다.