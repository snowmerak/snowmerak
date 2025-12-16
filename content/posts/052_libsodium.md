---
title: "나트륨이 아닙니다, 소듐입니다."
date: 2025-12-14T23:18:05+09:00
author: snowmerak
tags: ["libsodium", "memory", "network", "security", "go", "memguard", "secret"]
categories: ["Information"]
draft: false
---

## 소듐이요?

### 사족

저랑 비슷한 시기에 정규 교육을 나오신 분들은 나트륨이 더 익숙할 Na는 이제 소듐이 되었습니다. 저랑 같이 소듐으로 부르며 영포티가 되시죠. 전 아직 영써티지만요.

### 소금?

하여간에 그래서 왜 소듐인가, `libsodium`이란 라이브러리의 탄생 배경에는 다니엘 번스타인이라는 분이 만든 NaCl(Networking and Cryptography Library)이 있습니다. 이름 상태가 엄청난데, 발음이 `salt`입니다. `소금`이라고 읽으세요. 여튼 그래서 이 소금에서 소듐(나트륨)만 딱 빼내서 경량화 시킨게 `libsodium`입니다. 근데 솔직하게 말하자면, 전 소금을 직접적으로 다뤄보지 않았어서 소금과 소듐의 차이를 잘 모르겠습니다.

## 메모리에 소금 뿌리기

### 소듐을 할당

소듐은 일반적인 암호화 라이브러리와 그렇게 크게 거리감을 두고 얘기할 부분은 아닌 것같습니다. 다만, 확실히 대비되도록 어떤 장점이 있냐고 하면 저는 `sodium_malloc`을 둘 수 있을 것같습니다. 

`sodium_malloc`은 다음과 같은 과정으로 생성됩니다:
1. 페이지 단위로 3개의 연속된 페이지(카나리 가드 페이지 2개와 데이터 페이지 하나)를 할당받습니다. 총 메모리 크기는 제가 아는 선에서 12KB에서 48KB까지 다양할 것입니다.
2. 각 영역에 `mlock`이나 `VirtualLock`을 사용하여 스왑 메모리로 넘어가는 걸 방지합니다.
3. 또한 `madvise(..., MADV_DONTDUMP)`을 사용하여 코어 덤프 시에 기록되는 걸 방지합니다.
4. 그리고 데이터가 들어갈 가운데 페이지를 감싸는 양옆 페이지에 `mprotect`나 `VirtualProtect`를 사용하여 쓰기 작업을 금지(`sodium_mprotect_noaccess`)합니다.

이러한 조치로 얻을 수 있는 이점은 다음과 같습니다:
1. 제 광활한 램을 자랑할 수 있습니다.
2. 스왑으로 넘어가서 디스크에 한번이라도 기록된 민감 데이터가 포렌식으로 드러나는 걸 방지합니다.
3. 코어 덤프 시에 민감 데이터가 코어 덤프에 남아 코어 덤프와 함께 유출되는 걸 방지합니다.
4. 버퍼 오버플로우나 언더플로우, 랜덤 메모리 접근 등이 발생했을 때 즉시 앱이 종료되어 민감 데이터를 램에서 말소합니다.
   1. 다만, 이 경우에 코어 덤프가 떨어지며 남을 수 있으나 다행히 `sodium_malloc`은 `madvise`로 해당 상황을 미연에 방지합니다.

```typescript
import sodium from 'sodium-native'

console.log('--- Chapter 1: 소듐을 할당 ---')
// 일반 Buffer.alloc()과 달리, 스왑 방지, 코어 덤프 방지, 가드 페이지가 적용됩니다.
const secureBuf = sodium.sodium_malloc(1024)
console.log(`Allocated ${secureBuf.length} bytes securely.`)
```

### 메모리 잠그기

만약 랜덤 메모리 접근에서 운 좋게 민감 데이터의 메모리 영역에 접근할 수 있다고 가정하신다면 다음 작동을 추천드립니다.

