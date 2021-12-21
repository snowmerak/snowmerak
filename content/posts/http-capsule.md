---
title: "HTTP 프로토콜에서 키 교환과 대칭키 암호화"
date: 2021-09-19T22:46:26+09:00
tags: ["go", "ecdh", "aes", "dart", "flutter"]
draft: false
---

때는 졸업작품을 리메이크할 때로 돌아갑니다.

졸업작품 주제는 무려 온라인 투표 시스템이었고 내부 데이터베이스 구조를 [탱글](http://wiki.hash.kr/index.php/%ED%83%B1%EA%B8%80)로 생각하고 있었습니다. 즉, 블록체인 형태를 가지게 할 예정이었습니다. 그렇다보니 당연하게도 타원 곡선 기반 서명(실제로는 secp256r1과 sha256을 이용하였습니다)을 활용하게 되었고 투표 종료 이전 공개키의 공개는 위험하니 당연히 TLS를 제공해야했습니다.

하지만 유권자나 제 3자가 데이터 베이스를 클론하여 로컬에서 검증할 수 있게 하는 기능에서 고민이 생겼습니다. 사실 투표 과정에서야 당연히 중요한 공개키와 투표 내역이 오고 가기에 암호화가 필수이지만 익명으로 사용자가 등록되고 익명으로 투표 내역이 등록된, 모든 투표가 끝난 시점에서는 굳이 숨길 필요가 없습니다. 이를 기반으로 유권자나 제 3자로 하여금 자유롭게 투표가 무결하게 이루어졌는지 검증할 수 있기때문이죠.

그러면 투표할 때야 유권자 수, N에 비례하여 요청과 응답이 선형으로 증가하게됩니다. 하지만 투표가 종료된 후에는 상황이 달라집니다. 기존 투표할 때의 요청과 응답은 N에 비례하는 선형이지만 검증은 검증을 원하는 수, M 또한 포함되어 N*M 비례 선형으로 요청과 응답이 증가합니다. 그래서 굳이 할 필요없는 TLS를 대체하기로 하였습니다. 그러면서 겸사겸사 투표할 때의 오버헤드도 줄여보려했습니다.

TLS를 일단 완전히 걷어냈습니다. 서버는 HTTP 프로토콜로만 동작합니다. 하지만 보안은 지켜야합니다. 그렇기에 수동으로 키교환을 수행합니다. 서버에서 `handshake`라는 API를 열어 클라이언트와 서버가 키교환을 수행할 수 있게 합니다. 제 경우엔 `X25519`를 이용하였습니다.

```go
import "github.com/aead/ecdh"

func Handshake(data []byte) ([]byte, []byte, error) {
	ec := ecdh.X25519()
	priv, pub, err := ec.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	p := pub.([32]uint8)

	sec := ec.ComputeSecret(priv, data)

	return sec, p[:], nil
}
```

이 `handshake` 함수는 클라이언트에게 받은 공개키를 [ecdh](github.com/aead/ecdh) 라이브러리에서 발급 받은 X25519 키를 통해 공통키를 만들어내고 공통키와 공개키를 반환합니다. 

```go
import (
    "crypto/sha512"
    "log"

    "github.com/gofiber/fiber/v2"
    "github.com/valyala/fasthttp"
)

func Service(c *fiber.Ctx) error {
	cpk := c.Body()
	secret, pub, err := Handshake(cpk)
	if err != nil {
		log.Println(err)
		c.Response().Header.SetStatusCode(fasthttp.StatusBadRequest)
		return c.Send([]byte(err.Error()))
	}
	hashed := sha512.Sum512(cpk)
	reply := new(security.Reply)
	reply.ID = hex.EncodeToString(hashed[:])
	reply.PublicKey = pub
	sessions.Set(reply.ID, secret)
	data, err := proto.Marshal(reply)
	if err != nil {
		log.Println(err)
		c.Response().Header.SetStatusCode(fasthttp.StatusNotModified)
		return c.Send([]byte(err.Error()))
	}
	return c.Send(data)
}
```

`Service` 함수는 [fiber](github.com/gofiber/fiber) 프레임워크의 라우터로 클라이언트의 요청을 받는 함수입니다. `Service` 함수 첫번째 줄에 작성된 대로 클라이언트는 서버에 오로지 공개키만 전송합니다. 해당 공개키를 방금 미리 작성해놓은 `handshake` 함수에 넘겨 공통키와 서버의 공개키를 받아옵니다. 그리고 클라이언트에게 받은 공개키를 SHA512로 해싱하여 클라이언트의 익명 아이디를 생성합니다.

`reply` 객체는 string 타입 ID와 bytes 타입 publicKey를 가지는 프로토타입 객체입니다. 그리고 sessions는 구현 당시에는 전역 멤캐시드 인스턴스로 만들어졌습니다. sessions.go 파일은 다음과 같습니다.

```go
package sessions

import (
	"log"

	"github.com/bradfitz/gomemcache/memcache"
)

var store *memcache.Client

func init() {
	store = memcache.New("sessions:11211")
	if store == nil {
		log.Fatal("cannot connect sessions")
	}
}

func Set(key string, value []byte) error {
	return store.Set(&memcache.Item{
		Key: key, Value: value,
	})
}

func Get(key string) ([]byte, error) {
	item, err := store.Get(key)
	if err != nil {
		return nil, err
	}
	return item.Value, nil
}

func Delete(key string) error {
	return store.Delete(key)
}
```

실제로 처리량이 늘어나면 멤캐시드가 아니라 클러스터링된 레디스라도 써야겠지만 작은 서비스이니 멤캐시드로 작성했습니다. 라우터에서 나온 ID와 공통키를 세션에 저장합니다. 다음 요청에서 암호화된 값과 ID가 넘어오면 받은 ID에 해당하는 공통키를 받아와서 복호화하여 사용합니다. 

```go
func Secret2Aead(secret []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(secret[:32])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func Encrypt(id string, data []byte) ([]byte, error) {
	secret, err := sessions.Get(id)
	if err != nil {
		return nil, err
	}
	aead, err := Secret2Aead(secret)
	if err != nil {
		return nil, err
	}
	return aead.Seal(nil, secret[:aead.NonceSize()], data, nil), nil
}

func Decrypt(id string, data []byte) ([]byte, error) {
	secret, err := sessions.Get(id)
	if err != nil {
		return nil, err
	}
	aead, err := Secret2Aead(secret)
	if err != nil {
		return nil, err
	}
	return aead.Open(nil, secret[:aead.NonceSize()], data, nil)
}
```

`Secret2Aead` 함수는 넘겨 받은 공통키를 기반으로 새로운 AES256 기반 갈루아 카운터 모드를 만들어 반환합니다. `Encrypt`와 `Decrypt`는 각각 세션 아이디와 바이트 슬라이스를 받아서 `Secret2Aead`를 호출하여 암/복호화하여 결과를 반환합니다.

```go
func Encapsulate(id string, data []byte) ([]byte, error) {
	content, err := Encrypt(id, data)
	if err != nil {
		return nil, err
	}
	capsule := new(capsule.Capsule)
	capsule.ID = id
	capsule.Data = content
	return proto.Marshal(capsule)
}

func Decapsulate(data []byte) (string, []byte, error) {
	capsule := new(capsule.Capsule)
	if err := proto.Unmarshal(data, capsule); err != nil {
		return "", nil, err
	}
	data, err := Decrypt(capsule.ID, capsule.Data)
	return capsule.ID, data, err
}
```

여기서 `capsule` 객체는 string 타입의 ID와 bytes 타입의 Data를 가지는 프로토타입 객체입니다. 각각 미리 작성한 `Encrypt`와 `Decrypt`를 호출하여 캡슐을 만들거나 해체합니다. 특이하게 `Decapsulate` 함수일 경우엔 응답시에 사용하기 위해 세션 아이디 또한 같이 반환합니다. 그리고 최초 1회, 서버와 클라이언트의 키교환 이후 다음 요청들은 `capsule` 객체에 암호화해서 저장하여 주고 받으면 TLS를 사용하지 않고 TLS를 사용한 것같은 효과를 볼 수 있습니다.

이렇게 키교환 이후 세션처럼 저장하고 사용하게 되면 서버 자원을 더 사용하게 되지만 요청과 응답 사이에 걸리는 시간을 이론상 감소시킬 수 있습니다만 실제로 사용하기 위해 고려해야할 것, 대용량 세션을 저장하고 불러오기 위한 코스트를 생각하면 TLS를 적용하는 것이 속 편할 것같습니다. 

```dart
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:get/get.dart';
import 'package:hive/hive.dart';
import 'package:http/http.dart';

Future<void> handshake() async {
  var configController = Get.find<ConfigController>();
  var domain = configController.domain;
  var keyPair = await X25519().newKeyPair();
  var publicKey = await keyPair.extractPublicKey();

  post(Uri.parse('http://$domain:9999/handshake'), body: Uint8List.fromList(publicKey.bytes)).then((value) async {
    var pub = Reply.fromBuffer(value.bodyBytes);
    var remoteKey =
    SimplePublicKey(pub.publicKey, type: KeyPairType.x25519);
    var sec = await X25519()
        .sharedSecretKey(keyPair: keyPair, remotePublicKey: remoteKey);
    var secret = await sec.extractBytes();

    configController.id = pub.iD;
    configController.aead = AesGcm.with256bits();
    configController.secretKey = SecretKey(secret.toList());
    configController.nonce = secret.sublist(0, 12);
    Get.defaultDialog(title: '연결 했습니다', middleText: '서버에 연결되었습니다!');

    await Hive.openBox<Uint8List>(configController.domain);
    var id = Hive.box<Uint8List>(configController.domain).get('id');
    if (id == null) {
      Get.toNamed(registerRoute);
    } else {
      Get.toNamed(candidateRoute);
    }
    Get.toNamed(registerRoute);
  }).catchError((err) {
    Get.defaultDialog(title: '에러가 발생하였습니다', middleText: err.toString());
  });
}
```

이 코드는 졸업작품에 작성한 플러터 코드입니다. 실행시 최초 1회, `handshake` 함수를 호출하여 키교환을 수행합니다. 서버와는 반대로 미리 공개키를 보내고 응답으로 서버의 공개키를 받아 공통키를 만들어 저장합니다. 다트의 `aead`와 고의 그것에는 조금의 차이가 있습니다.

```dart
import 'package:cryptography/cryptography.dart';
import 'package:get/get.dart';

Future<List<int>> decapsulate(List<int> data) async {
  var configController = Get.find<ConfigController>();
  var capsule = Capsule.fromBuffer(data);
  data = capsule.data;
  var mac = Mac(data.sublist(data.length - 16, data.length));
  data = data.sublist(0, data.length - 16);
  var content = await configController.aead.decrypt(
      SecretBox(data, nonce: configController.nonce, mac: mac),
      secretKey: configController.secretKey);
  return content;
}

Future<Capsule> encapsulate(List<int> data) async {
  var configController = Get.find<ConfigController>();
  var capsule = Capsule();
  capsule.iD = configController.id;
  var box = await configController.aead.encrypt(data,
      secretKey: configController.secretKey, nonce: configController.nonce);
  capsule.data = box.cipherText + box.mac.bytes;
  return capsule;
}
```

다트에서 캡슐을 만들고 해체하는 코드입니다. 고에서는 `Seal` 메서드의 결과를 그대로 쓰지만 다트에서는 받은 데이터에서 뒤 16자리를 분리하여 [mac](https://ko.wikipedia.org/wiki/%EB%A9%94%EC%8B%9C%EC%A7%80_%EC%9D%B8%EC%A6%9D_%EC%BD%94%EB%93%9C)으로 사용합니다. 즉, 고의 기본 라이브러리에서 제공하는 aes-gcm의 경우엔 암호화된 바이트 배열 뒤에 mac 바이트 배열도 자동으로 이어 붙여주지만 다트에서는 `SecretBox`라는 객체에 따로 만들어 놓았기에 이용할 때 다트에서 암호화된 바이트 배열에 mac 바이트 배열도 붙여서 이용해야했습니다.

글은 여기까지입니다. 아직 완성되지도 않았고 스트레스 테스트도 해보지 않았지만 나쁘지 않은 아이디어라 생각해서 한번 작성해보았습니다. 읽어주셔서 감사합니다. 