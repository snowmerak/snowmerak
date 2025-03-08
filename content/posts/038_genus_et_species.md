---
title: "대는 소를 포함한다"
date: 2024-10-03T21:40:46+09:00
tags: ["go", "redis", "structure", "project"]
author: "snowmerak"
categories: ["Design"]
draft: false
---

## ?

`대는 소를 포함한다`는 말은 법률상으로 상위 개념과 하위 개념이 존재할 경우, 상위 개념에 대한 법을 하위 개념에도 적용하는 것입니다. 쉽게 이야기하면, 법률적으로는 자전거가 자동차의 하위 개념이니 자동차에 적용하는 다양한 법을 자전거에도 같이 적용하는 것입니다. 하지만 제가 법률 전문가도 아니고, 법과 관련된 이야기를 하고 싶은 건 아닙니다.

## 소프트웨어 설계에서

### 범용은 전용을 포함한다

저희는 때때로 범용으로 무언가를 만들고, 전용으로 사용하는 방법을 취합니다. 대표적인 예로 postgres는 많은 데이터를 저장하고 쿼리할 수 있지만, 저희는 스키마를 한정해서 한정적인 데이터 형태를 저장하고 활용합니다. MongoDB같은 경우엔 그렇지 않다구요? 하지만 높은 확률로 로직이나 환경적으로 들어갈 자료, 해야할 쿼리는 정해져 있을 겁니다. 그게 정녕 비정형 JSON을 저장하기 위한 data lake라 할 지라도요. 그리고 그를 위한 별도 모듈이 존재할 것입니다.

제가 좋아하는 Redis나 NATS는 더 특수하게 만들 수 있습니다. 저는 프로젝트나 아키텍처를 설계할 때에 `어떤 데이터를 캐싱할 건지?`, `어떤 데이터를 시그널링할 건지?`, `어떤 데이터를 브로드캐스팅할 건지?` 같은 특수성을 가지고 범용적인 레디스와 나츠의 클라이언트를 제한합니다. 물론 이는 법률적 해석과는 어느정도 차이를 보이는 해석입니다. 

### 예를 들어,

고 언어에서 제가 자주 구성하는 대로 레디스 관련 패키지를 구성하면, `prac/lib/client/redis`에 레디스의 연결에 대한 정보를 작성할 것입니다.

```go
// prac/lib/client/redis/client.go
package redis

import (
	"context"
	"fmt"
	"github.com/redis/rueidis"
)

const namespace = "practice"

func WrapKey(key string) string {
	return namespace + ":" + key
}

type Config struct {
	Addr     []string `env:"ADDR"`
	Username string   `env:"USERNAME"`
	Password string   `env:"PASSWORD"`
}

func NewConfig() *Config {
	return &Config{
		Addr:     []string{"localhost:6379"},
		Username: "",
		Password: "",
	}
}

type Client struct {
	cli rueidis.Client
}

func New(ctx context.Context, cfg *Config) (*Client, error) {
	cli, err := rueidis.NewClient(rueidis.ClientOption{
		InitAddress: cfg.Addr,
		Username:    cfg.Username,
		Password:    cfg.Password,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create redis client: %w", err)
	}

	context.AfterFunc(ctx, func() {
		cli.Close()
	})

	return &Client{cli: cli}, nil
}

func (c *Client) Do(ctx context.Context, runnable func(ctx context.Context, cli rueidis.Client) error) error {
	if err := runnable(ctx, c.cli); err != nil {
		return fmt.Errorf("failed to execute redis command: %w", err)
	}

	return nil
}
```

일단 가장 단순하지만 필요한 형태로 레디스에 대한 `Config`와 `Client`를 구성합니다. 조금 특이한 거라면, `client`를 생성할 때 컨텍스트가 만료되는 시점에 같이 종료되도록 하는 사후 동작이 추가되어 있습니다. `rueidis`는 연결에도 많은 옵션을 줄 수 있고, 더 많은 사후 동작을 지정할 수 있지만, 지금은 이렇게만 작성하겠습니다. 

이제 JWT 토큰의 상세 데이터 및 차단 여부를 확인할 수 있는 하위 패키지를 작성합니다.

