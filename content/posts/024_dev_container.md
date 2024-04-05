---
title: "도커 컴포즈와 함께 쓰는 devcontainer"
date: 2023-10-20T21:57:19+09:00
tag: ["devcontainer", "go", "docker", "docker-compose"]
draft: true
---

## devcontainer는?

`devcontainer`는 컨테이너 기반으로 개발 환경을 구성할 수 있게 도와주는 도구입니다. 일반적으로 도커 기반으로 동작하며, 리눅스 이미지 위에서 동작하므로 실 배포 환경과 유사하게 개발 환경을 세팅할 수 있고, 개발 환경을 공유하거나 그대로 배포할 수 있다는 장점이 있습니다.

### visual studio code

`devcontainer`는 `visual studio code`에서 잘 동작하므로, 이 아티클은 브스코드를 기준으로 작성하겠습니다.

브스코드의 `Remote Development` 확장과 `Dev Containers` 설치하면 `devcontainer`를 사용할 수 있습니다.

## 배경

저는 어떤 프로젝트를 `go`로 진행하고 있습니다. 배포 환경은 도커 컴포즈로 구성되어 있어, 우선적으로 도커 컴포즈로 작성하였습니다.

같이 배포되어야 하는 다른 서비스들로 `redis`, `postgresql`이 있습니다. 이들이 포함된 도커 컴포즈는 다음처럼 작성되어 있습니다.

```yaml
version: '3'

services:
  redis:
    image: redis
    networks:
      - inner_network
    volumes:
      - redis_data:/data
  postgres:
    image: postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 1q2w3e4r
      POSTGRES_DB: CTLog
    networks:
      - inner_network
    volumes:
      - postgres_data:/var/lib/postgresql/data
  planet:
    build:
      context: .
      dockerfile: planet.dockerfile
    ports:
      - "13431:13431"
      - "14541:14541"
    networks:
      - inner_network
    depends_on:
      - redis
      - postgres

networks:
  inner_network:
    driver: bridge

volumes:
  redis_data:
    external: false
  postgres_data:
    external: false
```

`planet`는 `go`로 작성된 서비스입니다. `redis`와 `postgres`에 의존하고 있습니다. 플래닛은 `planet.dockerfile` 파일을 통해 빌드됩니다.

```dockerfile
ARG GO_VERSION=1.21.3
ARG UBUNTU_VERSION=22.04

FROM golang:${GO_VERSION} AS builder

COPY . /go/src/satellite-network
WORKDIR /go/src/satellite-network/cmd/planet

RUN go build

FROM ubuntu:${UBUNTU_VERSION}

COPY --from=builder /go/src/satellite-network/cmd/planet/planet /usr/local/bin/planet

ENTRYPOINT ["/usr/local/bin/planet"]
```

일단은 같이 올려드립니다만, 이번 글에서는 제가 짧게 잘 짠거 같아서 자랑삼아 올립니다. (물론, 더 좋은 방법이 있을 겁니다.)

여튼 그래서 전체적인 흐름은 위 `planet.dockerfile`로 해당 프로젝트를 빌드하고 우분투 베이스 이미지에 executable 파일을 옮겨서 실행하는 것입니다.

그럼 이어서 `devcontainer`를 적용해보겠습니다.

## devcontainer 생성

### dockerfile 및 docker-compose 파일 작성

먼저 제 케이스에선 도커 컴포즈에 적용해야합니다. 그러면 아래와 같이 컴포즈의 이미지만 변경해도 상관없습니다.

```yaml
version: '3'

services:
  redis:
    image: redis
    networks:
      - inner_network
    volumes:
      - redis_data:/data
  postgres:
    image: postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 1q2w3e4r
      POSTGRES_DB: CTLog
    networks:
      - inner_network
    volumes:
      - postgres_data:/var/lib/postgresql/data
  planet:
    image: mcr.microsoft.com/devcontainers/go:1-1.21-bullseye
    ports:
      - "13431:13431"
      - "14541:14541"
    networks:
      - inner_network
    depends_on:
      - redis
      - postgres

networks:
  inner_network:
    driver: bridge

volumes:
  redis_data:
    external: false
  postgres_data:
    external: false
```

`mcr.microsoft.com/devcontainers/go:1-1.21-bullseye`는 `go` 개발 환경을 제공하는 이미지입니다. 이대로만 가지고 데브컨테이너를 실행하면 `go` 개발 환경이 구성된 컨테이너가 실행됩니다. 그래도 주의해야할 건 `go`만 있으니까 나머진 알아서 구성하셔야합니다. 저도 그렇구요.

그래서 `dev.dockerfile`로 부가적인 구성을 추가하겠습니다.

```dockerfile
ARG GO_VERSION=1.21

FROM mcr.microsoft.com/devcontainers/go:1-${GO_VERSION}-bullseye

USER vscode
RUN go install github.com/snowmerak/jetti/v2/cmd/jetti@latest
```

