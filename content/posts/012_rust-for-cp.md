---
title: "[Draft] 러스트로 알고리즘 테스트를 풀어봅시다"
date: 2022-04-12T00:08:40+09:00
tags: ["rust", "cp", "fast io"]
draft: false
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

#### 정렬 및 이진 탐색

```rust
fn main() {
    let mut v = vec![7, 3, 5, 4, 1, 2, 9, 10, 6, 8];
    v.sort();
    println!("sorted: {:?}", v);
}
```

러스트는 벡터가 가변이고 내부 타입이 비교 가능할 경우 `sort()` 메서드를 사용하여 벡터를 정렬할 수 있습니다. 위 예시를 실행하면 `sorted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`로 정렬된 벡터를 출력함을 확인할 수 있습니다.

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 6, 7, 8, 9, 10, 11];
    
    match v.binary_search(&4) {
        Ok(index) => println!("found 4 at index {}", index),
        Err(index) => println!("4 is not found, but index is {}", index),
    }

    match v.binary_search(&5) {
        Ok(index) => println!("found 5 at index {}", index),
        Err(index) => println!("5 is not found, but index is {}", index),
    }
}
```

```rust
found 4 at index 3
5 is not found, but index is 4
```

정렬된 벡터일 경우 `binary_search()` 메서드를 사용하여 값을 이진 탐색할 수 있습니다. 각각 4와 5를 탐색했을 때, 4는 존재하는 값이기에 인덱스 값인 3을 `Ok`를 통해 반환했고, 5는 존재하지 않는 값이기에 삽입(`insert`)하면 되는 인덱스인 4를 `Err`를 통해 반환했습니다.

```rust
fn main() {
    let mut v = vec![1, 2, 3, 4, 6, 7, 8, 9, 10, 11];
    
    v.insert(4, 5);
    println!("inserted: {:?}", v);
}
```

벡터가 가변일 경우에 `insert(index, value)` 메서드를 통해 해당 인덱스에 값을 추가하여 정렬 상태를 유지할 수 있습니다.

### 덱(VecDeque)

```rust
use std::collections::VecDeque;

fn main() {
    let mut a = VecDeque::new();
}
```

덱은 벡터와 비슷하지만 맨 처음과 마지막에 값을 추가 삭제할 때 코스트가 더 싸지만 순회는 더 비싸다는 특징을 가지고 있습니다. `use std::collections::VecDeque`으로 `VecDeque`를 가져와야 사용할 수 있습니다. 다른 구조체와 마찬가지로 `::new()` 메서드로 새로운 객체를 만들 수 있습니다.

#### 큐

```rust
use std::collections::VecDeque;

fn main() {
    let mut a = VecDeque::new();
    a.extend(vec![1, 2, 3, 4, 5].iter());

    a.push_back(6);
    let first = match a.pop_front() {
        Some(x) => x,
        None => 0,
    };
    println!("{}", first);
}
```

덱을 가변으로 선언하고 `push_back(value)` 메서드를 사용하면 덱의 마지막에 값을 추가할 수 있습니다. 그리고 `pop_front()` 메서드를 통해 덱의 맨 앞의 값의 `Option<T>`을 받습니다. 이렇게 덱의 맨 뒤에 넣고 맨 앞에서 빼는 방식으로 간단한 큐를 구현할 수 있습니다. 반대로 `push_front(value)`와 `pop_back()` 메서드를 사용하면 맨 앞에 넣고 맨 뒤에서 빼는 형식의 큐를 만들 수 있습니다.

#### 스택

```rust
use std::collections::VecDeque;

fn main() {
    let mut a = VecDeque::new();
    a.extend(vec![1, 2, 3, 4, 5].iter());

    a.push_back(6);
    let first = match a.pop_back() {
        Some(x) => x,
        None => 0,
    };
    println!("{}", first);
}
```

스택의 예시에서 조금 틀어서 `push_back(value)`로 맨 끝에 값을 넣고 `pop_back()`으로 맨 끝에서 값을 꺼내면 덱의 마지막에 넣고 빼는 스택이 됩니다. 반대로 `push_front(value)`와 `pop_front()` 메서드를 사용하면 맨 앞에서 넣고 빼는 스택이 됩니다.

### 이진 힙(BinaryHeap)

```rust
use std::collections::BinaryHeap;

