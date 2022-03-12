---
title: "[A] enum in go"
date: 2022-03-12T18:41:20+09:00
tag: ["go", "enum", "class", "project A"]
draft: true
---

> 이 페이지의 고 코드는 제네릭이 포함되어 있습니다.

## enum?

고에서 열거형은 아래의 단순한 형태, 혹은 조금의 변형으로밖에 작성되지 않습니다.

```go
package week

const (
    Monday = iota
    Tuesday
    Wednesday
    Thursday
    Friday
    Saturday
    Sunday
)
```

단순하게 `week` 패키지 내에서 상수를 선언하여 가져다 쓰는 정도입니다. 하지만 그건 어디까지나 열거형을 위한 패키지를 분리하지 않았기에 제한되는 방식이라 생각합니다.

## package as class

단일 역할에 대해 단일 구현체만 패키지에 작성할 경우 패키지를 클래스처럼 이용할 수 있습니다. 

### 바이트 슬라이스 열거형

바이트 슬라이스를 열거형의 값으로 가지려면 `const` 키워드를 사용하여 상수로 선언할 수는 없습니다. 

```go
package buffer

var A = [32]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32}
var B = [32]byte{2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31}
var C = [32]byte{3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28}
```

`var` 키워드로 변수로 선언할 수밖에 없습니다. 그러면 극단적인 상황으로 외부에서 전역 변수의 값을 바꿔버릴 경우 의도하지 않은 동작을 하게 될 수도 있습니다. 이걸 방지하기 위해 코드를 복잡하게 만들어 보겠습니다.

```go
package buffer

var a = [32]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32}
var b = [32]byte{2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31}
var c = [32]byte{3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28}

func A() [32]byte {
	return a
}
func B() [32]byte {
	return b
}
func C() [32]byte {
	return c
}
```

변수는 숨긴 채로 함수를 만들어서 값을 반환하여 변수가 노출되는 것을 방지하였습니다. 여기에 더 나아가서 `buffer` 패키지만의 타입을 만듭니다.

```go
package buffer

type Buffer [32]byte

var a = [32]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32}
var b = [32]byte{2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31}
var c = [32]byte{3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28}

func A() Buffer {
	return a
}
func B() Buffer {
	return b
}
func C() Buffer {
	return c
}
```

`Buffer` 타입을 만들어 `[32]byte`의 별칭으로 지정합니다. 이렇게 `Buffer` 타입의 정적 변수를 만든 셈입니다. 열거형에 맞게 인덱스 관련 함수를 작성합니다. 

```go
func Get(i int) Buffer {
	switch i {
	case 0:
		return A()
	case 1:
		return B()
	case 2:
		return C()
	default:
		return Buffer{}
	}
}
func IndexOf(buf *Buffer) int {
	if *buf == a {
		return 0
	}
	if *buf == b {
		return 1
	}
	if *buf == c {
		return 2
	}
	return -1
}
```

`Get`과 `IndexOf` 함수를 통해 각각 특정 인덱스의 버퍼를 가져오거나 입력받은 버퍼의 인덱스 값을 받아올 수 있습니다.

```go
package main

import (
	"fmt"
	"prac/buffer"
)

func main() {
	a := buffer.A()
	fmt.Println(a)
	fmt.Println("index:", buffer.IndexOf(&a))
	fmt.Println("first value:", buffer.Get(0))
}
```

```bash
[1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32]
index: 0
first value: [1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32]
```

간단한 코드인 만큼 제대로 동작하는 걸 확인할 수 있고 `buffer` 패키지를 스태틱 클래스처럼 쓸 수 있는 걸 볼 수 있습니다.

### Result[T any] type

위의 코드는 단순 상수 목록과 사실 다를게 없습니다. 좀 더 나아가서 열거형 항목을 별개의 객체처럼 다루는 것도 가능할 것입니다. 

```go
package result

type Result[T any] any

type resultOK[T any] struct {
	Value T
}

type resultError struct {
	err error
}

func OK[T any](value T) Result[T] {
	return resultOK[T]{Value: value}
}

func Err[T any](err error) Result[T] {
	return resultError{err: err}
}

func IndexOf[T any](result Result[T]) int {
	switch result.(type) {
	case resultOK[T]:
		return 0
	case resultError:
		return -1
	}
	return -1
}

func ValueOf[T any](result Result[T]) T {
	switch result.(type) {
	case resultOK[T]:
		return result.(resultOK[T]).Value
	}
	panic("Unwrap on Error")
}

func ErrorOf[T any](result Result[T]) error {
	switch result.(type) {
	case resultError:
		return result.(resultError).err
	}
	panic("Unwrap on OK")
}
```

가급적 간단한 형태로 만들었습니다. `result` 패키지에 `Result` 타입을 만들고 내부에 `resultOk`와 `resultError` 타입을 세부 타입으로 만들었습니다. 이전의 접근자나 `Get` 함수를 통해 값을 가져오기보다 각 세부 타입에 맞는 접근자(생성자)를 새로 작성하였습니다.

```go
package main

import (
	"errors"
	"fmt"
	"prac/result"
)

func main() {
	a := result.OK(10)
	switch result.IndexOf(a) {
	case 0:
		fmt.Println("OK:", result.ValueOf(a))
	case -1:
		fmt.Println("Err:", result.ErrorOf(a))
	}

	n := result.Err[int](errors.New("error"))
	switch result.IndexOf(n) {
	case 0:
		fmt.Println("OK:", result.ValueOf(n))
	case -1:
		fmt.Println("Err:", result.ErrorOf(n))
	}
}
```

`result`의 `OK`, `Err`과 `IndexOf`, 스위치 구문을 활용하여 러스트의 result를 모방해봤습니다. 

```bash
OK: 10
Err: error
```

출력된 결과 또한 의도한 대로 출력되는 것을 확인할 수 있습니다. 좀 더 사용성에 중점을 두고 `IndexOf` 함수를 `IsOk`와 `IsErr`로 분리하는 등 좀 더 나은 코드로 수정하는 방법도 있습니다.
