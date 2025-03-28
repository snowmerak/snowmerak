---
title: "Flutter 설치"
date: 2025-03-28T21:28:42+09:00
author: "snowmerak"
tags: ["flutter"]
categories: ["Information"]
draft: false
---

## 개요

flutter를 설치하는 걸 어려워 하시는 분들이 적잖이 계신 것같아 작성합니다.

## OS 별로 설치 방법

### Windows

#### Script를 이용해서

Written by Gemini.

PowerShell 스크립트입니다.  
아무 곳이나 `get_flutter.ps1`같은 파일을 만들어 아래 스크립트를 붙여넣기 하여 저장하고 실행합니다.  
그럼 버전을 입력해야하는데, [flutter 아카이브](https://docs.flutter.dev/release/archive)에서 확인 후 적절한 버전을 입력하면 됩니다.

```powershell
# PowerShell 스크립트: Flutter SDK 다운로드

# --- 설정 ---
# Flutter 다운로드 URL의 기본 구조
$flutterBaseUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_"
$flutterUrlSuffix = "-stable.zip"

# --- 사용자 입력 받기 ---
# 사용자에게 다운로드할 Flutter 버전 번호 요청 (예: 3.29.2)
# 사용자가 입력할 때까지 스크립트가 여기서 대기합니다.
$flutterVersionInput = Read-Host -Prompt "다운로드할 Flutter 버전을 입력하세요 (예: 3.29.2). 정확한 버전 번호는 Flutter 웹사이트에서 확인하세요"

# 입력값 유효성 검사 (간단히 비어있는지만 확인)
if ([string]::IsNullOrWhiteSpace($flutterVersionInput)) {
    Write-Error "버전 번호를 입력해야 합니다. 스크립트를 종료합니다."
    # 스크립트 비정상 종료 (오류 코드 1)
    exit 1
}

# 입력받은 버전으로 전체 다운로드 URL 구성
# 사용자가 '3.19.6'을 입력하면, URL은 ".../flutter_windows_3.19.6-stable.zip" 형태가 됩니다.
$flutterZipUrl = "$($flutterBaseUrl)$($flutterVersionInput)$($flutterUrlSuffix)"

# 다운로드 받을 임시 파일 경로 설정
$tempDir = $env:TEMP
# 파일 이름에도 버전을 포함시켜 구분 용이하게 함 (선택 사항)
$downloadFileName = "flutter_sdk_$($flutterVersionInput).zip"
$tempDownloadPath = Join-Path $tempDir $downloadFileName

# 압축 해제 대상 폴더 (사용자 홈 폴더)
$extractDestination = $HOME

# --- 스크립트 실행 ---
Write-Host "Flutter SDK v$($flutterVersionInput) 다운로드 및 설치를 시작합니다..." -ForegroundColor Cyan

# 1. Flutter SDK 다운로드
Write-Host "Flutter SDK 다운로드 중... ($flutterZipUrl)"
Write-Host "임시 저장 경로: $tempDownloadPath"
try {
    # Invoke-WebRequest를 사용하여 파일 다운로드
    Invoke-WebRequest -Uri $flutterZipUrl -OutFile $tempDownloadPath -ErrorAction Stop
    Write-Host "다운로드 완료." -ForegroundColor Green
} catch {
    # 오류 발생 시, 입력한 버전이나 URL이 잘못되었을 가능성을 명시
    Write-Error "Flutter SDK v$($flutterVersionInput) 다운로드 실패: $($_.Exception.Message)"
    Write-Error "입력한 버전 번호('$flutterVersionInput')가 정확한지, 해당 버전이 stable 채널에 존재하는지 확인하세요."
    Write-Error "시도한 URL: $flutterZipUrl"
    # 실패 시 임시 파일 삭제 (존재하는 경우)
    if (Test-Path $tempDownloadPath) {
        Remove-Item -Path $tempDownloadPath -Force -ErrorAction SilentlyContinue
    }
    # 스크립트 중단
    exit 1
}

# 2. Flutter SDK 압축 해제
Write-Host "Flutter SDK 압축 해제 중... ($extractDestination)"
try {
    # Expand-Archive를 사용하여 zip 파일 압축 해제
    Expand-Archive -Path $tempDownloadPath -DestinationPath $extractDestination -Force -ErrorAction Stop
    Write-Host "압축 해제 완료." -ForegroundColor Green

    # 압축 해제 확인
    $expectedFlutterPath = Join-Path $extractDestination "flutter"
    if (Test-Path $expectedFlutterPath) {
        Write-Host "Flutter SDK가 '$expectedFlutterPath' 경로에 성공적으로 압축 해제되었습니다."
    } else {
        Write-Warning "'$expectedFlutterPath' 경로를 찾을 수 없습니다. 압축 해제 결과를 확인하세요."
    }

} catch {
    Write-Error "Flutter SDK 압축 해제 실패: $($_.Exception.Message)"
    # 압축 해제 실패 시에도 임시 파일 삭제
    if (Test-Path $tempDownloadPath) {
        Write-Host "압축 해제 오류 발생. 임시 파일 삭제 중: $tempDownloadPath"
        Remove-Item -Path $tempDownloadPath -Force -ErrorAction SilentlyContinue
    }
    # 스크립트 중단
    exit 1
}

# 3. 임시 다운로드 파일 삭제
Write-Host "임시 다운로드 파일 삭제 중... ($tempDownloadPath)"
try {
    if (Test-Path $tempDownloadPath) {
        Remove-Item -Path $tempDownloadPath -Force -ErrorAction Stop
        Write-Host "임시 파일 삭제 완료." -ForegroundColor Green
    } else {
        Write-Host "임시 파일이 이미 삭제되었거나 존재하지 않습니다."
    }
} catch {
    Write-Warning "임시 파일 '$tempDownloadPath' 삭제 실패: $($_.Exception.Message)"
}

# 추가할 경로 정의
$flutterBinPathToAdd = Join-Path $HOME "flutter\bin"
$variableName = "Path"
$variableScope = "User" # 사용자 범위 지정

# 현재 사용자 PATH 값 가져오기
$currentUserPath = [System.Environment]::GetEnvironmentVariable($variableName, $variableScope)

# 경로가 이미 포함되어 있는지 확인 (중복 추가 방지)
if ($currentUserPath -split ';' -notcontains $flutterBinPathToAdd) {
    # 기존 PATH 끝에 세미콜론(;)과 새 경로 추가
    # 기존 PATH가 비어있거나 세미콜론으로 끝나지 않는 경우 고려
    $newUserPath = ($currentUserPath, $flutterBinPathToAdd) -join ';' -replace ';{2,}', ';' # 여러 개의 세미콜론을 하나로 정리

    # 새 PATH 값 설정
    [System.Environment]::SetEnvironmentVariable($variableName, $newUserPath, $variableScope)

    Write-Host "사용자 환경 변수 '$variableName'에 '$flutterBinPathToAdd' 경로를 추가했습니다." -ForegroundColor Green
    Write-Host "변경 사항을 적용하려면 새 PowerShell 창을 열거나 로그아웃 후 다시 로그인하세요."
} else {
    Write-Host "'$flutterBinPathToAdd' 경로는 이미 사용자 '$variableName' 환경 변수에 존재합니다." -ForegroundColor Yellow
}

# --- 완료 메시지 및 다음 단계 안내 ---
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "Flutter SDK v$($flutterVersionInput) 설치 스크립트가 완료되었습니다." -ForegroundColor Cyan
Write-Host "다음 단계를 진행하세요:"
Write-Host "- 새 PowerShell 창을 열고 'flutter doctor' 명령어를 실행하여 설치 상태를 확인하세요."
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
```

이 방식을 사용할 경우에는 수동으로 환경 변수를 수정해야합니다.

#### scoop을 이용해서

[Scoop](https://scoop.sh/)은 windows에서 사용할 수 있는 패키지 매니저입니다. PowerShell에서 편하게 쓸 수 있습니다.

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

```powershell
scoop bucket add extras
scoop install extras/flutter
flutter doctor
```

### MacOS

#### homebrew를 이용해서

homebrew는 MacOS에서 쓸 수 있는 보편적인 패키지 매니저입니다.

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install --cask flutter
```

#### Script를 통해서

Written by gemini.

테스트는 맥이 없어서 못 해봤습니다.
homebrew 쓰세요.

```sh
#!/bin/zsh

# macOS용 Flutter SDK 설치 스크립트 (Zsh)

# --- 설정 및 아키텍처 감지 ---
echo "macOS 아키텍처 확인 중..."
arch=$(uname -m)
if [[ "$arch" == "arm64" ]]; then
  platform_arch="macos_arm64"
elif [[ "$arch" == "x86_64" ]]; then
  platform_arch="macos_x64"
else
  echo "오류: 지원되지 않는 아키텍처입니다: $arch" >&2
  exit 1
fi
echo "감지된 아키텍처: $arch ($platform_arch)"

flutter_base_url="https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/"
flutter_suffix="-stable.zip"

# --- 사용자 입력 받기 ---
echo -n "다운로드할 Flutter 버전을 입력하세요 (예: 3.19.6). 정확한 버전 번호는 Flutter 웹사이트에서 확인하세요: "
read flutter_version_input

# 입력값 유효성 검사 (간단히 비어있는지만 확인)
if [[ -z "$flutter_version_input" ]]; then
    echo "\n오류: 버전 번호를 입력해야 합니다. 스크립트를 종료합니다." >&2
    exit 1
fi

# --- 다운로드 URL 및 경로 설정 ---
flutter_zip_url="${flutter_base_url}flutter_${platform_arch}_${flutter_version_input}${flutter_suffix}"

# 임시 다운로드 경로 설정 (TMPDIR 환경 변수 사용, 없으면 /tmp 사용)
temp_dir="${TMPDIR:-/tmp}"
download_filename="flutter_sdk_${platform_arch}_${flutter_version_input}.zip"
temp_download_path="$temp_dir/$download_filename"

# 압축 해제 대상 폴더 (사용자 홈 디렉토리)
extract_destination="$HOME"
expected_flutter_path="$extract_destination/flutter" # 압축 해제 후 예상되는 경로

# --- 스크립트 실행 ---
echo "\nFlutter SDK v$flutter_version_input ($platform_arch) 다운로드 및 설치를 시작합니다..."

# 1. Flutter SDK 다운로드
echo "Flutter SDK 다운로드 중... ($flutter_zip_url)"
echo "임시 저장 경로: $temp_download_path"
# curl 옵션: -L (리디렉션 따라가기), -o (출력 파일 지정), -# (진행률 표시)
curl -L -o "$temp_download_path" -# "$flutter_zip_url"

# curl 명령어 성공 여부 확인 ($? 는 마지막 명령어의 종료 코드)
if [[ $? -ne 0 ]]; then
  echo "\n오류: Flutter SDK 다운로드 실패." >&2
  echo "입력한 버전 번호('$flutter_version_input')가 정확한지, 해당 버전/아키텍처가 stable 채널에 존재하는지 확인하세요." >&2
  echo "시도한 URL: $flutter_zip_url" >&2
  # 실패 시 임시 파일 삭제 시도 (파일이 존재할 경우)
  rm -f "$temp_download_path"
  exit 1
fi
echo "다운로드 완료."

# 2. Flutter SDK 압축 해제
echo "Flutter SDK 압축 해제 중... ($extract_destination)"
# unzip 옵션: -q (조용히 실행), -d (대상 디렉토리 지정)
# zip 파일 내의 'flutter' 폴더가 $HOME 아래에 풀리도록 함
unzip -q "$temp_download_path" -d "$extract_destination"

# unzip 명령어 성공 여부 확인
if [[ $? -ne 0 ]]; then
  echo "\n오류: Flutter SDK 압축 해제 실패." >&2
  # 실패 시에도 임시 파일 삭제 시도
  rm -f "$temp_download_path"
  exit 1
fi

# 압축 해제 후 예상 경로 확인
if [[ -d "$expected_flutter_path" ]]; then
   echo "압축 해제 완료. Flutter SDK 경로: $expected_flutter_path"
else
   # 압축 해제는 성공했지만 예상 경로가 없는 경우 (zip 파일 구조가 다르거나 예외 상황)
   echo "\n경고: 압축 해제는 완료되었으나 예상 경로($expected_flutter_path)를 찾을 수 없습니다." >&2
   echo "홈 디렉토리($extract_destination) 내용을 확인하세요." >&2
   # 이 경우에도 임시 파일은 삭제
fi

# 3. 임시 다운로드 파일 삭제
echo "임시 다운로드 파일 삭제 중... ($temp_download_path)"
rm -f "$temp_download_path"
if [[ $? -ne 0 ]]; then
    echo "\n경고: 임시 파일 '$temp_download_path' 삭제 중 오류 발생." >&2
else
    echo "임시 파일 삭제 완료."
fi


# 4. PATH 환경 변수 설정 확인 및 추가 (.zshrc)
flutter_bin_path="$expected_flutter_path/bin" # ~/flutter/bin
zsh_config_file="$HOME/.zshrc"
# .zshrc 파일에 추가될 실제 라인 (파일 내에서는 $HOME, $PATH가 해석되어야 함)
path_export_line="export PATH=\"\$HOME/flutter/bin:\$PATH\""

echo "\n환경 변수 PATH 설정을 확인합니다 ($zsh_config_file)..."

# .zshrc 파일이 존재하는지 확인, 없으면 생성
if [[ ! -f "$zsh_config_file" ]]; then
  echo "알림: '$zsh_config_file' 파일이 없어 새로 생성합니다."
  touch "$zsh_config_file"
fi

# .zshrc 파일 내에 Flutter 경로가 이미 설정되어 있는지 확인 (grep -q: 결과 출력 없이 종료 코드로만 확인, -F: 고정 문자열 검색)
if grep -qF "$flutter_bin_path" "$zsh_config_file"; then
  echo "'$flutter_bin_path' 경로는 이미 '$zsh_config_file'에 설정되어 있는 것 같습니다."
else
  echo "알림: '$zsh_config_file' 파일에 Flutter 경로를 추가합니다."
  # 파일 끝에 주석과 함께 export 라인 추가
  echo "\n# Flutter SDK PATH" >> "$zsh_config_file"
  echo "$path_export_line" >> "$zsh_config_file"
  echo "'$zsh_config_file' 파일 업데이트 완료."
  echo "\n\033[1;33m중요: 변경 사항을 적용하려면 터미널을 새로 시작하거나 다음 명령을 실행하세요:\033[0m" # 노란색 강조
  echo "source $zsh_config_file"
fi

# --- 완료 메시지 및 다음 단계 안내 ---
echo "\n--------------------------------------------------"
echo "\033[1;32mFlutter SDK v$flutter_version_input 설치 스크립트가 완료되었습니다.\033[0m" # 녹색 강조
echo "다음 단계를 진행하세요:"
echo "1. (필요시) 터미널을 새로 시작하거나 'source $zsh_config_file' 명령을 실행하여 PATH 설정을 적용하세요."
echo "2. 새 터미널에서 'flutter doctor' 명령어를 실행하여 설치 상태를 확인하세요."
echo "--------------------------------------------------"

exit 0
```

### Linux

우분투 개발자십니까? snap 쓰십시오.