1. `sodium_mprotect_noaccess`는 함수입니다. 해당 `sodium_malloc`으로 생성한 버퍼의 포인터를 넣으면 앞뒤 페이지와 동일하게 접근 시에 예외가 발생하도록 할 수 있습니다.
2. 필요할 때는 `sodium_mprotect_readonly`를 호출하여 해당 버퍼를 읽기 전용으로 바꿀 수 있습니다. 빠르게 읽기 작업만 수행하고 다시 잠그면 보안성을 향상시킬 수 있습니다.

```typescript
// 데이터 쓰기
secureBuf.fill(0xAA)
console.log('Data written.')

// 1. 읽기 전용으로 변경 (sodium_mprotect_readonly)
sodium.sodium_mprotect_readonly(secureBuf)
console.log('Buffer is now Read-Only.')

// 쓰기 시도 시 프로세스가 종료될 수 있습니다.
secureBuf[0] = 0xFF; // This would crash or throw

// 2. 접근 금지로 변경 (sodium_mprotect_noaccess)
// 이 상태에서는 읽기/쓰기 모두 프로세스를 종료시킵니다.
sodium.sodium_mprotect_noaccess(secureBuf)
console.log('Buffer is now Inaccessible (No-Access).')

// 다시 사용하려면 권한을 복구해야 합니다.
sodium.sodium_mprotect_readwrite(secureBuf)
console.log('Buffer is Read-Write again.')
```

### 메모리 비우기

버퍼를 모두 사용한 뒤엔 필히 `sodium_free`로 비우는 것이 좋습니다. 앞서 `sodium_malloc`이 한 내용을 역행하는 것도 있지만, 가장 중요한 건 버퍼의 모든 데이터를 `0`으로 바꾼 후 메모리를 반환한다는 것입니다.

이 내용이 중요한 이유는 기본적으로 메모리 할당자(`Allocator`)의 경우에 OS로부터의 메모리 할당이 비싸기 때문에 TLS에 캐시하여 재사용하는 경우가 있기 때문입니다. 이 경우에 버퍼를 지우는 작업 또한 할당할 때 하는 경우가 있습니다. 혹은 반환해도 즉시 지워지진 않을 수 있습니다. 그리고 만에 하나 이 영역이 유출되면 민감 데이터가 그대로 노출될 수 있습니다.

그럴 때를 대비하여 미리 `0`으로 모든 버퍼를 초기화하고 메모리를 반환하는 작업이 동반되는 `sodium_free`를 사용하는 것이 좀 더 좋습니다.

```typescript
// 메모리를 0으로 덮어쓰고 OS에 반환합니다.
sodium.sodium_free(secureBuf)
console.log('Buffer securely freed.')
```

이로써 비교적 안전하게 인-메모리에서 키를 관리할 수 있게 됩니다. 하지만 민감 데이터를 안전하게 갖고만 있어선 아무 의미가 없죠.

## 회선에 소금 뿌리기

### 키 교환하기

키 교환은 일반적인 DH과 유사합니다. 단, 현재 아래 코드로는 알고리즘이 X25519와 blake2b-512로 고정되어 있습니다. 

1. 늘 하던 대로 서버와 클라이언트 각각의 키 페어를 준비(`crypto_kx_keypair`)합니다.
2. 서로의 공개키를 교환하고, 각각 `crypto_kx_client_session_keys`와 `crypto_kx_server_session_keys`를 이용해 세션키를 생성합니다.
   1. 이때 당연히 X25519를 사용하기에 일반적인 키 교환과 마찬가지로 공유키(`Shared Secret`)이 생성됩니다.
   2. 다만, 소듐에서는 Rx와 Tx에 대해 서로 다른 키를 사용하여 주고 받을 때 서로 다른 키로 암호화된 데이터를 사용합니다.
   3. 내부적으로 `Shared Secret || Client PublicKey || Server PublicKey`을 수행한 후, blake2b-512로 64바이트의 키를 생성합니다.
   4. 이후 반환할 때 앞 32바이트와 뒤 32바이트를 별도의 용도로 사용하게 됩니다.
      1. 앞 32바이트는 서버(Tx) -> 클라이언트(Rx)에 사용됩니다.
      2. 뒤 32바이트는 클라이언트(Tx) -> 서버(Rx)에 사용됩니다.

