---
title: "[A] 전략 패턴에 대해서"
date: 2022-03-04T15:57:12+09:00
tags: ["go", "rust", "java", "kotlin", "design pattern", "strategy", "project A"]
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

팩토리 패턴에도 상충하는 부분이 존재합니다.

---

## 결제 수단 선택하기

```dart
import 'dart:io';

abstract class Payment {
  void pay(int amount);
}

class CheckCard implements Payment {
  late int amount;

  CheckCard(this.amount);

  @override
  void pay(int amount) {
    if (amount <= this.amount) {
      print('Paying $amount using check card');
      this.amount -= amount;
      return;
    } 
    print('Not enough money');
  }
}

class CreditCard implements Payment {
  @override
  void pay(int amount) {
    print('Paying $amount using credit card');
  }
}

class DartPay implements Payment {
  int points = 0;

  @override
  void pay(int amount) {
    if (points > 0) {
      var paid = points % (amount+1);
      points -= paid;
      print('Paying $paid using dart pay\'s points');
      amount -= paid;
    }
    print('Paying $amount using dart pay');
    points += (amount * 0.15).toInt();
    print('You have $points points');
  }
}
```

1. 체크카드: 은행 잔고만큼 결제할 수 있는 카드입니다.
2. 신용카드: 신용을 담보로 한도까지 결제할 수 있는 카드입니다.
3. 다트페이: 높은 포인트 적립율을 보여주는 페이 서비스입니다.

```dart
class Consumer {
  late String name;
  late Payment payment;

  Consumer(this.name, this.payment);

  void changePayment(Payment payment) {
    this.payment = payment;
  }

  void pay(int amount) {
    stdout.write("$name: ");
    payment.pay(amount);
  }
}
```

소비자 클래스는 이름과 결제수단을 가지고 있습니다.

```dart
void main(List<String> args) {
  var consumer = Consumer("merak", CheckCard(10000));

  consumer.pay(8000); // 2000
  consumer.pay(8000); // -6000 ?
  print("------------------");

  consumer.changePayment(CreditCard());
  consumer.pay(10000); // 마음의 빚
  print("------------------");

  consumer.changePayment(DartPay());
  consumer.pay(10000);
  consumer.pay(2000);
}
```

결제 수단을 바꿔가며 결제합니다.

```bash
merak: Paying 8000 using check card
merak: Not enough money
------------------
merak: Paying 10000 using credit card
------------------
merak: Paying 10000 using dart pay
You have 1500 points
merak: Paying 1500 using dart pay's points
Paying 500 using dart pay
You have 75 points
```

선택한 수단에 따라 적절한 결과를 출력합니다.

---

## 특징

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
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"fmt"
	"math/big"

	"golang.org/x/crypto/blake2b"
	"golang.org/x/crypto/blake2s"
)

type Secp521r1 struct {
	hasher     func([]byte) [32]byte
	privateKey *ecdsa.PrivateKey
	publicKey  *ecdsa.PublicKey
}

func NewSecp521r1(hasher func([]byte) [32]byte) *Secp521r1 {
	return &Secp521r1{
		hasher:     hasher,
		privateKey: nil,
		publicKey:  nil,
	}
}

func (s *Secp521r1) GenerateKey() error {
	privateKey, err := ecdsa.GenerateKey(elliptic.P521(), rand.Reader)
	if err != nil {
		return err
	}
	s.privateKey = privateKey
	s.publicKey = &privateKey.PublicKey
	return nil
}

func (e *Secp521r1) Sign(key []byte) (*big.Int, *big.Int, error) {
	if e.privateKey == nil {
		return nil, nil, fmt.Errorf("private key is not set")
	}
	pass := e.hasher(key)
	return ecdsa.Sign(rand.Reader, e.privateKey, pass[:])
}

func (e *Secp521r1) Verfy(key, data []byte, r, s *big.Int) bool {
	if e.publicKey == nil {
		return false
	}
	pass := e.hasher(key)
	return ecdsa.Verify(e.publicKey, pass[:], r, s)
}

func (e *Secp521r1) ExportPrivateKey() ([]byte, error) {
	return x509.MarshalECPrivateKey(e.privateKey)
}

func (e *Secp521r1) ImportPrivateKey(key []byte) error {
	priv, err := x509.ParseECPrivateKey(key)
	if err != nil {
		return err
	}
	e.privateKey = priv
	return nil
}

func (e *Secp521r1) ExportPublicKey() ([]byte, error) {
	if e.publicKey == nil {
		return nil, fmt.Errorf("public key is not set")
	}
	return elliptic.Marshal(elliptic.P521(), e.publicKey.X, e.publicKey.Y), nil
}

func (e *Secp521r1) ImportPublicKey(key []byte) error {
	x, y := elliptic.Unmarshal(elliptic.P521(), key)
	if x == nil || y == nil {
		return fmt.Errorf("invalid public key")
	}
	publicKey := &ecdsa.PublicKey{
		Curve: elliptic.P521(),
		X:     x,
		Y:     y,
	}
	e.publicKey = publicKey
	return nil
}

