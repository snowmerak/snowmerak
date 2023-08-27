---
title: "제티"
date: 2023-08-20T13:48:43+09:00
tags: ["go", "code generation"]
draft: false
---

## 제티 (Jetti)

제티는 제가 프로젝트를 구조적으로 관리하고, 생산성을 조금이라도 높이기 위해 만든 코드 생성기입니다.

### 제티의 지향점

제티는 다음과 같은 지향점을 가지고 있습니다.

1. 고 언어 프로젝트 구조에 대해 어느 정도 강제성을 부여합니다.
2. 코드를 작성할 때, 귀찮은 부분을 최대한 코드 생성을 통해 줄여줍니다.
3. 까먹고 하지 못 했다는 이유로 해야할 것을 하지 못하는 일을 최대한 줄여줍니다.

## 설치

제티는 `go install`을 통해 설치할 수 있습니다.

```bash
go install github.com/snowmerak/jetti/v2/cmd/jetti@latest
```

## 기능

제티는 다음 기능을 제공합니다.

1. 프로젝트 혹은 파일 생성
   1. 특정 폴더 구조와 파일을 가지는 프로젝트를 생성합니다.
   2. 고 언어에 바로 쓸 수 있는 프로토버퍼 파일을 생성합니다.
   3. 바로 실행할 수 있는 `executable` 패키지를 생성합니다.
2. 패키지 실행
   1. `cmd` 폴더 내의 실행 가능한 패키지를 실행합니다.
3. 패키지 임포트 다이어그램 생성
   1. 어떤 패키지가 어떤 패키지들을 임포트하고 있는지 D2 다이어그램으로 그려줍니다.
4. 인터페이스 인덱싱과 구현체 생성
   1. 빌트인 인터페이스와 작업 중인 프로젝트의 인터페이스를 인덱싱 합니다.
   2. 인덱싱된 인터페이스 중 일부를 구현하는 구현체 코드를 생성합니다.
   3. 작성된 메서드에 대한 테스트 함수를 생성합니다.
5. 주석을 통한 특정 행동을 위한 코드 생성
6. json/yaml 파일에서 고 구조체 생성
   1. 프로젝트 내에 json이나 yaml 파일이 있을 경우, 마샬링 가능한 고 구조체를 생성합니다.
7. proto 파일 생성
   1. 프로젝트 내에 proto 파일이 있을 경우, `protoc`를 통해 고 코드를 생성합니다.

### 프로젝트 혹은 파일 생성

제티에 `new` 커맨드를 입력함으로 프로젝트 혹은 파일을 생성할 수 있습니다.

```bash
jetti new -h
```

#### 프로젝트 생성

제티를 통해 고 프로젝트를 초기화할 수 있습니다.

```bash
jetti new <module-name>
```

위 명령어를 통해 `module-name`을 이름으로 하는 고 프로젝트를 생성할 수 있습니다.  
예를 들어 `jetti new prac`을 입력하면 다음 구조를 가지는 프로젝트가 생성됩니다.

```bash
.
├── generate.go
├── go.mod
├── internal
│   └── doc.go
├── lib
│   └── doc.go
├── model
│   └── doc.go
└── README.md

4 directories, 6 files
```

`go.mod` 파일은 다음처럼 생성됩니다.

```bash
module prac

go 1.21.0
```

#### 프로토버퍼 파일 생성

`jetti new --proto <file-path>/<file-name>`을 통해 프로토버퍼 파일을 생성할 수 있습니다.

제티의 구조에서는 `model` 폴더를 데이터 전송 객체를 위한 폴더로 사용합니다.

```bash
jetti new --proto model/user/user
```

위 명령어를 통해 `model/user/user.proto` 파일이 생성됩니다.  
`user.proto` 파일은 다음과 같은 내용을 가집니다.

```protobuf
syntax = "proto3";

package model/user;

option go_package = "<module-name>/model/user";
```

#### 실행 가능한 패키지 생성

`jetti new --cmd <package-name>`을 통해 실행 가능한 패키지를 생성할 수 있습니다.

