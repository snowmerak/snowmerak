---
title: "고랭과 아레나"
date: 2022-05-19T18:25:26+09:00
tags: ["go", "arena", "mimalloc", "tcmalloc", "heap alloc"]
draft: false
---

## Arena?

고랭은 가비지 컬렉터를 쓰는 언어이고, 덕분에 사용자는 메모리를 관리하는 데에 크게 신경을 쓸 필요가 없습니다. 하지만 프로젝트 크기가 커지고, 사용해야할 힙 메모리가 커질수록 더욱 빈번하게, 그리고 한번에 많은 양의 메모리를 수집하여 처리하게 됩니다. 하나의 기능을 수행하고 난 후에는 물론이고, 수행하는 도중에도 GC가 동작하여 응답이 늦어지는 상황이 생겨날 확률이 늘어납니다.

그런 상황에서 유용하게 쓸 수 있는 아레나(`arena`)라는 개념이 등장했습니다. 아레나는 미리 사용할 힙 메모리를 할당 받아서 사용합니다. 이 때 할당받는 큰 힙 메모리 덩어리 하나를 페이지라고 합니다. 일반적인 경우는 IO 버퍼 사이즈로, 4096(4K) 혹은 8192(8K), 16384(16K) byte 중 하나입니다. 이 페이지들이 이중 연결리스트 형태로 이어지고, 필요한 메모리를 기존 페이지에서 충당할 수 없을 때마다 새로운 페이지를 추가합니다. 그리고 아레나를 활용한 모든 작업이 끝나면 마지막에 최종적으로 아레나 전체를 반환합니다.

