---
title: "전략 패턴에 대해서"
date: 2022-03-04T15:57:12+09:00
tags: ["go", "rust", "java", "kotlin", "design pattern", "strategy", "project A"]
author: "snowmerak"
categories: ["Philosophy"]
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

### 커맨드(Command)

```rust
pub trait Command {
    fn excute(&self);
}

pub struct SaveCommand {
    name: String,
}

impl SaveCommand {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }
}

impl Command for SaveCommand {
    fn excute(&self) {
        println!("{} save command excuted!", self.name);
    }
}

pub struct ExitCommand {
    name: String,
}

impl ExitCommand {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }
}

impl Command for ExitCommand {
    fn excute(&self) {
        println!("{} exit command excuted!", self.name);
    }
}

pub struct OpenCommand {
    name: String,
}

impl OpenCommand {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }
}

impl Command for OpenCommand {
    fn excute(&self) {
        println!("{} open command excuted!", self.name);
    }
}

pub struct Button<'a> {
    command: Box<&'a dyn Command>,
}

impl<'a> Button<'a> {
    pub fn new(command: Box<&'a dyn Command>) -> Self {
        Self {
            command,
        }
    }

    pub fn press(&self) {
        self.command.excute();
    }
}

pub fn main() {
    let save_command = SaveCommand::new("app");
    let exit_command = ExitCommand::new("app");
    let open_command = OpenCommand::new("app");

    let save_button = Button::new(Box::new(&save_command));
    let exit_button = Button::new(Box::new(&exit_command));
    let open_button = Button::new(Box::new(&open_command));

    save_button.press();
    exit_button.press();
    open_button.press();

    let save_touch = Button::new(Box::new(&save_command));
    let exit_touch = Button::new(Box::new(&exit_command));
    let open_touch = Button::new(Box::new(&open_command));

    save_touch.press();
    exit_touch.press();
    open_touch.press();
}
```

전략 패턴은 한가지 문제 해결에 대해서 여러 전략을 선택할 수 있는 여러 전략이 하나의 기능에 대응하는 형태라면 커맨드 패턴은 여러 기능에 대해 하나 이상의 전략이 대응되는 형태입니다. 

이를 두고 책에서는 커맨드 패턴과 비교한 전략 패턴의 차이점을 ‘letting you swap these algo­rithms with­in a sin­gle con­text class’, 단일 문맥에 대한 알고리즘들의 교체로 표현하였습니다.

---

### 데코레이터(Decorator)

```go
package main

import (
	"bytes"
	"crypto/rand"
	"fmt"

	"github.com/andybalholm/brotli"
	"github.com/golang/snappy"
	"github.com/itchio/lzma"
)

func main() {
	{
		buffer := bytes.NewBuffer(nil)
		brotliWriter := brotli.NewWriter(buffer)
		snappyWriter := snappy.NewBufferedWriter(brotliWriter)
		lzmaWriter := lzma.NewWriter(snappyWriter)

		data := [512]byte{}
		rand.Read(data[:])
		lzmaWriter.Write(data[:])

		lzmaWriter.Close()
		snappyWriter.Close()
		brotliWriter.Close()

		fmt.Println(buffer.Bytes())
	}

	{
		buffer := bytes.NewBuffer(nil)
		lzmaWriter := lzma.NewWriter(buffer)
		snappyWriter := snappy.NewBufferedWriter(lzmaWriter)
		brotliWriter := brotli.NewWriter(snappyWriter)

		data := [512]byte{}
		rand.Read(data[:])
		lzmaWriter.Write(data[:])

		brotliWriter.Close()
		snappyWriter.Close()
		lzmaWriter.Close()

		fmt.Println(buffer.Bytes())
	}
}
```

