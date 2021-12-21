---
title: "더 나은 제안, Kemtls"
date: 2021-12-21T12:07:02+09:00
tags: ["go", "tls", "sidh", "sike", "kem"]
draft: false
---

`본 문서는 https://blog.cloudflare.com/kemtls-post-quantum-tls-without-signatures/ 의 번역이 일부 포함되어 있습니다.`

***

## 더 나은 제안: KEMTLS

서명이 외에 인증에 사용되는 다른 메커니즘에는 긴 역사가 있습니다. Signal 프로토콜, Noise 프레임워크 또는 WireGuard와 같은 최신 프로토콜은 인증을 위해 키 교환 매커니즘에 의존합니다. 하지만 이런 것들은 길게보면 중요한 키가 이해관계자 사이에 알려지기 때문에 TLS 1.3에 적합하지 않습니다.

(중략)

Krawczyk와 Wee의 OPTLS 제안은 NIKE(Non-Interactive Key Exchange)를 통해 악수 없이 TLS 핸드셰이크를 합니다. 그러나 포스트 퀀텀 NIKE를 위한 다소 효율적인 유일한 선택지는 CSIDH이며, 보안은 현재 진행 중인 논의 내용입니다. 하지만 우리는 이 아이디어를 바탕으로 KEM을 인증에 사용할 수 있습니다. 현재 실험 단계인 KEMTLS는 포스트 퀀텀 KEM 핸드셰이크를 대체합니다. 이 내용은 ‘Post-Quantum TLS Without Handshake Signatures’에서 Peter Schwabe, Douglas Stebila 그리고 Thom Wiggers가 디자인 및 소개했습니다.

KEMTLS는 TLS 1.3과 같은 목표(인증, 기밀성, 무결성)를 양자 컴퓨터에 대응하여 성취하고자 합니다. 하지만 TLS 1.3의 핸드셰이크와는 조금 다른 부분이 있습니다. KEMTLS는 클라이언트의 인증이 필요하지 않을 때, 클라이언트에서 서버로 보내는 두번째 TLS 메시지부터 암호화된 데이터를 보낼 수 있습니다. 그리고 양쪽 모두의 인증이 필요할 때는 클라이언트에서 서버로 보내는 세번째 TLS 메시지부터 암호화된 메시지를 보낼 수 있습니다. TLS 1.3에서는 서버도 첫번째 응답에 암호화된 데이터를 전송할 수 있습니다. ~~KEMTLS에서 클라이언트의 인증이 필요하지 않을 때, TLS 1.3과 같은 핸드셰이크 라운드 트립 이후에서야 첫번째 암호화된 데이터를 전송할 수 있습니다.~~

직관적으로 TLS 1.3의 핸드셰이크 서명은 서버 인증서에 인증된 공개키에 대응하는 개인키의 소유를 증명합니다. 이러한 서명 방식에서 소유를 증명할 수 있는 쉬운 방법이 있습니다. 다른 소유를 증명하는 방법은 키를 교환함으로 소유를 증명합니다. 키 파생 순서를 잘 생각해보면 서버는 인증된 공개키에 상응하는 개인키를 가지고 있을 경우에만 클라이언트의 메시지를 복호화할 수 있습니다. ~~그래서 암묵적 인증이 수행됩니다.~~ KEMTLS는 여전히 장기적인 KEM 키의 인증을 위해 인증 기관에 의존하고 있음을 알 필요가 있다. 

KEMTLS를 사용하면 핸드셰이크 과정에서 교환되는 데이터는 명시적이기보다 암시적으로 인증된다. 그리고 조금 약하게 저하된 회복성과 전방향 기밀성(forward secrecy)을 가집니다. 그러나 한번 KEMTLS 핸드셰이크가 완료되면 회복성의 완전한 소멸과 전방향 기밀성이 확보됩니다.

***

위 내용은 Cloudflare의 블로그의 내용을 일부 번역한 것입니다. 제 영어 실력이 좋지 않아 이해가 안되실테니 cloudflare에서 작성한 `sidh` 라이브러리를 사용하여 작성한 간단한 코드를 보여드리겠습니다.

```go
import (
	"crypto/rand"
	"errors"

	"github.com/cloudflare/circl/dh/sidh"
	"github.com/twisted-lyfes/utility/dh"
)

type KeyPair struct {
	priv *sidh.PrivateKey
	pub  *sidh.PublicKey
	kem  *sidh.KEM
}
```