아레나를 고랭에 구현하기 위해, 먼저 GC에 영향을 받지 않는 동적 할당을 할 수 있을 필요가 있습니다. 이 부분에 대해 [lemon-mint](https://github.com/lemon-mint)님은 [umem](https://github.com/unsafe-risk/umem)이란 레포에서 `runtime` 패키지의 `sysAlloc`과 `sysFree`를 링크하여 사용하는 것으로 아레나를 구현했고, 저는 마이크로소프트가 만든 [`mimalloc`](https://github.com/microsoft/mimalloc)을 `cgo`로 고랭에 붙여서 동적할당을 구현하였습니다. 해당 구현체는 [mi](https://github.com/unsafe-risk/mi) 레포에 아레나와 함께 작성되어 있습니다. 

어느 쪽이든 아레나를 사용하게 되면 필요에 따라 힙에 데이터를 할당할 수 있고, 이 힙 메모리는 GC에 영향을 받지 않기 때문에 GC 부담을 줄일 수 있습니다. 또한 한번에 힙 메모리를 할당 받아 사용하기에 일종의 메모리 풀 역할 또한 수행할 수 있습니다. 단점은 어느 쪽이든 고랭에서 정상적으로 지원하는 방법이 아니기에, 불안함이 존재할 수밖에 없다는 것과 페이지 내에 충분한 양의 메모리가 존재하지 않을 경우 새로운 페이지를 할당 받게 되는데, 이 때 메모리 파편화가 발생하여 메모리를 낭비할 수 있습니다.

## mi 아레나 코드

> `현재는 이 코드로 되어 있지 않습니다` from 2022 06 11

아레나 코드는 제가 `umem`에서 가져와서 수정한 `mi`의 아레나 코드를 보여드리겠습니다. 당연하게도 99% lemon-mint님 코드이고 `mimalloc`을 사용하게 바꾼 부분만 제가 작성하였습니다. 

```go
package arena

import (
	"reflect"
	"runtime"
	"syscall"
	"unsafe"

	"github.com/unsafe-risk/mi/mimalloc"
)

// This code is implemented by lemon-mint.
// I brought the code from unsafe-risk/umem.

// This Implementation is based on the proposal in the following url: https://github.com/golang/go/issues/51317

// Thread-unsafe Allocation Arena.
type Arena struct {
	// The start address of the region.
	head uintptr
	// Tail of the region.
	tail uintptr
}

func NewFinalizer() *Arena {
	a := &Arena{}
	runtime.SetFinalizer(a, arenaFinalizer)
	return a
}

func New() *Arena {
	a := &Arena{}
	return a
}

func arenaFinalizer(a *Arena) {
	a.Free()
}

// Page Structure
/*
	|  0  |  1  |  2  |  3  |  4  |  5  |  6  |  7  |
	|-----|-----|-----|-----|-----|-----|-----|-----|
	|  page size            |  page head            |
	|-----|-----|-----|-----|-----|-----|-----|-----|
	|  Next Page Ptr                                |
	|-----|-----|-----|-----|-----|-----|-----|-----|
	|                                               |
	|                                               |
	|                                               |
	|                      Data                     |
	|                                               |
	|                                               |
	|                                               |
	|-----|-----|-----|-----|-----|-----|-----|-----|
*/
```

아레나는 연결리스트로 다음 노드의 포인터를 가지고 있습니다. 이 모양은 lemon-mint님이 그리신 `page structure`에 잘 표현되어 있습니다. 그리고 아레나를 참조하고 있는 변수가 드랍될 때 자동으로 해제 되게끔 파이널라이저가 설정되어 있습니다. 

```go
func (r *Arena) newPage(size int) {
	// println("Allocating new page", size)
	sptr := mimalloc.Malloc(size + 16)
	pagesize := (*uint32)(unsafe.Pointer(sptr))
	pagehead := (*uint32)(unsafe.Pointer(uintptr(sptr) + 4))
	nextpage := (*uint64)(unsafe.Pointer(uintptr(sptr) + 8))

	*pagesize = uint32(size)
	*pagehead = 0
	*nextpage = 0

	if r.tail != 0 {
		// Add to the tail of the region.
		tailNextPage := (*uint64)(unsafe.Pointer(r.tail + 8))
		if *tailNextPage != 0 {
			*nextpage = *tailNextPage
		}
		*tailNextPage = uint64(uintptr(sptr))
	}
	r.tail = uintptr(sptr)
	if r.head == 0 {
		r.head = uintptr(sptr)
	}
	// println("New page allocated", size, sptr)
}

var defaultPageSize = syscall.Getpagesize()*4 - 16

func (r *Arena) allocate(size int) uintptr {
retry:
	if r.tail == 0 {
		// println("tail is 0, allocating new page")
		if size > defaultPageSize {
			r.newPage(size)
		} else {
			r.newPage(defaultPageSize)
		}
	}

	pagesize := (*uint32)(unsafe.Pointer(r.tail))
	pagehead := (*uint32)(unsafe.Pointer(r.tail + 4))
	nextpage := (*uint64)(unsafe.Pointer(r.tail + 8))
	if *pagesize-*pagehead < uint32(size) {
		if *nextpage != 0 {
			r.tail = uintptr(*nextpage)
			goto retry
		}
		if size > defaultPageSize {
			r.newPage(size)
		} else {
			r.newPage(defaultPageSize)
		}
		pagesize = (*uint32)(unsafe.Pointer(r.tail))
		pagehead = (*uint32)(unsafe.Pointer(r.tail + 4))
		nextpage = (*uint64)(unsafe.Pointer(r.tail + 8))
	}

	data := r.tail + 16 + uintptr(*pagehead)
	*pagehead += uint32(size)
	return data
}
```

`newPage` 함수는 입력받은 크기로 새로운 페이지를 만듭니다. 여기에 입력받는 크기는 상황에 따라 변하게 되는 데 이 부분은 `allocate` 함수의 실행 과정에 따릅니다. 일반적으로는 `defaultPageSize` 변수의 값을 사용하여 하드웨어 페이지 사이즈에 따라 자동으로 지정됩니다. `mi`의 아레나는 하드웨어에서 지원하는 페이지의 4배 크기를 사용합니다. 이는 `umem`도 비슷합니다. 만약 만들어야 할 페이지의 크기가 `defaultPageSize` 보다 클 경우, 해당 사이즈를 그대로 가져가서 페이지를 만듭니다. 

```go
func (r *Arena) Free() {
	for r.head != 0 {
		_ = (*uint32)(unsafe.Pointer(r.head))
		nextpage := (*uint64)(unsafe.Pointer(r.head + 8))
		nexthead := uintptr(*nextpage)
		mimalloc.Free(unsafe.Pointer(r.head))
		r.head = nexthead
	}
	r.tail = 0
}
```

마지막으로 `Free` 함수는 모든 아레나를 돌면서 할당된 페이지를 반환합니다. 이 함수가 호출되면 해당 아레나에서 할당받은 모든 포인터는 접근 불가가 됩니다. 하지만 `mimalloc`을 기반으로 하고 있는 `mi`는 메모리를 풀에 캐싱하기 때문에, 접근 에러를 바로 띄우지는 않습니다.

## umem 아레나 벤치마크

`umem` 패키지의 아레나의 벤치마크 코드는 [lemon-mint](https://github.com/lemon-mint)님이 작성하였습니다. 벤치마크 분야는 총 3가지로, 아레나를 통해서 타입 없이 메모리 크기만 받고 동적할당 받을 때, 타입을 가지고 동적할당 받을 때, 그리고 고랭에서 `new`로 동적할당 받을 때로 구성되어 있습니다. 

```go
package arena

import (
	"testing"
)

type Person struct {
	Name    string
	Age     int
	Address string
	number  int
	uuid    string
}

const nAlloc = 1000000

func BenchmarkAllocateUmemUninitializedPerson(b *testing.B) {
	r := New()
	for i := 0; i < b.N; i++ {
		for j := 0; j < nAlloc; j++ {
			p := NewOfUninitialized[Person](r)
			p.Name = "John"
			p.Age = 42
			p.Address = "London"
			p.number = i
			p.uuid = "12345"
		}
	}
	r.Free()
}

func BenchmarkAllocateUmemPerson(b *testing.B) {
	r := New()
	for i := 0; i < b.N; i++ {
		for j := 0; j < nAlloc; j++ {
			p := NewOf[Person](r)
			p.Name = "John"
			p.Age = 42
			p.Address = "London"
			p.number = i
			p.uuid = "12345"
		}
	}
	r.Free()
}

//go:noinline
func StdNewPerson() *Person {
	p := new(Person)
	return p
}

func BenchmarkAllocateStdNew(b *testing.B) {
	for i := 0; i < b.N; i++ {
		for j := 0; j < nAlloc; j++ {
			p := StdNewPerson()
			p.Name = "John"
			p.Age = 42
			p.Address = "London"
			p.number = i
			p.uuid = "12345"
		}
	}
}
```

### 맥

```bash
goos: darwin
goarch: amd64
pkg: github.com/unsafe-risk/umem/arena
cpu: Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz
BenchmarkAllocateUmemUninitializedPerson-16    	      27	  47605454 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateUmemPerson-16                 	      28	  42615860 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateStdNew-16                     	      33	  35083543 ns/op	64000142 B/op	 1000001 allocs/op
```

맥의 경우 어느쪽이든 아레나가 `new` 힙 얼록보다 느립니다.

### 리눅스

```bash
goos: linux
goarch: amd64
pkg: github.com/unsafe-risk/umem/arena
cpu: Intel(R) Core(TM) i5-7200U CPU @ 2.50GHz
BenchmarkAllocateUmemUninitializedPerson-4   	      26	  42833816 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateUmemPerson-4                	      24	  45659802 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateStdNew-4                    	      25	  48400510 ns/op	64000235 B/op	 1000001 allocs/op
```

```bash
goos: linux
goarch: amd64
pkg: github.com/unsafe-risk/umem/arena
cpu: AMD Ryzen 7 4800H with Radeon Graphics         
BenchmarkAllocateUmemUninitializedPerson-16    	      45	  24664832 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateUmemPerson-16                 	      43	  26992343 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateStdNew-16                     	       9	 118905567 ns/op	64000272 B/op	 1000001 allocs/op
```

```bash
goos: linux
goarch: arm64
pkg: github.com/unsafe-risk/umem/arena
BenchmarkAllocateUmemUninitializedPerson-4   	      22	  51751258 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateUmemPerson-4                	      21	  52538087 ns/op	       0 B/op	       0 allocs/op
BenchmarkAllocateStdNew-4                    	      20	  57569415 ns/op	64000338 B/op	 1000002 allocs/op
```

리눅스에서는 상황이 조금 달랐습니다. 인텔 x64와 arm64에서는 큰 차이를 보이지 않은 상태에서 아레나가 조금 앞섰지만, AMD 위에서는 아레나가 압도적으로 빨랐습니다. 아직까진 이 부분에 대해서 지식이 부족하여 설명할 수는 없지만, 리눅스 환경에서는 충분히 경쟁력 있다고 보입니다.

## mi 아레나 벤치마크

`mi` 패키지의 벤치마크는 `umem` 패키지의 벤치마크에서 패러렐 부분을 추가했습니다. 그래서 한번에 여러개의 벤치마크가 동시에 수행하게 됩니다. 이는 `mimalloc`에게 불리한 부분입니다. 여러번의 테스트로 `mimalloc`은 할당 해제를 하더라도, C 메모리 영역에서 할당받은 메모리를 가지고 있다가 재활용을 하게 되는데, 이 벤치마크 코드에서는 아쉽게도 이 부분을 적극적으로 활용할 수는 없을 것같습니다.

```go
package arena_test

import (
	"runtime"
	"testing"

	"github.com/unsafe-risk/mi/arena"
)

type Person struct {
	Name string
	Age  int
	Addr string
	Zip  int
}

const MAX = 2000000

func BenchmarkMiArenaPerson(b *testing.B) {
	b.RunParallel(func(p *testing.PB) {
		for p.Next() {
			a := arena.New()
			for i := 0; i < MAX; i++ {
				p := arena.NewOf[Person](a)
				p.Name = "John"
				p.Age = 32
				p.Addr = "Istanbul"
				p.Zip = 397
			}
			a.Free()
		}
	})
}

//go:noinline
func StdNewPerson() *Person {
	p := new(Person)
	return p
}

func BenchmarkStdNew(b *testing.B) {
	b.RunParallel(func(p *testing.PB) {
		for p.Next() {
			for i := 0; i < MAX; i++ {
				p := StdNewPerson()
				p.Name = "John"
				p.Age = 32
				p.Addr = "London"
				p.Zip = 1111
			}
			runtime.GC()
		}
	})
}
```

### 맥

```bash
goos: darwin
goarch: amd64
pkg: github.com/unsafe-risk/mi/arena
cpu: Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz
BenchmarkMiArenaPerson-16    	      33	  33580864 ns/op	      42 B/op	       1 allocs/op
BenchmarkStdNew-16           	      39	  30365484 ns/op	96002062 B/op	 2000022 allocs/op
```

`umem` 아레나와 마찬가지로 인텔 맥에서는 `new` 할당에 비해 조금 밀리는 성능을 보입니다.

### 리눅스

```bash
goos: linux
goarch: amd64
pkg: github.com/unsafe-risk/mi/arena
cpu: Intel(R) Core(TM) i5-7200U CPU @ 2.50GHz
BenchmarkMiArenaPerson-4   	      19	  59619689 ns/op	     195 B/op	       0 allocs/op
BenchmarkStdNew-4          	      20	  54869378 ns/op	96000574 B/op	 2000006 allocs/op
```

```bash
goos: linux
goarch: amd64
pkg: github.com/unsafe-risk/mi/arena
cpu: AMD Ryzen 7 4800H with Radeon Graphics         
BenchmarkMiArenaPerson-16    	      32	  49734124 ns/op	     861 B/op	       2 allocs/op
BenchmarkStdNew-16           	      52	  20565911 ns/op	96001187 B/op	 2000011 allocs/op
```

```bash
goos: linux
goarch: arm64
pkg: github.com/unsafe-risk/mi/arena
BenchmarkMiArenaPerson-4   	      85	  11788425 ns/op	      10 B/op	       0 allocs/op
BenchmarkStdNew-4          	      26	  44319635 ns/op	96001133 B/op	 2000011 allocs/op
```

리눅스의 경우 인텔과 AMD 위에서는 `new` 할당에 비해 매우 떨어지는 모습을 보이지만, ARM64에서는 예상보다 큰 차이를 보였습니다.

## 고랭의 아레나

고랭에서 아레나 이야기가 크게 나온건 비교적 최근인 2022년 2월 22일에 고랭 이슈에 올라온 하나의 [프로포절](https://github.com/golang/go/issues/51317)입니다. 해당 프로포절은 아레나의 기본적인 내용과 이점에 대해 작성하고 있으며, 고랭에 어떤 식으로 아레나를 들여올 건지 쓰여 있고, 고퍼들의 토론이 포함되어 있습니다. 현재는 프로포절로만 올라가 있어서 언제 될지는 알 수 없지만, 공식적으로 추가되면 개인이 만든 위의 2개보다 시스템적으로 훨씬 좋은 성능을 낼 수 있을 것입니다. 게다가 이미 구글은 [gapid](https://github.com/google/gapid) 프로젝트에서 [arena](https://github.com/google/gapid/tree/master/core/memory/arena)를 구현했던 적이 있어 더욱 기대됩니다. 

게다가 `umem`이나 `mi`도 기존 인텔x64나 amd64에서 아쉬운 결과를 보였지만, arm64에서는 어느 쪽에서든 좋은 결과를 보여서 앞으로 arm64 아키텍처가 더욱 대중화된다면, 충분히 사용을 고려해볼만 하다고 생각합니다. 
