---
title: "PGO를 쉽게 하는 방법이 있을까?"
date: 2024-10-12T16:16:46+09:00
tags: ["go", "pgo", "minio", "s3"]
author: "snowmerak"
categories: ["Suggestions"]
draft: false
---

## 개요

> 왜 사람들은 PGO(Profile Guided Optimization)을 적극적으로 사용하지 않을까?

저는 이 의문을 예전부터 품고 있었습니다. 생각해보니 프로파일을 저장하고, 가져오는 어떠한 표준화된 프로토콜이 없다는 게 이유로 보였습니다. 사실 쓸 사람들은 어떻게든 쓰고 있겠지만, 저도 처음 PGO를 적용할 때에 어떻게 저장하고 가져와야 할지 고민을 좀 했었습니다. 그래서 이번 글에선 해당 내용에 대한 공유를 하겠습니다.

## 설계 및 구현

### 전형적인 읽는 사람 따로, 쓰는 사람 따로인 구조

PGO 특성 상, 프로파일을 주기적으로 생성하고 업로드하는 실제 서비스로 올라간 어플리케이션과, 해당 프로파일들을 받아서 하나로 합치고 빌드할 때 적용하는 빌드 어플리케이션이 있습니다. 두 과정이 철저하게 분리되어 있기에 동기적으로 사고할 필요가 없습니다. 그럼 가장 적합한 구조는 중간에 버퍼나 저장소를 두고 계속 데이터를 추가, 필요할 때 다운로드, 주기적으로 데이터를 삭제하는 과정만 있으면 됩니다.

그래서 해당 동작들을 모두 수행할 수 있는 `Storage` 인터페이스를 먼저 선언합니다.

```go
// Storage is an interface that defines the methods that a storage system for golang profiles for PGO can implement.
type Storage interface {
	// SaveProfile saves the profile data to the storage system.
	SaveProfile(ctx context.Context, createdAt time.Time, profile []byte) error
	// GetProfile retrieves the profile data from the storage system.
	GetProfile(ctx context.Context, createdAt time.Time) ([]byte, error)
	// GetProfiles retrieves the profile data from the storage system.
	GetProfiles(ctx context.Context, startedAt, endedAt time.Time) ([][]byte, error)
	// DeleteProfile deletes the profile data from the storage system.
	DeleteProfile(ctx context.Context, createdAt time.Time) error
	// DeleteProfiles deletes the profile data from the storage system.
	DeleteProfiles(ctx context.Context, startedAt, endedAt time.Time) error
}
```

1. SaveProfile은 프로파일을 저장합니다.
2. GetProfile과 GetProfiles는 프로파일을 가져옵니다.
3. DeleteProfile과 DeleteProfiles는 프로파일을 삭제합니다.

이제 필요에 따라, `Storage` 인터페이스를 구현하는 전략을 구현하고 적용하면 됩니다.  
저는 필요에 의해 `minio`(`S3`)와 `local-directory`를 구현해놓았습니다.

### 프로파일 생성 및 업로드는?

프로파일 생성과 업로드를 담당하기 위해 `Profiler`라는 구조체를 생성합니다.

```go
type Profiler struct {
	storage storage.Storage

	cancelFunc context.CancelFunc

	interval time.Duration
	duration time.Duration
}
```

프로파일러는 
1. 얼마의 간격(internal)을 가지고 프로파일을 수집할 것인지
2. 얼마나 많은 시간(duration) 동안 프로파일을 수집할 것인지
에 대한 정보가 필요합니다.

이를 바탕으로 다음과 같은 `Run` 메서드를 작성합니다.

```go
func (p *Profiler) Run(ctx context.Context) (<-chan error, error) {
	ctx, cancel := context.WithCancel(ctx)
	p.cancelFunc = cancel
	ticker := time.NewTicker(p.interval)

	done := ctx.Done()

	errCh := make(chan error, 32)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				go func() {
					now := time.Now()
					pf, err := collectCpuProfile(p.duration)
					if err != nil {
						errCh <- fmt.Errorf("failed to collect CPU profile: %w", err)
						return
					}

					if err := p.storage.SaveProfile(ctx, now, pf); err != nil {
						errCh <- fmt.Errorf("failed to save profile: %w", err)
						return
					}
				}()
			}
		}
	}()

	return errCh, nil
}
```

이 메서드는 실행할 때의 컨텍스트가 유지되는 동안 실행되며, CPU 프로파일을 주기적으로 수집해서 `Storage`에 업로드합니다.

그리고 `GetProfiles` 메서드를 구현합니다.