```typescript
import sodium from 'sodium-native'

console.log('--- Key Exchange (KX) Example ---')

// 1. Server generates a keypair
const serverPublicKey = Buffer.alloc(sodium.crypto_kx_PUBLICKEYBYTES)
const serverSecretKey = Buffer.alloc(sodium.crypto_kx_SECRETKEYBYTES)
sodium.crypto_kx_keypair(serverPublicKey, serverSecretKey)
console.log('Server Public Key:', serverPublicKey.toString('hex'))

// 2. Client generates a keypair
const clientPublicKey = Buffer.alloc(sodium.crypto_kx_PUBLICKEYBYTES)
const clientSecretKey = Buffer.alloc(sodium.crypto_kx_SECRETKEYBYTES)
sodium.crypto_kx_keypair(clientPublicKey, clientSecretKey)
console.log('Client Public Key:', clientPublicKey.toString('hex'))

// 3. Client derives session keys
// Client needs: Client Public, Client Secret, Server Public
const clientRx = Buffer.alloc(sodium.crypto_kx_SESSIONKEYBYTES)
const clientTx = Buffer.alloc(sodium.crypto_kx_SESSIONKEYBYTES)
sodium.crypto_kx_client_session_keys(clientRx, clientTx, clientPublicKey, clientSecretKey, serverPublicKey)

// 4. Server derives session keys
// Server needs: Server Public, Server Secret, Client Public
const serverRx = Buffer.alloc(sodium.crypto_kx_SESSIONKEYBYTES)
const serverTx = Buffer.alloc(sodium.crypto_kx_SESSIONKEYBYTES)
sodium.crypto_kx_server_session_keys(serverRx, serverTx, serverPublicKey, serverSecretKey, clientPublicKey)

console.log('\n--- Session Keys Derived ---')
console.log('Client RX:', clientRx.toString('hex'))
console.log('Server TX:', serverTx.toString('hex'))
console.log('Match?', clientRx.equals(serverTx) ? '✅ Yes' : '❌ No')

console.log('Client TX:', clientTx.toString('hex'))
console.log('Server RX:', serverRx.toString('hex'))
console.log('Match?', clientTx.equals(serverRx) ? '✅ Yes' : '❌ No')
```

그래서 실행해보면 각각의 Tx:Rx 쌍이 일치하도록 나오는 걸 확인할 수 있습니다.

```shell
~ bun kx_example.ts                                                              
--- Key Exchange (KX) Example ---
Server Public Key: 05774cf2e23700b25c685d966dcc739cee456cafe1f2f2583f2eb71138ca792e
Client Public Key: b1f56d472e25a23fdfb9bd5b6113e3b07535654ccc357a3b731d0d372a999e31       

--- Session Keys Derived ---
Client RX: 39e42f9be55b1705bee32dca66049ec19e7827804944e3e4201d82ee4eec8b01
Server TX: 39e42f9be55b1705bee32dca66049ec19e7827804944e3e4201d82ee4eec8b01
Match? ✅ Yes
Client TX: 28e3a0590e41f8849b743d897d6e720a2a6ba6f89a6a094a7f812f95be5abb9e
Server RX: 28e3a0590e41f8849b743d897d6e720a2a6ba6f89a6a094a7f812f95be5abb9e
Match? ✅ Yes
```

### 암호화된 통신하기

그럼 방금 교환한 키를 이용해서 암호화 통신을 해보겠습니다. 일반적으로 많이 쓰이는 대칭키 암호화는 `AES256-CBC`, `AES256-GCM`, `ChaCha20Poly1305` 등이 있습니다. 그러나 여기에선 스트림 암호화 알고리즘 중 하나인 `XChaCha20Poly1305`를 사용해보겠습니다.

당연히 소듐에는 여러가지 알고리즘이 지원되며 `crypto_aead_chacha20poly1305_ietf_*`, `crypto_aead_xchacha20poly1305_ietf_*`, `crypto_aead_salsa20poly1305_ietf_*`, `crypto_aead_xsalsa20poly1305_ietf_*` 함수와 상수로 해당 알고리즘을 이용할 수 있습니다.

