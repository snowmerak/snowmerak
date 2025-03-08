---
title: "간단한 로드밸런서와 HTTP 프록시 서버 구현"
date: 2022-03-11T06:45:51+09:00
tags: ["go", "http", "rate limiter", "circuit breaker", "load balancer", "reverse proxy"]
author: "snowmerak"
categories: ["Design"]
draft: false
---

## 레이트 리미터

### Limiter interface

```go
package limiter

type Limiter interface {
	TryTake([]byte) (bool, int)
}
```

레이트 리미터 객체가 구현해야할 인터페이스로 `Limiter` 인터페이스가 있습니다. 바이트 슬라이스를 받아서 해당 슬라이스를 기반으로 레이트 리밋을 계산하여 이번 요청이 사용 가능하면 `true`와 적절한 status code를 반환합니다.

### slide count struct

```go
type SlideCount struct {
	lock       *lock.Lock
	unit       int64
	maxConnPer float64
	prevTime   int64
	prevCount  int64
	curCount   int64
	nextTime   int64
}

func New(maxConnPer float64, unit time.Duration) limiter.Limiter {
	now := int64(time.Now().UnixNano())
	return &SlideCount{
		lock:       new(lock.Lock),
		unit:       int64(unit),
		maxConnPer: maxConnPer,
		prevTime:   now - int64(unit),
		prevCount:  0,
		curCount:   0,
		nextTime:   now + int64(unit),
	}
}
```

슬라이드 카운트 구조체는 sliding window count 방식의 레이트 리밋을 구현한 것입니다. 일반적인 케이스와 달리 제 주관적인 해석이 들어가 있으므로 코드가 좀 다릅니다.

일반적인 슬라이딩 윈도우 카운트와 동일한 아이디어를 차용했지만 저는 아예 명시적으로 단위 시간과 윈도우 크기를 정해놓고 좀 더 명확하게 구간을 움직이는 방식으로 코드를 작성했습니다.

그렇기에 이전 시간, 이전 단위 시간 당 연결 수, 현재 연결 수, 다음 시간을 의미하는 구조체 멤버가 존재합니다.

최대 연결 수(maxConnPer)는 단위 시간 당 최대 허용 연결 수입니다.

#### TryTake

```go
func (s *SlideCount) TryTake(_ []byte) (bool, int) {
	s.lock.Lock()
	defer s.lock.Unlock()

	now := int64(time.Now().UnixNano())

	if now < s.prevTime {
		return false, 0
	}

	for now > s.nextTime {
		s.prevTime = s.nextTime - s.unit
		s.prevCount = s.curCount
		s.curCount = 0
		s.nextTime = s.nextTime + s.unit
	}

	req := float64(s.prevCount)*float64(-now+s.prevTime+2*s.unit)/float64(s.unit) + float64(s.curCount+1)
	if req > s.maxConnPer {
		return false, 0
	}

	s.curCount++

	return true, 0
}
```

슬라이딩 윈도우 카운트 방식에선 바이트 슬라이스를 받을 필요가 없기 때문에 언더바를 이용하여 매개변수를 처리하였습니다.

구조체 멤버를 많이 생성해 놓았기 때문에 코드는 비교적 간결한 편이라고 생각합니다. 먼저 현재 시간을 구한 후 매우 과거인 경우(`now < s.prevTime`)인 경우 잘못된 요청으로 처리하고 `false`를 반환합니다.

그리고 단위 시간보다 훨씬 많이 기준 시간을 벗어났을 경우 지속적으로 갱신시켜주어 슬라이딩 윈도우의 위치를 맞춰줍니다.

마지막으로 이전 시간에서 일정 비율과 현재 연결 누적 수를 계산하여 최대 연결 수를 초과하였는지 확인하고 결과를 반환합니다.

### AccessControlCount

```go
type AccessControlCount struct {
	lock       *lock.Lock
	list       map[string]limiter.Limiter
	maxConnPer float64
	unit       time.Duration
}

func New(maxConnPer float64, unit time.Duration) limiter.Limiter {
	return &AccessControlCount{
		lock:       new(lock.Lock),
		list:       nil,
		maxConnPer: maxConnPer,
		unit:       unit,
	}
}
```

이 구조체는 슬라이딩 윈도우를 확장하여 만든 각 클라이언트 별 레이트 리미터입니다.

#### TryTake

```go
func (acc *AccessControlCount) TryTake(key []byte) (bool, int) {
	acc.lock.Lock()
	defer acc.lock.Unlock()

	if acc.list == nil {
		acc.list = make(map[string]limiter.Limiter)
	}

	slide, ok := acc.list[string(key)]
	if !ok {
		slide = slide_count.New(acc.maxConnPer, acc.unit)
		acc.list[string(key)] = slide
	}

	return slide.TryTake(nil)
}
```

