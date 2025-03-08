---
title: "git, buf, 그리고 패키지 매니저로 프로토버퍼 관리하기"
date: 2023-12-13T21:42:22+09:00
tags: ["protobuf", "buf", "npm", "pub", "go", "node", "dart"]
author: "snowmerak"
categories: ["Suggestions"]
draft: false
---

## 프로토버퍼?

프로토버퍼는 구글에서 개발한 직렬화 라이브러리입니다.  
프로토버퍼는 다양한 언어를 지원하며, 단일 IDL(Interface Description Language)을 사용하여 여러 언어에 대한 DTO 및 시리얼라이저를 생성할 수 있습니다.

그렇기에 서버와 클라이언트 사이에 서로 다른 언어를 사용하더라도, 같은 IDL만 공유할 경우 서로가 주고 받는 메시지의 종류만 안다면, 별도의 DTO를 문서를 보고 만들 필요 없이 바로 사용할 수 있습니다.

### 프로토버퍼의 문제점

프로토버퍼는 `.proto` 확장자를 가진 IDL 파일을 각 언어에 맞게 컴파일해서 사용해야한다는 단점이 있습니다.

그래서 프로토버퍼 파일 버전이 상이할 경우에, 같은 메시지(DTO)를 주고 받는 다더라도, 예외가 발생할 수 있어 주의가 필요합니다.

### 그럼에도 불구하고

프로토버퍼는 다양한 언어를 지원하며, 빠르고, 직렬화된 데이터의 크기가 작아서, 여전히 많은 곳에서 사용되고 있습니다.

그리고 프로토버퍼로 생성된 메시지는 JSON으로 직렬화가 가능해서 범용성도 좋습니다.  
클라이언트가 웹이라면, 같은 메시지를 JSON으로 직렬화해서 주고 받을 수도 있습니다.

그렇다면, 딱 2개 있는 문제점, 컴파일이 필요하다는 것과 버전 관리가 별도로 이루어져야 한다는 걸 해결해야합니다.

## 컴파일 자동화

프로토버퍼는 다양한 언어를 지원하는 만큼, 각 언어에 맞는 컴파일러 플러그인이 존재합니다.  
그리고 필요한 언어에 맞는 플러그인을 매번 설치하고 설치 스크립트를 작성하는 것이 그다지 단순하게 쉬운 일은 아닐 것입니다.