> 아까 키 교환한 것에 이어서 그대로 작업합니다.\

1. `Nonce`를 생성하기 위해 `*_NPUBBYTES`를 참조하여 논스를 위한 버퍼를 생성합니다.
2. 논스를 받은 뒤 AD(`Additional Data`)와 평문 데이터와 함께 `*_encrypt` 함수로 암호화를 합니다.
   1. 이때 방금 만들었던 `clientTx`나 `serverTx`를 사용합니다.
3. 별도로 받은 논스와 AD, 암호화된 데이터를 `*_decrypt` 함수를 이용하여 복호화 합니다.
   1. 마찬가지로 `serverRx`나 `clientRx`를 사용합니다.

```typescript
const protocolHeader = Buffer.from('protocol-v1')
console.log('Using Protocol Header (AD):', protocolHeader.toString())

// 1. Client sends a message to Server
// Client encrypts using its TX key
const clientMessage = Buffer.from('Hello Server, this is Client!')
const clientNonce = Buffer.alloc(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
sodium.randombytes_buf(clientNonce)

const clientCiphertext = Buffer.alloc(clientMessage.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(clientCiphertext, clientMessage, protocolHeader, null, clientNonce, clientTx)

console.log('Client sends (encrypted):', clientCiphertext.toString('hex'))

// Server decrypts using its RX key
const serverDecrypted = Buffer.alloc(clientCiphertext.length - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
// Note: decrypt returns the length of the message on success, or throws/returns undefined on failure depending on binding.
// In sodium-native, it returns the length of the decrypted message, or throws if verification fails.
try {
    sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(serverDecrypted, null, clientCiphertext, protocolHeader, clientNonce, serverRx)
    console.log('Server received (decrypted):', serverDecrypted.toString())
} catch (err) {
    console.error('Server failed to decrypt!', err)
}

// 2. Server responds to Client
// Server encrypts using its TX key
const serverMessage = Buffer.from('Hello Client, I received your message!')
const serverNonce = Buffer.alloc(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
sodium.randombytes_buf(serverNonce)

const serverCiphertext = Buffer.alloc(serverMessage.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(serverCiphertext, serverMessage, protocolHeader, null, serverNonce, serverTx)

console.log('Server responds (encrypted):', serverCiphertext.toString('hex'))

// Client decrypts using its RX key
const clientDecrypted = Buffer.alloc(serverCiphertext.length - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
try {
    sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(clientDecrypted, null, serverCiphertext, protocolHeader, serverNonce, clientRx)
    console.log('Client received (decrypted):', clientDecrypted.toString())
} catch (err) {
    console.error('Client failed to decrypt!', err)
}
```

이 코드를 실행하면 이런 식으로 메시지를 안전하게 주도 받는 걸 확인할 수 있습니다.

```shell
Using Protocol Header (AD): protocol-v1
Client sends (encrypted): 6030256ca75021a4c08bd1a868f3c7ccdf506b662b1931643afa745d3e994c8f17050d259d378e4d8ef692f9dd
Server received (decrypted): Hello Server, this is Client!
Server responds (encrypted): fec3d7175fc52ad920923fdb1a3e0cc04554b4d62316f6906236ff1de163b11b134ef059c5626f9547d76ab01219ffc3e435e992a7a1
Client received (decrypted): Hello Client, I received your message!
```

하지만, 이 구조에는 명확한 취약점이 하나 있습니다. 바로 리플레이 어택(`Replay Attack`)입니다. 특정 동작을 하기 위해 전송된 기존 메시지를 이용하여 그대로 재전송하여 기존 동작의 효과를 반복적으로 만드는 것입니다. 이를 대응하기 위해선 MAC이나 AD에서 카운터를 이용하는 방식을 가장 쉽게 사용할 수 있습니다.

### 스트림 시크릿

이런게 있습니다. 자동으로 논스 관리 해줍니다. 신기합니다.

