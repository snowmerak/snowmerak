---
title: "에러 처리 in go"
date: 2021-12-26T13:12:58+09:00
tags: ["go", "error"]
author: "snowmerak"
categories: ["Information"]
draft: false
---

## 쉬운 에러 처리

```go
package main

import (
	"errors"
)

func NewError() error {
	return errors.New("this is new error!")
}

func ThrowError() error {
	_, err := os.Open("not-exist")
	return err
}

func main() {
	err := NewError()
	if err != nil {
		log.Println(err)
	}

	err = ThrowError()
	if err != nil {
		log.Println(err)
	}
}
```

가장 쉬운 에러 처리 방법은 `errors.New` 함수로 에러 메시지를 담은 `error` 인터페이스 인스턴스를 직접 만드는 것과 반환된 에러를 그대로 상위 스택에 넘겨주는 방법이 있습니다. 하지만 이 2가지 방식은 각기 다른 문제점이 있습니다.

첫번째 에러 메시지만 담아 보낼 때는 어떤 에러인지 파악하기 위해 메시지를 검사해야한다는 점이 있습니다. 단순 로깅을 위해 메시지만 저장하는 경우엔 큰 문제가 되지 않지만 런타임에 어떤 에러인지에 따라 다음 행동을 정해야할 때는 코딩 난이도가 높아지게 됩니다. 그래서 이를 해결하기 위한 여러가지 솔루션을 고랭 팀과 고퍼들이 연구 & 개발했습니다. 그 중 몇가지만 더 낫다고 생각하는 순서대로 작성해보겠습니다.

## error 인스턴스 비교

```go
var thisError = errors.New("this is a new error!")

func NewError() error {
	return thisError
}

func main() {
	err := NewError()
	switch err {
	case thisError:
		log.Println(err)
	default:
		log.Println("no error")
	}
}
```

첫번째로 알아볼 것은 미리 만들어 놓은 `error` 인스턴스를 에러가 발생할 때 반환하는 것입니다. `switch` 문으로 `thisError`와 비교하면 옳다고 판단하여 에러 로그를 남기는 모습을 확인할 수 있습니다. 

```bash
go % go run .
2021/12/26 13:52:02 this is a new error!
```

하지만 이 방법에는 2가지 문제점이 있습니다. 하나는 고 언어에는 불변값이 존재하지 않기에 외부로 내보내진 `error` 인스턴스에 악의적인 행동 혹은 실수에 의해 수정되어 다음 동작에 대한 결과를 보장할 수 없다는 것입니다.

그리고 다른 하나는, 예제 코드에서는 두 에러를 `switch`를 통해 비교했지만 실제로는 `if err == thisError { ... }`와 같다는 걸 알고, 두 에러를 `==`로 비교하는 건 두 문자열이 동등한지 파악하는 거와 같기에 그다지 유연한 코드가 아니라는 걸 알 수 있습니다.

### 문자열 상수 비교

```go
var thisError = "this is a new error!"

func NewError() error {
	return errors.New(thisError)
}

func main() {
	err := NewError()
	if err.Error() == thisError {
		log.Println("this is a new error!")
	}
}
```

문자열 상수를 비교하는 건 error 인스턴스를 비교하는 것과 완전히 동일합니다. 대신 문자열 상수를 비교하기 때문에 에러 메시지가 수정되는 걸 방지할 수 있다는 장점이 있습니다.

## 타입 비교

```go
type FileError struct {
	IsExist         bool
	InvalidName     bool
	PermissionError bool
	Msg             string
}

func (e *FileError) Error() string {
	return e.Msg
}

func NewError() error {
	return &FileError{
		IsExist:         false,
		InvalidName:     false,
		PermissionError: true,
		Msg:             "permission error",
	}
}

func main() {
	err := NewError()
	switch err := err.(type) {
	case *FileError:
		log.Println(err.Msg)
		log.Println(fmt.Sprintf("is exist: %v", err.IsExist))
		log.Println(fmt.Sprintf("invalid name: %v", err.InvalidName))
		log.Println(fmt.Sprintf("permission error: %v", err.PermissionError))
	}
}
```