fn main() {
    let mut heap: BinaryHeap<i32> = BinaryHeap::new();
    heap.extend(vec![1, 9, 2, 8, 3, 7, 4, 6, 5].iter());
    while !heap.is_empty() {
        print!("{:?} ", heap.pop().unwrap());
    }
}
```

이진 힙은 벡터를 베이스로 동작하는 우선순위 큐입니다. 이진 힙도 덱과 마찬가지로 `::new()` 메서드로 새로운 인스턴스를 생성합니다. 순서대로 `1, 9, 2, 8, 3, 7, 4, 6, 5`을 입력합니다. 러스트의 이진 힙은 최대 값을 먼저 반환하는 최대 힙입니다. 위 예시의 출력은 `9 8 7 6 5 4 3 2 1`입니다.

#### 최소 힙

```rust
use std::{collections::BinaryHeap, cmp::Reverse};

fn main() {
    let mut heap = vec![1, 9, 2, 8, 3, 7, 4, 6, 5].into_iter().map(Reverse).collect::<BinaryHeap<_>>();
    while !heap.is_empty() {
        print!("{:?} ", heap.pop().unwrap().0);
    }
}
```

이진 힙은 타입에 정의된 비교 메서드를 통해 이루어지는데, 이 비교를 역전하여 적용할 수 있는 `Reverse`라는 구조체가 존재합니다. 벡터를 기반으로 이터레이터를 만들고 모든 원소에 `map()` 메서드를 통해 `Reverse` 구조체를 적용하여 `Reverse<T>` 인스턴스의 이터레이터로 변환합니다. 이후 `collect::<BinaryHeap<_>>()` 메서드로 `BinaryHeap<Reverse<T>>` 인스턴스로 수집합니다.

```rust
use std::{collections::BinaryHeap, cmp::Reverse};

fn main() {
    let mut heap = BinaryHeap::new();
    heap.push(Reverse(5));
    heap.push(Reverse(4));
    heap.push(Reverse(3));
    heap.push(Reverse(2));
    heap.push(Reverse(1));

    while let Some(Reverse(x)) = heap.pop() {
        print!("{} ", x);
    }
}
```

이번에는 처음의 예처럼 일반적인 방법으로 이진 힙을 만듭니다. 이후 `Reverse` 구조체로 감싼 값을 추가합니다. 그럼 모든 비교가 역전되어 적용되어 이진 힙이 최소 힙으로 만들어집니다. 

### HashMap, BTreeMap

`HashMap`은 SipHash 1-3 해시 알고리즘을 기반으로 만들어진 해시 맵 자료구조입니다.  
`BTreeMap`은 B-Tree를 기반으로 만들어진 트리 맵 자료구조입니다.

#### 추가

```rust
use std::collections::{HashMap, BTreeMap};

fn main() {
    let mut m = HashMap::new();
    m.insert(0, "zero");
    m.insert(1, "one");
    m.insert(2, "two");

    for (k, v) in &m {
        println!("{} -> {}", k, v);
    }

    let mut m = BTreeMap::new();
    m.insert(0, "zero");
    m.insert(1, "one");
    m.insert(2, "two");

    for (k, v) in &m {
        println!("{} -> {}", k, v);
    }
}
```

`insert(key, value)` 메서드는 값이 없을 때는 키와 값 페어를 추가하고, 이미 키가 맵에 있을 경우 키에 해당하는 값을 변경합니다. 또한 `HashMap`과 `BTreeMap`은 위 예시에서 보듯이 키와 값을 추가하는 메서드가 동일합니다. 이는 다른 메서드들, 조회나 삭제도 동일합니다.

#### 조회

```rust
use std::collections::HashMap;

