---
title: "vRPC 구현"
date: 2022-01-23T15:25:32+09:00
tags: ["vstruct", "go", "tcp"]
draft: true
---

이 글은 제 [레포](https://github.com/snowmerak/vrpc)를 기반으로 작성되었습니다.

## vstruct

vRPC는 [vstruct](https://github.com/lemon-mint/vstruct)를 기반으로 작성되었습니다.

vstruct는 [lemon-mint](https://github.com/lemon-mint)님이 만든 빠른 직렬화 라이브러리로 고와 다트, 러스트를 지원합니다.

vstruct의 컴파일러는 고로 작성되어 있기에 `go install github.com/lemon-mint/vstruct/cli/vstruct@latest`로 `vstruct` CLI 툴을 설치할 수 있습니다.

CLI 툴 설치 없이는 [해당 링크](https://vstruct.pages.dev/)에서 컴파일 해서 사용해 볼 수 있습니다.

### Sample vstruct file

```vstruct
struct Request {
    string Name;
}

struct Response {
    string Reply;
}

```

고 언어 프로젝트의 루트 폴더에서 위와같은 정의를 가지는 `test.vstruct` 파일을 생성합니다. `test.vstruct`는 `string` 타입을 가지는 두 객체 `Request`, `Response`를 가집니다. `vstruct go test`을 실행하면 `vstruct/model/test` 폴더에 `test` 패키지 이름으로 `Request`와 `Response`가 자동 생성됩니다.

`vstruct rust test`나 `vstruct dart test`를 하게 되면 각기 다른 언어에 맞는 디렉토리에 자동으로 생성됩니다.

## vRPC

### 프레임

|Service|Method|Sequence|BodySize|Body|
|---|---|---|---|---|
|uint32|uint32|uint32|uint32|bytes|

vRPC의 데이터는 해당 프레임에 담아서 전송합니다. 

헤더에 해당하는 부분이 서비스 번호, 메서드 번호, 시퀸스 번호, 바디 사이즈로 매우 적은 양만 존재하는 이유는, 처음 계획할 때부터 내부망이나 가까운 네트워크에서 사용하는 것과 하나의 클라이언트 연결에서 동시에 하나의 요청만 주고 받는 것을 가정했기때문입니다. 그래서 어떤 서비스의 어떤 메서드를 호출할 것인지, 몇번 순서인지, 바디 사이즈는 몇인지만 기록하여 전송합니다.