위 내용을 `dev.dockerfile`로 작성합니다. 그러면 `go` 개발 환경 위에 `vscode` 유저 권한으로 `jetti`를 설치하는 내용입니다. 여기서는 `go install`만 사용했지만, `bullseye`가 있는 거 보면 `apt`도 사용 가능해 보입니다.

그럼 개발 환경 용 도커 컴포즈 파일도 작성해보겠습니다.

```yaml
version: '3'

services:
  redis:
    image: redis
    networks:
      - inner_network
    volumes:
      - redis_data:/data
  postgres:
    image: postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 1q2w3e4r
      POSTGRES_DB: CTLog
    networks:
      - inner_network
    volumes:
      - postgres_data:/var/lib/postgresql/data
  planet:
    build:
      context: .
      dockerfile: dev.dockerfile
    ports:
      - "13431:13431"
      - "14541:14541"
    networks:
      - inner_network
    depends_on:
      - redis
      - postgres

networks:
  inner_network:
    driver: bridge

volumes:
  redis_data:
    external: false
  postgres_data:
    external: false
```

이렇게 작성한 도커 컴포즈 파일을 `docker-compose.planet.dev.yaml`로 지정해 루프 폴더에 저장해 놓겠습니다.

### devcontainer.json 작성

먼저 프로젝트 루트 폴더를 브스코드로 열고, `shift + command + p`를 눌러 `Dev Containers: Add Dev Container Configuration Files...`를 선택합니다.

이후 `From docker-compose.planet.dev.yaml` 옵션을 선택합니다. 그럼 `devcontainer.json` 파일이 생성됩니다. 저는 이미 수정을 좀 했는데, 템플릿에서 추가된 부분을 파악하는 건 어렵지 않을 것입니다.

```json
// For format details, see https://aka.ms/devcontainer.json. For config options, see the
// README at: https://github.com/devcontainers/templates/tree/main/src/docker-existing-docker-compose
{
	"name": "Existing Docker Compose (Extend)",

	"dockerComposeFile": [
		"../docker-compose.planet.dev.yaml",
		"docker-compose.yml"
	],

	"service": "planet",

	"workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",

	"remoteUser": "vscode",

	"forwardPorts": [13431, 14541],

	"customizations": {
		"vscode": {
			"extensions": [
				"GitHub.copilot",
				"GitHub.copilot-chat",
				"cweijan.vscode-database-client2"
			]
		}
	}
}
```

순차적으로 각 요소는 다음과 같습니다.
1. `name`: 데브컨테이너 이름입니다. 원하는 걸 쓰시면 됩니다.
2. `dockerComposeFile`: 도커 컴포즈 파일 경로입니다. 기본적으로 커맨드 팔레트에서 선택한 `docker-compose.planet.dev.yaml`로 되어 있습니다.
3. `service`: 도커 컴포즈 파일에서 실행할 서비스 이름. 저는 `planet`로 작성했기에 `planet`로 되어 있습니다.
4. `workspaceFolder`: 데브컨테이너에서 작업할 폴더 경로입니다.
5. `remoteUser`: 데브컨테이너에서 사용할 유저 이름입니다. 저는 `vscode`로 되어 있습니다. 이건 `dev.dockerfile`에서 `USER`로 지정한 유저 이름과 동일해야합니다. 그렇지 않으면, `dev.dockerfile`에서 작업한 내용이 에러가 발생하거나, 권한 문제로 사용하지 못할 수 있습니다.
6. `forwardPorts`: 데브컨테이너에서 포트 포워딩할 포트 번호입니다. 저는 `planet` 서비스의 `13431`과 `14541` 포트를 포워딩하도록 했습니다.
7. `customizations`: 데브컨테이너에서 추가로 설치할 패키지를 지정합니다. 저는 `copilot`과 `database-client2`를 추가로 설치하도록 했습니다.

## devcontainer 실행

생성 때와 마찬가지로 커맨드 팔레트에서 `Dev Containers: Reopen in Container`를 선택하면 데브컨테이너가 실행됩니다. 그럼 `dev.dockerfile`에 작성한 내용이 실행됩니다.

만약 빌드를 다시 해야한다면, `Dev Containers: Rebuild and Reopen in Container`를 선택하면 됩니다. 그럼 `dev.dockerfile`을 다시 실행하고 데브컨테이너가 실행됩니다. 그리고 이미 컨테이너 내부인데, 컨테이너를 다시 빌드해야한다면, `Dev Containers: Rebuild Container`를 선택하면 됩니다.

## 끝으로

재밌었습니다.

타 OS에서 리눅스 개발 환경을 구성한다거나, 리눅스 내에서도 개발 환경을 분리해서 OS를 깨끗하게 유지하고 싶을 때, 다른 사용자에게 자신의 개발 환경을 공유해줄 때 매우 유용할 것같습니다.
