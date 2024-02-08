---
title: "고 언어의 의존성 주입을 위한 Provider"
date: 2024-02-09T01:10:20+09:00
tag: ["go", "dependency injection", "dependency inversion"]
draft: false
---

## Provider

`Provider`는 제가 만들고 있는 고 언어에서 의존성 주입을 위한 컨테이너입니다.

### 정의

```go
type Provider struct {
	constructors map[reflect.Type]map[reflect.Value]struct{}
	container    map[reflect.Type]any
	lock         sync.RWMutex
}
```

`Provider`는 `constructors`와 `container`를 가지고 있습니다.
1. `constructors`는 생성자를 저장하는 맵입니다.
2. `container`는 실제로 생성된 인스턴스를 저장하는 맵입니다.

### 생성자 등록

```go
func (p *Provider) Register(constructFunction ...any) error {
	p.lock.Lock()
	defer p.lock.Unlock()
	for _, con := range constructFunction {
		if err := p.register(con); err != nil {
			return err
		}
	}
	return nil
}

func (p *Provider) register(constructFunction any) error {
	args, _, err := analyzeConstructor(constructFunction)
	if err != nil {
		return err
	}

	for _, arg := range args {
		if _, ok := p.constructors[arg]; !ok {
			p.constructors[arg] = make(map[reflect.Value]struct{})
		}
		p.constructors[arg][reflect.ValueOf(constructFunction)] = struct{}{}
	}

	return nil
}

func analyzeConstructor(constructFunction any) ([]reflect.Type, []reflect.Type, error) {
	if reflect.TypeOf(constructFunction).Kind() != reflect.Func {
		return nil, nil, ErrNotAFunction{}
	}

	constructor := reflect.ValueOf(constructFunction)
	var args []reflect.Type

	for i := 0; i < constructor.Type().NumIn(); i++ {
		args = append(args, constructor.Type().In(i))
	}

	var returns []reflect.Type

	for i := 0; i < constructor.Type().NumOut(); i++ {
		returns = append(returns, constructor.Type().Out(i))
	}

	return args, returns, nil
}
```

`Register` 메서드는 생성자를 등록하는 메서드입니다.  
`...any`로 가변인자를 받아서 여러개의 생성자를 등록할 수 있습니다.  
내부에 정의된 `register` 메서드를 호출해서 각 함수를 `constructors`에 저장합니다.

`register`는 내부에 다시 `analyzeConstructor`를 호출해서 생성자의 인자와 반환값을 분석합니다.

보면 알겠지만, 함수의 시그니처는 `func Constructure(p1 T1, p2 T2, ...) (r1 R1, r2, R2 ... , error)`로 되어있어야 합니다.

매개변수가 하나도 정의되어 있지 않다면, 동작하지 않습니다.

### 생성자 호출

```go
func getContextType() reflect.Type {
	return reflect.TypeOf((*context.Context)(nil)).Elem()
}

func (p *Provider) Construct(ctx context.Context) error {
	p.lock.Lock()
	defer p.lock.Unlock()

	p.container[getContextType()] = ctx
	count := 0
	for len(p.constructors) > 0 {
		for arg, constructors := range p.constructors {
		ConsLoop:
			for con := range constructors {
				args := make([]reflect.Value, con.Type().NumIn())
				for i := 0; i < con.Type().NumIn(); i++ {
					at := con.Type().In(i)
					v, ok := p.container[at]
					if !ok {
						continue ConsLoop
					}
					args[i] = reflect.ValueOf(v)
				}

				returns := con.Call(args)

				for _, ret := range returns {
					if ret.Type().Kind().String() == "error" {
						if !ret.IsNil() {
							return ret.Interface().(error)
						}
					}

					p.container[ret.Type()] = ret.Interface()
				}

				count++

				delete(p.constructors[arg], con)
			}

			if len(p.constructors[arg]) == 0 {
				delete(p.constructors, arg)
			}
		}

		if count == 0 {
			return ErrMaybeCyclicDependency{}
		}
	}

	return nil
}
```

`Construct` 메서드는 생성자를 호출하는 메서드입니다.

`constructors`에 저장된 생성자를 하나씩 호출하면서, 인자로 필요한 값이 `container`에 있는지 확인하고, 있다면 호출합니다.

반환값이 있을 경우, 타입을 검사하여 `container`에 저장합니다.

이 과정을 반복하면서, `constructors`에 저장된 생성자가 모두 호출되면 종료합니다.  
만약 이전 호출과 비교하여 호출된 생성자가 없다면, 순환 의존성이 있을 수 있으므로 에러를 반환합니다.

### 사용 예시

```go
func JustRun(provider *Provider, function any) error {
	provider.lock.RLock()
	defer provider.lock.RUnlock()

	args, rets, err := analyzeConstructor(function)
	if err != nil {
		return err
	}

	if len(rets) != 1 || rets[0].String() != "error" {
		return ErrInvalidFunctionReturn{}
	}

	reflectArgs := make([]reflect.Value, len(args))
	for i, arg := range args {
		v, ok := provider.container[arg]
		if !ok {
			return ErrNotProvided{arg}
		}
		reflectArgs[i] = reflect.ValueOf(v)
	}

	reflectReturns := reflect.ValueOf(function).Call(reflectArgs)

	if !reflectReturns[0].IsNil() {
		return reflectReturns[0].Interface().(error)
	}

	return nil
}
```

`JustRun`은 프로바이더에 존재하는 인스턴스를 사용하여 함수를 호출하는 메서드입니다.

`function`은 생성자와 비슷하게 `func Function(p1 T1, p2 T2, ...) (error)`로 되어있어야 합니다.  
`JustRun`은 `function`을 호출하고, 반환값이 에러라면 에러를 반환합니다.

### 마치며

이 라이브러리를 통해 쉽게 인스턴스를 생성하고 활용할 수 있게 되었으면 합니다.

한가지 아쉬운 점은 아직 로직이 효율적이지 않아, 앱 스타트가 느릴 수 있다는 점입니다.
