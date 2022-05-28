---
title: "고랭과 아레나"
date: 2022-05-19T18:25:26+09:00
tags: ["go", "arena", "mimalloc", "tcmalloc", "heap alloc"]
draft: false
---

## Arena?

고랭은 가비지 컬렉터를 쓰는 언어이고, 덕분에 사용자는 메모리를 관리하는 데에 크게 신경을 쓸 필요가 없습니다. 하지만 프로젝트 크기가 커지고, 사용해야할 힙 메모리가 커질수록 더욱 빈번하게, 그리고 한번에 많은 양의 메모리를 수집하여 처리하게 됩니다. 하나의 기능을 수행하고 난 후에는 물론이고, 수행하는 도중에도 GC가 동작하여 응답이 늦어지는 상황이 생겨날 확률이 늘어납니다.

그런 상황에서 유용하게 쓸 수 있는 아레나(`arena`)라는 개념이 등장했습니다. 아레나는 미리 사용할 힙 메모리를 할당 받아서 사용합니다. 이 때 할당받는 큰 힙 메모리 덩어리 하나를 페이지라고 합니다. 일반적인 경우는 IO 버퍼 사이즈로, 4096(4K) 혹은 8192(8K) byte입니다. 이 페이지들이 이중 연결리스트 형태로 이어지고, 필요한 메모리를 기존 페이지에서 충당할 수 없을 때마다 새로운 페이지를 추가합니다. 그리고 아레나를 활용한 모든 작업이 끝나면 마지막에 최종적으로 아레나 전체를 반환합니다.

