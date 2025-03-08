---
title: "Result를 활용한 에러처리"
date: 2021-12-30T19:21:53+09:00
tags: ["go", "generic", "error", "result"]
author: "snowmerak"
categories: ["Suggestions"]
draft: false
---

이 글은 제가 작성한 레포인 [generics-for-go](https://github.com/snowmerak/generics-for-go)를 기반으로 쓰여졌습니다.

## 개요

예전 고 1.18 dev 버전이 나왔을 때 한 레포를 만들어서 제네릭 관련 함수를 찍어낸 적이 있습니다. 그 이후 한동안 잊고 지내다가 1.18 beta가 나오게 되고 이제 큰 피처의 변화는 없을 거라 판단해서 제네릭으로 몇가지 장난을 하던 도중, 러스트같은 언어에서 자주 보이는 Option과 Result를 만들어 보고 싶었습니다.

예전에도 당연히 `interface{}`만으로 구현에 도전해봤지만 사실 타입 단언(Type Assertion)을 해야한다는 것에서 그다지 사용성이 좋지 못 했고 이로 인해 코드 수만 늘어났습니다. 하지만 제네릭이라는 수단이 추가되니 생각할 폭이 넓어지고 재밌는 문법이 떠올랐습니다.

```go
func (r *Result[T]) Unwrap() T {
	value, _ := r.value.(T)
	return value
}
```

이 코드는 제가 구현한 `Result` 구조체의 메서드입니다. 제네릭 인자가 타입으로 취급되는 점을 이용하여 제네릭 타입으로 타입 단언을 하고 단언한 값을 반환하는 것입니다. 이렇게 되면 먼저 적었던 라이브러리의 사용자가 타입 단언을 해야해서 추가되는 코드를 획기적으로 줄일 수 있습니다. 해당 코드가 동작하는 걸 확인하고 일종의 희열을 느꼈고 관련 패키지 코드를 작성해 나갔습니다.

## result

### 구조체

```go
type Result[T any] struct {
	value any
}

func Ok[T any](data T) *Result[T] {
	return &Result[T]{value: data}
}

func Err[T any](err error) *Result[T] {
	return &Result[T]{value: err}
}
```

구조체 내부에는 `any` 타입을 가지는 value 멤버만이 존재합니다. 그리고 `Ok`와 `Err` 생성자가 존재합니다. `Ok`는 특정 타입 변수를 받아서 해당 타입을 저장하는 `Result[T]` 포인터를 생성하여 반환합니다. `Err`는 타입과 에러를 받고 해당 타입의 `Result[T]` 포인터를 반환합니다. 사용할 때는 다음과 같이 사용하면 됩니다.

```go
okInt := result.Ok(10)
errInt := result.Err[int](errors.New("anything"))
```

`okInt`는 내부적으로 10을 가지고 `errInt`는 내부적으로 에러 인스턴스를 가집니다. 이들은 간단한 메서드로 어떤 값을 가지고 다음에 어떤 행동을 해야하는가를 정할 수 있습니다.

### 메서드

#### Ok, Unwrap, Err

```go
okInt := result.Ok(10)

switch okInt.Ok() {
    case true:
        fmt.Println(okInt.Unwrap())
    case false:
        log.Println(okInt.Err().Error())
}

errInt := result.Err[int](errors.New("anything"))

switch errInt.Ok() {
    case true:
        fmt.Println(errInt.Unwrap())
    case false:
        log.Println(errInt.Err().Error())
}
```

간단하게 `Ok()` 메서드를 호출함으로 적절한 값이 포함되어 있는지, 에러가 포함되어 있는지 검사하고 다음 행동을 정하게 됩니다. 이때 `Unwrap()` 메서드는 내부에 저장된 값이 해당 타입이 아닐 경우 그 타입의 제로 값을 반환하지만 `Err()` 메서드는 내부에 저장된 값이 에러가 아닐 경우에는 `nil`을 반환합니다.

#### Map, MapOr

```go
a := result.Ok(100)

a.Map(func (t int) (int, error)) {
    return t * 2, nil
})

if a.Ok() {
    fmt.Println(a.Unwrap())
}
```

`Map()` 메서드는 주어진 함수에 따라 만들어진 값으로 내부 값을 바꾸게 됩니다. 당연하게도 에러가 반환되면 내부 값도 에러로 바뀌게 되어 `Ok()` 메서드의 반환값이 `false`로 바뀌게 됩니다. 하지만 에러가 발생한다 하더라도 어떤 값을 가지게 할 수 있을 것입니다.

```go
a := result.Ok(100)

a.MapOr(func (t int) (int, error)) {
    return -1, errors.New("some error")
}, 99)

if a.Ok() {
    fmt.Println(a.Unwrap())
}
```

이 코드에서는 `MapOr()` 메서드를 사용하였습니다. 인자는 `Map()` 메서드와 같은 함수와 기본값을 넘겨줍니다. 이 코드에서 넘겨준 함수는 무조건 에러를 반환하여 `a`가 에러를 가져야하지만 대신 인자로 넘겨 받은 기본값, `99`를 대입하게 됩니다.

#### AndThen

만약 지속적으로 같은 타입의 인자와 반환값을 넘겨주는 함수가 연속적으로 반복될 경우 일일이 넘겨주고 에러 체크하는 것이 귀찮을 수 있습니다. 

```go
a := result.Ok(100)

a = a.AndThen(func(t int) (int, error) {
    return t * 2, nil
}).AndThen(func (t int) (int, error) {
    return t * 3, nil
})

if a.Ok() {
    fmt.Println(a.Unwrap() == 600)
}
```

예시는 간단한 함수로 작성하였습니다. `a`가 가진 `100`에서 시작하여 2를 곱한 후 3을 곱하여 최종적으로 600이 맞는 지 확인합니다. 출력은 `true`가 나올것입니다.

```go
a := result.Ok(100)

a = a.AndThen(func(t int) (int, error) {
    return t * 2, nil
}).AndThen(func (t int) (int, error) {
    return -1, errors.New("some error")
}).AndThen(func (t int) (int, error) {
    return t * 3, nil
})

switch a.Ok() {
    case true:
        fmt.Println(a.Unwrap() == 600)
    case false:
        log.Fatal(a.Err().Error())
        // additional error handling
}
```

이 예시는 중간에 에러가 발생할 때를 위한 코드입니다. `AndThen()` 메서드로 연결된 메서드 체인의 경우 중간에 에러가 발생하면 다음 단계에서 함수를 실행하지 않고 에러 인스턴스를 가진 `Result[T]` 객체를 지속적으로 반환합니다. 그리고 아래 스위치 구문에서 발생 가능한 에러들을 한번에 처리할 수 있도록 합니다. 저는 충분히 이 메서드 체인으로도 나쁘지 않다고 생각하지만 그래도 만족할 수 없었습니다.

### 함수

#### ToFunctor

```go
func ToFunctor[T any, R any](fn func(T) (R, error)) func(*Result[T]) *Result[R] {
	return func(param *Result[T]) *Result[R] {
		if param.Ok() {
			n, err := fn(param.Unwrap())
			if err != nil {
				return Err[R](err)
			}
			return Ok(n)
		}
		return Err[R](param.Err())
	}
}
```

해당 함수는 `func(T) (R, error)` 함수를 `func(*Result[T]) *Result[R]` 함수로 래핑해주는 역할을 합니다. 이렇게 함으로 `result` 패키지를 사용하는 사람으로 하여금 직접 객체를 다루는 수고를 줄일 수 있습니다.

---

고의 제네릭에는 몇가지 한계점이 존재하는데, 그 중 하나가 메서드에 구조체에서 선언하지 않은 제네릭 인자를 추가할 수 없다는 것입니다. 이는 고 런타임이 가지는 인터페이스 시스템과 연관이 있기에 해달라고 할 수도 없는 부분이라 다른 방안이 필요했습니다. 그 방법으로 제가 제안하는 건 시작 타입과 끝 타입만 제공하는 방법입니다.

만약 런타임 안정성을 위해 컴파일할 때 타입이 다 파악되면 좋겠다고 생각하시면 지금으로서는 여러 함수를 이어서 새 함수를 만들어주는 함수를 만들어서 계속 피라미드처럼 이어 올라가는 수밖에 없습니다. 이렇게 되면 코드를 작성하는 게 큰 노동이 될 것입니다.

## chain

`chain`은 이를 위해 만든 패키지입니다.

### 구조체

```go
type Chain[T, R any] struct {
	list []any
}
```

런타임과 `reflect`의 힘을 빌려야하기에 함수 리스트의 타입은 `[]any`(기존의 `[]interface{}`와 동일합니다)으로 작성합니다.

### 함수

```go
func From[T, R any](list ...any) *result.Result[*Chain[T, R]] {
	if len(list) == 0 {
		return result.Err[*Chain[T, R]](errors.New("list is empty"))
	}
	if len(list) == 1 {
		fun := reflect.TypeOf(list[0])
		if fun.Kind() != reflect.Func {
			return result.Err[*Chain[T, R]](errors.New("list is not a function"))
		}
		if fun.In(0) != reflect.TypeOf(new(T)).Elem() {
			return result.Err[*Chain[T, R]](errors.New("the function's parameter type is invalid"))
		}
		if fun.Out(0) != reflect.TypeOf(new(R)).Elem() {
			return result.Err[*Chain[T, R]](errors.New("the function's return type is invalid"))
		}
		return result.Success(&Chain[T, R]{list})
	}
	in := reflect.TypeOf(list[0]).In(0)
	if in != reflect.TypeOf(new(T)).Elem() {
		return result.Err[*Chain[T, R]](errors.New("function's parameter type is invalid"))
	}
	out := reflect.TypeOf(list[0]).Out(0)
	for i := 1; i < len(list); i++ {
		in = reflect.TypeOf(list[i]).In(0)
		if out != in {
			return result.Err[*Chain[T, R]](errors.New("function's parameter type is invalid"))
		}
		out = reflect.TypeOf(list[i]).Out(0)
	}
	if out != reflect.TypeOf(new(R)).Elem() {
		return result.Err[*Chain[T, R]](errors.New("function's return type is invalid"))
	}
	return result.Ok(&Chain[T, R]{list})
}
```

`reflect` 패키지를 사용한 것에 대해 마음에 안드시는 분들이 분명 존재할 것입니다. 런타임 성능을 어느정도 희생하는 결과를 낳을 것이지만 안정적인 런타임을 위해 필요했습니다. 이 코드는 입력받은 함수 리스트의 출력과 입력이 앞뒤로 맞는 지 확인하고 한번이라도 틀리면 에러를 포함한 `Result`가 반환되고 아니라면 `Chain[T, R]` 인스턴스를 포함한 `Result`가 반환됩니다.

### 메서드

```go
func (c *Chain[T, R]) Run(param T) R {
	paramValue := reflect.ValueOf(param)
	for _, fun := range c.list {
		funValue := reflect.ValueOf(fun)
		result := funValue.Call([]reflect.Value{paramValue})
		paramValue = result[0]
	}
	return paramValue.Interface().(R)
}
```

마지막으로 `Run()` 메서드를 실행함으로 `Chain` 구조체가 가지고 있던 함수 리스트를 순차적으로 실행합니다. 반환값은 `Interface()` 메서드로 `any`로 변환된 후 다시 `R` 타입으로 변환되어 반환됩니다.

## 예시

```go
package main

import (
	"strings"

	"github.com/snowmerak/generics-for-go/chain"
	"github.com/snowmerak/generics-for-go/result"
	"github.com/snowmerak/generics-for-go/slice"
)

func main() {
	ch := chain.From[*result.Result[string], *result.Result[int]](
		result.ToFunctor(func(t string) (string, error) {
			return strings.Repeat(t, 10), nil
		}),
		result.ToFunctor(func(t string) (string, error) {
			return string(slice.Filter([]rune(t), func(t rune) bool {
				return t != 'a'
			})), nil
		}),
		result.ToFunctor(func(t string) (string, error) {
			return slice.JoinToString([]rune(t), "a"), nil
		}),
		result.ToFunctor(func(t string) (int, error) {
			return len(t), nil
		}),
	)

	switch ch.Ok() {
	case true:
		rs := ch.Unwrap().Run(result.Ok("snowmerak is a fool"))
		switch rs.Ok() {
		case true:
			println(rs.Unwrap())
		case false:
			println(rs.Err())
		}
	case false:
		println(ch.Err())
	}
}
```

복잡한 코드를 만들려고 하지는 않았습니다. 이 코드는 `chain`과 `result` 그리고 설명하지는 않았지만 보시면 바로 아실 `slice` 패키지를 사용하였습니다. 먼저 `chain.From`을 이용하여 문자열을 10번 반복, 문자열에서 'a'를 필터링, 각 문자 사이에 'a'를 삽입하고 그 길이를 구하는 함수를 연결하였습니다. 만들어진 체인이 제대로 만들어졌는지 확인한 후 "snowmerak is a fool"이라는 문장을 넣어 실행시킨 후 다시 에러 여부를 확인하고 각 값을 출력합니다.

```bash
649
```
