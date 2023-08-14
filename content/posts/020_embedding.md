---
title: "구조체 임베딩과 프로모션, 그리고 상속"
date: 2023-08-14T19:01:08+09:00
tags: ["go", "embedding", "promotion"]
draft: false
---

## 구조체 임베딩

구조체 임베딩은 구조체를 다른 구조체의 필드로 사용하는 것을 말합니다. 예를 들어 다음과 같은 구조체가 있다고 가정해봅시다.

```go
type Person struct {
    Name string
    Age int
}
```

그리고 이 구조체를 다른 구조체의 필드로 사용한다면 다음과 같이 사용할 수 있습니다.

```go
type Student struct {
    Person
    Grade int
}
```

그러면 마치 `Student` 구조체에 `Person` 구조체의 필드가 포함된 것처럼 사용할 수 있습니다.

```go
student := Student{
    Person: Person{
        Name: "snowmerak",
        Age: 20,
    },
    Grade: 3,
}

fmt.Println(student.Name) // snowmerak
fmt.Println(student.Age) // 20
fmt.Println(student.Grade) // 3
```

## 프로모션

위 내용에서 `Person` 구조체의 값을 `Student`에서 바로 쓸 수 있게 해주는 고 언어의 장치를 프로모션이라고 합니다.  
위 예시에서는 멤버만 다루었으나, 메서드도 다룰 수 있습니다.

프로모션은 임베딩 되는 여러 구조체가 동일한 이름의 필드나 메서드를 가질 경우에는 호출할 수 없습니다. 명확한 구분을 위해 직접 호출해야 합니다.

간단한 예시를 들어보겠습니다.

```go
type Person struct {
    Name string
    Age int
}

func (p *Person) Eat() {
	println("Person Eat")
}

func (p *Person) Sleep() {
	println("Person Sleep")
}

func (p *Person) Say() {
	println("Person Say")
}
```

간단한 `Person` 구조체입니다. 이 구조체는 `Name`과 `Age` 멤버가 있으며, `Eat`, `Sleep`, `Say` 메서드가 있습니다.

```go
package student

import "~/person"

type Student struct {
	person.Person
}

func (s *Student) Study() {
	println("Student Study")
}
```

그리고 간단한 `Student` 구조체입니다. 이 구조체는 `Person` 구조체를 임베딩하고 있습니다.  
그렇기에 `Student` 구조체는 `Person` 구조체의 멤버와 메서드를 사용할 수 있습니다.  
간단한 테스트 코드로 호출이 되는 지 확인할 수 있습니다.

```go
package student

import (
	"prac/lib/person"
	"testing"
)

func TestStudent(t *testing.T) {
	s := &Student{
		Person: person.Person{
			Name: "Tom",
			Age:  18,
		},
		Grade: 7,
	}
	s.Eat()
	s.Sleep()
	s.Say()
	s.Study()
}
```

```bash
=== RUN   TestStudent
Tom
18
Person Eat
Person Sleep
Person Say
Student Study
--- PASS: TestStudent (0.00s)
PASS
```

생성할 때는 비록 직접 `Person` 구조체를 참조해야하지만, 호출할 때는 그 무엇도 구분 없이 `Student`의 것처럼 사용할 수 있습니다.

### 오버라이딩

프로모션이 발생하지 않는 조건에는 임베딩 되는 구조체의 필드나 메서드의 이름 중, 임베딩 하는 구조체에 이미 그 이름이 존재할 경우에 프로모션이 발생하지 않는 것도 있습니다.

그래서 오버라이딩과 비슷한 기능을 만들 수 있죠.

```go
func (s *Student) Eat() {
	println("Student Eat")
}

func (s *Student) Sleep() {
	println("Student Sleep")
}

func (s *Student) Say() {
	println("Student Say")
}
```

`Student` 구조체에 위와같은 메서드들을 추가로 작성해보겠습니다.

그리고 테스트를 수행하면 결과가 달라져 있을 것입니다.

```bash
=== RUN   TestStudent
Tom
18
Student Eat
Student Sleep
Student Say
Student Study
--- PASS: TestStudent (0.00s)
PASS
```

`Student` 구조체의 메서드가 호출되었습니다. 이는 프로모션이 발생하지 않았기 때문입니다.

### 부모 메서드 호출

그러면 `Person`의 메서드는 어떻게 호출할 수 있을까요?  
테스트 코드를 아래와 같이 수정해보겠습니다.