먼저 `KeyPair` 구조체를 선언합니다. 멤버는 sidh의 개인키, 공개키, 그리고 `KEM`의 포인터를 저장합니다.

```go
func NewKeyPair() (dh.DH, error) {
	priv := sidh.NewPrivateKey(sidh.Fp751, sidh.KeyVariantSike)
	if err := priv.Generate(rand.Reader); err != nil {
		return nil, err
	}
	pub := sidh.NewPublicKey(sidh.Fp751, sidh.KeyVariantSike)
	priv.GeneratePublicKey(pub)
	kem := sidh.NewSike751(rand.Reader)

	return &KeyPair{
		priv: priv,
		pub:  pub,
		kem:  kem,
	}, nil
}
```

첫번째 생성자는 `KeyPair`에 개인키와 공개키, KEM을 생성하고 저장합니다.

```go
func NewKem() (dh.DH, error) {
	return &KeyPair{
		priv: nil,
		pub:  nil,
		kem:  sidh.NewSike751(rand.Reader),
	}, nil
}
```

두번째 생성자는 `KeyPair`에 개인키와 공개키를 `nil`로 비워두고 KEM만 생성해서 반환합니다.

```go
func (k *KeyPair) Encapsulate(publicKey []byte) (ct []byte, ss []byte, err error) {
	ct = make([]byte, k.kem.CiphertextSize())
	ss = make([]byte, k.kem.SharedSecretSize())
	other := sidh.NewPublicKey(sidh.Fp751, sidh.KeyVariantSike)
	if err := other.Import(publicKey); err != nil {
		return nil, nil, err
	}
	if err := k.kem.Encapsulate(ct, ss, other); err != nil {
		return nil, nil, err
	}
	return ct, ss, nil
}
```

`Encapsulate` 메서드는 외부 공개키를 받고, KEM에서 암호문 크기와 비밀키 크기를 받아 새로운 `[]byte`를 만들어 각각 생성 받아 반환하는 함수입니다. 이 중 암호문을 서버에 전송하여 지금 생성한 비밀키를 공유하는 데에 사용합니다.

```go
func (k *KeyPair) Decapsulate(cipherText []byte) (ss []byte, err error) {
	ss = make([]byte, k.kem.SharedSecretSize())
	if err := k.kem.Decapsulate(ss, k.priv, k.pub, cipherText); err != nil {
		return nil, err
	}
	return ss, nil
}
```

`Decapsulate` 메서드는 공유받은 암호문을 받아서 자신의 개인키와 공개키를 활용하여 비밀키를 복호화합니다.

```go
func TestKeyExchangeA(t *testing.T) {
	client, err := sidh.NewKem()
	if err != nil {
		t.Fatal(err)
	}

	server, err := sidh.NewKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	ctClient, ssClient, err := client.Encapsulate(server.ExportPublic())
	if err != nil {
		t.Fatal(err)
	}

	ssServer, err := b.Decapsulate(ctClient)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(ssClient, ssServer) {
		t.Fatal("secret shares do not match")
	}
	t.Log("secret shares match")
}
```

방금 코드를 기반으로 작성한 테스트 파일입니다. `client`와 `server`는 문자 그대로 클라이언트와 서버를 의미합니다. 보통 서버에서 공개키를 공개하고 있을 테니 `server`가 공개키를 제공하는 것으로 코드를 작성하였습니다. 먼저 클라이언트는 KEM만 생성하고 서버는 키쌍을 전부 생성합니다. 클라이언트에서 서버의 공개키를 받아서 `Encapsulate` 메서드를 통해 암호문(`ctClient`)과 비밀키(`ssClient`)를 만듭니다. 그리고 클라이언트는 생성된 암호문을 서버에 전송하고 서버는 `Decapsulate` 메서드를 사용하여 비밀키(`ssServer`)를 생성합니다. 마지막으로 이 두 비밀키가 동일한지 확인합니다.

```bash
Running tool: C:\Program Files\Go\bin\go.exe test -timeout 30s -run ^TestKeyExchangeA$ github.com/twisted-lyfes/utility/dh/sidh

ok  	github.com/twisted-lyfes/utility/dh/sidh	0.060s
```

테스트를 실행하면 성공하는 것을 확인할 수 있습니다.
