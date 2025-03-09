---
title: "요청 수를 줄이고, 캐시 수용량은 늘리기"
date: 2025-03-09T00:14:15+09:00
tags: ["go", "redis", "valkey", "request", "singleflight"]
author: "snowmerak"
categories: ["Design"]
draft: false
---

## valkey?

여전히 valkey보다 redis가 더 익숙한 분들이 계실 겁니다. valkey는 Redis Inc.의 redis에 대한 라이센스 변경 및 독점적 지위 확보 시도에 대한 반발로 redis 7.2.4를 베이스로 추가 개발되고 있는 레디스 대체제입니다. 현재는 레디스보다도 먼저 8.0 버전을 출시하는 등 굉장히 활발하게 개발 및 유지보수 되고 있습니다.

당연한 이야기로 레디스의 포크인 만큼 레디스와 동일하게 다양한 곳에서 캐시로써 활용되고 있습니다. 이 글에서는 그 중 가장 보편적인 흐름 중 하나인 유저가 API 서버에 질의 후, API 서버는 캐시를 조회, 실패 시 RDB에서 조회하는 방식을 사용하는 패턴에서 효과적으로 밸키에 대한 읽기를 감소 시키는 방법을 소개하고자 합니다.

## CDN

가장 쉬운 접근 법은 CDN을 쓰는 겁니다. 내부적으로 어떻게 되어 있는 지는 담당 서비스 개발자가 아니라 알 수 없으나, 다양한 방법을 이용해 단 시간 내에 들어온 중복된 요청에 대해서는 뒤 API나 스토리지를 검색하지 않고, 캐시된 데이터를 요청자에게 반환할 겁니다.

우리 코드를 수정할 필요도 없고, 버튼 몇개 누르는 선에서 아마 가능할 테지만, 추가 비용이 많이 들 수 있다는 건 굉장한 단점입니다. 그럼 다음으로 소개할 두 기법으로 우리가 CDN처럼 요청을 필터링해서 부하를 줄여보도록 하겠습니다.

## Single-Flight

싱글플라이트는 간단하게 설명하면, 같은 결과가 나올 것으로 예상되는 동 시점에 발생한 다수의 요청에 대하여 한번의 처리만 수행하는 걸 의미합니다. 이런 경우를 가정해봅시다. 여러분들은 커뮤니티 서비스를 하나 개발했습니다. 해당 서비스에는 인기 게시글 랭킹을 실시간으로 제공해주고 있습니다. 동시 접속 유저가 적을 때는 모든 요청을 각각 조회해도 부하가 되지 않겠지만, 만약 동접이 매우 늘어나게 된다면 모든 요청에 대해 DB나 캐시를 조회하는 건 합리적이지 못할 겁니다.

이런 경우에, 어차피 1초 간격으로 들어온 요청들은 같은 내용의 인기 게시글 랭킹을 응답으로 받아갈 가능성이 높습니다. 그렇다면 첫 요청으로부터 1초 안에 들어온 모든 요청들은, 혹은 요청 처리에 어느정도 시간이 소요된다면 첫 요청으로부터 처리가 끝나기 전에 들어온 모든 요청들은 굳이 처리하지 않고, 하나의 응답을 공유하면 될 겁니다. 이러한 역할을 해주는 기능이 싱글플라이트입니다.

### 예제

먼저, 저희는 고 언어로 할테니 고 프로젝트를 만들어 줍니다.

```sh
go mod init practice
```

그리고, x 라이브러리로 분류되어 있는 `sync/singleflight`를 가져옵니다.

```sh
go get golang.org/x/sync/singleflight
```

하나의 500ms가 걸리는 작업을 시뮬레이트 하는 코드를 작성해보겠습니다.

```go
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGKILL)

	server := new(http.Server)
	server.Addr = ":8080"
	server.Handler = http.HandlerFunc(LongRequestHandler)

	go func() {
		log.Printf("Starting server on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil {
			log.Printf("Error starting server: %s", err)
		}
	}()

	<-sigChan

	log.Printf("Shutting down server...")

	if err := server.Shutdown(context.TODO()); err != nil {
		log.Printf("Error shutting down server: %s", err)
	}

	log.Printf("Server shutdown complete")
}

func LongRequestHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Received request from %s", r.RemoteAddr)
	// Simulate a long request
	result := SearchDB("query")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("Error encoding response: %s", err)
	}

	log.Printf("Request from %s complete", r.RemoteAddr)
}

func SearchDB(query string) []string {
	// Simulate a long database query
	time.Sleep(500 * time.Millisecond)
	return []string{"result1", "result2", "result3"}
}
```

이 코드는 어떤 라우트로 들어오든 간에 `LongRequestHandler`에 할당될 것이고, `SearchDB`라는 500ms 짜리 메서드를 실행할 겁니다. 그럼 모든 요청은 공평하게 최소 500ms 후에 받게되겠죠. 만약 단순 time sleep이 아니라 더 큰 무언가라면 서비스 운영에 문제가 되었을 겁니다. 너무 많은 read로 인해 write가 지연된다거나 하는 형식으로 실시간성을 지킬 수 없게 될 수도 있죠.

