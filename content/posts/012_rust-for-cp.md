---
title: "러스트로 알고리즘 문제을 풀어봅시다"
date: 2022-04-12T00:08:40+09:00
tags: ["rust", "cp", "fast io"]
draft: true
---

## 왜 러스트?

개인적으로 러스트로 알고리즘 문제를 푸는 건 좋은 선택이라 생각합니다.

1. 아래의 다양한 자료구조를 빌트인으로 제공합니다.
   1. Vector
   2. VecDeque
   3. LinkedList
   4. HashMap
   5. HashSet
   6. BtreeMap
   7. BtreeSet
   8. BinaryHeap
2. 유용한 이터러블과 빌트인 고차함수들이 있습니다.
   1. 일단 이터러블로 변환하면 뭐든지 가능하다는 장점이 있습니다.
   2. 이 과정은 당연히 정적 타입으로 이루어지기에 실수가 줄어듭니다.
3. 튜플과 패턴 매칭 문법이 훌륭하고 표현식입니다.
   1. `()`로 만드는 튜플은 어떤 타입, 어떤 길이로도 가능하여 유용합니다.
   2. `match` 문법은 튜플조차 패턴 매칭을 해내기에 어떤 조건도 직관적으로 표현할 수 있습니다.
   3. `if`, `match`, 심지어 `loop`가 값을 반환할 수 있어 유연하게 작성할 수 있습니다.
4. 메모리를 효율적으로 재사용하고 반납합니다.
   1. 메모리를 어느정도 막 써도 용서받을 수 있습니다.
   2. 알고리즘 테스트 과정에서 메모리로 인한 실패 가능성이 줄어듭니다.
5. 소유권에 익숙하면 좋지만 그렇지 않아도 좋습니다.
   1. C++의 `&`(레퍼런스) 정도로 알고 있어도 무리가 없습니다.
   2. 너무 큰 객체가 아니라면 `clone()` 메서드로 복사값을 넘겨줘도 됩니다.
   3. 솔직히 어지간하면 소유권으로 에러가 나는 케이스가 적습니다.

---

## 변수 할당

### 불변(immutable)

```rust
let a = 123;
```

러스트는 기본적으로 할당되는 변수는 불변입니다. 해당 변수, `a`는 값을 변경할 수 없습니다. `a = a + 3`나 `a = 100`같은 재할당을 할 수 없습니다. 이 불변성은 변수에 할당된 값에도 동일하게 적용됩니다. 예를 들어 `Vector`나 `HashMap`을 할당하게 되면 값을 추가하거나 삭제할 수 없게 됩니다.

### 가변(mutable)

```rust
let mut a = 123;
```

`mut` 키워드를 추가하게 되면 변수가 가변 상태가 됩니다. 해당 변수, `a`는 위의 경우와 달리 값을 변경할 수 있습니다. `a = a + 3`이나 `a = 100`을 수행할 수 있습니다. 당연하게도 `Vector`나 `HashMap` 등 자료구조에 대해서도 값을 추가하거나 삭제할 수 있게 됩니다. 

---

## 패턴 매칭

### Option<T>

`Option<T>`은 타입 `T`를 가질 수도 있는 객체입니다. `Some(value)` 함수를 통해 입력받은 값을 가지는 `Option<T>` 객체를 반환합니다. `Some()` 대신 `None`을 반환하면 값을 가지지 않는 `Option<T>` 객체를 반환합니다.

### Result<T, R>

`Result<T, R>`은 타입 `T`와 `R`을 각각 결과값과 에러값으로 가지는 객체입니다. `Ok(value)` 함수를 통해 입력받은 값을 결과값으로 가지는 `Result<T, R>`을 반환합니다. `Err(value)` 함수를 사용하면 입력받은 값을 에러값으로 가지는 `Result<T, R>`을 반환합니다. 

### Tuple

`()`을 사용하여 값을 감싸게 되면 복합 타입으로 이루어진 튜플을 생성하고 사용할 수 있습니다.

```rust
let a = (1, 2.2, "str")
```

이렇게 작성하게 되면 `a`는 `(i32, f32, &str)` 타입을 가지게 됩니다. 길이나 타입은 원하는 대로 설정할 수 있습니다. 각 원소에 대해서는 `a.0`, `a.1`처럼 인덱스를 직접 호출하여 접근할 수 있습니다. 가변 변수로 선언했을 경우 각 원소의 값을 수정할 수도 있습니다.