하지만 다행스럽게도, [buf](https://buf.build)에서 `buf`라는 툴을 제공해서 컴파일을 자동화할 수 있습니다.

### buf 설치

`buf` 툴은 아래와 같은 명령어들로 설치할 수 있습니다.

1. homebrew: `bbrew install bufbuild/buf/buf`
2. npm: `npm install @bufbuild/buf`
3. go: `GO111MODULE=on GOBIN=/usr/local/bin go install github.com/bufbuild/buf/cmd/buf@v1.28.1`
4. scoop: `scoop install buf`

이외에 직접 [github](https://github.com/bufbuild/buf/releases)에서 바이너리를 다운로드 해서 `PATH`에 등록해서 쓸 수도 있습니다.

### buf 세팅

루트 디렉토리에 `buf.gen.yaml` 파일을 만들어 아래 내용을 작성합니다.

```yaml
version: v1
managed:
  enabled: true
  go_package_prefix:
    default: github.com/snowmerak/common
plugins:
  - plugin: buf.build/protocolbuffers/go
    out: output
    opt: paths=source_relative
  - plugin: buf.build/grpc/go
    out: output
    opt: paths=source_relative
```

이 내용은 `buf`가 컴파일할 때, `go_package_prefix`를 `github.com/snowmerak/common`으로 설정하고, `output` 디렉토리에 컴파일 결과물을 저장하도록 설정한 것입니다.

경로는 `source_relative`로 설정해서, `buf.gen.yaml`이 있는 디렉토리를 기준으로 상대 경로로 설정하도록 했습니다.

당연하게도 각 프로토버퍼 파일 간의 의존성 경로도 루트 디렉토리를 기준으로 작성해야합니다.

고 이외의 플러그인은 [buf 공식 플러그인 페이지](https://buf.build/plugins)를 참고하시면 됩니다.

저희는 nodejs와 dart 코드에 대해서도 컴파일을 할 예정이므로 이 둘을 추가하도록 하겠습니다.

아래에 추가로 다음 항목을 추가하여 `buf.gen.yaml`을 완성합니다.

```yaml
version: v1
managed:
  enabled: true
  go_package_prefix:
    default: github.com/snowmerak/common
plugins:
  - plugin: buf.build/protocolbuffers/go:v1.31.0
    out: lib/src/go
    opt: paths=source_relative
  - plugin: buf.build/grpc/go:v1.3.0
    out: lib/src/go
    opt: paths=source_relative
  - plugin: buf.build/community/timostamm-protobuf-ts:v2.9.3
    out: lib/src/ts
  - plugin: buf.build/protocolbuffers/dart:v21.1.2
    out: lib/src/dart
```

이제 `buf`를 실행하면, `buf.gen.yaml`에 설정한 대로 컴파일이 진행됩니다.

### buf 컴파일

컴파일은 가볍게 `buf generate`를 실행하면 됩니다.

## 예시 프로토버퍼 파일

이제 프로토버퍼 파일을 작성해보겠습니다.

이번에는 가장 기초적인 회원가입과 결과, 로그인과 세션키를 반환하는 예시로 작성해보겠습니다.

우선 폴더를 확실하게 분리하기 위해, `proto` 폴더를 만들고, 그 안에 `auth` 폴더를 만들어서 `auth.proto` 파일을 만들어 아래 내용을 작성합니다.

```proto
syntax = "proto3";

option go_package = "github.com/common/auth";

message SignUpRequest {
    string email = 1;
    string password = 2;
}

message SignUpResponse {
    string token = 1;
}

message SignInRequest {
    string email = 1;
    string password = 2;
}

message SignInResponse {
    string token = 1;
}
```

여기서 `option go_package`는 프로토버퍼가 가질 고 코드의 패키지 경로를 설정하는 것입니다.

그리고 `proto` 폴더 밑에  `buf mod init`을 실행해서 buf 모듈를 생성합니다.

```yaml
version: v1
breaking:
  use:
    - FILE
lint:
  use:
    - DEFAULT
```

그러면 위 yaml 파일을 가진 `buf.yaml` 파일이 생성됩니다.

이제 다시 루트 디렉토리로 돌아와서 `buf generate`를 하면 결과물이 생성될 것입니다.

## 버전 관리

버전 관리라곤 하나, 각 언어의 패키지 매니저를 통해 배포하고, 각 프로젝트에서 업데이트하는 것을 의미합니다.

### go

우선 `go`의 경우 `go.mod` 파일을 생성하고, `go get`을 통해 패키지를 설치하면 됩니다.

```bash
go mod init github.com/snowmerak/common
```

그러면 이제 외부 프로젝트에서 `go get github.com/snowmerak/common`를 통해 패키지를 설치하여 사용할 수 있습니다.

### node

우선 npm 패키지를 생성합니다.

```bash
npm init -y
```

위 명령어를 실행하면 `package.json` 파일이 생성됩니다.  
그리고 저희가 사용한 프로토버퍼 생성 플러그인인 `timostamm-protobuf-ts`이 제공하는 런타임을 설치합니다.

```bash
npm install @protobuf-ts/runtime@^2.9.3 @protobuf-ts/runtime-rpc@^2.9.3
```

그리고 타입스크립트도 설치합니다.

```bash
npm install typescript
```

이후 `tsc --init`을 실행해서 `tsconfig.json` 파일을 생성합니다.  
타입스크립트 설정 파일에서 원하시는 옵션으로 수정하신 후, `tsc`를 실행하면 `gen/ts` 폴더의 타입스크립트 파일에서 자바스크립트 파일이 생성됩니다.

그리고 `index.js`를 루트 폴더에 생성한 후, 다음 내용을 입력합니다.

```js
const { Auth } = require('./lib/src/ts/proto/auth/auth');

export default {
    Auth,
};
```

저의 경우엔 `index.js`가 없어도 잘 돌아는 갔습니다만, 잘 배운 노드 개발자가 아니라서 확실치 않습니다.

그러면 이제 외부 프로젝트에서 `npm install git+https://github.com/snowmerak/common.git`을 통해 패키지를 설치하여 사용할 수 있습니다.

### dart

다트는.. 라이브러리를 생성하면 프로젝트가 더러워집니다.

```bash
dart create --pub --force -t package .
```

위 명령어를 통해 루트 프로젝트에 다트 프로젝트를 생성합니다.  
주의할 점은 `README.md` 파일이 초기화되므로 주의해주시기 바랍니다.  
그리고 `buf generate` 및 `tsc` 등을 다시 실행합니다.

그러면 `lib/src`에 각 언어들에 대한 프로토버퍼 코드가 생성되었을 것입니다.

그럼 이제 `lib/common.dart`를 열어서 다음과 같이 수정합니다.

```dart
/// Support for doing something awesome.
///
/// More dartdocs go here.
library;

export 'src/dart/proto/auth/auth.pb.dart';
export 'src/dart/proto/auth/auth.pbenum.dart';
export 'src/dart/proto/auth/auth.pbjson.dart';
export 'src/dart/proto/auth/auth.pbserver.dart';

// TODO: Export any libraries intended for clients of this package.
```

마지막으로 `dart pub add protobuf`를 실행해서 프로토버퍼 라이브러리를 추가합니다.

그럼 이제 외부 프로젝트에서 `pubspec.yaml`에 다음과 같이 추가하고, `pub get`을 실행하면 패키지를 설치하여 사용할 수 있습니다.

```yaml
dependencies:
  common:
    git: https://github.com/snowmerak/common.git
```

## 마치며

이렇게 한번 구성함으로 프로토버퍼를 수정하고 생성한 후 업로드하기만 하면, go나 node, dart 프로젝트에서 지속적으로 의존성을 업데이트함으로 최신 버전 메시지(DTO)를 사용할 수 있습니다.