```bash
[11 28 129 255 6 0 0 115 78 97 80 112 89 1 43 2 0 228 245 231 207 93 0 0 128 0 255 255 255 255 255 255 255 255 0 16 42 90 225 96 215 49 150 191 231 81 102 136 62 95 77 104 92 78 75 16 204 0 91 238 30 145 117 113 242 30 249 138 121 187 208 255 110 204 123 92 139 9 184 87 109 246 142 142 64 250 231 128 158 65 192 100 179 48 32 61 117 150 229 36 110 141 9 125 96 158 5 47 105 93 232 198 47 240 40 123 12 177 172 44 197 38 236 247 246 18 136 238 55 128 131 124 96 125 246 134 126 235 152 114 229 37 169 53 176 129 105 177 57 106 70 6 92 174 203 182 84 237 143 84 150 57 79 64 213 25 26 68 240 131 177 129 101 195 128 69 26 15 191 166 62 51 131 51 114 193 191 70 232 222 139 174 146 210 179 91 213 188 122 46 135 189 31 43 231 105 224 119 213 25 109 75 94 120 32 114 102 220 103 90 211 172 173 57 204 26 171 160 37 223 59 115 18 250 105 171 103 37 81 100 136 178 53 119 160 72 166 232 253 48 44 30 167 148 253 215 171 250 110 207 119 207 201 186 132 197 52 171 81 224 46 4 247 12 73 149 65 217 49 123 177 50 25 92 46 70 37 173 171 195 135 120 126 149 156 126 124 22 225 37 195 43 58 97 16 121 167 1 218 48 129 232 244 104 158 120 164 141 64 130 135 114 188 148 91 206 118 206 230 88 98 108 143 23 180 148 153 12 95 168 70 177 68 143 95 21 82 185 162 15 189 218 12 58 244 103 221 60 94 9 66 143 75 126 82 47 124 206 65 205 146 106 204 119 149 195 214 19 45 114 37 167 11 234 100 183 203 134 219 69 182 201 85 156 131 165 195 135 2 50 146 76 37 39 241 5 51 23 197 36 137 66 189 79 161 42 228 40 228 205 26 88 161 197 38 83 248 152 104 203 6 25 220 250 245 46 134 221 215 72 76 165 92 164 112 89 88 150 69 18 140 129 140 93 111 251 113 228 85 107 67 242 26 39 181 81 60 64 114 145 201 95 52 26 156 1 141 238 129 213 241 254 62 67 2 187 92 209 178 166 117 21 95 30 208 213 10 75 22 68 243 63 192 211 181 244 185 97 64 64 49 174 120 142 230 53 56 236 255 173 170 85 249 202 56 112 212 133 220 38 231 104 220 99 96 58 131 195 128 47 28 227 233 29 103 207 54 236 45 227 128 74 148 160 187 214 27 255 189 34 57 209 163 130 105 170 255 255 245 237 64 0 3]
[93 0 0 128 0 255 255 255 255 255 255 255 255 0 122 24 25 194 85 84 33 139 74 229 139 76 80 79 119 247 20 8 180 11 199 251 57 222 145 219 179 232 15 99 78 167 85 109 155 143 3 112 15 46 200 161 250 235 38 83 203 221 91 21 123 255 195 115 53 232 201 174 65 204 178 84 213 46 219 6 83 215 195 107 148 132 55 56 158 202 122 122 146 146 223 196 40 207 7 232 218 43 161 11 73 101 163 87 239 20 19 42 43 172 10 35 106 234 153 225 23 183 188 193 192 131 134 50 21 83 175 32 184 76 108 229 232 108 125 3 5 233 157 20 205 10 60 32 176 41 116 13 196 133 51 99 157 158 93 93 170 20 223 84 164 188 113 227 2 73 109 159 67 174 247 178 57 133 164 115 16 12 93 69 138 74 227 94 118 64 51 90 172 170 0 37 82 86 235 237 36 234 56 116 50 57 192 83 78 95 251 54 201 67 79 64 15 35 24 175 138 139 134 197 60 248 169 85 231 89 52 70 60 71 170 179 123 183 237 156 14 161 140 40 106 133 246 252 2 187 217 39 47 50 2 82 141 81 116 81 28 13 173 187 210 148 199 125 124 167 173 133 50 218 157 97 85 55 17 179 33 52 120 96 12 125 96 87 109 43 70 95 57 135 254 20 143 230 12 17 216 105 82 97 91 159 90 188 216 149 170 118 196 160 77 61 75 18 71 247 176 204 136 10 53 5 10 115 138 167 172 238 176 152 229 99 14 45 37 105 37 254 87 195 87 131 114 209 83 33 21 125 48 42 236 109 93 68 179 15 183 123 251 71 130 255 222 121 247 46 60 8 119 201 102 241 201 166 189 187 32 178 18 67 39 224 48 18 243 213 102 174 31 7 233 64 131 46 251 82 95 65 95 200 245 191 206 208 160 177 149 204 212 151 138 144 240 31 235 249 2 215 154 70 208 55 110 32 102 129 227 29 146 169 117 158 103 232 59 161 223 115 38 146 119 194 54 111 41 154 170 191 159 124 216 56 77 56 120 139 124 54 127 144 19 36 40 170 228 168 121 76 26 108 17 232 3 141 158 240 20 127 55 126 87 161 143 246 10 254 249 206 118 243 86 73 14 12 29 231 108 156 139 253 223 10 38 47 15 204 142 174 194 20 175 116 114 227 74 141 110 237 129 30 57 194 48 7 133 234 17 45 98 38 123 123 189 128 3 221 61 2 208 34 175 173 221 150 147 90 135 6 153 52 38 66 21 228 209 48 58 65 22 56 255 255 183 120 0 0]
```