매개변수의 바이트 슬라이스를 가지고 맵에서 특정 레이트 리미터를 꺼내와서 연산한 후 결과를 반환합니다. 

## 로드 밸런서

### balancer interface

```go
package balancer

type Balancer interface {
	Add(string) error
	Sub(string) error
	Get(string) (string, error)
	Restore(string) error
}
```

`balancer` 인터페이스는 대상 값을 추가, 삭제하고 적절한 로직에 따라 값을 받고 돌려주는 메서드를 구현하도록 합니다.

### least balancer

```go
package least

import (
	"math"

	"github.com/diy-cloud/virtual-gate/balancer"
	"github.com/diy-cloud/virtual-gate/lock"
)

type Least struct {
	candidates map[string]int64
	l          *lock.Lock
}

func New() balancer.Balancer {
	return &Least{
		candidates: make(map[string]int64),
		l:          new(lock.Lock),
	}
}
```

`least` 패키지는 최소 연결 방식 로드밸런서를 모방합니다. 후보군을 맵에 저장하여 가지고 있습니다.

```go
func (l *Least) Get(_ string) (string, error) {
	l.l.Lock()
	defer l.l.Unlock()

	min := int64(math.MaxInt64)
	target := ""
	for k, v := range l.candidates {
		if v < min {
			target = k
			min = v
		}
	}

	if target == "" {
		return "", balancer.ErrorAnythingNotExist()
	}

	l.candidates[target]++
	return target, nil
}
```

최소 연결 방식에 따라 맵을 순회하며 가장 적은 연결 수를 가진 후보를 선택하여 반환합니다.

```go
func (l *Least) Restore(target string) error {
	l.l.Lock()
	defer l.l.Unlock()

	if _, ok := l.candidates[target]; !ok {
		return balancer.ErrorValueIsNotExist()
	}

	l.candidates[target]--
	return nil
}
```

최소 연결 방식은 연결 수를 저장하고 있어야 하기에 모든 작업이 끝날 경우 `Restore` 메서드를 호출하여 연결 수를 줄여주어야합니다.

### hash balancer

```go
package hashed

import (
	"hash"

	"github.com/diy-cloud/virtual-gate/balancer"
	"github.com/diy-cloud/virtual-gate/lock"
)

type Hashed struct {
	candidates []string
	hasher     hash.Hash64
	index      int
	l          *lock.Lock
}

func New(hasher hash.Hash64) balancer.Balancer {
	return &Hashed{
		candidates: make([]string, 0, 8),
		hasher:     hasher,
		l:          new(lock.Lock),
	}
}
```

`hashed` 패키지는 사용자의 정보를 해싱하여 나온 값을 기반으로 후보군에서 후보를 선택하는 방식입니다. 그래서 `hasher` 멤버를 가지며 후보군을 문자열 슬라이스로 가집니다.

```go
func (h *Hashed) Get(id string) (string, error) {
	h.l.Lock()
	defer h.l.Unlock()

	h.hasher.Reset()
	h.hasher.Write([]byte(id))
	hashedIndex := int(h.hasher.Sum64() % uint64(len(h.candidates)))
	count := 0
	for {
		count++
		if count >= len(h.candidates) {
			return "", balancer.ErrorNoAvaliableTarget()
		}
		if hashedIndex >= len(h.candidates) {
			hashedIndex = 0
		}
		candidate := h.candidates[hashedIndex]
		if candidate != "" {
			return candidate, nil
		}
		hashedIndex = hashedIndex + 1
	}
}
```

후보군에서 후보를 선택하는 방식은 앞서 작성했던 대로 사용자 정보를 해싱하여 인덱스를 구한 후 유효한 후보 정보가 나올 때까지 반복합니다. 만약 너무 오래동안 유효한 후보가 나타나지 않으면 에러를 반환합니다.

```go
func (h *Hashed) Restore(_ string) error {
	return nil
}
```

`Restore` 메서드는 해시 로드 밸런서에서는 아무 역할도 하지 않습니다.

## 차단기

### breaker interface

```go
package breaker

type Breaker interface {
	BreakDown(target string) error
	Restore(target string) error
	IsBrokeDown(target string) bool
}
```

`Breaker` 인터페이스는 대상이 고장났는지, 고쳐졌는지, 고장난 상태인지를 정할 수 있는 메서드를 제공합니다.

### count breaker