```bash
jetti new --cmd prac
```

위 명령어를 통해 `cmd/prac` 폴더와 `cmd/prac/main.go` 파일이 생성됩니다.

```bash
package main

import "fmt"

func main() {
   fmt.Println("Hello, world!")
}
```

생성하면 `main.go` 파일은 위와같이 작성되어 있으며, 해당 패키지는 `jetti run prac` 명령어를 통해 실행할 수 있습니다.

### 패키지 실행

`jetti run <package-name>`을 통해 `cmd` 폴더 내의 패키지를 실행할 수 있습니다.

```bash
jetti run prac

Hello, world!
```

위 명령어를 통해 `cmd/prac` 패키지가 실행됩니다.

#### 매개변수를 동반한 패키지 실행

`jetti run <package-name> "<args> ..."`을 통해 매개변수를 동반한 패키지를 실행할 수 있습니다.

우선 `prac` 패키지 내의 `main.go`를 다음과같이 수정하겠습니다.

```go
package main

import (
	"fmt"
	"os"
)

func mainI() {
	fmt.Println(os.Args)
}
```

그리고 다음 명령어처럼 매개변수를 넘겨주면 `os.Args`로 값이 넘어간걸 확인할 수 있습니다.

```bash
jetti run prac a b c

[C:\Users\snowm\AppData\Local\Temp\go-build870924501\b001\exe\prac.exe a b c]
```

### 패키지 정보 보기

제티는 `show` 커맨드를 통해 다양한 패키지 정보를 확인할 수 있도록 제공할 수 있습니다.

#### 패키지 임포트 다이어그램 생성

`jetti show --imports`를 사용하면 패키지 임포트 다이어그램을 생성할 수 있습니다.

```bash
jetti show --imports
```

위 명령어를 통해 `imports.svg` 파일이 생성됩니다.  
D2 기반으로 작성된 다이어그램을 `svg` 파일로 생성합니다.

현재로서는 사용을 추천하지 않습니다.

### 인터페이스 인덱싱과 구현체 생성

제티는 빌트인 라이브러리와 현재 작업 중인 프로젝트에 대해 인터페이스를 인덱싱하고, 구현을 위한 구조체와 메서드 코드 스텁을 생성할 수 있습니다.

#### 인터페이스 인덱싱

`jetti index`를 통해 인터페이스를 인덱싱할 수 있습니다.

```bash
jetti index
```

위 명령어를 통해 `.jetti-cache` 내의 로컬 캐시에 인덱싱 정보를 저장합니다.

#### 인터페이스 구현체 생성

`jetti impl`을 통해 인터페이스 구현체를 생성할 수 있습니다.

```bash
jetti impl
```

위 명령어를 입력하면 인터페이스들을 선택할 수 있는 메뉴가 나타납니다.

```bash
? Select interfaces:  [Use arrows to move, space to select, <right> to all, <left> to none, type to filter]
> [ ]  cmd/api/testdata/src/issue21181/dep Interface
  [ ]  cmd/api/testdata/src/pkg/p1 Namer
  [ ]  cmd/api/testdata/src/pkg/p1 I
  [ ]  cmd/api/testdata/src/pkg/p1 Public
  [ ]  cmd/api/testdata/src/pkg/p1 Private
  [ ]  cmd/api/testdata/src/pkg/p1 Error
  [ ]  cmd/api/testdata/src/pkg/p2 Twoer
  [ ]  cmd/doc/testdata ExportedInterface

```

원하는 인터페이스를 방향키로 페이지를 넘겨 찾거나, 검색을 통해 찾은 후 `space` 키로 선택합니다.  
전부 선택했다면, `enter`(혹은 `return`)을 입력하여 다음으로 넘어갑니다.

예시에서는 `fmt.Printer`와 `fmt.GoPrinter`를 선택하여 `lib` 내부에 `printer` 패키지에 `Printer` 구조체를 생성하였습니다.

```bash
? Select interfaces: fmt Stringer, fmt GoStringer
? Package path: jetti/lib/printer
? Struct name: Printer
```