func main() {
	password := []byte("password")

	secp521r1s := []*Secp521r1{NewSecp521r1(sha256.Sum256), NewSecp521r1(blake2b.Sum256), NewSecp521r1(blake2s.Sum256)}
	for _, secp521r1 := range secp521r1s {
		if err := secp521r1.GenerateKey(); err != nil {
			panic(err)
		}
		key, err := secp521r1.ExportPrivateKey()
		if err != nil {
			panic(err)
		}
		fmt.Printf("private key: %x\n", key)
		r, s, err := secp521r1.Sign(password)
		if err != nil {
			panic(err)
		}
		fmt.Printf("signature: %x %x\n", r, s)
		pub, err := secp521r1.ExportPublicKey()
		if err != nil {
			panic(err)
		}
		fmt.Printf("public key: %x\n", pub)
		if !secp521r1.Verfy(password, []byte("hello world"), r, s) {
			panic("verify failed")
		}
		fmt.Println("verified")
	}
}
```

```bash
private key: 3081dc0201010442005af683aaa7b3103cc5a893a2d5edcd12c94d6c25c603938fb8db3605d4018d742ee8a83c5b9fd8ceb15f25b2aa57f1c8b78b829bfe8c2a8e3b407027828d384834a00706052b81040023a1818903818600040041a0d4653a1b88f9ad0554c2ec7a549e0ccd2a6c5fb91b420a8ee18d12eafd2e14b34fc4c73af89b49800254e3e90137fc1ac193d0fbfbbb9873a31a533a55a3180147f9c4a35502adc5f9a82fffc6f3ec2738bb54a80407218e6c83af18bc730a5cc4bd3c6db7c3abec90e784d92970ec6693e10c453fd28b6a83295a077918572699
signature: 1ca9495865d94e57edcd971c1aaf0cb20009e1f6bad62b304e4eb7267b1fddae24a429a865a52471c095cc4978d8161667a933e6f80b73b24dcd921eed58fca30b1 1dbf3033500a1544d89b7f9669d51d6ff5be404cd2f496fe661ce931bb4e17547b336cb57b0404d9b40aea7d63febb68d6f899105b32b4668a4dc35ec2b522df08
public key: 040041a0d4653a1b88f9ad0554c2ec7a549e0ccd2a6c5fb91b420a8ee18d12eafd2e14b34fc4c73af89b49800254e3e90137fc1ac193d0fbfbbb9873a31a533a55a3180147f9c4a35502adc5f9a82fffc6f3ec2738bb54a80407218e6c83af18bc730a5cc4bd3c6db7c3abec90e784d92970ec6693e10c453fd28b6a83295a077918572699
verified
private key: 3081dc0201010442013f9bd30fb3e9c3b7938b1460afb5dd2b387276a2ad3972d02b207cc17c1a2c936d30def3ff553a82705d1ff6707ca92faa05ebf29151e7cd397e688def7eb986dea00706052b81040023a18189038186000401926686d54c17305d36ce85781afb4b37af3d0c6600c1c2f86966fdf9141fe1bb764abb797d2dc5587756f3bd3b59f24218007d7b26c5c21912d74900578f2803ff01cfb76b3433c47bcacbec67cb1e604ca39df3ac1b71a504b0587f232389d2612a3372296d8f9ddb0ff1fa178eaeb9ac775cc2c21d09efebe5fa28eca6cd81e1af25
signature: 47181b97a7593ff886bdb048e28aad3aff6b070c0f092de442566b10f84e3ca44a4f489bb1715e8fa2db8afb47b892173bde915153a1b97bcb9aa24fc8877f4e12 612fbb3ea9eef240ae28763448efa8ccc796d11c235448be14da6a28969d58597aea2f95fcbc6fcef873b7e8f55d7ed23f482fd1a25ed7974a23d79e22a32bcdef
public key: 0401926686d54c17305d36ce85781afb4b37af3d0c6600c1c2f86966fdf9141fe1bb764abb797d2dc5587756f3bd3b59f24218007d7b26c5c21912d74900578f2803ff01cfb76b3433c47bcacbec67cb1e604ca39df3ac1b71a504b0587f232389d2612a3372296d8f9ddb0ff1fa178eaeb9ac775cc2c21d09efebe5fa28eca6cd81e1af25
verified
private key: 3081dc02010104420038c726ef8a57cce983c52f16c9ff9e726567b1b3a7f65b8e18bc4d9330c4556d20fb450f1d1f1ebe4792a38946d90e4d3c6e51930deaf4934f820dc1532c028d58a00706052b81040023a181890381860004001005cdde06ca3f8552237c5a9e120a2e5ee58a1b44d8f4db46e311bd61a67bf00b38912e5daf4ebadfe71959044feb6e6809caffcc125eba28c0bd4fc9c356db93011128764b2fb69cffab80a6970af7c2c4b3f13390905843600e6d722d5089dc0fc4b3408a230d59cf261f3ccc213d034bb043744e33d1eed9cbf41bc5f04afaded2
signature: 14531b9b3bd2fe9f41c1cd69f6d2fa29bc59d3a4e91bff256b231af34d910786c094503a726f53174a228cfaaba8b93655014205baefd09307f53c2440a7fc8b2b7 1987d0e1cc57416b8c9ce7ced1e0b760b1f586f9ccc1e3cbc3271cb2615911caef1aa56b40702abb11b6207acead199cd995c4a4debbb6fd838a689f07abece349a
public key: 04001005cdde06ca3f8552237c5a9e120a2e5ee58a1b44d8f4db46e311bd61a67bf00b38912e5daf4ebadfe71959044feb6e6809caffcc125eba28c0bd4fc9c356db93011128764b2fb69cffab80a6970af7c2c4b3f13390905843600e6d722d5089dc0fc4b3408a230d59cf261f3ccc213d034bb043744e33d1eed9cbf41bc5f04afaded2
verified
```

객체 자체를 넘기기 보다 특정 동작을 하는 함수를 기반으로 전략 패턴을 구현한 케이스입니다.

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