---
title: "vcpkg를 cgo에 사용하기"
date: 2023-10-12T00:21:28+09:00
tags: ["cgo", "vcpkg"]
author: "snowmerak"
categories: ["Information"]
draft: false
---

## vcpkg?

[`vcpkg`](https://github.com/microsoft/vcpkg)는 Microsoft에서 발표한 C/C++ 패키지 매니저입니다.  
vcpkg의 레포에 등록된 패키지들을 `install`을 통해 손쉽게 설치하고 이용할 수 있습니다.

### vcpkg 설치

vcpkg는 전역으로 사용할 수 있지만 이번 글에서는 프로젝트 내에서 사용하도록 설정하겠습니다.

```bash
mkdir prac
git clone https://github.com/microsoft/vcpkg.git
```

`prac` 폴더를 생성한 후, vcpkg를 클론합니다.  
클론하면 vcpkg 폴더가 생성되고, 최초 1회 `bootstrap-vcpkg.sh`(or 윈도우의 경우, `bootstrp-vcpkg.bat`)을 실행해야 합니다.

```bash
cd vcpkg
./bootstrap-vcpkg.sh
```

그럼 vcpkg 폴더에 `vcpkg` 파일이 생성됩니다.  
이 파일을 실행함으로 패키지를 설치할 수 있습니다.

### 패키지 설치

저는 ffmpeg를 설치해보겠습니다.

```bash
./vcpkg install ffmpeg
```

저는 맥이라 그런지, `nasm`을 설치하라고 떠서 `brew install nasm`으로 설치했습니다.

```bash
-- Performing post-build validation
Stored binaries in 1 destinations in 7.9 s.
Elapsed time to handle ffmpeg:arm64-osx: 1.9 min
Total install time: 1.9 min
To use ffmpeg add the following to your CMake project:

    find_package(FFMPEG REQUIRED)
    target_include_directories(main PRIVATE ${FFMPEG_INCLUDE_DIRS})
    target_link_directories(main PRIVATE ${FFMPEG_LIBRARY_DIRS})
    target_link_libraries(main PRIVATE ${FFMPEG_LIBRARIES})
```

설치가 끝나면 위와 같은 내용이 출력됩니다.  
설치가 잘 되었고, 하단 4 라인을 CmakeLists.txt에 추가하여 사용하면 된다는 뜻입니다.  
하지만 저희는 cgo를 사용할 것이기에 다른 메뉴얼을 참고해야합니다.

### 수동 통합

vcpkg는 [수동 통합](https://learn.microsoft.com/ko-kr/vcpkg/users/buildsystems/manual-integration) 문서를 통해 `include`와 `lib` 폴더를 지정해 주는 방법을 소개하고 있습니다.  
cgo에서는 어쩔 수 없이 이 방식을 채택했습니다.

## cgo

cgo는 익히 아시다시피 go 언어에서 C 코드를 실행할 수 있게 도와주는 도구입니다.

### 프로젝트 생성

먼저 `prac` 폴더로 돌아가서 go 프로젝트를 생성합니다.

```bash
go mod init prac
```

그리고 `main.go` 파일을 생성합니다.

```go
package main

import "C"

func main() {}
```

cgo를 사용할 것이기 때문에 `import "C"` 구문을 추가합니다.  
그리고 빌드할 때, cgo 관련 플래그를 추가할 수 있지만, 저는 `go build`만 사용해서 빌드하고 싶으므로 미리 플래그를 추가하겠습니다.

```go
package main

/*
#cgo LDFLAGS: -L./vcpkg/installed/arm64-osx/lib
#cgo CFLAGS: -I./vcpkg/installed/arm64-osx/include
*/
import "C"

func main() {}
```

`#cgo` 구문을 통해 `LDFLAGS`와 `CFLAGS`를 추가했습니다.  
이제 빌드할 때, 별도의 플래그 없이 해당 include 폴더와 lib 폴더를 참조할 수 있습니다.

### vscode c 설정

C 헤더를 가져오는 건 잘 되겠지만, vscode에서 인식하지 못 하면 많이 불편할 것입니다.  
아님 말구요.

저는 자동 완성과 인텔리센스가 없으면 안 되는 몸이 되어버렸기 때문에 관련 설정을 해주겠습니다.

vscode에서 커맨드 팔레트를 열어서 `C/C++: Edit Configurations (JSON)`을 선택합니다.  
그럼 프로젝트 내에 `.vscode` 폴더 밑에 `c_cpp_properties.json` 파일이 생성됩니다.  
해당 `json` 파일은 제 맥을 기준으로 아래와 같았습니다.

```json
{
    "configurations": [
        {
            "name": "Mac",
            "includePath": [
                "${workspaceFolder}/**"
            ],
            "defines": [],
            "macFrameworkPath": [
                "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks"
            ],
            "compilerPath": "/usr/bin/clang",
            "cStandard": "c17",
            "cppStandard": "c++17",
            "intelliSenseMode": "macos-clang-arm64"
        }
    ],
    "version": 4
}
```

이 json 파일에서 `"includePath"` 내부에 vcpkg 내부의 include 폴더를 추가합니다.

```json
{
    "configurations": [
        {
            "name": "Mac",
            "includePath": [
                "${workspaceFolder}/**",
                "./vcpkg/installed/arm64-osx/include"
            ],
            "defines": [],
            "macFrameworkPath": [
                "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks"
            ],
            "compilerPath": "/usr/bin/clang",
            "cStandard": "c17",
            "cppStandard": "c++17",
            "intelliSenseMode": "macos-clang-arm64"
        }
    ],
    "version": 4
}
```

그럼 vscode에서 C 헤더파일들을 인식해서 cgo 내에서도 도구의 힘을 빌릴 수 있습니다. hooray!

### 크로스플랫폼 설정

vcpkg 내부의 installed 폴더 아래는 플랫폼 별로 폴더가 나뉘어져 있습니다.  
흔히 쓰이는 실리콘 맥의 경우엔 `arm64-osx`이고, amd64 윈도우의 경우엔 `x64-windows`입니다.  
그리고 amd64 리눅스는 `x64-linux`입니다.

맥만 생각하고 작성했기에 방금 `main.go`같은 형식이 나올 수 있었지만, amd64 windows와 linux에 대해서도 별도의 설정 없이 동작할 수 있게 파일을 생성하겠습니다.

- osx.go

```go
//go:build darwin

package main

/*
#cgo LDFLAGS: -L./vcpkg/installed/arm64-osx/lib
#cgo CFLAGS: -I./vcpkg/installed/arm64-osx/include
*/
import "C"
```

- windows.go

```go
//go:build windows

package main

/*
#cgo LDFLAGS: -L./vcpkg/installed/x64-windows/lib
#cgo CFLAGS: -I./vcpkg/installed/x64-windows/include
*/
import "C"
```

- linux.go

```go
//go:build linux

package main

/*
#cgo LDFLAGS: -L./vcpkg/installed/x64-linux/lib
#cgo CFLAGS: -I./vcpkg/installed/x64-linux/include
*/
import "C"
```

빌드 컨트랙트를 통해 각 플랫폼 별로 적용될 플래그를 다르게 설정하였습니다.

## ffmpeg 사용해보기

이제 ffmpeg를 사용해보겠습니다.

```go
package main

/*
#cgo LDFLAGS: -L ./vcpkg/installed/arm64-osx/lib -lavcodec -lavformat -lavutil
#cgo CFLAGS: -I ./vcpkg/installed/arm64-osx/include

#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
*/
import "C"
import (
	"fmt"
)

func main() {
	fmt.Println(C.avcodec_configuration())
	fmt.Println(C.avcodec_license())
	fmt.Println(C.avcodec_version())
}
```

```bash
0x100117872
0x100117eac
3933028
```

아마 잘(?) 실행됩니다.