아레나를 고랭에 구현하기 위해, 먼저 GC에 영향을 받지 않는 동적 할당을 할 수 있을 필요가 있습니다. 이 부분에 대해 [lemon-mint](https://github.com/lemon-mint)님은 [umem](https://github.com/unsafe-risk/umem)이란 레포에서 `runtime` 패키지의 `sysAlloc`과 `sysFree`를 링크하여 사용하는 것으로 아레나를 구현했고, 저는 마이크로소프트가 만든 [`mimalloc`](https://github.com/microsoft/mimalloc)을 `cgo`로 고랭에 붙여서 동적할당을 구현하였습니다. 해당 구현체는 [mi](https://github.com/unsafe-risk/mi) 레포에 아레나와 함께 작성되어 있습니다. 

어느 쪽이든 아레나를 사용하게 되면 필요에 따라 힙에 데이터를 할당할 수 있고, 이 힙 메모리는 GC에 영향을 받지 않기 때문에 GC 부담을 줄일 수 있습니다. 또한 한번에 힙 메모리를 할당 받아 사용하기에 일종의 메모리 풀 역할 또한 수행할 수 있습니다. 단점은 어느 쪽이든 고랭에서 정상적으로 지원하는 방법이 아니기에, 불안함이 존재할 수밖에 없다는 것과 페이지 내에 충분한 양의 메모리가 존재하지 않을 경우 새로운 페이지를 할당 받게 되는데, 이 때 메모리 파편화가 발생하여 메모리를 낭비할 수 있습니다.

## 테스트 코드

테스트를 위해 한가지 코드를 작성하였습니다. `mi_arena`는 `mi` 패키지의 아레나를, `um_arena`는 `umem` 패키지의 아레나를 가져옵니다. 그리고 테스트할 구조체로 `Person` 구조체를 만들었습니다. 총 64비트 아키텍처에서 24 + 8 + 24 + 8 = 64 바이트의 크기를 차지합니다. 그리고 아레나와 비교하기 위해 `go:noinline` 지시자를 적용하여 `Person`을 의도적으로 힙에 할당하여 20000000개의 `Person`을 각 방식대로, 20번 반복 할당과 해제를 해보았습니다.

```go
package main

import (
	"fmt"
	"runtime"
	"time"

	mi_arena "github.com/unsafe-risk/mi/arena"
	um_arena "github.com/unsafe-risk/umem/arena"
)

type Person struct {
	Name string
	Age  int
	Addr string
	Zip  int
}

//go:noinline
func NewPerson() *Person {
	return new(Person)
}

func main() {
	const MAX = 20000000

	for n := 0; n < 20; n++ {
		fmt.Println("run", n)

		s := time.Now()
		a1 := mi_arena.New()
		for i := 0; i < MAX; i++ {
			p := mi_arena.NewOf[Person](a1)
			p.Name = "name"
			p.Age = i
			p.Addr = "addr"
			p.Zip = i
		}
		a1.Free()
		e := time.Now()
		fmt.Println("mi_arena.NewOf[Person]", e.Sub(s))

		s = time.Now()
		a2 := um_arena.New()
		for i := 0; i < MAX; i++ {
			p := um_arena.NewOf[Person](a2)
			p.Name = "name"
			p.Age = i
			p.Addr = "addr"
			p.Zip = i
		}
		a2.Free()
		e = time.Now()

		fmt.Println("um_arena.NewOf[Person]", e.Sub(s))

		s = time.Now()
		for i := 0; i < MAX; i++ {
			p := NewPerson()
			p.Name = "name"
			p.Age = i
			p.Addr = "addr"
			p.Zip = i
		}
		runtime.GC()
		e = time.Now()

		fmt.Println("new(Person)", e.Sub(s))

		fmt.Println("----------")
	}
}
```

## 인텔 i9-9980H 2.3GHz + 16GB DDR4 2400MHz + macOS BigSur

```bash
run 0
mi_arena.NewOf[Person] 659.255787ms
um_arena.NewOf[Person] 1.21731888s
new(Person) 712.108632ms
----------
run 1
mi_arena.NewOf[Person] 448.509698ms
um_arena.NewOf[Person] 1.088909006s
new(Person) 678.810648ms
----------
run 2
mi_arena.NewOf[Person] 423.16818ms
um_arena.NewOf[Person] 1.029993031s
new(Person) 654.001768ms
----------
run 3
mi_arena.NewOf[Person] 394.738617ms
um_arena.NewOf[Person] 993.820519ms
new(Person) 655.2234ms
----------
run 4
mi_arena.NewOf[Person] 414.755613ms
um_arena.NewOf[Person] 1.071207551s
new(Person) 649.460368ms
----------
run 5
mi_arena.NewOf[Person] 372.203537ms
um_arena.NewOf[Person] 1.02093218s
new(Person) 642.210045ms
----------
run 6
mi_arena.NewOf[Person] 437.812332ms
um_arena.NewOf[Person] 969.906196ms
new(Person) 669.860604ms
----------
run 7
mi_arena.NewOf[Person] 414.864831ms
um_arena.NewOf[Person] 1.036287315s
new(Person) 653.905186ms
----------
run 8
mi_arena.NewOf[Person] 395.464146ms
um_arena.NewOf[Person] 1.070897709s
new(Person) 657.461694ms
----------
run 9
mi_arena.NewOf[Person] 394.594126ms
um_arena.NewOf[Person] 1.053012742s
new(Person) 667.139945ms
----------
run 10
mi_arena.NewOf[Person] 355.382596ms
um_arena.NewOf[Person] 1.0134867s
new(Person) 674.637156ms
----------
run 11
mi_arena.NewOf[Person] 369.826531ms
um_arena.NewOf[Person] 1.085812064s
new(Person) 655.93504ms
----------
run 12
mi_arena.NewOf[Person] 419.360267ms
um_arena.NewOf[Person] 1.096227161s
new(Person) 693.90571ms
----------
run 13
mi_arena.NewOf[Person] 395.489365ms
um_arena.NewOf[Person] 1.051677299s
new(Person) 657.919031ms
----------
run 14
mi_arena.NewOf[Person] 385.44913ms
um_arena.NewOf[Person] 1.089778489s
new(Person) 685.85118ms
----------
run 15
mi_arena.NewOf[Person] 442.502459ms
um_arena.NewOf[Person] 1.06281998s
new(Person) 681.524087ms
----------
run 16
mi_arena.NewOf[Person] 362.964553ms
um_arena.NewOf[Person] 1.028840643s
new(Person) 675.452201ms
----------
run 17
mi_arena.NewOf[Person] 385.1104ms
um_arena.NewOf[Person] 1.107781299s
new(Person) 706.541074ms
----------
run 18
mi_arena.NewOf[Person] 762.131867ms
um_arena.NewOf[Person] 1.077516082s
new(Person) 647.707399ms
----------
run 19
mi_arena.NewOf[Person] 393.620217ms
um_arena.NewOf[Person] 997.934415ms
new(Person) 647.659917ms
----------
```

환경은 2019 맥북프로 15.6인치 CTO 버전입니다. 맥OS는 빅서이고 해당 환경에서는 `mi`의 아레나가 가장 좋은 성능을 보였습니다. 이는 `mi`의 바탕이 되는 `mimalloc`이 그 자체적으로도 메모리 풀을 가지고 있어서 처음 할당받은 메모리를 꾸준히 반복하다가 한번씩 해제되고 재할당 받아 사용하는 것으로 보입니다. `umem`의 아레나는 지속적으로 안좋은 성능을 보였는데, 이는 아마 맥OS에서 고랭의 메모리 관리 방식이 바로 할당 받고 바로 해제 하는 방식이라 그런 것으로 보입니다. 그래서 사실 `cgo`의 오버헤드를 고려하지 않는 다면, 이 환경에서는 고랭의 힙 메모리 관리가 가장 빠른 성능을 보여주었습니다.

## AMD Ryzen 7 4800H 2.9GHz + DDR4 16GB PC4-25600 + Endeavour OS (linux kernel 5.17.9-arch1-1)

```bash
```