```go
// prac/lib/client/redis/tokencache/cache.go
package tokencache

import (
	"context"
	"errors"
	"fmt"
	"github.com/redis/rueidis"
	"prac/lib/client/redis"
	"strings"
	"time"
)

var namespace = redis.WrapKey("token_cache")

const (
	data    = "data"
	blocked = "blocked"

	defaultTokenDataCacheTTL  = 7 * 24 * time.Hour // 1 week
	defaultTokenBlockCacheTTL = 7 * 24 * time.Hour // 1 week
	defaultClientSideCacheTTL = 60 * 60            // 1 hour
)

func WrapKey(key ...string) string {
	return namespace + ":" + strings.Join(key, ":")
}

type TokenCache struct {
	cli *redis.Client
}

func New(_ context.Context, cli *redis.Client) *TokenCache {
	return &TokenCache{
		cli: cli,
	}
}

func (tc *TokenCache) GetTokenData(ctx context.Context, token string) (string, error) {
	key := WrapKey(data, token)
	value := ""
	if err := tc.cli.Do(ctx, func(ctx context.Context, cli rueidis.Client) error {
		v, err := cli.DoCache(ctx, cli.B().Get().Key(key).Cache(), defaultClientSideCacheTTL).ToString()
		if err != nil {
			return fmt.Errorf("failed to get token data: %w", err)
		}

		value = v

		return nil
	}); err != nil {
		return "", err
	}

	return value, nil
}

func (tc *TokenCache) SetTokenData(ctx context.Context, token, data string) error {
	key := WrapKey(data, token)
	if err := tc.cli.Do(ctx, func(ctx context.Context, cli rueidis.Client) error {
		if err := cli.Do(ctx, cli.B().Set().Key(key).Value(data).Ex(defaultTokenDataCacheTTL).Build()).Error(); err != nil {
			return fmt.Errorf("failed to set token data: %w", err)
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}

func (tc *TokenCache) DeleteTokenData(ctx context.Context, token string) error {
	key := WrapKey(data, token)
	if err := tc.cli.Do(ctx, func(ctx context.Context, cli rueidis.Client) error {
		if err := cli.Do(ctx, cli.B().Del().Key(key).Build()).Error(); err != nil {
			return fmt.Errorf("failed to delete token data: %w", err)
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}

func (tc *TokenCache) BlockToken(ctx context.Context, token string) error {
	key := WrapKey(blocked, token)
	if err := tc.cli.Do(ctx, func(ctx context.Context, cli rueidis.Client) error {
		if err := cli.Do(ctx, cli.B().Set().Key(key).Value("").Ex(defaultTokenBlockCacheTTL).Build()).Error(); err != nil {
			return fmt.Errorf("failed to block token: %w", err)
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}

func (tc *TokenCache) IsTokenBlocked(ctx context.Context, token string) (bool, error) {
	key := WrapKey(blocked, token)
	ok := true
	if err := tc.cli.Do(ctx, func(ctx context.Context, cli rueidis.Client) error {
		_, err := cli.DoCache(ctx, cli.B().Get().Key(key).Cache(), defaultClientSideCacheTTL).ToString()
		if err != nil {
			ok = false
			if errors.Is(err, rueidis.Nil) {
				return nil
			}
			return fmt.Errorf("failed to get token block status: %w", err)
		}

		return nil
	}); err != nil {
		return ok, err
	}

	return ok, nil
}

func (tc *TokenCache) UnblockToken(ctx context.Context, token string) error {
	key := WrapKey(blocked, token)
	if err := tc.cli.Do(ctx, func(ctx context.Context, cli rueidis.Client) error {
		if err := cli.Do(ctx, cli.B().Del().Key(key).Build()).Error(); err != nil {
			return fmt.Errorf("failed to unblock token: %w", err)
		}

		return nil
	}); err != nil {
		return err
	}

	return nil
}
```

코드가 좀 길지만, 결과적으로 외부에서 `tokencache` 패키지를 사용할 때 알아야 할 것은, 각 메서드와 거기에 `token`만 입력하면 해당 메서드의 이름 대로 동작할 것이라는 것입니다. 이렇게 작성함으로 저희는 언제나 `tokencache`를 사용할 때에 실수를 최소화할 수 있습니다. 거기에 더해, 저희는 모든 레디스에 타임아웃 정책을 추가하고 싶다면, `prac/lib/client/redis/client.go` 파일의 `Do` 메서드를 다음과 같이 수정할 수도 있습니다.

```go
func (c *Client) Do(ctx context.Context, runnable func(ctx context.Context, cli rueidis.Client) error) error {
    ctx, cancel := context.WithTimeout(ctx, time.Second)
    defer cancel()

	if err := runnable(ctx, c.cli); err != nil {
		return fmt.Errorf("failed to execute redis command: %w", err)
	}

	return nil
}
```

그러면 이 글에서 구현한 `tokencache` 뿐만 아니라, 모든 `*redis.Client`를 이용해 구현한 서브 패키지들은 1초 타임아웃의 영향을 받을 것입니다. 물론 모든 쿼리에 1초의 타임아웃을 적용하는 건 불합리할 수 있으므로, `WithShortTimeout`, `WithLongTimeout`같은 추가적인 메서드를 구현해도 좋아 보입니다. 이렇게 `rueidis` -> `redis` -> `tokencachde` 순으로 점점 범용에서 전용으로 제한해 가면서 구성할 수 있습니다.

### 그래서

이러한 범용에서 전용으로 진행되는 패키지 구조를 통해 저희는 로직을 한 곳에 모아 코드 중복을 방지하고, 각 함수가 특정 기능만을 담당하도록 하여 단일 책임 원칙을 준수하며, 명확한 인터페이스를 제공하여 사용 시 실수를 줄일 수 있습니다.
