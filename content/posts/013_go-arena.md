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

어디까지나 아레나의 활용도는 일련의 기능을 실행함에 있어 힙에 할당되는 메모리를 하나의 연속된 공간에 기록하고, 한번에 할당 해제하는 것으로 GC 부담을 줄이는 것입니다. 의의를 GC가 동작하지 않아, 로직이 실행되는 동안 프로그램이 멈추는 일이 없다는 것과 하나의 아레나가 해제되는 동안 다른 로직에 영향을 끼치지 않는다는 것으로, 다소의 메모리 파편화나 할당 해제의 코스트는 비교적 후순위로 평가됩니다. 그럼에도 아래 벤치마크는 편의성을 위해 장점 외의 부분도 포함하여 작성되었습니다. 

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

### 맥 결과

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

### 리눅스 결과

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

`mi` 패키지의 벤치마크는 `umem` 패키지의 벤치마크에서 패러렐 부분을 추가했습니다. 그래서 한번에 여러개의 벤치마크가 동시에 수행하게 됩니다. 이는 `mimalloc`에게 불리한 부분입니다. 여러번의 테스트로 `mimalloc`은 할당 해제를 하더라도, C 메모리 영역에서 할당받은 메모리를 가지고 있다가 재활용을 하게 되는데, 이 벤치마크 코드에서는 아쉽게도 모든 테스트에서 새로 OS로부터 할당받으므로 장점을 잃게 됩니다.

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

테스트 코드는 `umem` 패키지의 테스트 코드와 달리 타입을 받아 할당하는 하나의 코드만 테스트합니다.

### 맥 결과

```bash
goos: darwin
goarch: amd64
pkg: github.com/unsafe-risk/mi/arena
cpu: Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz
BenchmarkMiArenaPerson-16    	      33	  33580864 ns/op	      42 B/op	       1 allocs/op
BenchmarkStdNew-16           	      39	  30365484 ns/op	96002062 B/op	 2000022 allocs/op
```

`umem` 아레나와 마찬가지로 인텔 맥에서는 `new` 할당에 비해 조금 밀리는 성능을 보입니다.

### 리눅스 결과

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

리눅스의 경우 인텔과 AMD 위에서는 `new` 할당에 비해 매우 떨어지는 모습을 보이지만, ARM64에서는 메모리 풀을 활용할 수 없었을 것임에도 불구하고 꽤 큰 차이를 보였습니다.

## 고랭의 아레나

고랭에서 아레나 이야기가 크게 나온건 비교적 최근인 2022년 2월 22일에 고랭 이슈에 올라온 하나의 [프로포절](https://github.com/golang/go/issues/51317)입니다. 해당 프로포절은 아레나의 기본적인 내용과 이점에 대해 작성하고 있으며, 고랭에 어떤 식으로 아레나를 들여올 건지 정리되어 있고, 고퍼들의 토론이 포함되어 있습니다. 현재는 프로포절로만 올라가 있어서 언제 될지는 알 수 없지만 공식적으로 추가되면 개인이 만든 2개보다 훨씬 좋은 성능을 낼 수 있을 것입니다. 게다가 이미 구글은 [gapid](https://github.com/google/gapid) 프로젝트에서 [arena](https://github.com/google/gapid/tree/master/core/memory/arena)를 구현했던 적이 있어, 더욱 기대됩니다. 

게다가 `umem`이나 `mi`도 기존 인텔x64나 amd64에서 아쉬운 결과를 보였지만, arm64에서는 어느 쪽에서든 좋은 결과를 보여서 앞으로 arm64 아키텍처가 더욱 대중화된다면, 충분히 사용을 고려해볼만 하다고 생각합니다. 