```go
package count_breaker

import (
	"math/rand"

	"github.com/diy-cloud/virtual-gate/breaker"
	"github.com/diy-cloud/virtual-gate/lock"
)

type CountBreaker struct {
	cache       map[string]int
	maxCount    int
	minimumRate float64
	l           *lock.Lock
}

func New(maxCount int, minimumRate float64) breaker.Breaker {
	return &CountBreaker{
		cache:       make(map[string]int),
		maxCount:    maxCount,
		minimumRate: minimumRate,
		l:           new(lock.Lock),
	}
}
```

`CountBreaker`는 카운트 기반 차단기입니다. 카운트의 최대 한도를 정할 수 있고 최소한의 연결 시도를 보장할 값을 설정할 수 있습니다. 

```go
func (c *CountBreaker) BreakDown(target string) error {
	c.l.Lock()
	defer c.l.Unlock()
	if c.cache[target] < c.maxCount {
		c.cache[target] += 1
	}
	return nil
}

func (c *CountBreaker) Restore(target string) error {
	c.l.Lock()
	defer c.l.Unlock()
	if c.cache[target] > 0 {
		c.cache[target] -= 1
	}
	return nil
}
```

`BreakDown`과 `Restore` 메서드를 통해 카운트를 늘리고 줄일 수 있습니다.

```go
func (c *CountBreaker) IsBrokeDown(target string) bool {
	c.l.Lock()
	defer c.l.Unlock()
	fMaxCount := float64(c.maxCount)
	fTarget := float64(c.cache[target])
	if fTarget >= fMaxCount {
		fTarget = fMaxCount
	}
	maxRate := ((fMaxCount-fTarget)/fMaxCount)*(100-c.minimumRate) + c.minimumRate
	rnd := rand.Float64() * 100
	return rnd >= maxRate
}
```

카운트가 최대 수를 넘어갈리 없지만 넘어 갔을 때 최대 값으로 한정 짓습니다. `maxRate` 값을 구하는 식을 통해 카운트에 비례하여 고장 났음을 반환합니다. 최소 연결 시도를 보장하기 위한 보정 값이 추가되어 있어 미리 설정한 최소값은 깔고 계산합니다.

## 프록시

### proxy interface

```go
package proxy

import (
	"github.com/diy-cloud/virtual-gate/balancer"
	"github.com/diy-cloud/virtual-gate/breaker"
	"github.com/diy-cloud/virtual-gate/limiter"
)

type Proxy interface {
	Serve(address string, limiter limiter.Limiter, acl limiter.Limiter, breaker breaker.Breaker, balancer balancer.Balancer) error
}
```

`Proxy` 인터페이스는 주소와 레이트 리미터, 또 레이트 리미터, 차단기, 로드 밸런서를 받아서 서버를 실행하는 `Serve` 메서드가 정의되어 있습니다.

### http_proxy

```go
package http_proxy

type HttpProxy struct {
	proxyCache map[string]*httputil.ReverseProxy
	l          *lock.Lock
}

func NewHttp() *HttpProxy {
	return &HttpProxy{
		proxyCache: make(map[string]*httputil.ReverseProxy),
		l:          new(lock.Lock),
	}
}
```

`HttpProxy` 객체는 `httputil` 패키지의 리버스 프록시 객체를 사용합니다. 미리 연결했던 업스트림서버에 대한 리버스 프록시 인스턴스를 저장하고 있다가 재요청이 있을 경우 가져와서 사용합니다.

```go
func (hp *HttpProxy) ServeHTTP(name string, w http.ResponseWriter, r *http.Request) {
	var upstreamServer *httputil.ReverseProxy
	hp.l.Lock()
	if l, ok := hp.proxyCache[name]; ok {
		hp.proxyCache[name] = l
	}
	if upstreamServer == nil {
		url, err := url.Parse(name)
		if err != nil {
			log.Println(err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		upstreamServer = httputil.NewSingleHostReverseProxy(url)
	}
	hp.l.Unlock()

	upstreamServer.ServeHTTP(w, r)

	hp.l.Lock()
	if _, ok := hp.proxyCache[name]; !ok {
		hp.proxyCache[name] = upstreamServer
	}
	hp.l.Unlock()
}
```

`ServeHTTP` 메서드는 위에 작성된 것처럼 미리 연결된 리버스 프록시 인스턴스가 있는 지 체크하고 있다면 그걸 사용하고 없다면 새로운 인스턴스는 만들어서 요청하는 동작을 합니다.

