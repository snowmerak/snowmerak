---
title: "전략 패턴에 대해서"
date: 2022-03-04T15:57:12+09:00
tags: ["go", "rust", "java", "kotlin", "design pattern", "strategy"]
draft: false
---

> 행위 패턴의 하나로, `어떤 문제`를 해결함에 `어떤 방법`을 사용하는 지 적절히 선택, 혹은 작성할 수 있게 해주는 패턴

---

## 코틀린으로 평균을 구하는 계산기 만들기

이 계산기의 평균을 구하는 방법은 총 3가지가 있습니다.

1. 산술 평균 : (a + b) / 2
  
2. 기하 평균 : root2(a * b)
  
3. 조화 평균 : 2ab / (a + b)
  

이 3가지를 각각 따로 입력 받아 실행하는 `평균만 구하는 계산기`의 코틀린 코드입니다.

```kotlin
import kotlin.math.sqrt

fun main(args: Array<String>) {
    val (a, b) = Pair(30, 80)
    val arithmeticCalculator = Calculator(ArithmeticMean())
    println(arithmeticCalculator.average.calculate(a, b))

    val geometricCalculator = Calculator(GeometricMean())
    println(geometricCalculator.average.calculate(a, b))

    val harmonicCalculator = Calculator(HarmonicMean())
    println(harmonicCalculator.average.calculate(a, b))
}

class Calculator(val average: Average)

interface Average {
    fun calculate(a: Int, b: Int): Int
}

class ArithmeticMean: Average {
    override fun calculate(a: Int, b: Int): Int {
        return (a + b) / 2
    }
}

class GeometricMean: Average {
    override fun calculate(a: Int, b: Int): Int {
        return sqrt(a.toDouble() * b.toDouble()).toInt()
    }
}

class HarmonicMean: Average {
    override fun calculate(a: Int, b: Int): Int {
        return (2*a*b) / (a + b)
    }
}
```

`ArithmeticMean`, `GeometricMean`, `HarmonicMean` 클래스는 `Average` 인터페이스를 상속 받아 평균을 구하는 메서드를 오버라이드하고 있습니다.

`Calculator` 클래스는 이 `Average` 인터페이스를 입력 받아 평균을 구하는 기능을 가진 계산기를 생성합니다.

메인 함수를 보면 각 계산기 클래스 구현체에서 `average.calculate` 메서드를 호출하여 평균을 계산했을 때 산술, 기하, 조화 평균에 맞는 값을 출력하는 걸 확인할 수 있습니다.

```kotlin
55
48
43
```

이 예시에서는 코틀린의 인터페이스를 활용하여 각기 다른 메서드 구현을 가지는 클래스를 매개로 전략 패턴을 구현했습니다.

---

## 자바에서 AES 암호화하기

```java
import javax.crypto.*;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

class Hex {
    static public String from(byte[] a) {
        return new java.math.BigInteger(a).toString(16);
    }

    static public byte[] toBytes(String a) {
        return new java.math.BigInteger(a, 16).toByteArray();
    }
}

class SHA256 {
    static public byte[] hash(String source) throws NoSuchAlgorithmException {
        MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
        return messageDigest.digest(source.getBytes(StandardCharsets.UTF_8));
    }
}
```

`Hex` 클래스와 `SHA256` 클래스를 먼저 만듭니다. 전자는 바이트 배열을 헥스 문자열로 바꾸거나 헥스 문자열을 바이트 배열로 바꾸는 역할을 합니다. 후자는 입력받은 문자열을 sha256 알고리즘으로 해싱합니다.