fn main() {
    let mut m: HashMap<_, _> = HashMap::from([(1, 2), (2, 3), (3, 4)]);

    println!("contains key 2: {}", m.contains_key(&2));

    match m.get(&1) {
        Some(v) => println!("{} of key 1", v),
        None => println!("not contains"),
    }

    println!("keys: {:?}", m.keys());

    println!("values: {:?}", m.values());

    print!("for loop: ");
    for (k, v) in &m {
        print!("{} -> {}, ", k, v);
    }
    println!();
}
```

두 맵은 동일한 메서드를 사용하므로 `HashMap`만 사용하였습니다. `contains_key(&key)`는 입력받은 키가 존재하는 지를 반환합니다. 당연하게도 있다면 `true`를 반환합니다. `get(&key)` 메서드는 입력받은 키에 해당하는 값의 `Option<T>` 객체를 반환합니다. `Some(value)` 분기로 빌린 값에 접근할 수 있고, `None` 분기를 통해 없을 때의 동작을 정의할 수 있습니다.

#### 삭제

```rust
use std::collections::HashMap;

fn main() {
    let mut m: HashMap<_, _> = HashMap::from([(1, 2), (2, 3), (3, 4)]);

    match m.remove(&2) {
        Some(x) => println!("{} of key 2", x),
        None => println!("not exists"),
    };

    println!("{:?}", m);

    m.clear();

    println!("{:?}", m);
}
```

`remove(&key)` 메서드를 사용하여 맵에 저장된 키와 값을 삭제합니다. 결과는 `Option<T>`로 반환하며 성공했을 경우, `Some(value)` 분기에서 값을 받아서 다룰 수 있으며, 실패했을 경우 `None` 분기에서 적절한 처리를 할 수 있습니다. `clear()` 메서드는 맵 내부 데이터를 모두 삭제합니다.

### HashSet, BTreeSet

`HashSet`은 해시 맵과 마찬가지로 해시로 동작하는 해시 셋십니다.  
`BTreeSet`은 비트리 맵과 마찬가지로 B-Tree를 기반으로 동작하는 트리 셋입니다.

#### 추가

```rust
use std::collections::HashSet;

fn main() {
    let mut s = HashSet::new();
    s.insert(1);
    s.insert(3);
    s.insert(5);
}
```

`insert(value)` 메서드를 통해 값을 셋에 추가할 수 있습니다. 이 때, `true`가 반환되면 셋에 존재하지 않았다가 추가된 것이고, `false`가 반환되면 셋에 존재하고 있는 값을 추가한 것입니다.

#### 조회

```rust
use std::collections::HashSet;

fn main() {
    let s = HashSet::from([1, 2, 3, 4, 5]);
    println!("key 5 is exists? {:?}", s.contains(&5));
    println!("key 6 is exists? {:?}", s.contains(&6));
}
```

`contains(&value)` 메서드를 통해 값이 존재하는 지 확인할 수 있습니다.

#### 삭제

```rust
use std::collections::HashSet;

fn main() {
    let mut s = HashSet::from([1, 3, 5, 7, 9, 11]);
    
    println!("5 is removed? {}", s.remove(&5));
    println!("13 is removed? {}", s.remove(&13));
}
```

`remove(&value)` 메서드를 통해 특정 값을 삭제할 수 있습니다. 반환값은 `bool` 타입으로 존재한 것을 삭제했을 경우 `true`를 반환하고, 존재하지 않는 값을 삭제하려고 했을 경우 `false`를 반환합니다.

#### 집합 연산

```rust
use std::collections::HashSet;