```go
func (hp *HttpProxy) Serve(address string, limiter limiter.Limiter, acc limiter.Limiter, breaker breaker.Breaker, balancer balancer.Balancer) error {
	handler := func(w http.ResponseWriter, r *http.Request) {
		remote := []byte(r.RemoteAddr)

		wr := NewResponse()

		if b, code := limiter.TryTake(remote); !b {
			log.Println("HttpProxy.Serve: limiter.TryTake: false from", r.RemoteAddr)
			w.WriteHeader(code)
			return
		}

		if b, code := acc.TryTake(remote); !b {
			log.Println("HttpProxy.Serve: acl.TryTake: false from", r.RemoteAddr)
			w.WriteHeader(code)
			return
		}

		for count := 0; count < 10; count++ {
			upstreamAddress, err := balancer.Get(r.RemoteAddr)
			if err != nil {
				log.Println("HttpProxy.Serve: balancer.Get:", err, "from", r.RemoteAddr)
				w.Write([]byte(err.Error()))
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			defer balancer.Restore(upstreamAddress)

			if ok := breaker.IsBrokeDown(upstreamAddress); ok {
				log.Println("HttpProxy.Serve: breaker.IsBrokeDown: true from", r.RemoteAddr, "to", upstreamAddress)
				continue
			}

			hp.ServeHTTP(upstreamAddress, wr, r)

			if _, ok := statusCodeSet[wr.StatusCode]; ok {
				log.Println("HttpProxy.Serve: breakDown: true from", r.RemoteAddr, "to", upstreamAddress)
				breaker.BreakDown(upstreamAddress)
				continue
			}

			breaker.Restore(upstreamAddress)

			if _, ok := statusCodeSet[wr.StatusCode]; !ok {
				w.Write(wr.Body)
				w.WriteHeader(wr.StatusCode)
				break
			}
		}
	}
	server := http.Server{
		Addr:    address,
		Handler: http.HandlerFunc(handler),
	}
	return server.ListenAndServe()
}
```

`Serve` 메서드는 간단한 핸들러를 기반으로 동작합니다. 해당 핸들러는 레이트 리미터를 통해 요청을 처리할 수 있는 여유가 있는지 확인합니다. `acc` 객체를 통해 개별 클라이언트 당 요청을 처리할 수 있는 여유가 있는지 확인합니다.

로드 밸런서를 호출하여 적절한 업스트림서버를 받고 브레이커 객체를 통해 해당 업스트림서버가 정상적인지 확인합니다. 만약 아니라면 반복문을 다시 반복하여 밸런서에서 새로운 업스트림서버를 받아옵니다. 

성공적으로 동작할 경우 브레이커 객체의 `Restore` 메서드를 호출하고 요청을 끝냅니다.

## main.go

```go
package main

import (
	"time"

	"github.com/diy-cloud/virtual-gate/balancer/least"
	"github.com/diy-cloud/virtual-gate/breaker/count_breaker"
	"github.com/diy-cloud/virtual-gate/limiter/slide_count"
	"github.com/diy-cloud/virtual-gate/limiter/slide_count/acc"
	"github.com/diy-cloud/virtual-gate/proxy/http_proxy"
)

func main() {
	limiter := slide_count.New(30000, time.Microsecond)
	acc := acc.New(60, time.Microsecond)
	breaker := count_breaker.New(200, 10)
	balancer := least.New()
	balancer.Add("http://127.0.0.1:8080")
	balancer.Add("http://127.0.0.1:8081")
	balancer.Add("http://127.0.0.1:8082")
	balancer.Add("http://127.0.0.1:8083")
	balancer.Add("http://127.0.0.1:8084")
	balancer.Add("http://127.0.0.1:8085")
	balancer.Add("http://127.0.0.1:8086")
	balancer.Add("http://127.0.0.1:8087")
	balancer.Add("http://127.0.0.1:8088")
	balancer.Add("http://127.0.0.1:8089")
	proxy := http_proxy.NewHttp()

	if err := proxy.Serve("0.0.0.0:9999", limiter, acc, breaker, balancer); err != nil {
		panic(err)
	}
}
```

마이크로세컨드 당 30000회의 요청을 수락하고 사용자 별로 마이크로세컨드 당 60회의 요청을 수락하는 레이트 리미터를 생성하였습니다. 브레이커는 최대 200회의 누적 실패 수를 기록하고 10%의 최소 연결 시도를 보장하는 인스턴스로 생성합니다. 밸런서는 최소 연결 방식이며 로컬 호스트 8080~8089까지 연결했습니다.

프록시는 HTTP 리버스 프록시로 로컬 호스트의 9999 포트에 연결하였습니다. 정상적으로 8080~8089 포트에 http 서버를 띄워놓았다면 9999 포트로 접속했을 때 돌아가며 요청을 처리하는 걸 확인할 수 있습니다.