```typescript
import sodium from 'sodium-native'

// 1. Key Generation
const key = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES)
sodium.crypto_secretstream_xchacha20poly1305_keygen(key)
console.log('Key generated:', key.toString('hex'))

// --- Sender Side ---
console.log('\n--- Sender: Encrypting Stream ---')

// Initialize Push Stream
const header = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
const stateOut = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES)
sodium.crypto_secretstream_xchacha20poly1305_init_push(stateOut, header, key)

console.log('Header generated:', header.toString('hex'))

// Messages to send
const messages = [
  { text: 'Chunk 1: Hello', tag: sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE },
  { text: 'Chunk 2: World', tag: sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE },
  { text: 'Chunk 3: Final', tag: sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL }
]

const encryptedChunks: Buffer[] = []

for (const msg of messages) {
  const plaintext = Buffer.from(msg.text)
  const ciphertext = Buffer.alloc(plaintext.length + sodium.crypto_secretstream_xchacha20poly1305_ABYTES)
  
  sodium.crypto_secretstream_xchacha20poly1305_push(
    stateOut,
    ciphertext,
    plaintext,
    null, // AD (Optional)
    msg.tag
  )
  
  encryptedChunks.push(ciphertext)
  console.log(`Encrypted "${msg.text}" -> ${ciphertext.toString('hex')}`)
}


// --- Receiver Side ---
console.log('\n--- Receiver: Decrypting Stream ---')

// Initialize Pull Stream
const stateIn = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES)
sodium.crypto_secretstream_xchacha20poly1305_init_pull(stateIn, header, key)

for (let i = 0; i < encryptedChunks.length; i++) {
  const ciphertext = encryptedChunks[i]
  const decrypted = Buffer.alloc(ciphertext.length - sodium.crypto_secretstream_xchacha20poly1305_ABYTES)
  const tagBuf = Buffer.alloc(sodium.crypto_secretstream_xchacha20poly1305_TAGBYTES) // To store the received tag
  
  try {
    const ret = sodium.crypto_secretstream_xchacha20poly1305_pull(
      stateIn,
      decrypted,
      tagBuf,
      ciphertext,
      null
    )
    
    if (ret === false) {
        throw new Error('Decryption failed (forged?)')
    }

    // The tag is written to tagBuf[0]
    const receivedTag = tagBuf[0]
    
    let tagStr = 'UNKNOWN'
    if (receivedTag === sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE) tagStr = 'MESSAGE'
    if (receivedTag === sodium.crypto_secretstream_xchacha20poly1305_TAG_PUSH) tagStr = 'PUSH'
    if (receivedTag === sodium.crypto_secretstream_xchacha20poly1305_TAG_REKEY) tagStr = 'REKEY'
    if (receivedTag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) tagStr = 'FINAL'

    console.log(`Decrypted: "${decrypted.toString()}" [Tag: ${tagStr}]`)
    
    if (receivedTag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
        console.log('End of stream reached.')
    }

  } catch (err) {
    console.error('Decryption error:', err)
  }
}
```

## 그래서 이제 안전한가요?

### 한가지만 더

Go 언어에서는 `memguard`를 이용해서 소듐과 유사한 장치를 만들 수 있습니다. `memguard`가 소듐에게 영향을 받아 만들어진 라이브러리가 유사한 기능이 제공되고 있거든요.

전체적인 구조는 유사합니다. `sodium_malloc`대신 `NewBufferRandom`이나 `NewBufferFromBytes`를 사용하고 있으며, `sodium_free`를 대신하여 `WipeBytes`가 버퍼를 `0`으로 초기화 및 `Destroy`가 버퍼 할당 해제를 담당합니다.

동일하게 스왑 방지, 접근 방지, 침해 방지 등이 적용되어 있습니다. 단, 버퍼 자체에 대한 `mprotect`는 적용되어 있지 않습니다.