이때, 패키지 경로는 고 모듈의 이름을 따라야 합니다. 만약 그렇지 않을 경우에는 해당 폴더 위에 그 구조 그대로 생성되거나, 의도치 않은 버그가 발생할 수 있습니다.

생성한다면 다음 패키지와 파일 구조를 가지게 됩니다.

```bash
.
└── printer
    ├── Printer.GoString.jet.go
    ├── Printer.GoString.jet_test.go
    ├── Printer.String.jet.go
    ├── Printer.String.jet_test.go
    └── Printer.jet.go
```

```go
// Printer.jet.go
package printer

type Printer struct {
}
```

```go
// Printer.String.jet.go
package printer

func (p *Printer) String() string {
	// TODO: implement this method
	panic("not implemented")
}
```

```go
// Printer.String.jet_test.go
package printer

import "testing"

func TestPrinter_String(t *testing.T) {
}

func BenchmarkPrinter_String(b *testing.B) {
}

func ExamplePrinter_String() {
}

func FuzzPrinter_String(f *testing.F) {
}
```

### 주석을 통한 코드 생성

제티는 주석의 내용을 기반으로 코드를 생성할 수 있습니다.

모든 생성은 `jetti generate`를 실행하면 `lib`, `internal`, `model` 폴더 내부의 고와 관련 파일들에 대해 분석 후 필요한 코드를 생성합니다.

#### bean container

`jetti:bean <container-name> ...`을 주석에 넣음으로 의존성 주입을 위한 컨테이너를 생성할 수 있습니다.

이 컨테이너는 패키지 단위에 쓸 수 있게 `bean` 패키지를 별도로 생성하고, 내부에 `Container` 인터페이스와 `Default` 구조체를 생성하여 사용합니다.

먼저 다음과 같은 `Compressor` 코드가 있다고 가정합니다.

```go
package compressor

// jetti:bean Compressor
type Compressor interface {
	Compress([]byte) ([]byte, error)
	Decompress([]byte) ([]byte, error)
}
```

이 코드를 `jetti generate`를 통해 코드를 생성하면 다음과 같은 코드가 생성됩니다.

```go
// compressor.bean.jet.go
package compressor

import (
	"errors"
	"prac/gen/bean"
)

type CompressorBeanKey string

var errCompressorNotFound error = errors.New("compressor not found")

func PushCompressor(beanContainer bean.Container, value Compressor) {
	beanContainer.Set(CompressorBeanKey("Compressorkey"), value)
}

func GetCompressor(beanContainer bean.Container) (value Compressor, err error) {
	maybe, ok := beanContainer.Get(CompressorBeanKey("Compressorkey"))
	if !ok {
		return nil, errCompressorNotFound
	}
	value, ok = maybe.(Compressor)
	if !ok {
		return nil, errCompressorNotFound
	}
	return value, nil
}

func IsErrCompressorNotFound(err error) (ok bool) {
	return errors.Is(err, errCompressorNotFound)
}
```

이 코드를 활용하여, 엔트리 포인트에서 `Compressor`를 생성한 후에 `bean.Container`에 등록하고, 필요한 곳에서 `bean.Container`를 통해 `Compressor`를 가져와 사용할 수 있습니다.

위 예시처럼, 인터페이스일 때는 타입 그대로 활용합니다. 그리고 구조체일 경우엔 포인터를 붙입니다.

#### request scope data

`jetti:request <data-name> ...`을 주석에 넣음으로 요청 범위의 데이터를 생성할 수 있습니다.

이 데이터는 `context.valueCtx`를 통해 요청 범위의 데이터를 저장하고, 가져올 수 있습니다.

먼저 다음과 같은 `Claim` 및 `Claims`가 있다고 가정합니다.

```go
package claims

type Claim struct {
	Issuer    string `json:"iss,omitempty"`
	Subject   string `json:"sub,omitempty"`
	Audience  string `json:"aud,omitempty"`
	ExpiresAt int64  `json:"exp,omitempty"`
	NotBefore int64  `json:"nbf,omitempty"`
}

// jetti:request Claims
type Claims []Claim
```