이번에는 구체적인 타입을 만들어서 `error` 인터페이스로 반환하였습니다. 이렇게 작성하면 더 많은 정보를 에러를 통해 넘겨줄 수 있으며 `switch assertion` 문법을 활용하여 쉽게 접근할 수 있습니다. 하지만 잘 아시다시피 구체적인 타입을 이용하여 코드를 작성할 경우 느슨한 결합을 유도할 수 없게 된다는 단점이 있습니다. 그리고 저희는 고 코드를 작성할 때 인터페이스를 사용함으로 느슨한 결합을 만들었습니다.

## 인터페이스 비교

```go
type IsExistErrorInterface interface {
	IsExist() bool
}

type InvalidNameErrorInterface interface {
	IsInvalidName() bool
}

type PermissionErrorInterface interface {
	IsPermissionError() bool
}

type FileError struct {
	isExist         bool
	invalidName     bool
	permissionError bool
	Msg             string
}

type PermissionError FileError

func (p *PermissionError) IsPermissionError() bool {
	return true
}

func (p *PermissionError) Error() string {
	return p.Msg
}

func NewError() error {
	return &PermissionError{
		isExist:         true,
		invalidName:     true,
		permissionError: true,
		Msg:             "permission error",
	}
}

func main() {
	err := NewError()
    log.Println(err.Error())
	switch e := err.(type) {
	case PermissionErrorInterface:
		log.Println(fmt.Sprintf("is permission error: %v", e.IsPermissionError()))
	case IsExistErrorInterface:
		log.Println(fmt.Sprintf("is exist error: %v", e.IsExist()))
	case InvalidNameErrorInterface:
		log.Println(fmt.Sprintf("is invalid name error: %v", e.IsInvalidName()))
	}
}
```

코드 상태가 그다지 좋지 않은 점은 죄송하게 생각합니다. 그다지 좋은 예시가 떠오르지 않았습니다.

이번엔 타입을 비교하는 것에서 한단계 더 나아가서 인터페이스를 비교합니다. 이 코드는 여러가지 에러의 정보를 얻을 수 있는 인터페이스를 만들어서 에러의 구체적인 타입을 몰라도 값을 얻을 수 있게 덕타이핑한 것입니다. 

위에서 이어져오는 예시 코드의 상태가 너무 안좋으니 간단한 `GetRequest` 코드를 새로 작성해보겠습니다.

```go
func GetRequest(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}
```

`GetRequest` 함수는 입력받은 url에 GET 요청을 하여 얻은 body를 반환하는 함수입니다. 하지만 여기에 한가지 문제가 있습니다. 요청이 성공했든 실패했든 `Status Code`를 사용자에게 전달할 방법이 없습니다. 이걸 해결하기 위해 에러를 살짝 수정하여 다시 작성해보겠습니다.

```go
type errorWithStatus struct {
	err    error
	status int
}

func (e *errorWithStatus) Error() string {
	return e.err.Error()
}

func (e *errorWithStatus) Status() int {
	return e.status
}

type HasStatus interface {
	Status() int
}

func GetRequest(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		if resp == nil {
			return nil, &errorWithStatus{
				err:    err,
				status: http.StatusNotFound,
			}
		}
		return nil, &errorWithStatus{
			err:    err,
			status: resp.StatusCode,
		}
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}
```

새로운 에러 타입인 `errorWithStatus`를 만들었고 멤버로 스테이터스 코드를 가지고 `Status()` 메서드를 통해 해당 값을 받을 수 있도록 수정하였습니다. 이제 이 함수를 실행하고 만약 요청에서 에러가 발생하면 스테이터스 코드를 확인하여 디버깅할 수 있습니다.

```go
func main() {
	_, err := GetRequest("https://not.exists.domain")
	switch e := err.(type) {
	case nil:
		log.Println("no error")
	case *errorWithStatus:
		log.Println("Status:", e.Status())
		log.Fatal(err.Error())
	default:
		log.Fatal(err)
	}
}
```

```bash
go % go run .
2021/12/26 16:10:48 Status: 404
2021/12/26 16:10:48 Get "https://not.exists.domain": dial tcp: lookup not.exists.domain: no such host
exit status 1
```

이렇게 작성하면 단순 GET 요청 뿐만 아니라 다른 REST API 요청에도 하나의 인터페이스로 에러를 처리하여 느슨한 결합을 만들 수 있을 것입니다.

## 계층적 에러 처리

마지막은 에러를 어떻게 만들고 처리하냐가 아니라 첫번째 코드의 마지막 `ThrowError` 함수에서의 에러 처리에 대한 부분입니다. 표준 `errors` 패키지에는 에러를 계층적으로 처리하기에 유용한 함수들이 작성되어 있습니다.