```go
package main

import (
	"fmt"

	"github.com/awnumar/memguard"
)

func main() {
	defer memguard.SafeExit(0)
	memguard.CatchInterrupt()

	// 1. Generate a random key directly into a LockedBuffer
	key1 := memguard.NewBufferRandom(32)
	defer key1.Destroy()

	fmt.Printf("Key 1 (Random) Address: %p\n", key1)
	fmt.Printf("Key 1 Size: %d bytes\n", key1.Size())
	fmt.Printf("Key 1 Data (Hex): %x\n", key1.Bytes())

	// 2. Create a LockedBuffer from existing data
	sensitiveData := []byte("my-secret-password-1234")
	key2 := memguard.NewBufferFromBytes(sensitiveData)
	defer key2.Destroy()

	memguard.WipeBytes(sensitiveData)

	fmt.Printf("\nKey 2 (From Bytes) Address: %p\n", key2)
	fmt.Printf("Key 2 Data (String): %s\n", key2.Bytes())

	fmt.Println("\nAll buffers will be destroyed on exit.")
}
```

하지만, 이렇게만 되어 있을 경우에 여전히 평문 데이터가 누구나 접근 가능한 상태(소듐은 `noaccess` 걸면 다른 이야기긴 합니다)인 것이 거슬릴 수 있습니다. 그렇기에 암호화해서 저장할 수 있는 `memguard.Enclave`를 사용하여 레이어를 추가할 수 있습니다.

```go
package main

import (
	"fmt"

	"github.com/awnumar/memguard"
)

func main() {
	defer memguard.SafeExit(0)
	memguard.CatchInterrupt()

	// 1. Create a LockedBuffer with sensitive data
	originalBuffer := memguard.NewBufferFromBytes([]byte("super-secret-enclave-data"))
	fmt.Printf("Original Buffer Address: %p\n", originalBuffer)
	fmt.Printf("Original Data: %s\n", originalBuffer.Bytes())

	// 2. Seal the buffer into an Enclave
	enclave := originalBuffer.Seal()
	fmt.Println("\nBuffer sealed into Enclave.")

	// originalBuffer은 이 시점에 파괴됩니다.
	// 명시적으로 originalBuffer.Destroy()를 호출할 필요가 없습니다..

	// 3. Open the Enclave to access data
	decryptedBuffer, err := enclave.Open()
	if err != nil {
		panic(err)
	}
	defer decryptedBuffer.Destroy() // 위 originalBuffer와 다른 LockedBuffer이기에 꼭 폭파시켜야합니다.

	fmt.Printf("\nDecrypted Buffer Address: %p\n", decryptedBuffer)
	fmt.Printf("Decrypted Data: %s\n", decryptedBuffer.Bytes())

	// 4. Enclave is reusable (immutable)
	decryptedBuffer2, _ := enclave.Open()
	defer decryptedBuffer2.Destroy()
	fmt.Printf("Opened again: %s\n", decryptedBuffer2.Bytes())

	fmt.Println("\nExiting safely...")
}
```

원리는 간단합니다. 처음 인클레이브가 생성될 때 앱이 관리하는 메모리 어딘가에 시크릿을 생성하고 필요에 따라 `LockedBuffer`를 암호화하여 `Enclave`로 만들고, 복호화하여 `LockedBuffer` 상태로 활용하길 반복합니다. 이 과정에서 `mprotect`도 지속적으로 토글됩니다.

당연한 이야기지만, 하나의 동작(`Seal`과 `Unseal`)에 시스템 콜 여러번과 암복호화가 포함되어 있다보니 상당히 비싼 편입니다. 정말 중요한 민감 데이터에만 사용해야합니다.

### 그리고 조금만 더

Go는 1.26에 `runtime/secret` 패키지가 추가될 예정입니다. 해당 패키지는 특정 스코프에 대해 클린룸을 제공합니다.

```go
package secret

// Do invokes f.
//
// Do ensures that any temporary storage used by f is erased in a
// timely manner. (In this context, "f" is shorthand for the
// entire call tree initiated by f.)
//   - Any registers used by f are erased before Do returns.
//   - Any stack used by f is erased before Do returns.
//   - Any heap allocation done by f is erased as soon as the garbage
//     collector realizes that it is no longer reachable.
//   - Do works even if f panics or calls runtime.Goexit. As part of
//     that, any panic raised by f will appear as if it originates from
//     Do itself.
func Do(f func())
```