데코레이터 패턴의 예는 편의를 위해 외부 라이브러리를 사용하였습니다. 각각 `brotli`, `snappy`, `lzma`의 `writer`를 순차적으로 데코레이팅 했습니다. 필요에 따라 서로 다른 순서로 맞추게 되면 서로 다른 목적에 따른 압축 결과물이 나오게 됩니다. 

`http server`의 미들웨어와 비슷하다고 봅니다. 여기서는 단순 압축이었지만 어떤 단어를 필터링한다거나 어떤 문장을 말미에 추가한다는 식의 기능도 선택하여 추가할 수 있을 것입니다. 

그래서 데코레이터와 전략 패턴의 관계는 여러 전략을 여러 층으로 데코레이팅하는 일종의 상호 보완적 관계에 있다고 생각합니다. 

---

### 템플릿 메서드(Template Method)

책에서는 템플릿 메서드 패턴은 클래스 단위에서 상속을 통해 처리하기에 컴파일 타임에 기능이 지정되어 런타임에 안정적(stable)이고, 전략 패턴은 런타임에 전략이 정해지기에 안정적(stable)이지 않다고 표현합니다. 단순히 생각하면 정적 타입 언어와 동적 타입 언어를 생각하면 편리합니다.

```java
// BaseCalculator.java
public abstract class BaseCalculator {
    public abstract int method(int a, int b);

    final int calculate(int a, int b) {
        return method(a, b);
    }
}

// AddCalculator.java
public class AddCalculator extends BaseCalculator {
    @Override
    public int method(int a, int b) {
        return a + b;
    }
}

// SubCalculator.java
public class SubCalculator extends BaseCalculator {
    @Override
    public int method(int a, int b) {
        return a - b;
    }
}

// App.java
public class App {
    public static void main(String[] args) {
        var addCalculator = new AddCalculator();
        System.out.println(addCalculator.calculate(6, 1));
				// 7

        var subCalculator = new SubCalculator();
        System.out.println(subCalculator.calculate(10, 3));
				// 7
    }
}
```

템플릿 메서드로 간단한 하나의 계산 방법을 가지는 계산기를 만들었습니다. `BaseCalculator` 추상 클래스의 `method` 메서드를 구현함으로 각기 다른 계산기를 구현합니다. 이걸 고도화하는 건 제 파트가 아니니 넘어가겠습니다.

```java
// BaseCalculator.java
public class BaseCalculator {
    public interface Method {
        int calculate(int a, int b);
    }

    private Method method;

    public BaseCalculator(Method method) {
        this.method = method;
    }

    final int calculate(int a, int b) {
        return method.calculate(a, b);
    }
}

// App.java
public class App {
    public static void main(String[] args) {
        var addCalculator = new BaseCalculator((a, b) -> a + b);
        System.out.println(addCalculator.calculate(1, 2));
				// 3

        var subCalculator = new BaseCalculator((a, b) -> a - b);
        System.out.println(subCalculator.calculate(1, 2));
				// -1
    }
}
```

전략 패턴으로 작성하면 단일 계산 방법의 명세를 정의하는 `Method` 인터페이스를 정의하고 `Method` 인터페이스의 값을 `BaseCalculator`가 가집니다. 그리고 `BaseCalculator`의 `calculate`는 `method`의 `calculate`를 호출하여 값을 반환합니다. 

`App.java` 파일에서는 자바의 람다식을 이용하여 간편하게 `Method` 인터페이스의 구현체를 만들어 생성자에 넘겨줍니다.  동작은 완전히 동일함을 확인할 수 있습니다. 

두 방식의 큰 차이는 역시 템플릿 메서드는 미리 컴파일 때 구현된 클래스가 메서드 영역에 포함되어 실행되어 안정적으로 호출할 수 있지만 전략 패턴은 힙 영역에 올라가서 비교적 덜 안정적입니다.

---

### 브릿지(Bridge)

브릿지 패턴은 관점의 차이로 어떤 전략을 선택하느냐가 아니라 어떤 전략을 특정 객체에 붙이기 위해 중간 인터페이스를 두는 방식을 취한 것이기에 결과 자체는 전략 패턴과 비슷하지만, 전략 패턴이 가지는 여러 전략을 선택하여 사용할 수 있게 하는 의의에 있어 두 패턴은 차이가 있습니다.

---

### 어댑터(Adapter)

어댑터 패턴 또한 어떤 기능을 특정 객체에 붙이기 위한 중간 다리를 제공하기 위해 나온 패턴이라 전략 패턴과 비슷하게 구성될 수는 있지만 두 패턴이 한번에 가지는 뎁스의 차이와 브릿지 패턴과 마찬가지로 의의에 차이가 있다고 생각합니다.