fn main() {
    let a = HashSet::from([1, 3, 5, 7, 9, 11]);
    let b = HashSet::from([1, 2, 3, 4, 5, 6]);

    println!("intersection: {:?}", a.intersection(&b).collect::<HashSet<_>>());

    println!("union: {:?}", a.union(&b).collect::<HashSet<_>>());

    println!("subtract: {:?}", a.difference(&b).collect::<HashSet<_>>());

    println!("symmetric_difference: {:?}", a.symmetric_difference(&b).collect::<HashSet<_>>());

    println!("is_disjoint: {}", a.is_disjoint(&b));

    println!("is_subset: {}", a.is_subset(&b));

    println!("is_superset: {}", a.is_superset(&b));

    println!("is_empty: {}", a.is_empty());
}
```

```bash
intersection: {1, 5, 3}
union: {4, 3, 2, 6, 7, 11, 5, 9, 1}
subtract: {9, 11, 7}
symmetric_difference: {2, 9, 7, 11, 6, 4}
is_disjoint: false
is_subset: false
is_superset: false
is_empty: false
```

`intersection(&other)`, `union(&other)`, `difference(&other)`, `symmetric_difference(&other)` 메서드는 각각 교집합, 합집합, 차집합, 대칭 차집합을 의미합니다. 이 네 가지 메서드들은 각각 `collect()` 메서드로 특정 자료구조로 수집할 수 있습니다.

`is_disjoint(&other)`, `is_subset(&other)`, `is_superset(&other)`는 각각 서로소 집합인지, `other`의 부분집합인지, `other`가 부분집합인지를 반환합니다.

### 문자열(String)

러스트에는 수 많은 문자열이 있지만 `String` 구조체만 생각합니다. `String`은 내부적으로 UTF8 인코딩을 따르고 있기에 범용성이 좋습니다.

```rust
fn main() {
    let from_str = String::from("hello");
    let new_constuctor = String::new();
    let from_literal = "hello".to_string();
}
```

`String` 구조체는 `::from(&str)` 메서드로 문자열 리터럴을 받아 생성하는 방법, `&str`의 `to_string()` 메서드로 반환받는 방법, `::new()` 생성자로 생성하는 방법, 3가지가 존재합니다. 

#### 추가

러스트의 `String`은 바이트 배열로 이루어져 있지만 UTF8 인코딩을 기본으로 하고 있기에 스트링 리터럴 및 바이트 접근과 `char` 타입을 통한 UTF8 접근이 가능합니다. 

```rust
fn main() {
    let mut s = String::new();

    s.push_str("아이스아메리카노");
    s.push(char::from('리'));

    println!("{}", s);  
}
```

`push_str(&str)` 메서드는 입력받은 문자열 리터럴을 단순하게 뒤에 붙입니다.  
`push(char)` 메서드는 `char` 타입 변수 하나를 뒤에 추가합니다. 러스트에서는 UTF8 인코딩의 한 글자를 `char`로 표기합니다.

 #### 조회

 ```rust