저희가 주로 사용하게 될 함수는 `secret.Do`입니다. 이 함수는 인자로 받은 익명 함수를 실행할 때 할당된 레지스터와 스택이 스코프가 종료될 때 확실하게 `0`으로 밀고 해제됩니다. 또한 힙에 할당된 메모리는 추후 GC가 가져갈 때 확정적으로 `0`으로 밀립니다. 이 동작은 패닉이 발생해도 무시하고 실행합니다.

이렇게만 봐서는 딱히 무엇이 장점인지 알기 어렵습니다. 하지만 `memguard`와 함께 쓰면서 평소에는 `Enclave`에 저장하고 있으면서 필요에 따라 `secret.Do` 내에서 `LockedBuffer`로 복호화하여 사용하고 즉시 `Destroy` 하면서 스택과 레지스터까지 정리하면 추적할 수 있는 흔적까지 최소화할 수 있습니다.

```go
package main

import (
	"fmt"
    "runtime/secret"

	"github.com/awnumar/memguard"
)

func main() {
	defer memguard.SafeExit(0)
	memguard.CatchInterrupt()

	// 1. Create a LockedBuffer with sensitive data
	originalBuffer := memguard.NewBufferFromBytes([]byte("super-secret-enclave-data"))
	fmt.Printf("Original Buffer Address: %p\n", originalBuffer)
	fmt.Printf("Original Data: %s\n", originalBuffer.Bytes())

	// 2. Seal the buffer into an Enclave
	enclave := originalBuffer.Seal()
	fmt.Println("\nBuffer sealed into Enclave.")

	// originalBuffer은 이 시점에 파괴됩니다.
	// 명시적으로 originalBuffer.Destroy()를 호출할 필요가 없습니다..

	// 3. Open the Enclave to access data
    secret.Do(func() {
	    decryptedBuffer, err := enclave.Open()
	    if err != nil {
	    	panic(err)
	    }
	    defer decryptedBuffer.Destroy() // 위 originalBuffer와 다른 LockedBuffer이기에 꼭 폭파시켜야합니다.

	    fmt.Printf("\nDecrypted Buffer Address: %p\n", decryptedBuffer)
	    fmt.Printf("Decrypted Data: %s\n", decryptedBuffer.Bytes())
    })

	// 4. Enclave is reusable (immutable)
    secret.Do(func(){
	    decryptedBuffer2, _ := enclave.Open()
	    defer decryptedBuffer2.Destroy()
	    fmt.Printf("Opened again: %s\n", decryptedBuffer2.Bytes())
    })

	fmt.Println("\nExiting safely...")
}
```

`memguard`만 있을 때 작성된 예제를 이렇게 고도화할 수 있습니다. 당연히 `Seal`하는 과정도 `secret.Do`에 포함시킬 수 있으나, 현재 상황에서 그다지 효용성을 느끼지 못 했습니다.

## 그래서

원래는 nodejs에서 안전하게 메모리를 관리하기 위한 방법이 어떤 것이 있는가를 고민하다 소듐을 확인했습니다만, 이후 Go 언어의 `memguard`와 `secret`에 대해서도 연관성이 있다 생각되어 한번 확인해봤습니다.

이 글과 연관된 벤치마크 자료도 있으나 자료 자체를 보여드릴 순 없지만 몇가지 언급은 가능해 보입니다.
- 일반적인 사용 상황에서 `sodium-native`가 수동으로 `mprotect`를 사용하는 식으로 메모리를 관리해도 기반이 C++이기에 생각보다 매우 좋은 성능을 보여줍니다.
- 생각보다 `memguard.Enclave`가 암복호화와 시스템콜의 오버헤드로 인해 많이 느립니다.
- 당연하지만 `memguard.LockedBuffer`는 `sodium-native`의 그것과 비교해서 상당히 빠릅니다.

여튼 상당히 좋은 성능을 보여주기 때문에 php를 제외한 nodejs를 비롯한 다른 소듐을 지원하는 스크립트 언어들에서도 안전한 메모리 관리로 보안에 신경을 써주시면 좋을 것같습니다.
