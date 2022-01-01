---
title: "Option과 default parameter"
date: 2021-12-30T21:09:32+09:00
tags: ["go", "generic", "option"]
draft: false
---

## option

`option` 패키지는 직전 포스트에 작성한 `result` 패키지에서 에러 메시지가 빠진 형태입니다.

### 구조체

```go
type Option[T any] struct {
	value any
}

func Some[T any](value T) *Option[T] {
	return &Option[T]{value: value}
}

func None[T any]() *Option[T] {
	return &Option[T]{value: nil}
}
```

구조체는 `result`와같이 `any` 타입을 가진 멤버 하나만 존재합니다. `Some` 생성자는 인자의 타입에 따른 `Option` 구조체를 생성하고 멤버 변수에 인자를 대입합니다. `None` 생성자는 타입 인자만 하나 받으며 해당 타입에 대한 `Option` 구조체를 반환하지만 멤버 변수는 `nil`이 대입됩니다.

### 메서드

#### Ok, Unwrap

```go
someInt := option.Some(100)
noneInt := option.None[int]()

switch someInt.Ok() {
    case true:
        fmt.Println(someInt.Unwrap())
    case false:
        fmt.Println("nothing in someInt")
}

if !noneInt.Ok() {
    log.Fatal(errors.New("noneInt is not empty"))
}
```

`option`에도 `Ok()` 메서드와 `Unwrap()` 메서드가 그대로 존재합니다. 대신 에러가 포함된 형태가 아니기에 `Ok()` 메서드가 `false`라면 그냥 값이 없구나 하고 코드를 작성해야합니다. 하지만 여러가지 상황에서 값이 없을 때 기본값을 꺼내야하는 코드가 필요할 것입니다.

#### UnwrapOr

```go
a := option.None[int]()

b := a.UnwrapOr(10)

fmt.Println(b)
```

`a` 변수는 `None` 생성자를 통해 생성되어 내부에 값이 없는 상황이라 `b` 변수에는 당연히 제로값인 0이 들어가야하지만 `UnwrapOr()` 메서드를 사용하여 기본값을 지정함으로 `b`에는 10이 들어가게 됩니다.

## default parameter

```go
func Add(a *option.Option[int], b *option.Option[int]) int {
	return a.UnwrapOr(100) + b.UnwrapOr(100)
}

func main() {
	fmt.Println(Add(option.Some(1), option.Some(2)))
	fmt.Println(Add(option.None[int](), option.Some(2)))
	fmt.Println(Add(nil, nil))
}
```

간단한 `Add()` 함수를 작성하였습니다. 두개의 `Option` 구조체를 받고 `UnwrapOr()` 메서드로 값을 가져와서 연산한 후 돌려줍니다. 값이 주어질 때는 해당 값으로, 없다면 기본값인 100으로 연산을 하고 있고 엔트리 함수에서는 각기 다른 경우의 반환값을 출력합니다.

```bash
3
102
200
```

각각 예상된 대로 3, 102, 200이 나오는 것을 확인할 수 있습니다.

이 방식이 해야할 것은 많지만 필요할 때 적은 수의 곳에 디폴트 패러미터를 써야한다면 유용하게 쓰일거라 기대합니다.