fn main() {
    let mut s = String::from("qpsdosssxclvwemfwjkbssscbzxyugadasdefsssdfv");

    match s.find("sss") {
        Some(index) => println!("Found 'sss' at index {}", index),
        None => println!("Didn't find 'sss'"),
    }

    for (i, v) in s.matches("sss").enumerate() {
        println!("{}: {}", i, v);
    }

    println!("'sss' is contains? {}", s.contains("sss"));
}
 ```

`String` 구조체의 조회 방법은 크게 3가지가 있습니다. `find(pattern)`, `matches(pattern)`, `contains(pattern)` 메서드는 문자열 리터럴, `char` 타입 문자, `char` 타입 배열, 혹은 `char` 타입 문자를 받아 판별하는 함수를 입력 받아 해당 패턴에 맞는 결과를 반환합니다.

일반적인 문자열 리터럴과 `char` 문자, `char` 배열이 아닌 `char` 타입 문자를 판별하는 함수는 러스트에서 기본적으로 몇가지 제공해주고 있습니다.

```rust
fn main() {
    let mut s = String::from("A little copying is better than a little dependency.");

    let pat = char::is_lowercase;
    let pat = char::is_uppercase;
    let pat = char::is_alphabetic;
    let pat = char::is_numeric;
    let pat = char::is_alphanumeric;
    let pat = char::is_whitespace;
    let pat = char::is_control;

    match s.find(pat) {
        Some(i) => {
            println!("Found at {}", i);
        }
        None => {
            println!("No found!");
        }
    }

    for (i, v) in s.matches(pat).enumerate() {
        println!("{}: {}", i, v);
    }

    println!("contains? {}", s.contains(pat));
}
```

각각 `is_lowercase`, `is_uppercase`, `is_alphabetic`, `is_numeric`, `is_alphanumeric`, `is_whitespace`, `is_control`은 유니코드 상에서 소문자인지, 유니코드 상에서 대문자인지, 글자인지, 숫자인지, 문자 혹은 숫자인지, 공백인지, 컨트롤 문자인지 반환합니다. 이 함수들을 패턴으로 입력함으로 원하는 패턴을 검색할 수 있습니다.

#### 삭제, 교체

```rust
fn main() {
    let mut s = String::from("A little copying is better than a little dependency.");

    let result = s.replace(char::is_whitespace, "");

    println!("{}", result);
}
```

다른 언어와 마찬가지로 `replace(from, to)` 메서드로 제거합니다. `from` 매개변수는 위 `char`의 함수들도 사용할 수 있습니다. 

```rust
fn main() {
    let mut s = String::from("A little copying is better than a little dependency.");

    let result = s.remove(0);

    println!("{}", result);
}
```

`remove(index)` 메서드는 `String` 변수가 가변일 때 사용할 수 있습니다. 입력된 인덱스에 해당하는 문자를 삭제하고 반환합니다. 만약 인덱스가 문자열 전체 길이를 넘어갔을 경우 런타임 패닉이 발생하기 때문에 주의해서 사용해야합니다.

---

## Iterator

러스트는 거의 모든 자료구조가 이터레이터로 변환되어 동작할 수 있습니다. 다른 자료구조들, 벡터, 덱, 셋은 `iter()` 메서드나 `into_iter()` 메서드로 이터레이터를 만들 수 있습니다. `iter()` 메서드는 내부 값들을 빌려주기 때문에 기존 자료구조를 그대로 재활용할 수 있습니다. 하지만 `into_iter()`의 경우 내부 값들을 이동 시키기 때문에 기존 자료구조를 재활용할 수 없습니다.

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5];

    let a = v.iter().map(|x| x + 1).collect::<Vec<_>>();

    println!("prev: {:?}", v);
    println!("new: {:?}", a);
}
```

이터레이터를 활용하여 벡터의 모든 원소에 1을 더한 새로운 벡터를 생성하는 간단한 코드입니다. 이전 변수도 그대로 활용할 수 있습니다.

```rust
fn main() {
    let mut v = vec![1, 2, 3, 4, 5];

    v.iter_mut().for_each(|x| *x += 1);

    println!("prev: {:?}", v);
}
```

이번엔 `iter_mut()` 메서드를 이용해 가변 자료구조 변수의 값을 가변 변수로 빌렸습니다. 포인터 참조를 하듯이 `*`을 사용하여 1을 더함으로 모든 벡터의 값이 1이 더해져 있음을 확인할 수 있습니다.

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5];

    let a  = v.into_iter().map(|x| x + 1).collect::<Vec<_>>();

    println!("prev: {:?}", v); // error
    println!("new: {:?}", a);
}
```

이 코드는 실행되지 않습니다. `into_iter()` 메서드는 내부 값을 모두 이터레이터에게 빌려주지 않고 그냥 주기 때문에 기존 자료구조 변수를 재사용할 수 없습니다. `v`를 출력하려고 할 때 에러가 납니다. 대신 이터페리터 연산 시 거추장스러운 `*`을 보지 않아도 됩니다.

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5];

    let v  = v.into_iter().map(|x| x + 1).collect::<Vec<_>>();

    println!("prev: {:?}", v);
}
```

마지막으로 `into_iter()` 메서드를 사용할 때는 이렇게 같은 이름의 새로운 변수로 할당하는 방식을 쓰기도 합니다. 이를 러스트에서는 쉐도잉(shadowing)이라고 합니다. 이렇게 사용하게 되면 기존의 `v`는 접근할 수 없게 되고 새로 만든 `v`만 접근할 수 있게 되어 자연스럽게 쓸 수 있습니다. 주의할 점은 쉐도잉된 기존 `v`는 사라지는게 아니라 가려지는 것이기 때문에 의도치 않게 메모리를 낭비할 수 있습니다.
