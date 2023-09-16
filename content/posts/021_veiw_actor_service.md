---
title: "뭔가 이상한 플러터 프로젝트 구조"
date: 2023-09-16T14:54:01+09:00
draft: false
---

## 프로바이더는 이번 생에 처음이라..
처음으로 제대로 된 플러터 프로젝트를 시작하는 중이었습니다.  
이전에는 편하다는 이유로, getx를 애용했었는데, 이번에는 [flutter developers korea](https://open.kakao.com/o/gYyufB6)분들의 의견을 듣고 [Riverpod](https://riverpod.dev/)으로 선택했습니다.

여기서부터 문제가 생깁니다.  
원래 GetX를 썼기에 제 스타일 상, 프로바이더의 구성은 전역 변수와 거의 같아질 수밖에 없었습니다.  
물론 사실 이 부분은 제 능력부족에 대한 핑계이고, `auto dispose`만 제대로 해줬어도 그런 느낌은 주지 않았을 겁니다.

이 문제로 인해 폴더 분리도, 큰 규모는 처음이라 제대로 분리되어 있지도 않았죠.  
`lib` 밑에 `components`, `pages`, 이름만 있는 `service`, 외부 서버의 `client`, `model` 내부에 `state`, `schema` 등등 매우 혼란스러운 구조를 가지고 있었습니다.  
그리고 거의 모든 페이지 코드에 비즈니스 로직이 직접 포함되어 있었습니다.  
솔직히 제가 채용 담당자고 지원자가 이렇게 포폴을 가져왔으면 일단 감점 했을 거에요.

## 그래서 이걸 어떻게 해결하려고 했는가?  
이틀 정도 급하게 구성하다보니, 더 개판이 되기 전에 바꿔야겠다고 생각했습니다.  
그래서 다시 오픈톡에 물어봤죠. 너무 전역 변수를 어렵게 쓰는 거같이 프로바이더를 쓴다고..

이야기가 오가던 중 한분이 말씀하신 `상태관리와 같은 클래스에서 컨트롤러처럼 처리하면 됩니다.`라는 문장이 해결을 위한 힌트를 줬습니다.  
만약 이 말을 듣지 못 했다면, 적당한 방법을 못 떠올리고 저주 받은 프로젝트로 남았을 거에요. 감사하고 있습니다.

### 코드가 더러워진 건 비즈니스 로직을 분리하지 못 해서다!
라고 생각했습니다.

실제로 `LoginPage.dart`에는 리프레시 토큰 상태, 엑세스 토큰 상태, 서버 쪽 클라이언트 호출, 예외 처리 등에 대한 코드가 모두 들어가 있었고, 이로 인해 로그인 화면 하나만을 위한 코드가 매우 번잡하고 읽기 어렵고, 수정하기 어려웠습니다.

페이지에 있는 비즈니스 로직을 싹 다 분리해서 프로바이더가 되는 클래스에 메서드로 추가했습니다.

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';  
  
class AuthToken {  
  String refreshToken;  
  String accessToken;  
  
  AuthToken({this.refreshToken = '', this.accessToken = ''});  
}  
  
class AuthTokenNotifier extends StateNotifier<AuthToken> {  
  AuthTokenNotifier() : super(AuthToken());  
}  
  
final authTokenProvider = StateNotifierProvider<AuthTokenNotifier, AuthToken>((ref) {  
  return AuthTokenNotifier();  
});
```

인증 토큰을 저장하는 상태를 이렇게 관리한다고 가정해봅시다.  
그리고 인증 서버는 gRPC로 돌아간다고 가정하겠습니다.  
기존의 제 코드라면, 페이지에서 토큰을 가져와서 직접 gRPC 클라이언트를 만들어서 응답을 받고 처리하는 코드가 들어갔을 겁니다.

상태관리 클래스에 메서드로 로그인 관련 비즈니스 로직을 추가하면 다음과 같이 작성하고, 페이지에서는 결과에 따라 경고 메시지를 띄울지, 다른 화면으로 넘어갈지 선택하면 됩니다.

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';  
import 'package:grpc/grpc.dart';  
import 'package:untitled/result.dart';  
  
class AuthToken {  
  String refreshToken;  
  String accessToken;  
  
  AuthToken({this.refreshToken = '', this.accessToken = ''});  
}  
  
class AuthTokenNotifier extends StateNotifier<AuthToken> {  
  AuthTokenNotifier() : super(AuthToken());  
  
  Future<Result<String, String>> login(ClientChannel channel, String username, String password) async {  
    final stub = AuthServiceClient(channel);  
    final request = LoginRequest()  
      ..username = username  
      ..password = password;  
    try {  
      final response = await stub.login(request);  
      state = AuthToken(  
        refreshToken: response.refreshToken,  
        accessToken: response.accessToken,  
      );  
      return Result.ok(response.accessToken);  
    } catch (e) {  
      return Result.error(e.toString());  
    }  
  }  
}  
  
final authTokenProvider = StateNotifierProvider<AuthTokenNotifier, AuthToken>((ref) {  
  return AuthTokenNotifier();  
});
```

이런 식으로 페이지의 로직을 프로바이더의 메서드로 분리해서, 페이지의 코드를 단순하게 만들고, 각 영역의 데이터 흐름과 책임도 잘 나눌 수 있었습니다.  
이를 테면, 위 코드의 가짜 코드들, `AuthServiceClient`의 경우에는 새로운 제 프로젝트 구조에 따라 `service` 패키지 밑 `client`, `auth_service`에 포함될 것입니다.  
추상적으로 보면 `서비스 -> 모델(+프로바이더) -> 뷰` 흐름이 명확하게 생깁니다.

반대로, 사용자의 데이터 수정 요청에 따른 처리는 `뷰 -> 모델(+프로바이더) -> 서비스` 흐름 대로 처리 됩니다.

이 중에서 `모델(+프로바이더)`은 단순히 데이터만 저장하지 않습니다.  
서비스의 코드를 호출해서 데이터를 가공하고, 자신의 데이터로 수정하거나 반환하기도 하므로, 이름을 `actor`라 지었습니다.  
그래서 앞으로는 계속 액터라고 지칭하겠습니다.

## 각 영역에 대해서

제 성격 상, 프로젝트의 `lib` 폴더 아래에는 `view`, `actor`, `service`, 3개의 패키지가 존재합니다.  
각 패키지는 방금 말한 역할을 수행합니다.  
좀 더 적자면 아래와 같을 것입니다.

- view
플러터 화면에 보여줄 페이지, 컴포넌트, 레이아웃 등이 포함되는 곳입니다.  
이전에 말하지 않은 특성이 한가지 존재하는데, 뷰는 액터들의 상태를 조립해주는 역할을 같이 해야합니다.  
리버팟을 사용하는 만큼, 액터 코드 내에서도 프로바이더에 접근해서 상태를 가져오는 것 쯤은 할 수 있을 것입니다.  
하지만 개인적으로 컨슈머 위젯을 통해 명시적으로 뷰에서 상태를 가져와서, 각 액터의 메서드에 넘겨주는 게 아름답다고 느꼈습니다.  
그래서 뷰는 각 액터들의 상태를 엮어주는 역할도 하게 됩니다.

- actor
앱 실행 시 쓰일, VO와 VO를 다룰 메서드가 포함된 영역입니다.  
view에서 전달 받은 `나`와 다른 상태 값을 토대로 적절한 행동을 실행하고, 그 결과를 알려줍니다.  
`service` 영역과 직접 통신하여 임베디드 DB 접근, 외부 서버 요청 등을 요구하고 응답을 받을 수 있습니다.

- service
서비스는 액터의 데이터, 혹은 액터에게서 입력 받은 데이터를 기반으로 어떠한 동작을 수행하는 코드가 있는 영역입니다.  
저는 [isar](https://isar.dev/)을 사용하고 있는데, isar에 대한 스키마와 쿼리를 여기서 관리해도 좋다고 생각합니다.  
그리고 gRPC 클라이언트 동작 코드, http 요청에 대한 코드, 그에 따른 DTO 등도 들어갈 수 있다고 생각합니다.

### 뭔가 빠지지 않았어?

제 특별한 상황 때문에, `service`가 조금 가볍기도 하고, 정리가 안되기도 했습니다.  
저는 지금 프로젝트가 모노레포로 되어 있고, 크게 3개의 하부 프로젝트가 있습니다.

1. 고 언어로 된 gRPC 서버
2. gRPC 클라이언트를 구현하는 플러터
3. gRPC 명세를 가지고 고와 다트의 라이브러리 패키지를 생성하는 프로토버퍼 프로젝트

그래서 사실 상, 모든 DTO와 서버 및 클라이언트 스펙이 3번 하부 레포에 있습니다.  
서버와 플러터는 3번 프로젝트의 라이브러리를 참조해서 동작합니다.  
그래서 제 설명에서 DTO와 gRPC 클라이언트에 대한 설명이 거의 완전히 빠져 있습니다.

그러면 이런 식으로 구성되지 않는다면, 그리고 이 프로젝트 구성을 쓴다면,  
필연적으로 DTO는 액터나 서비스 중 적절한 곳에 포함되는 형태로 작성이 되어야 합니다.  
이 구간은 제가 오롯이 프로젝트를 만드는 사람에게 맡길 수밖에 없어 보입니다.

대신 저는 프로토버퍼가 json으로도 시리얼라이징이 가능하니, 저처럼 프로토버퍼 스펙을 위한 레포를 분리하고 서버와 같이 참조하는 방식으로 설계하는 걸 추천드립니다.

## P.S. Result<O, E> 클래스

```dart
class Result<O,E> {  
  final O? ok;  
  final E? error;  
  
  Result.ok(this.ok) : error = null;  
  Result.error(this.error) : ok = null;  
  
  bool get isOk => ok != null;  
  bool get isError => error != null;  
  
  O unwrap() {  
    if (isOk) {  
      return ok!;  
    } else {  
      throw Exception('Result is error');  
    }  
  }  
  
  E unwrapError() {  
    if (isError) {  
      return error!;  
    } else {  
      throw Exception('Result is ok');  
    }  
  }  
  
  O unwrapOr(O defaultValue) {  
    if (isOk) {  
      return ok!;  
    } else {  
      return defaultValue;  
    }  
  }  
  
  O unwrapOrElse(O Function(E error) f) {  
    if (isOk) {  
      return ok!;  
    } else {  
      return f(error as E);  
    }  
  }  
}
```
