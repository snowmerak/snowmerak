---
title: "스마트폰 파괴 방법과 매개변수 덕타핑"
date: 2022-01-04T18:54:54+09:00
tags: ["go"]
draft: false
---

## 개요

인터페이스 비교로 에러를 처리하는 방식에 기반하여 인터페이스로 매개변수를 덕타이핑하는 건 어떨까 해서 한번 시도해봤습니다.

### 아이디어

아이디어는 쉽습니다. 베이스가 되는 인터페이스와 구조체를 작성합니다. 이후 필요에 따라 매개변수를 얻을 수 있는 새로운 인터페이스를 제공하고 해당 인터페이스에 대한 구조체를 작성합니다. 그렇다면 동일한 함수 원형에 여러가지 타입의 매개변수를 넘겨줄 수 있을 것입니다.

## 구현

스마트폰을 파괴하는 코드를 작성해보겠습니다.

### PhoneBreaker

```go
package phonebreaker

type PhoneBreakable interface {
	Break(PhoneBreakingTool) int
}

type PhoneBreakingTool interface {
	Hand() int
}
```

간단하게 `PhoneBreakable` 인터페이스로 휴대폰을 파괴할 수 있는 행위를 정의해 놓았습니다.  
그리고 가장 간단한 파괴 도구로 `Hand()`를 가지는 툴 인터페이스도 만들어 놓았습니다.

### IPhoneBreaker

```go
package iphonebreaker

import "prac/phonebreaker"

type IPhoneBreakingTool interface {
	Hammer() int
}

type IPhoneBreaker struct {
	Label string
}

func (i *IPhoneBreaker) Break(tool phonebreaker.PhoneBreakingTool) int {
	r := 100
	r -= tool.Hand()
	switch t := tool.(type) {
	case IPhoneBreakingTool:
		r -= t.Hammer()
	}
	return r
}

```

`IPhoneBreaker`는 `PhoneBreakable` 인터페이스를 구현합니다. 조금 다른 점이라면 아이폰 전용 파괴 도구인 망치를 사용할 수 있을 경우 망치의 데미지를 추가로 가할 수 있습니다.

### GalaxyBreaker

```go
package galaxybreaker

import "prac/phonebreaker"

type GalaxyBreakingTool interface {
	Axe() int
}

type GalaxyBreaker struct {
	Label string
}

func (g *GalaxyBreaker) Break(tool phonebreaker.PhoneBreakingTool) int {
	r := 100
	r -= tool.Hand()
	switch t := tool.(type) {
	case GalaxyBreakingTool:
		r -= t.Axe()
	}
	return r
}

```

`GalaxyPhoneBreaker`도 아이폰과 마찬가지로 휴대폰을 파괴할 수 있고 전용 도구인 도끼를 사용하면 추가 데미지를 줄 수 있습니다.

### LumiaBreaker

```go
package lumiabreaker

import "prac/phonebreaker"

type LumiaBreakingTool interface {
	Gun() int
}

type LumiaBreaker struct {
	Label string
}

func (l *LumiaBreaker) Break(tool phonebreaker.PhoneBreakingTool) int {
	r := 100
	r -= tool.Hand()
	switch t := tool.(type) {
	case LumiaBreakingTool:
		r -= t.Gun()
	}
	return r
}

```

`LumiaBreaker`도 아이폰, 갤럭시와 마찬가지로 휴대폰 파괴 가능 기술을 소지하고 있으며 루미아 파괴 전용 도구인 총을 사용하면 더 효과적으로 파괴할 수 있습니다.

## 시연

### 연장 준비

```go
package main

import (
	"fmt"
	"prac/phonebreaker"
	"prac/phonebreaker/galaxybreaker"
	"prac/phonebreaker/iphonebreaker"
	"prac/phonebreaker/lumiabreaker"
)

type HandPhoneBreakingTool struct {
	Label string
}

func (h *HandPhoneBreakingTool) Hand() int {
	return 10
}

type IPhoneBreakingTool struct {
	Label string
	*HandPhoneBreakingTool
}

func (i *IPhoneBreakingTool) Hammer() int {
	return 85
}

type GalaxyBreakingTool struct {
	Label string
	*HandPhoneBreakingTool
}

func (g *GalaxyBreakingTool) Axe() int {
	return 75
}

type LumiaBreakingTool struct {
	Label string
	*HandPhoneBreakingTool
}

func (l *LumiaBreakingTool) Gun() int {
	return 60
}
```

이제 각각의 도구를 구현합니다. 기본적으로 손을 이용한 파괴 데미지는 10이고 아이폰의 망치는 85, 갤럭시의 도끼는 75, 루미아의 총은 60의 데미지를 각각의 스마트폰에게만 줍니다.

### 파괴 시작

```go
func main() {
	breakers := []phonebreaker.PhoneBreakable{
		&iphonebreaker.IPhoneBreaker{Label: "iphone"},
		&galaxybreaker.GalaxyBreaker{Label: "galaxy"},
		&lumiabreaker.LumiaBreaker{Label: "lumia"},
	}

	tools := []phonebreaker.PhoneBreakingTool{
		&HandPhoneBreakingTool{Label: "hand breaking tool"},
		&IPhoneBreakingTool{Label: "iphone breaking tool"},
		&GalaxyBreakingTool{Label: "galaxy breaking tool"},
		&LumiaBreakingTool{Label: "lumia breaking tool"},
	}

	for _, breaker := range breakers {
		for _, tool := range tools {
			score := breaker.Break(tool)
			fmt.Println(breaker, tool, score)
		}
	}
}
```

각각 아이폰, 갤럭시, 루미아 파괴자를 준비합니다. 각 파괴자는 자신의 스마트폰을 파괴할 때마다 새로운 각 스마트폰이 주어질 것입니다. 그리고 각 기본, 아이폰, 갤럭시, 루미아 파괴 도구들을 준비합니다. 파괴자를 각 한번씩 도구를 돌아가며 써서 자신의 스마트폰을 파괴할 것입니다. 그 결과는 다음과 같습니다.

```bash
&{iphone} &{hand breaking tool} 90
&{iphone} &{iphone breaking tool <nil>} 5
&{iphone} &{galaxy breaking tool <nil>} 90
&{iphone} &{lumia breaking tool <nil>} 90
&{galaxy} &{hand breaking tool} 90
&{galaxy} &{iphone breaking tool <nil>} 90
&{galaxy} &{galaxy breaking tool <nil>} 15
&{galaxy} &{lumia breaking tool <nil>} 90
&{lumia} &{hand breaking tool} 90
&{lumia} &{iphone breaking tool <nil>} 90
&{lumia} &{galaxy breaking tool <nil>} 90
&{lumia} &{lumia breaking tool <nil>} 30
```

다 동일한 `break(phonebreaker.PhoneBreakingTool)`을 이용했지만 각 상황에 맞게 다르게 스마트폰을 파괴했습니다.  
이 방법을 이용하면 동일한 함수 시그니처를 활용해야하면서 다른 패러미터를 가져야할 때 유연하게 값을 전달할 수 있으며 인터페이스 타입 단언을 하는 과정을 통해 디폴트 패러미터도 흉내낼 수 있을 것입니다.

### 하지만

1.18beta1 기준으로, 아직은 parameter leakage가 발생할 확률이 높아서 힙 얼록이 될 것입니다.  
그리고 패러미터로 전달할 타입을 만드는데 드는 코드가 짧지 않기 때문에 더 귀찮을 수 있습니다.