```go
func TestStudent(t *testing.T) {
	s := &Student{
		Person: person.Person{
			Name: "Tom",
			Age:  18,
		},
		Grade: 7,
	}
	println(s.Name)
	println(s.Age)
	s.Person.Eat()
	s.Person.Sleep()
	s.Person.Say()
	s.Study()
}
```

그러면 다시 `Student`의 것이 아닌 `Person`의 것이 호출되는 것을 확인할 수 있습니다.

```bash
=== RUN   TestStudent
Tom
18
Person Eat
Person Sleep
Person Say
Student Study
--- PASS: TestStudent (0.00s)
PASS
```

### 다이아몬드 문제

다이아몬드 문제는 다중 상속에서 발생하는 문제입니다.

근데 고 언어에서는 다중 상속을 지원하지 않습니다. 그래서 다이아몬드 문제가 발생하지 않습니다.  
라고 말하면 너무 이상하지 않나요? 왜 개념적으로 그렇게 될 수 없는 지 얘기해주지 않으니까요.

그럼 `Person`을 임베딩하는 `Korean` 구조체를 만들어보겠습니다.

```go
package korean

import "~/person"

type Korean struct {
	person.Person
	Address string
}

func (k *Korean) Eat() {
	println("냠냠")
}

func (k *Korean) Sleep() {
	println("쿨쿨")
}

func (k *Korean) Say() {
	println("안녕하세요")
}
```

그리고 한국에 사는 학생 구조체를 만들어보겠습니다.

```go
package kstudent

import (
	"~/korean"
	"~/student"
)

type KoreanStudent struct {
	korean.Korean
	student.Student
}
```

혹시 첫번째 프로모션이 발생하지 않는 조건을 기억하시나요?  
`Korean`과 `Student` 둘다 `Name`과 `Age`라는 필드를 가지고 있습니다.  
그럼 어느 쪽의 필드를 사용할 지 모호해집니다. 그래서 프로모션이 발생하지 않습니다.  
이게 임베딩에서의 다이아몬드 문제라고 생각합니다.

```go
func TestKoreanStudent(t *testing.T) {
	ks := &KoreanStudent{}
	println(ks.Name)
	println(ks.Age)
	ks.Eat()
	ks.Sleep()
	ks.Say()
	ks.Study()
}
```

이런 테스트 코드를 작성하면 `Eat`, `Sleep`, `Say` 메서드는 명확하지 않은 메서드를 사용하려고 했기에 컴파일 에러가 발생합니다.

```bash
.\ks_test.go:7:13: ambiguous selector ks.Name
.\ks_test.go:8:13: ambiguous selector ks.Age
.\ks_test.go:9:5: ambiguous selector ks.Eat
.\ks_test.go:10:5: ambiguous selector ks.Sleep
.\ks_test.go:11:5: ambiguous selector ks.Say
```

그래서 이런 경우에는 `KoreanStudent`의 코드를 수정해야합니다.

```go
type KoreanStudent struct {
	korean.Korean
	student.Student
	Name string
	Age  int
}

func (ks *KoreanStudent) Eat() {
	ks.Korean.Eat()
}

func (ks *KoreanStudent) Sleep() {
	ks.Korean.Sleep()
}

func (ks *KoreanStudent) Say() {
	ks.Korean.Say()
}
```

아쉽게도 `KoreanStudent` 구조체에 `Korean`과 `Student` 구조체의 중복된 필드와 메서드를 모두 재정의해주어야 합니다.

그리고 위 테스트 코드를 다시 작성하고, 실행해보겠습니다.

```go
func TestKoreanStudent(t *testing.T) {
	ks := &KoreanStudent{
		Name: "snowmerak",
		Age:  20,
	}
	println(ks.Name)
	println(ks.Age)
	ks.Eat()
	ks.Sleep()
	ks.Say()
	ks.Study()
}
```

```bash
=== RUN   TestKoreanStudent
snowmerak
20
냠냠
쿨쿨
안녕하세요
Student Study
--- PASS: TestKoreanStudent (0.00s)
PASS
```

이제 의도한 대로 동작하는 것을 확인할 수 있습니다.

다행히 고는 해당하는 케이스의 코드가 작성되면 IDE가 알려주거나, 컴파일 에러를 발생시켜주기 때문에 쉽게 발견할 수 있습니다.