```java
class AES {
    private final Cipher cipher;
    private final SecretKey key;
    private final byte[] iv;

    public AES(String algorithm, String password) throws NoSuchAlgorithmException, NoSuchPaddingException {
        byte[] passwordBytes = SHA256.hash(password);

        KeyGenerator keygen = KeyGenerator.getInstance("AES");
        keygen.init(256);

        key = new SecretKeySpec(passwordBytes, "AES");
        iv = new byte[16];
        System.arraycopy(passwordBytes, 0, iv, 0, 16);

        cipher = Cipher.getInstance(algorithm);
    }

    public String encrypt(String plainText) throws IllegalBlockSizeException, BadPaddingException, InvalidAlgorithmParameterException, InvalidKeyException {
        cipher.init(Cipher.ENCRYPT_MODE, key, new IvParameterSpec(iv));

        byte[] ciphertext = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

        return Hex.from(ciphertext);
    }

    public String decrypt(String cipherText) throws InvalidAlgorithmParameterException, InvalidKeyException, IllegalBlockSizeException, BadPaddingException {
        cipher.init(Cipher.DECRYPT_MODE, key, new IvParameterSpec(iv));

        byte[] decodedText = Hex.toBytes(cipherText);
        byte[] plainText = cipher.doFinal(decodedText);

        return new String(plainText, StandardCharsets.UTF_8);
    }
}
```

`AES` 클래스는 aes 암호화 알고리즘을 사용하기 위한 간단한 래핑 클래스입니다. 생성자에서 사용할 알고리즘과 비밀번호를 입력받습니다. 입력받은 비밀번호를 기반으로 암호화에 필요한 키 스펙을 생성하고 입력받은 알고리즘을 기반으로 `Cipher` 클래스 구현체를 생성합니다.

이 `Cipher` 클래스 구현체에 따라 서로 다른 방식의 aes 암호화를 진행합니다.

```java
public class App {
    public static void main(String[] args) throws NoSuchPaddingException, NoSuchAlgorithmException, InvalidAlgorithmParameterException, IllegalBlockSizeException, BadPaddingException, InvalidKeyException {
        var plainText = "Hello, World!";
        System.out.println("Plain text: " + plainText);

        var cbc = new AES("AES/CBC/PKCS5PADDING", "1q2w3e4r");
        var cbcEncrypted = cbc.encrypt(plainText);
        var cbcDecrypted = cbc.decrypt(cbcEncrypted);
        System.out.println("CBC encrypted: " + cbcEncrypted);
        System.out.println("CBC decrypted: " + cbcDecrypted);

        var ctr = new AES("AES/CTR/NoPadding", "1q2w3e4r");
        var ctrEncrypted = ctr.encrypt(plainText);
        var ctrDecrypted = ctr.decrypt(ctrEncrypted);
        System.out.println("CTR encrypted: " + ctrEncrypted);
        System.out.println("CTR decrypted: " + ctrDecrypted);
    }
}
```

메인 메서드에서는 평문인 `Hello, World!`를 각각 aes-cbc와 aes-ctr 방식으로 암호화 및 복호화합니다. `AES` 클래스의 생성자에 입력한 알고리즘이 CBC인지, CTR인지에 따라 서로 다른 방식의 암호화 방식을 취하고 있습니다.

```bash
Plain text: Hello, World!
CBC encrypted: -2f0c50ee15e575610bfe998bef09f085
CBC decrypted: Hello, World!
CTR encrypted: -24b40ce10f09034538f4cff9f0
CTR decrypted: Hello, World!
```

대칭키 암호화 방식인 aes에 같은 비밀번호를 사용했음에도 서로 다른 암호문이 나온걸 확인할 수 있습니다.

팩토리 패턴에도 상충하는 부분이 존재합니다. 자바에는 이러한 형식, 전략을 선택하는 과정에서 팩토리 패턴으로 구현된 케이스가 많이 산재해있습니다.

---

## LogStream 구현에서 버퍼 선택하기

로그스트림은 제가 고 패키지로 구현한 로그 라이브러리입니다. 내부에 메시지큐처럼 로그 객체를 잠시 저장하고 있을 버퍼가 필요합니다.

```go
package logbuffer

import "github.com/diy-cloud/logstream/v2/log"

type LogBuffer interface {
    Push(log log.Log) error
    Pop() (log.Log, error)
    Size() int
}
```

버퍼는 `LogBuffer` 인터페이스를 구현하는 객체로 구성됩니다.