이 코드를 `jetti generate`를 통해 코드를 생성하면 다음과 같은 코드가 생성됩니다.

```go
// claims.context.jet.go
package claims

import (
	"context"
	"errors"
)

type ClaimsContextKey struct{}

var errClaimsNotFound error = errors.New("claims not found")

func PushClaims(ctx context.Context, v *Claims) context.Context {
	return context.WithValue(ctx, ClaimsContextKey{}, v)
}

func GetClaims(ctx context.Context) (*Claims, bool) {
	v, ok := ctx.Value(ClaimsContextKey{}).(*Claims)
	return v, ok
}

func ErrClaimsNotFound() error {
	return errClaimsNotFound
}

func IsClaimsNotFoundErr(err error) bool {
	return errors.Is(err, errClaimsNotFound)
}
```

이 생성된 코드를 통해, 요청 범위 내에서 `context.valueCtx`를 사용할 때 키나 타입을 잘못 사용할 가능성을 현저히 줄일 수 있습니다.

#### 오브젝트 풀 생성

`jetti:pool sync:<pool-name> ...`이나 `jetti:pool chan:<pool-name> ...`으로 간단한 풀을 생성할 수 있습니다.

아까 사용한 `Claim` 코드를 아래와같이 고쳐보겠습니다.

```go
package claims

// jetti:pool sync:Infinite chan:Limited
type Claim struct {
	Issuer    string `json:"iss,omitempty"`
	Subject   string `json:"sub,omitempty"`
	Audience  string `json:"aud,omitempty"`
	ExpiresAt int64  `json:"exp,omitempty"`
	NotBefore int64  `json:"nbf,omitempty"`
}
```

위 코드는 `Infinite`라는 이름으로 `sync.Pool` 래퍼를 생성하고, `Limited`라는 이름으로 `chan`을 사용한 풀을 생성합니다.

```go
// infinite.pool.jet.go
package claims

import (
	"context"
	"errors"
	"runtime"
	"sync"
)

var errInfiniteCannotGet error = errors.New("cannot get infinite")

type InfinitePool struct {
	pool *sync.Pool
}

func (i *InfinitePool) Get() (*Claim, error) {
	v := i.pool.Get()
	if v == nil {
		return nil, errInfiniteCannotGet
	}
	return v.(*Claim), nil
}

func (i *InfinitePool) GetWithFinalizer() (*Claim, error) {
	v := i.pool.Get()
	if v == nil {
		return nil, errInfiniteCannotGet
	}
	runtime.SetFinalizer(v, func(v interface{}) {
		i.pool.Put(v)
	})
	return v.(*Claim), nil
}

func (i *InfinitePool) GetWithContext(ctx context.Context) (*Claim, error) {
	v := i.pool.Get()
	if v == nil {
		return nil, errInfiniteCannotGet
	}
	context.AfterFunc(ctx, func() {
		i.pool.Put(v)
	})
	return v.(*Claim), nil
}

func (i *InfinitePool) Put(v *Claim) {
	i.pool.Put(v)
}

func NewInfinitePool() InfinitePool {
	return InfinitePool{
		pool: &sync.Pool{
			New: func() interface{} {
				return new(Claim)
			},
		},
	}
}

func IsInfiniteCannotGetErr(err error) bool {
	return errors.Is(err, errInfiniteCannotGet)
}
```

```go
// limited.pool.jet.go
package claims

import (
	"context"
	"runtime"
	"time"
)

type LimitedPool struct {
	pool    chan *Claim
	timeout time.Duration
}

func (l *LimitedPool) Get() *Claim {
	after := time.After(l.timeout)
	select {
	case v := <-l.pool:
		return v
	case <-after:
		return new(Claim)
	}
}

func (l *LimitedPool) GetWithFinalizer() *Claim {
	after := time.After(l.timeout)
	resp := (*Claim)(nil)
	select {
	case v := <-l.pool:
		resp = v
	case <-after:
		resp = new(Claim)
	}
	runtime.SetFinalizer(resp, func(v interface{}) {
		l.pool <- v.(*Claim)
	})
	return resp
}

func (l *LimitedPool) GetWithContext(ctx context.Context) *Claim {
	after := time.After(l.timeout)
	resp := (*Claim)(nil)
	select {
	case v := <-l.pool:
		resp = v
	case <-after:
		resp = new(Claim)
	}
	context.AfterFunc(ctx, func() {
		l.Put(resp)
	})
	return resp
}

func (l *LimitedPool) Put(v *Claim) {
	select {
	case l.pool <- v:
	default:
	}
}

func NewLimitedPool(size int, timeout time.Duration) LimitedPool {
	pool := make(chan *Claim, size)
	return LimitedPool{
		pool:    pool,
		timeout: timeout,
	}
}
```