```go
func ThrowError() error {
	_, err := os.Open("not-exist")
	return err
}
```

### 에러 포장

이 코드는 `os.Open` 함수가 주는 에러를 그대로 반환합니다. 그럴 경우 해당 에러가 어디서부터 왔는지, 어떤 계층을 가지는 지 파악할 수 없습니다. 그러면 `ThrowError` 함수를 거쳤음을 표현하기 위해 코드를 수정해보겠습니다.

```go
func ThrowError() error {
	_, err := os.Open("not-exist")
	return fmt.Errorf("ThrowError: %w", err)
}

func main() {
	err := ThrowError()
	if err != nil {
		log.Fatal(err)
	}
}
```

`ThrowError` 함수에서 에러를 반환하기 전에 `fmt.Errorf` 함수를 사용하여 에러를 래핑하고 있습니다. 래핑한 에러를 출력하게 되면 아래와 같이 문구가 추가되어 있음을 확인할 수 있습니다.

```bash
go % go run .
2021/12/26 16:20:10 ThrowError: open not-exist: no such file or directory
exit status 1
```

이렇게 래핑된 에러는 `errors.Unwrap` 함수를 이용하여 내부 에러를 가져올 수 있습니다.

```go
func main() {
	err := ThrowError()
	fmt.Println(errors.Unwrap(err))
	fmt.Println(errors.Unwrap(errors.Unwrap(err)))
	fmt.Println(errors.Unwrap(errors.Unwrap(errors.Unwrap(err))))
}
```

`main` 함수를 수정하여 여러 단계의 `errors.Unwrap`을 수행하게 되면 순서대로 하나씩 벗겨지는 걸 확인할 수 있습니다.

```bash
go % go run .
open not-exist: no such file or directory
no such file or directory
<nil>
```

순서대로 `ThrowError`, `open not-exist`, `no such file or directory`이 벗겨지고 마지막으로 `nil`이 나옴을 확인할 수 있습니다. 이러한 구조가 있기에 `for err != nil { ... }`같은 형태로 쉽게 반복할 수 있습니다.

### 에러 추적

```go
func main() {
	firstErr := errors.New("this is an error")
	secondErr := fmt.Errorf("second error: %w", firstErr)
	thirdErr := fmt.Errorf("third error: %w", secondErr)

	fmt.Println(errors.Is(thirdErr, firstErr))
}
```

`errors` 패키지에는 `errors.Is` 함수도 제공하고 있습니다. 이 함수는 지속적인 래핑의 결과물로 나온 에러가 원본 에러와 같은 에러인가를 쉽게 확인할 수 있게 작성된 함수입니다. 위 코드를 실행하게 되면 `thirdErr`은 `firstErr`와 같다는 것을 확인할 수 있습니다. 그리고 객체지향의 상속 계층과 마찬가지로 두 패러미터의 위치가 바뀌면(`errors.Is(firstErr, thirdErr)`) 성립되지 않고 `false`를 출력합니다.

### 에러 확인

```go
type HasStatus interface {
	Status() int
}

type ErrorWithStatus struct {
	err    error
	status int
}

func (e *ErrorWithStatus) Error() string {
	return fmt.Sprintf("%d: %s", e.status, e.err)
}

func (e *ErrorWithStatus) Status() int {
	return e.status
}

func main() {
	err := &ErrorWithStatus{
		err:    errors.New("error"),
		status: 500,
	}

	fmt.Println(errors.As(err, new(HasStatus)))
}
```

방금 `GetRequest` 함수를 만들었을 때 사용한 에러 타입을 간단하게 다시 만들었습니다. 해당 에러는 `HasStatus` 인터페이스를 구현하고 있음을 생각하고 `main` 함수를 보면 `errors.As` 함수를 이용하여 에러 인스턴스와 인터페이스 포인터를 사용하여 해당 인터페이스를 구현하고 있는 지 확인하는 걸 볼 수 있습니다.

```go
func main() {
	err := &ErrorWithStatus{
		err:    errors.New("error"),
		status: 500,
	}

	wrappedErr := fmt.Errorf("%w", err)

	fmt.Println(errors.As(wrappedErr, new(HasStatus)))
}
```

`errors.As` 함수는 계층적 동작도 가능하기에 위 코드처럼 에러 인스턴스를 한번 감싸도 `true`를 출력하는 것을 확인할 수 있습니다.