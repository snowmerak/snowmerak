---
title: "템플-리츠로 간단하게 설정 페이지 만들기"
date: 2022-12-14T21:25:02+09:00
tags: ["template", "go"]
draft: true
---

스타 수는 적지만 `a-h`님의 `templ`이란 템플릿 라이브러리가 있습니다. 코드 생성 기반으로 돌아가며, 고랭 코드에 HTML을 작성하는 자체 문법과 해당 문법을 구현한 `language server`도 존재합니다. 

`templ`을 사용하려면 우선 CLI 툴을 설치해야합니다. `go install github.com/a-h/templ/cmd/templ@latest` 명령어로 `templ` CLI 툴을 설치할 수 있습니다. 그리고 프로젝트를 생성한 후, `go get github.com/a-h/templ`을 실행해 `templ` 의존성을 추가합니다. 