미리 추가한 싱글플라이트 패키지로 이 코드를 중복 요청을 줄여봅시다.

```go
var searchDBSingleFlightGroup = singleflight.Group{}

func SearchDB(query string) []string {
	response, err, shared := searchDBSingleFlightGroup.Do(query, func() (interface{}, error) {
		time.Sleep(500 * time.Millisecond)
		return []string{"result1", "result2", "result3"}, nil
	})
	if err != nil {
		log.Printf("Error searching DB: %s", err)
		return nil
	}

	log.Printf("is shared: %v", shared)

	return response.([]string)
}
```

> 여기서는 전역 변수로 활용하였으나, 실제로 작업할 때는 객체에 넣어서 쓰시는 편이 더 좋습니다.

`searchDBSingleFlightGroup`을 새로 만들어서, 하나의 싱글플라이트 그룹을 생성합니다. 그리고 `SearchDB` 메서드 내에서 각 쿼리에 따라 응답을 공유받도록 합니다. 이때, 반환된 `shared`를 통해 내 요청이 오리지널이 아니라는 걸 확인할 수 있습니다.

이 코드 흐름 대로 동작한다면, 아무리 많은 요청이 들어와서 DB에 대한 조회는 500ms 마다 딱 한번 하는 것에 그칠 겁니다. 이것만으로 충분히 많은 양의 요청 수를 줄일 수 있습니다. 하지만 저희가 조회하는 곳이 밸키인 만큼 저희는 한가지 더 효과적인 실제 요청 수 감소를 만들 수 있습니다.

## Server Assisted Client Side Cache

이론적인 부분은 제가 고수다 블로그에 쓴 [글](https://gosuda.org/ko/blog/posts/improving-responsiveness-with-redis-client-side-caching-zb711e502)을 참고해주세요.

해당 글에 거의 다 있는 얘기입니다. 밸키 또한 레디스의 포크인 만큼 server assisted client side cache 기능을 제공합니다. 간략하게 설명드리면, 해당 기능은 밸키에서 값이 갱신/삭제 되었을 시에 한번이라도 해당 키에 접근한 기록이 있는 클라이언트에게 "해당 키가 변경되었으니 로컬 캐시를 만료시켜"라는 메시지를 전송하여, 다음 조회부터 로컬 캐시가 아니라 밸키를 조회하게 만들고, 해당 값으로 로컬 캐시를 갱신하도록 도와줍니다.

그럼 `valkey-go` 라이브러리를 받습니다. 위 고수다 블로그 글의 `rueidis`를 포크한 것이 `valkey-go`입니다.

```sh
go get github.com/valkey-io/valkey-go
```

마찬가지로 밸키 클라이언트를 적용해줍니다.

```go
var valkeyClient, _ = valkey.NewClient(valkey.ClientOption{
	InitAddress: []string{"localhost:7001", "localhost:7002", "localhost:7003"},
})

func SearchDB(query string) []string {
	response, err, shared := searchDBSingleFlightGroup.Do(query, func() (interface{}, error) {
		resp, err := valkeyClient.DoCache(context.TODO(), valkeyClient.B().Lrange().Key("favorite_posts").Start(0).Stop(10).Cache(), 10*time.Second).AsStrSlice()
		if err != nil {
			log.Printf("Error caching response: %s", err)
			return []string{}, nil
		}

		return resp, nil
	})
	if err != nil {
		log.Printf("Error searching DB: %s", err)
		return nil
	}

	log.Printf("is shared: %v", shared)

	return response.([]string)
}
```

> 이번에도 편의상 전역변수를 사용했습니다. 작업할 때는 객체로 처리해주길 바랍니다.

해당 로직은 이제 밸키 클라이언트가 밸키에서 키 변경이 일어나지 않는다면, 최초 조회 이후 10초 동안은 로컬 캐시에서 데이터를 읽게 됩니다.

그러면 최선의 경우에서 싱글플라이트로 500ms 마다 한번 로컬 캐시를 읽고, 밸키에 대해서는 10초에 한번 요청하게 됩니다.

## 결론

이 글에서 API가 실제 데이터 소스에 접근하는 회수를 줄이는 방법에 대해 설계된 부분을 공유 드리고자 했습니다. 이 방식은 로직 복잡도가 조금 있을 수는 있지만, 효과 자체는 우수하다고 보고 있습니다. 예를 들어, API 게이트웨이를 운영한다면 뒤에 존재하는 각 서비스로의 실제 IO 요청 자체를 줄이는 것이 OS에 대한 부하 자체를 줄이는 효과를 불러일으켜 CPU와 메모리를 아끼는 효과 또한 가져올 수 있습니다.