각 생성된 코드를 각각 다음 장점을 취할 수 있습니다.

1. sync
   1. 타입 안정성을 유지할 수 있습니다.
2. chan
   1. 풀링되는 오브젝트의 수를 제한할 수 있습니다. 단 생성 수는 제한할 수 없습니다.

공통 장점은 `GetWithFinalizer`와 `GetWithContext`를 통해 오브젝트를 사용한 후에 자동으로 풀에 반환할 수 있습니다.

#### optional 래퍼 생성

`jetti:optional`을 구조체나 인터페이스, 타입 별칭 위에 씀으로, 옵셔널 타입 래퍼를 만들 수 있습니다.

위의 `Claim`과 `Claims`를 다음과같이 다시 수정해보겠습니다.

```go
package claims

// jetti:pool sync:Infinite chan:Limited
// jetti:optional
type Claim struct {
	Issuer    string `json:"iss,omitempty"`
	Subject   string `json:"sub,omitempty"`
	Audience  string `json:"aud,omitempty"`
	ExpiresAt int64  `json:"exp,omitempty"`
	NotBefore int64  `json:"nbf,omitempty"`
}

// jetti:request Claims
// jetti:optional
type Claims []Claim
```

각각 `Claim`과 `Claims`에 `jetti:optional`을 추가하였습니다.  
이렇게 작성하면 두 타입의 옵셔널 타입 래퍼를 생성합니다만, `Claims`의 옵셔널 래퍼는 패키지 이름과 동일하기 때문에, 몇몇 함수 이름이 간략화되어 생성됩니다.

```go
// claim.option.jet.go
package claims

type OptionalClaim struct {
	value *Claim
	valid bool
}

func (o *OptionalClaim) Unwrap() *Claim {
	if !o.valid {
		panic("unwrap a none value")
	}
	return o.value
}

func (o *OptionalClaim) IsSome() bool {
	return o.valid
}

func (o *OptionalClaim) IsNone() bool {
	return !o.valid
}

func (o *OptionalClaim) UnwrapOr(defaultValue *Claim) *Claim {
	if !o.valid {
		return defaultValue
	}
	return o.value
}

func SomeClaim(value *Claim) OptionalClaim {
	return OptionalClaim{
		value: value,
		valid: true,
	}
}

func NoneClaim() OptionalClaim {
	return OptionalClaim{
		valid: false,
	}
}
```

`Claim`의 경우엔 생성자가 `SomeClaim`과 `NoneClaim`입니다.  
어떤 타입의 `Some`과 `None`인지 확인하기 위해, 이렇게 이름을 생성합니다.

```go
package claims

type OptionalClaims struct {
	value *Claims
	valid bool
}

func (o *OptionalClaims) Unwrap() *Claims {
	if !o.valid {
		panic("unwrap a none value")
	}
	return o.value
}

func (o *OptionalClaims) IsSome() bool {
	return o.valid
}

func (o *OptionalClaims) IsNone() bool {
	return !o.valid
}

func (o *OptionalClaims) UnwrapOr(defaultValue *Claims) *Claims {
	if !o.valid {
		return defaultValue
	}
	return o.value
}

func Some(value *Claims) OptionalClaims {
	return OptionalClaims{
		value: value,
		valid: true,
	}
}

func None() OptionalClaims {
	return OptionalClaims{
		valid: false,
	}
}
```

