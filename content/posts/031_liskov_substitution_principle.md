---
title: "리스코프 치환 법칙에 대한 고찰"
date: 2024-07-23T18:54:27+09:00
tags: ["architecture", "coding", "liskov_substitution_principle", "go", "interface", "composite"]
author: "snowmerak"
categories: [ "Philosophy"]
draft: false
---

## Liskov Substitution Principle with inheritance

리스코프 치환 법칙은 객체지향 프로그래밍에서 중요한 법칙 중 하나입니다.  

> 서브 타입은 언제나 슈퍼 타입으로 대체될 수 있어야 한다.

개인적으로는 살짝 헷갈린 적이 있는 표현이지만, 코드 내의 인스턴스 타입을 교체하는 케이스로 이해하면 쉽습니다.

### 상속을 활용한 케이스

이 법칙은 일반적인 상속이 존재하는 객체지향 지향 언어에서 쉽게 설명되는 법칙입니다.  
예를 들어 보통 자바에선 이런 식으로 많이 예제를 작성합니다.

```java
class Shape {
    int width;
    int height;
}

class Rectangle extends Shape {
    void setWidth(int width) {
        this.width = width;
    }

    void setHeight(int height) {
        this.height = height;
    }
}

class Square extends Shape {
    void setWidth(int width) {
        this.width = width;
        this.height = width;
    }

    void setHeight(int height) {
        this.width = height;
        this.height = height;
    }
}
```

위 코드에서 `Rectangle`과 `Square`는 `Shape`를 상속받고 있습니다.  
그리고 `Square`와 `Rectangle`을 주고 받을 수 있는 곳은 `Shape`로 대체할 수 있습니다.  
그리고 상속받은 객체를 다음과 같이 수퍼 타입으로 받을 수 있습니다.

```java
class main {
    public static void main(String[] args) {
        var shape = new Rectangle();
        setShape(shape);
    }

    void setShape(Shape shape) {
        shape.setWidth(10);
        shape.setHeight(20);
    }
}
```

위 코드에서 `setShape` 메소드는 `Shape`를 인자로 받고 있습니다.  
그리고 `Rectangle`을 넘겨줬지만 수퍼 타입인 `Shape`로 변환되어 문제 없이 동작합니다.

### LSP의 의의

이렇게 특정 서브 타입을 슈퍼 타입으로 대체할 수 있는 것은 다형성을 활용할 수 있게 해줍니다.  
그리고 다형성은 객체의 역할과 책임을 제한하여, 잘못된 동작을 막거나 내부 상태를 숨기는 데에 도움을 줍니다.

## Listkov Substitution Principle with interface and composite pattern

하지만 이러한 상속을 통한 객체지향은 상속을 지원하는 언어에서만 사용할 수 있습니다.  
그리고 스프링에서 보다시피, 상속 깊이가 깊어질 수록 상속 구조가 복잡해질 수 있으며,  
다형성을 위한 행위 뿐만 아니라 내부 상태도 상속 받기 때문에, 개발자가 신경 써야할 부분이 늘어납니다.

### 객체지향을 다시 생각해서