### match

`match` 문법은 다른 언어의 `switch`나 `when`과 비슷한 역할을 합니다. 하지만 러스트의 `match`는 그보다 훨씬 풍부한 기능을 가지고 있으며 유용하게 쓰입니다.

#### Option<T>

```rust
fn main() {
    let o = Some(4);
    match o {
        Some(i) => println!("{}", i),
        None => println!("none"),
    }

    let o: Option<i32> = None;
    match o {
        Some(i) => println!("{}", i),
        None => println!("none"),
    }
}
```

`match`는 `Option<T>`의 `Some`과 `None`을 분해할 수 있습니다. `Some(value)` 분기를 통해 값이 있다면 값을 받아오고 `None` 분기를 통해 값이 없을 때의 처리를 할 수 있습니다.

#### Result<T, R>

```rust
fn main() {
    let r: Result<i32, String> = Ok(42);
    match r {
        Ok(v) => println!("{}", v + 2),
        Err(e) => println!("{}", e),
    }

    let r: Result<i32, String> = Err("Error message".to_string());
    match r {
        Ok(v) => println!("{}", v + 2),
        Err(e) => println!("{}", e),
    }
}
```

`Result<T, R>`의 경우도 `Option<T>`와 마찬가지로 작성할 수 있습니다. `Ok(value)` 분기를 통해서 결과값에 해당하는 값의 처리를 할 수 있고,`Err(value)` 분기를 통해서 에러값에 해당하는 값의 처리를 할 수 있습니다.

#### tuple

```rust
fn main() {
    let r: (Option<usize>, Option<String>) = (Some(3), Some("boo".to_string()));
    match r {
        (Some(x), Some(y)) => println!("{}", y.repeat(x)),
        (None, Some(y)) => println!("{}", y.repeat(1)),
        (Some(x), None) => println!("{}", "foo".repeat(x)),
        (None, None) => println!("{}", "foo".repeat(1)),
    }
}
```

복합 `Option<T>` 타입을 가지는 튜플을 `match`에 적용했습니다. 각 4가지 경우인 Some+Some, Some+None, None+Some, None+None를 작성한 케이스입니다. 다른 언어에서는 중첩 `switch`나 여러 조건문의 `if`를 여러개 나열했어야 하지만 러스트의 `match`는 튜플을 이용하여 깔끔하게 처리할 수 있습니다.

```rust
fn main() {
    let r: (Option<usize>, Option<String>) = (Some(3), Some("boo".to_string()));
    match r {
        (Some(x), Some(y)) => println!("{}", y.repeat(x)),
        (_, _) => println!("{}", "foo".repeat(1)),
    }
}
```

만약 특정 튜플 원소에 대해 모든 경우의 수를 모두 수용하고 싶다면 `_`로 표기할 수 있습니다. 

---

## 자료 구조

### 벡터(Vector)

```rust
let v = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
```

벡터는 C++의 Vector, java의 ArrayList, Go의 Slice처럼 미리 기반이 되는 배열을 만들어놓고 값이 추가될 때마다 기반 배열의 용량을 넘어서게 되면 더 큰 새로운 배열을 만들어 사용하는 방식입니다. 이 방식은 보편적으로 좋은 성능을 가집니다.

#### 스택

벡터의 가장 단순한 활용 형태는 스택입니다.

```rust
fn main() {
    let mut v = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    v.push(11);
    while !v.is_empty() {
        let last = v.pop().unwrap();
        println!("{}", last);
    }
}
```

단순한 형태의 스택 순회입니다. `push()` 메서드로 벡터의 끝에 값을 추가합니다. `while` 반복문의 조건에 `is_empty()` 메서드를 넣어 벡터가 빌 때까지 반복합니다. `pop()` 메서드를 통해 벡터의 마지막 값의 `Option` 객체를 받아 출력합니다.

이때 사용된 `Option<T>`의 `unwrap()`은 옵션 객체가 `Some`일 경우 값을 반환하고, `None`일 경우 런타임 패닉이 발생합니다. 알고리즘 테스트의 경우 `None`이 예상치 못한 곳에서 발생할 가능성이 적으니 부담없이 사용할 수 있습니다.