`Claims`의 생성자는 `Some`과 `None`입니다.  
이는 패키지 이름과 동일하기 때문에, 생성할 때 패키지 이름에 해당하는 부분은 생략됩니다.

#### getter 생성

`jetti:getter`를 구조체에 사용하여, 각 필드에 대한 `getter`를 생성할 수 있습니다.  
당연히 많은 고퍼 분들이 getter를 싫어하시는 걸 알고 있습니다만, 저는 일부분에 대해서 충분히 효율적이고 좋은 방식이라 생각합니다.

먼저 위에 사용했던 `claims` 패키지에 다음 `errors.go` 파일을 생성하겠습니다.

```go
package claims

// jetti:getter
type InvalidTokenError struct {
	token string
	err   error
}
```

이 코드를 생성하게 되면 다음 파일과 코드가 나옵니다.

```go
// claims.InvalidTokenError.jet.go
package claims

func (I *InvalidTokenError) GetToken() string {
	return I.token
}

func (I *InvalidTokenError) GetErr() error {
	return I.err
}
```

```go
// gen/errface/InvalidTokenError.errface.jet.go
package errface

type GetTokenOfClaimsInvalidTokenError interface {
	GetToken() string
}

type GetErrOfClaimsInvalidTokenError interface {
	GetErr() error
}

type GetClaimsInvalidTokenError interface {
	GetToken() string
	GetErr() error
}
```

`InvalidTokenError`에 대한 `getter`가 생성되었고, `errface` 패키지에 `InvalidTokenError`에 대한 `getter` 인터페이스가 생성되었습니다.

이렇게 하면 `errface`를 통해 상위 스코프에서 하위 스코프에 쓰인 패키지들을 참조하지 않고도 에러 정보를 가져올 수 있습니다.

### json/yaml 파일에서 고 구조체 생성

`jetti:generate`를 하면 `lib`, `model`, `internal` 내의 폴더와 파일 중 `*.json`과 `*.yaml`, `*.yml` 파일을 찾아서 고 구조체를 생성합니다.

이 기능은 `github.com/twpayne/go-jsonstruct/v2` 패키지를 통해 실행됩니다.

`jetti:generate`를 통해 다음과 같은 `*.json` 파일을 생성하면 다음과 같은 코드가 생성됩니다.

```json
{
  "name": "snowmerak",
  "age": 25,
  "hobbies": [
    "programming",
    "reading",
    "writing"
  ],
  "address": {
    "country": "South Korea",
    "city": "Seoul",
    "street": "Seoul"
  }
}
```

```go
package address

import (
	"io"
	"os"

	"github.com/goccy/go-json"
)

func AddressFromJSON(data []byte) (*Address, error) {
	v := new(Address)
	if err := json.Unmarshal(data, v); err != nil {
		return nil, err
	}
	return v, nil
}

func AddressFromFile(path string) (*Address, error) {
	f, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return AddressFromJSON(f)
}

func (address *Address) Marshal2JSON() ([]byte, error) {
	return json.Marshal(address)
}

func (address *Address) Encode2JSON(w io.Writer) error {
	return json.NewEncoder(w).Encode(address)
}

type Address struct {
	Address struct {
		City    string `json:"city"`
		Country string `json:"country"`
		Street  string `json:"street"`
	} `json:"address"`
	Age     int      `json:"age"`
	Hobbies []string `json:"hobbies"`
	Name    string   `json:"name"`
}
```

`yaml`(혹은 `yml`)에 대해서도 동일한 동작을 수행합니다.

자동으로 `goccy`님의 `go-json`과 `go-yaml`을 추가합니다.

### protobuf 코드 생성

`jetti:generate`를 호출할 때 `lib`, `internal`, `model` 내부에서 `*.proto`을 찾으면 `protoc`를 호출해서 `gen` 폴더 밑에 프로토버퍼 고 코드와 gRPC 코드를 생성합니다.

자동으로 프로토버퍼와 gRPC 관련 디펜던시를 추가합니다.

## 버전

이 글은 `v2.9.1` 기준으로 작성되었습니다.