```go
func (p *Profiler) GetProfile(ctx context.Context, startedAt, endedAt time.Time) ([]byte, error) {
	rawProfiles, err := p.storage.GetProfiles(ctx, startedAt, endedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get profiles: %w", err)
	}

	profiles := make([]*profile.Profile, 0, len(rawProfiles))
	for _, rawProfile := range rawProfiles {
		pf, err := profile.ParseData(rawProfile)
		if err != nil {
			return nil, fmt.Errorf("failed to parse profile: %w", err)
		}
		profiles = append(profiles, pf)
	}

	value, err := profile.Merge(profiles)
	if err != nil {
		return nil, fmt.Errorf("failed to merge profiles: %w", err)
	}

	buf := new(bytes.Buffer)
	if err := value.Write(buf); err != nil {
		return nil, fmt.Errorf("failed to write profile: %w", err)
	}

	return buf.Bytes(), nil
}
```

`GetProfiles` 메서드는 특정 시간의 프로파일을 가져와서 하나의 프로파일 파일(pprof)로 병합하는 메서드입니다.  
이를 통해 실제 빌드할 때, PGO의 옵션으로 프로파일을 쉽게 적용할 수 있도록 합니다.

## 결과

### 프로파일 생성

프로파일을 생성하는 코드는 다음과 같이 작성할 수 있습니다.

```go
package main

import (
	"context"
	"log"
	"time"

	"github.com/snowmerak/pgolib/profile"
	"github.com/snowmerak/pgolib/storage/minio"

	"signal"
	"os"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	strg, err := minio.NewClient(ctx, "sample", 10, "profile", &minio.Config{
		Endpoint: "localhost:9000",
        Bucket:          "profile",
		AccessKeyID:     "minio",
		SecretAccessKey: "minio123",
	})
	if err != nil {
		panic(err)
	}

	prof := profile.New(strg, 30*time.Minute, 5*time.Minute) // 30 minutes for delay, 5 minutes for collect interval

	errCh, err := prof.Run(ctx)
	if err != nil {
		panic(err)
	}

	done := ctx.Done()
loop:
	for {
		select {
		case err := <-errCh:
			log.Printf("error: %v", err)
		case <-done:
			break loop
		}
	}
	
	log.Println("done")
}
```

전체적인 코드가 보기 쉬운 편은 아닌 것같지만, `Storage`와 `Profiler`를 통해 비교적 쉽게 PGO를 위한 프로파일을 수집 & 업로드할 수 있습니다.  

### 프로파일 다운로드 및 병합

프로파일을 다운로드하고 병합하는 코드는 이렇게 작성할 수 있습니다.

```go
package main

import (
	"context"
	"os"
	"os/signal"
	"time"

	"github.com/snowmerak/pgolib/profile"
	"github.com/snowmerak/pgolib/storage/minio"
)

func main() {
	const (
		appName = "sample"
	)

	var (
		endedAt   = time.Now()
		startedAt = endedAt.Add(-24 * time.Hour)
	)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	strg, err := minio.New(ctx, appName, 32, "profile", &minio.Config{
		Endpoint:        "localhost:9000",
		Bucket:          "profile",
		AccessKeyID:     "minio",
		SecretAccessKey: "minio123",
	})
	if err != nil {
		panic(err)
	}

	profiler := profile.NewProfiler(strg, 0, 0)
	data, err := profiler.GetProfile(ctx, startedAt, endedAt)
	if err != nil {
		panic(err)
	}

	f, err := os.Create("profile.pprof")
	if err != nil {
		panic(err)
	}
	defer f.Close()
	defer f.Sync()

	if _, err := f.Write(data); err != nil {
		panic(err)
	}
}
```

다운로드 및 병합하는 코드 또한 간단하게 적용할 수 있습니다.

### 도커 빌드

이렇게 만들어진 `profile.pprof`는 다음과 같은 형태의 `Dockerfile`을 통해 쉽게 적용할 수 있습니다.

```Dockerfile
FROM golang:1.23 AS builder
LABEL authors="<your-name>"

ARG PGO=off

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build the Go app
RUN CGO_ENABLED=0 go build -pgo=$PGO -o ./build/app ./cmd/app/.

FROM alpine:3.20

WORKDIR /app

COPY --from=builder /app/build/app .

CMD ["./app"]
```

```shell
docker build -t sample:latest -f Sample.Dockerfile --build-arg PGO=profile.pprof .
```

앞으로 좀 더 다듬어야 할 부분이 있겠지만, 이정도면 프로파일링과 PGO에 대한 난이도를 낮출 수 있을 거라 기대합니다.

## 외부 링크

- [snowmerak/pgolib](https://github.com/snowmerak/pgolib)