객체지향의 핵심은 역할과 책임을 기능으로써 객체에게 부여하는 것입니다.  
우리는 이 기능을 부여하기 위해 인터페이스와 [덕 타이핑](https://ko.wikipedia.org/wiki/%EB%8D%95_%ED%83%80%EC%9D%B4%ED%95%91)을 사용할 수 있습니다.  
그리고 당연하게도, class 중심이 아니라 interface를 중심으로, 상속이 아니라 합성 관계를 중점으로 다시 생각해볼 수 있습니다.

### 고 언어에서

고 언어에서는 상속 대신 합성(composite)를 이용해서 다형성을 구성합니다.  
다음 예제를 통해 간단하게 고 언어에서의 합성을 볼 수 있습니다.

```go
func main() {
    f, err := os.Open("test.txt")
    if err != nil {
        log.Fatal(err)
    }
    defer f.Close()

    f.Write([]byte("Hello, World!"))
}
```

이 코드는 `test.txt` 파일을 열고, `Hello, World!`를 쓰는 코드입니다.  
여기서 `f`는 `*os.File` 타입입니다.  
그리고 이 `*os.File`은 `io.WriteCloser` 인터페이스를 구현하고 있습니다.  
`io.WriteCloser` 인터페이스를 구현함으로 `*os.File` 타입은 데이터 쓰기를 받을 수 있고, 연결을 닫을 수 있게 됩니다.

```go
type WriteCloser interface {
    Writer
    Closer
}

type Writer interface {
	Write(p []byte) (n int, err error)
}

type Closer interface {
	Close() error
}
```

그리고 `*os.File`은 `io.WriteCloser` 인터페이스로 대체할 수 있습니다.  
이렇게 말이죠!

```go
func writeHelloWorld(wc io.WriteCloser) {
    wc.Write([]byte("Hello, World!"))
}

func main() {
    f, err := os.Open("test.txt")
    if err != nil {
        log.Fatal(err)
    }
    defer f.Close()

    writeHelloWorld(f)
}
```

또 위에 있다시피 `io.WriteCloser`는 `io.Writer`와 `io.Closer` 인터페이스를 포함하고 있습니다.  
그러면 `*os.File`은 `io.Writer`와 `io.Closer` 인터페이스로 대체할 수 있습니다.

```go
func writeHelloWorld(w io.Writer) {
    w.Write([]byte("Hello, World!"))
}

func closeFile(c io.Closer) {
    c.Close()
}

func main() {
    f, err := os.Open("test.txt")
    if err != nil {
        log.Fatal(err)
    }
    defer closeFile(f)

    writeHelloWorld(f)
}
```

이 포함 관계, 어쩌면 상속 관계를 이렇게 나타낼 수 있습니다.

![01](/img/023/01.png)

단순한 인터페이스의 포함 관계로 Go 언어는 충분히 객체지향의 핵심적인 개념인 메시지 패싱과 다형성을 활용할 수 있습니다. 거디가 다음 규칙을 준수하며, 추가로 몇몇 다른 SOLID 원칙을 지킬 수 있습니다.

1. 객체는 자신의 내부 구현을 숨기고, 인터페이스를 통해 다른 객체와 소통합니다. 이는 캡슐화 개념과도 연결됩니다.
2. 객체는 자신이 구현하는 인터페이스의 규약을 반드시 준수해야 합니다. 이는 LSP의 핵심 요구사항과 일치합니다.
3. 서브 인터페이스 타입, 혹은 인터페이스 구현 타입은 슈퍼 인터페이스로 대체할 수 있어야 합니다. 이는 DIP(의존성 역전 원칙)을 실현할 수 있도록 합니다.
4. 하나의 인터페이스는 자신이 담당하는 역할에만 집중해야 합니다. 이는 SRP(단일 책임 원칙)과 ISP(인터페이스 분리 원칙)을 준수할 수 있도록 합니다.

### Go 언어 외에선

Go 언어에서는 언어 차원에서 이를 지원하고 독려하기 때문에 이러한 패턴을 쉽게 사용할 수 있습니다. 하지만 다른 언어에서도 이러한 패턴을 어렵지 않게 사용할 수 있습니다.

몇몇 언어의 예시를 간단하게 작성해보겠습니다.

- Java

```java
interface Writer {
    void write(char[] cbuf, int off, int len) throws IOException;
}

interface Closer {
    void close() throws IOException;
}

interface WriteCloser extends Writer, Closer {
    // 추가적인 메서드는 필요하지 않음
}

class FileWriter implements WriteCloser {
    private final FileWriter fileWriter;

    public FileWriter(String fileName) throws IOException {
        fileWriter = new FileWriter(fileName);
    }

    @Override
    public void write(char[] cbuf, int off, int len) throws IOException {
        fileWriter.write(cbuf, off, len);
    }

    @Override
    public void close() throws IOException {
        fileWriter.close();
    }
}
```

- C#

```csharp
interface IWriter {
    void Write(char[] buffer, int index, int count);
}

interface ICloser {
    void Close();
}

interface IWriteCloser : IWriter, ICloser {
    // 추가적인 메서드는 필요하지 않음
}

class FileWriter : IWriteCloser {
    private readonly StreamWriter streamWriter;

    public FileWriter(string fileName) {
        streamWriter = new StreamWriter(fileName);
    }

    public void Write(char[] buffer, int index, int count) {
        streamWriter.Write(buffer, index, count);
    }

    public void Close() {
        streamWriter.Close();
    }
}
```

- Typescript

```typescript
interface Writer {
    write(buffer: string): void;
}

interface Closer {
    close(): void;
}

interface WriteCloser extends Writer, Closer {
    // 추가적인 메서드는 필요하지 않음
}

class FileWriter implements WriteCloser {
    private readonly fs: fs.promises;

    constructor(fileName: string) {
        this.fs = require('fs').promises;
    }

    write(buffer: string) {
        this.fs.writeFile(buffer);
    }

    close() {
        this.fs.close();
    }
}
```

- Rust

```rust
use std::io::{Write, Read};

trait WriteCloser: Write {
    fn close(&mut self) -> std::io::Result<()>;
}

struct File {
    // ... (파일 관련 필드)
}

impl WriteCloser for File {
    fn close(&mut self) -> std::io::Result<()> {
        // ... (파일 닫기 로직)
    }

    // Write trait의 메서드들을 여기에 직접 구현
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        // ... (파일 쓰기 로직)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        // ... (버퍼 비우기 로직)
    }
}
```

- Dart

```dart
import 'dart:io';

abstract class Writer {
  void write(List<int> bytes);
}

abstract class Closer {
  void close();
}

abstract class WriteCloser implements Writer, Closer {
  // 추가적인 메서드는 필요하지 않음
}

class MyFile implements WriteCloser {
  final File _file;

  MyFile(String path) : _file = File(path);

  @override
  void write(List<int> bytes) {
    _file.writeAsBytesSync(bytes);
  }

  @override
  void close() {
    _file.closeSync();
  }
}

void main() {
  final file = MyFile('example.txt');
  file.write('Hello, world!'.codeUnits);
  file.close();
}
```

## 결론

리스코프 치환 법칙은 객체지향 프로그래밍에서 중요한 법칙 중 하나입니다.  
기존의 언어들은 class 기반의 상속을 통해 이를 달성하고자 했지만, 최근의 언어나 패러다임 중에는 interface와 composite 패턴만으로 달성하고자 하는 케이스가 있습니다.  
이러한 패턴은 무리없이 리스코프 치환 원칙을 지킬 수 있으며, 객체지향을 구성하는 데에 일조할 수 있습니다.
하지만 인터페이스를 너무 많이 분리하거나, 인터페이스에 역할을 너무 많이 부여하는 것은 오히려 코드의 복잡성을 높일 수 있으니 적절한 수준에서 사용하는 것이 중요합니다.
