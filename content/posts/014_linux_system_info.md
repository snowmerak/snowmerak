---
title: "리눅스 서버 및 앱 모니터링하기"
date: 2022-12-14T21:25:02+09:00
tags: ["linux", "socket"]
author: "snowmerak"
categories: ["Information"]
draft: true
---

## summary

이 포스트는 최근에 리눅스에서 어플리케이션을 돌리며 배운 내용을 정리한 것입니다.

간단한 모니터링부터 문제 해결을 어떻게 했는지 정리해보았습니다.

## 서버 모니터링

### htop

htop은 제가 가장 처음 업무를 배울 때 들었던 모니터링 툴입니다.

![htop](/img/014/htop.png)

> 이 스크린샷은 제 맥의 htop입니다.

#### 상단 CPU 사용량 바

지금 제 맥은 뭔가를 하고 있지 않아서 CPU가 놀고 있지만 작업 중에는 `|||||`로 채워지며 이 바는 3가지 색상으로 구분됩니다.

1. blue: 낮은 우선순위의 스레드
2. green: 일반 우선순위, 유저 단계의 스레드
3. red: 높은 우선순위, 시스템 단계의 스레드

그래서 전체적으로 CPU가 얼마나 바쁜지 알 수 있지만, 색상으로 어떤 연산으로 인해 CPU가 바쁜지 대략적으로 유추할 수도 있습니다.  
초록색이 많다면 내가 작성한 로직이 CPU에 부하를 주고 있고, 빨간색이 많다면 OS가 CPU를 많이 사용하고 있다는 것을 알 수 있습니다.

#### Load Average

Load Average는 1분, 5분, 15분 동안의 CPU 사용량을 나타냅니다.

최대 수는 htop이 보여주는 코어 수와 동일하며, 총 8개의 코어를 쓰고 있다면 8이 CPU 자원을 100% 모두 쓰고 있다는 것이 됩니다.

#### 상단 MEM, SWAP 사용량 바

MEM은 메모리 사용량, SWAP은 스왑 사용량을 나타냅니다.

1. green: 사용 중인 메모리
2. blue: 버퍼 메모리
3. yello: 캐시 메모리

대체로 메모리를 얼마나 쓰고 있는가만 보고 있습니다.  

### netstat

netstat은 네트워크 상태를 확인하는 명령어입니다.

netstat는 아래 옵션들을 가지고 있습니다.

- `-l`: listening 소켓만 보여줍니다.
- `-n`: IP 주소를 숫자로 보여줍니다.
- `-t`: TCP 소켓만 보여줍니다.
- `-u`: UDP 소켓만 보여줍니다.
- `-p`: 프로세스 ID를 보여줍니다.
- `-a`: 모든 소켓을 보여줍니다.
- `-i`: 인터페이스별로 보여줍니다.
- `-r`: 라우팅 테이블을 보여줍니다.
- `-s`: 통계를 보여줍니다.

이 중 `-na` 옵션을 사용하면 모든 소켓과 IP를 보여줍니다.

```bash
Active Internet connections (including servers)
Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)
```

인터넷 연결만 보면 상단 헤더는 위와 같이 나오는데, 이는 아래와 같은 의미를 가집니다.

- `Proto`: 프로토콜
- `Recv-Q`: 수신 대기 큐
- `Send-Q`: 송신 대기 큐
- `Local Address`: 로컬 주소
- `Foreign Address`: 외부 주소
- `state`: ESTABLISHED, LISTEN, CLOSE_WAIT, TIME_WAIT 등의 상태

제 맥에서 임의로 레디스 서버를 오픈하고, netstat로 레디스 서버의 포트를 확인하면 다음과같은 결과를 확인할 수 있습니다.

![netstat](/img/014/netstat.png)

그럼 두번째(`Recv-Q`), 세번째(`Send-Q`) 칼럼으로 현재 레디스 서버가 소켓을 얼마나 사용하고 있는지, 혹시 큐가 쌓이진 않는지 확인할 수 있습니다.

### nethogs

nethogs는 네트워크 사용량을 확인하는 명령어입니다.

nethogs를 설치한 후, 실행하기 위해서는 root 권한이 필요합니다.

`sudo nethogs`로 실행합니다.

![nethogs](/img/014/nethogs.png)

nethogs는 프로세스별로 네트워크 사용량을 확인할 수 있습니다.

이 명령어를 사용하면, 현재 어떤 프로세스가 네트워크를 얼마나 사용하고 있는지 확인할 수 있습니다.
