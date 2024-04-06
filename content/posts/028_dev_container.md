---
title: "DevContainer로 개발환경 구성하기"
date: 2024-04-05T19:30:42Z
tags: ["devcontainer", "go", "docker", "docker-compose"]
draft: false
---

## Dev Container

`Dev Container`는 도커 컨테이너를 이용하여 개발 환경을 구축하는 방법입니다.  
이 방식을 이용하면 쉽게 어느 곳에서나 동일한 개발 환경을 구축할 수 있습니다.  
이 글에서는 `Go` 언어를 사용하는 개발 환경을 구축하는 방법을 소개합니다.

### devcontainer 폴더 구성

프로젝트 폴더 내에 `.devcontainer` 폴더를 생성합니다.  
그리고 다시 한번 그 안에 원하는 개발 환경 이름으로 폴더를 생성합니다.

```bash
$ mkdir -p .devcontainer/practice-go
```

### devcontainer 설정 파일 작성

`.devcontainer/practice-go` 폴더 내에 `devcontainer.json` 파일을 생성합니다.  
저희는 전반적인 구성을 `docker-compose`로 하기 때문에 `docker-compose.yml` 파일을 참조하도록 설정합니다.

```json
{
  "name": "practice-go",
  "dockerComposeFile": [
    "docker-compose.yml"
  ],
  "service": "workspace",
  "workspaceFolder": "/workspace",
  "shutdownAction": "stopCompose",
  "customizations": {
    "vscode": {
      "extensions": [
        "golang.go-nightly",
      ]
    }
  }
}

```

마지막의 `customizations` 부분은 `VSCode`에서 사용할 확장 프로그램을 설정하는 부분입니다.  
일반적인 `golang.go` 확장을 쓰는 걸 권장하지만, 제 경우엔 `golang.go-nightly`를 사용하고 있어 그렇게 작성했습니다.

### dockerfile 파일 작성

`.devcontainer/practice-go` 폴더 내에 `Dockerfile` 파일을 생성합니다.  
`Go` 언어를 사용하는 경우, `golang` 이미지를 사용하는 것이 일반적입니다.

```dockerfile
FROM golang:1.22-bookworm

CMD ["/bin/sh", "-c", "while true; do sleep 30; done;"]
```

마지막의 `CMD` 부분은 컨테이너가 종료되지 않도록 하는 설정입니다.  
이 설정이 없으면 컨테이너가 실행되자마자 종료되어 ssh 접속이 불가능합니다.

만약 `sqlc`와 같은 도구를 사용하는 경우, 해당 도구를 설치하는 설정을 추가합니다.

```dockerfile
FROM golang:1.22-bookworm

RUN go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest && \
    echo 'export PATH=$PATH:$HOME/go/bin' >> /etc/profile

CMD ["/bin/sh", "-c", "while true; do sleep 30; done;"]
```

### docker-compose 파일 작성

`.devcontainer/practice-go` 폴더 내에 `docker-compose.yml` 파일을 생성합니다.

```yaml
version: '3'
services:
  workspace:
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ../../.:/workspace:cached
```

`volumes` 부분은 프로젝트 폴더를 컨테이너 내의 `/workspace` 폴더에 마운트하는 설정입니다.  
뒤로 2번 가는 이유는 해당 도커 컴포즈 파일이 프로젝트 내의 `.devcontainer/practice-go` 폴더에 있기 때문입니다.

여기서 굳이 `docker-compose`를 사용하는 이유는 필요한 경우 다른 서비스를 추가하기 위함입니다.

### postgres 추가하기

예를 들어, `PostgreSQL`을 사용하는 경우 `docker-compose.yml` 파일을 다음과 같이 수정합니다.

```yaml
version: '3'
services:
  workspace:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=postgres
      - POSTGRES_HOST=localhost
      - POSTGRES_PORT=5432
    ports:
      - "5432:5432"
    volumes:
      - ../../.:/workspace:cached
  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER=postgres
      POSTGRES_PASSWORD=postgres
      POSTGRES_DB=postgres
    network-mode: service:workspace
```

일반적인 도커 컴포즈와 유사하지만, `network-mode` 부분은 흔히 볼 수 없는 설정입니다.  
이 설정은 `postgres` 컨테이너가 `workspace` 컨테이너와 같은 네트워크를 사용하도록 하는 설정입니다.  
이렇게 하면 `localhost`로 접근이 가능합니다.

마지막으로 `postgres` 컨테이너가 `workspace` 컨테이너의 네트워크를 사용하기 떄문에,  
`postgres` DB에 호스트 머신에서 접근하려면 `workspace`에서 5432 포트를 포워딩해야 합니다.

### 환경 변수 분리

`docker-compose.yml` 파일에 환경 변수를 직접 적는 것은 너무 번거롭습니다.  
그래서 환경 변수를 별도의 파일로 분리하고, `docker-compose.yml` 파일에서 참조하도록 합니다.  
먼저 `.env` 파일을 생성합니다.

```bash
$ touch .env
```

그리고 다음과 같이 환경 변수를 설정합니다.

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

마지막으로 `docker-compose.yml` 파일을 다음과 같이 수정합니다.

```yaml
version: '3'
services:
  workspace:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_HOST=${POSTGRES_HOST}
      - POSTGRES_PORT=${POSTGRES_PORT}
    ports:
      - "5432:5432"
    volumes:
      - ../../.:/workspace:cached
  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER=${POSTGRES_USER}
      POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      POSTGRES_DB=${POSTGRES_DB}
    network-mode: service:workspace
```

그러면 `docker-compose`가 `.env` 파일을 읽어 환경 변수를 설정하여, 중복된 설정을 줄일 수 있습니다.

### Dev Container 실행

#### VSCode

`VSCode`에서 `Dev Containers`와 `Remote Development` 확장을 설치합니다.  
그리고 `Command(or Ctrl) + Shift + P`를 눌러 `Remote-Containers: Reopen in Container`를 검색하고 실행합니다.  
그러면 `VSCode`가 재시작되고, `Dev Container`를 빌드한 후 실행됩니다.

#### IntelliJ

최신 버전의 `IntelliJ`에서는 `Remote Development` 기능을 지원합니다.  
시작 화면에서 `Remote Development`를 선택하고, `Dev Container`를 선택하면 됩니다.