이 인터페이스를 구현한 각 구조체 내부의 자료구조는 [Workiva의 go-datastructures](https://github.com/Workiva/go-datastructures)에서 임포트했습니다.

```go
package logring

import (
    "fmt"

    "github.com/Workiva/go-datastructures/queue"
    "github.com/diy-cloud/logstream/v2/log"
    "github.com/diy-cloud/logstream/v2/log/logbuffer"
)

type LogRingBuffer struct {
    ringbuffer *queue.RingBuffer
}

func New(size int) logbuffer.LogBuffer

func (lrb *LogRingBuffer) Push(value log.Log) error

func (lrb *LogRingBuffer) Pop() (log.Log, error)

func (lrb *LogRingBuffer) Size() int
```

링 버퍼를 래핑하여 만든 구조체입니다. 이것을 로그스트림 버퍼로 사용하게 되면 넣고 빼는 퍼포먼스가 우수하지만 컨커런트한 환경에서 들어온 순서로 정렬되기에 로그가 시간순으로 처리되지 않을 수 있습니다.

```go
package logqueue

import (
    "errors"

    "github.com/Workiva/go-datastructures/queue"
    "github.com/diy-cloud/logstream/v2/log"
    "github.com/diy-cloud/logstream/v2/log/logbuffer"
)

type LogQueue struct {
    queue *queue.PriorityQueue
}

func New(size int) logbuffer.LogBuffer

func (lq *LogQueue) Push(log log.Log) error

func (lq *LogQueue) Pop() (log.Log, error)

func (lq *LogQueue) Size() int
```

우선순위 큐를 래핑한 구조체입니다. 들어온 순서보다 로그가 가진 시간을 기준으로 순서가 정해지기에 좀 더 시간순으로 이용하기에 적합하지만 퍼포먼스는 링 버퍼에 비해 많이 느린 편입니다.

```go
package logstream

import (
    "errors"
    "sync"

    "github.om/Workiva/go-datastructures/trie/ctrie"
    "github.com/diy-cloud/logstream/v2/consumer"
    "github.com/diy-cloud/logstream/v2/log/logbuffer"
    "github.com/diy-cloud/logstream/v2/log/logbuffer/logring"
)

var bufferConstructor func(int) logbuffer.LogBuffer = logring.New

func (t tempTrie) SetBufferConstructor(f func(int) logbuffer.LogBuffer) {
    bufferConstructor = f
}
```

두 버퍼 중 상황에 더 적합한 버퍼를 선택하여 `logstream.SetBufferConstructor` 메서드에 생성자를 넘겨주고 필요에 따라 생성하여 쓰게 됩니다.

생성자를 넘겨주는 것에 OOP가 아니라고 생각하실 수 있습니다. 이것에 대해서는 아래에 다시 작성하겠습니다.

---

## 특징 및 장점

1. 서로 다른 알고리즘을 `런타임`에 변경하고 적용할 때 사용합니다.
  위 3가지 예시 모두 런타임에 어떤 계산 방식, 어떤 암호화 방식, 어떤 버퍼를 쓸지 정할 수 있습니다.
  
2. 같은 레이어의 서로 다른 구현체는 철저히 격리되어 있지만 동일한 입출력 타입을 보장합니다.
  동일한 인터페이스를 구현하여 동일한 동작을 보장합니다.
  
3. 각 인터페이스를 구현하는 구현체는 각자의 비즈니스 로직을 가집니다.
  입출력 타입은 동일하지만 내부 동작이 다르므로 동일한 입력에도 서로 다른 출력을 가집니다.
  
4. 느슨한 결합으로 구성되어 새로운 구현부를 추가하기 용이합니다.
  

---

## 단점

1. 적은 수의 알고리즘만 존재하고 거의 수정되지 않으면 불필요하게 복잡해질 수 있습니다.
  
2. 이 패턴으로 만들어진 객체를 이용하는 사람은 알고리즘 간의 차이를 알아야 합니다.
  어떤 알고리즘을 선택할지는 전적으로 객체를 이용하는 사람이 결정합니다.
  

---

## FP

프로그래밍 환경이 과거와 달리 OOP로만 작업을 하는 케이스는 거의 없고 선언형, 함수형 프로그래밍의 개념이 일반적인 프로그래밍 환경에도 많이 녹아들었기에 디자인 패턴의 변형도 이제는 생각해야할 시기라고 생각합니다.

OOP의 전략 패턴은 객체를 중심으로 생각하기에 각 알고리즘의 명세를 인터페이스로 정의하고 클래스(혹은 구조체)로 만들어 객체를 생성하여 넘기는게 일반적입니다.

하지만 `서로 다른 구현부를 런타임에 자유롭게 교체하여 사용할 수 있는` 전략 패턴의 의의를 가져온다면 굳이 객체만 넘겨야할 필요는 없다고 생각합니다.

### 해시 알고리즘 선택하기

```go
package main

import (
    "crypto/sha256"
    "fmt"

    "golang.org/x/crypto/blake2b"
    "golang.org/x/crypto/blake2s"
)

func main() {
    var hasher func([]byte) [32]byte = nil

    hasher = sha256.Sum256
    fmt.Println(hasher([]byte("hello")))

    hasher = blake2b.Sum256
    fmt.Println(hasher([]byte("hello")))

    hasher = blake2s.Sum256
    fmt.Println(hasher([]byte("hello")))
}
```

로그 버퍼 선택하는 예시와 마찬가지로 객체 자체를 넘기기 보다 특정 동작을 하는 함수를 기반으로 전략 패턴을 구현한 케이스입니다.

어떠한 해시 함수(알고리즘 구현부)와 일급 함수 변수가 느슨하게 결합되어 있으며 런타임에 유연하게 교체하여 적용할 수 있습니다. 또한 동일 레이어, 각 해시 함수들은 서로에게 영향을 주지 않고 각자의 로직을 함수 정의에 포함시켰습니다. 확장 또한 새로운 함수를 구현하면 되기에 쉽습니다.

### 단점?

책의 저자는 전략 패턴의 마지막 단점으로 이러한 함수형의 특징 때문에 굳이 OOP의 전략 패턴을 사용하기보다 함수형의 함수 시그니처를 활용하면 클래스 정의와 인터페이스 정의, 패키지 분리 등을 통해 코드가 부풀려지는 걸 방지할 수 있다고 작성했습니다.

하지만 위에서도 썼다시피 OOP의 관점이 아니라 다양한 패러다임에 확장하여 생각해보면 그것 또한 전략 패턴이고 전략 패턴의 특징이라고 생각합니다.

---

## 다른 디자인 패턴과의 관계

### 상태(State)

상태 패턴은 가지고 있는 상태 값의 변경에 의해 다른 행동을 수행하는 패턴입니다. 이러한 특징을 저는 두 가지 이상의 상태에 각각 하나의 전략을 배정하여 특정 상태에 적절한 전략을 사용하는 패턴을 생각했습니다.

```rust
fn main() {
    let mut a = Switch::new(Box::new(OnPrinter{}), Box::new(OffPrinter{}));
    a.click();
    a = a.inverse();
    a.click();
}

trait Printable {
    fn print(&self);
}

struct OnPrinter;

impl Printable for OnPrinter {
    fn print(&self) {
        println!("on!");
    }
}

struct OffPrinter;

impl Printable for OffPrinter {
    fn print(&self) {
        println!("off!");
    }
}

struct Switch {
    positive_printable: Box<dyn Printable>,
    negative_printable: Box<dyn Printable>,
    state: bool,
}

impl Switch {
    pub fn new(positive_action: Box<dyn Printable>, negative_action: Box<dyn Printable>) -> Switch {
        Switch {
            positive_printable: positive_action,
            negative_printable: negative_action,
            state: false,
        }
    }

    pub fn inverse(self) -> Self {
        Self {
            negative_printable: self.negative_printable,
            positive_printable: self.positive_printable,
            state: !self.state,
        }
    }

    pub fn click(&self) {
        if self.state {
            self.positive_printable.print();
        } else {
            self.negative_printable.print();
        }
    }
}
```

간단한 On, Off만 있는 `Switch` 구조체를 만들었습니다.

해당 구조체는 스위치가 On일 때 행동, Off일 때 `Printable` 구현체가 각각 설정되어 있으며 각 상태에 맞춰서 해당 구현체의 메서드를 수행할 것입니다.

```bash
off!
on!
```

---

### 그 외

1. 어댑터 패턴을 이용하면 기존에 전략으로 채택할 수 없던 코드도 선택할 수 있게 됩니다.
  
2. 데코레이터 패턴에 적용하면 각 레이어에 각기 다른 전략을 적용할 수 있게 됩니다.
  
3. 브릿지 패턴과의 관계는 관점 차이라고 생각합니다.