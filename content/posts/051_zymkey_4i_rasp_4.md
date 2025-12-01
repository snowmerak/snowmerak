---
title: "라즈베리파이 + 데비안13+에서 zymkey 설치하기"
date: 2025-12-02T01:03:39+09:00
author: snowmerak
tags: ["zymkey", "debian", "raspberry_pi"]
categories: ["Information"]
draft: false
---

## 뭐냐면

별 건 아니고, zymkey 4i 드라이버 설치 스크립트가 debian 13에 적용이 안되어 있어서 제가 써먹으려고 멋대로 수정한 스크립트 입니다. `install_zk_sw.sh`로 저장해서 실행하세요.

## 스크립트

```sh
#!/bin/bash

#---------------------------------------------------------------------------------------------------------------------------------------------------------------
# Copyright (C) 2021-2022 by copyright Zymbit
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
# to deal in the Software without restriction, including without l> imitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
# WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#---------------------------------------------------------------------------------------------------------------------------------------------------------------

mod=""

# ensure running as root or exit
if [ "$(id -u)" != "0" ]; then
  echo "run this as root or use sudo" 2>&1 && exit 1;
fi;

function pip()
{
   python -m pip $@
}

function pip3()
{
   if [ "${distro}" != "bookworm" ] && [ "${distro}" != "noble" ]
   then
      python3 -m pip $@
   else
      python3 -m pip $@ --break-system-packages
   fi
}

function apt()
{
   NEEDRESTART_MODE=a DEBIAN_FRONTEND=noninteractive DEBIAN_PRIORITY=critical \
      /usr/bin/apt --yes --quiet \
         --option Dpkg::Options::=--force-confold \
         --option Dpkg::Options::=--force-confdef \
         "$@" # &>/dev/null
}

# for older versions of Raspbian, insure that apt-transport-https is installed first
echo -n "Installing prerequisites (this might take a few minutes)..."
apt update --allow-releaseinfo-change
apt install libboost-thread-dev lsb-release

distro="bookworm"
if { uname -m | grep -q "arm"; }
then
   arch=""
else
   arch="-"`uname -m`
fi

if [[ "$distro" = "noble" ]]; then
   USE_SYSFS_GPIO=false
else 
   USE_SYSFS_GPIO=true
fi

if $USE_SYSFS_GPIO; then
   # ensure that the group 'gpio' exists
   if ! grep "^gpio" /etc/group; then
      if [ "$1" == "-y" ]
      then
         answer="YES"
      else
         echo "Group 'gpio' does not exist. This group is necessary for zymbit software to operate normally."
         read -p 'Type yes in all capital letters (YES) to create this group: ' answer <&1
      fi
      if [ "${answer}" == "YES" ]
      then
         # Add group 'gpio'
         groupadd -r gpio
      else
         echo "Quitting..."
         exit -1
      fi
      # Modify /etc/rc.local to change the group of /etc/sys/class/gpio
      if ! grep -q "chown -R root:gpio" /etc/rc.local; then
         [[ -f /etc/rc.local ]] || echo '#!/bin/sh' > /etc/rc.local
         echo "chown -R root:gpio /sys/class/gpio" >> /etc/rc.local
         echo "chmod -R ug+rw /sys/class/gpio" >> /etc/rc.local
      fi
   fi
fi

# Check for existence of udev rule
if [[ ! -f "/etc/udev/rules.d/80-gpio-noroot.rules" ]]; then
   echo "ACTION==\"add\", SUBSYSTEM==\"gpio\", PROGRAM=\"/bin/sh -c 'chown -R root:gpio /sys/\$devpath; chmod -R g+w /sys/\$devpath'\"" >> /etc/udev/rules.d/80-gpio-noroot.rules
fi

# jammy uses python3-dev; no longer supports python3-dev
if [ "${distro}" != "jammy" ] && [ "${distro}" != "bookworm" ]  && [ "${distro}" != "noble" ]
then
   apt install apt-transport-https curl libyaml-dev libssl-dev libcurl4-openssl-dev python3-pip python3-setuptools i2c-tools
else
   apt install apt-transport-https curl libyaml-dev libssl-dev libcurl4-openssl-dev python3-pip python3-setuptools python3-pycurl i2c-tools
fi
if [ "${distro}" != "focal" ] && [ "${distro}" != "bookworm" ] && [ "${distro}" != "bullseye" ] && [ "${distro}" != "jammy" ] && [ "${distro}" != "noble" ]
then
   apt install -y python3-pip
   pip install inotify || exit
   pip install pycurl progress python3-gnupg
fi
pip3 install inotify progress python3-gnupg
pip3 install pycurl &>/dev/null || exit  # Will error for bookworm; installed via apt install above
echo "done."

baseurl="https://zk-sw-repo${mod}.s3.amazonaws.com"
# import zymbit gpg key
gpg_key_url="$baseurl/apt-zymkey-pubkey.gpg"
echo -n "Importing Zymbit Packages gpg key... "
# import the gpg key
curl -L "${gpg_key_url}" 2>/dev/null | sudo gpg --dearmor --yes -o /usr/share/keyrings/zymbit.gpg
echo "done."

# add zymbit apt repo to sources list
apt_source_path="/etc/apt/sources.list.d/zymbit.list"
echo -n "Installing $apt_source_path..."
repodist="$distro"
#if [[ "$distro" == noble ]]; then
#   repodist="jammy"
#fi
echo "deb [signed-by=/usr/share/keyrings/zymbit.gpg] $baseurl/apt-repo-${repodist}${arch}/ ${repodist} main" > $apt_source_path
echo "done...Updating now."
apt update

# install our packages
echo -n "Installing Zymkey Packages..."
apt install libzymkeyssl zkbootrtc zkifc zkapputilslib zksaapps zkpkcs11 cryptsetup || exit
if [ "${distro}" != "focal" ] && [ "${distro}" != "bookworm" ] && [ "${distro}" != "bullseye" ] && [ "${distro}" != "jammy" ] && [ "${distro}" != "noble" ]
then
   pip install -U zku zk_luks &>/dev/null
fi
pip3 install -U zku zk_luks &>/dev/null
if [ "${distro}" != "focal" ] && [ "${distro}" != "bookworm" ] && [ "${distro}" != "bullseye" ] && [ "${distro}" != "jammy" ] && [ "${distro}" != "noble" ]
then
   ln -s /usr/local/lib/python2.7/dist-packages/zk_luks/__init__.py /usr/local/bin/create_zk_crypt_vol
fi

# Install example scripts
echo; echo "Installing example scripts..."
mkdir -p /usr/local/share/zymkey/examples
curl -G https://s3.amazonaws.com/zk-sw-repo/zk_app_utils_test.py > /usr/local/share/zymkey/examples/zk_app_utils_test.py
curl -G https://s3.amazonaws.com/zk-sw-repo/zk_crypto_test.py > /usr/local/share/zymkey/examples/zk_crypto_test.py

curl -G https://s3.amazonaws.com/zk-sw-repo/zk_prep_encr > /usr/local/bin/zk_prep_encr
chmod +x /usr/local/bin/zk_prep_encr

# Make sure necessary crypt packages are included
apt install cryptsetup-initramfs cryptsetup-run 

# Check for NVIDIA Xavier platform
nv_model_fn="/proc/device-tree/model"
if [ -e  ${nv_model_fn} ]
then
   if grep -q -i "Xavier" ${nv_model_fn}
   then
      # Configure the zymkey environment variables for the xavier
      echo "Configuring zymkey environment for Xavier..."
      sed -i "s/216/436/" /var/lib/zymbit/zkenv.conf
      sed -i "s/=1/=8/" /var/lib/zymbit/zkenv.conf
   fi
fi

# Debian 6.6 and later use different GPIO numbering, no long forces the base number of the main GPIO controller to be global GPIO 0.
# Need to determine correct wake pin number
function version_gt() { test "$(printf '%s\n' "$@" | sort -V | head -n 1)" = "$1"; }
version_to_check="6.6"
current_version=`uname -r`
if version_gt $version_to_check $current_version
then
   wake_pin=`grep GPIO4 /sys/kernel/debug/gpio | sed -r 's/[^0-9]*([0-9]*).*/\1/'`
   echo "ZK_GPIO_WAKE_PIN=$wake_pin" > /var/lib/zymbit/zkenv.conf
fi

# temp workaround to set for noble for standalone apps
if [[ "$distro" == noble ]] && [[ -z "$wake_pin" ]]
then
   if grep -q "Pi 5 Model B Rev 1.0" /sys/firmware/devicetree/base/model; then
      wake_pin=575
   elif grep -q "Pi 5 Model B Rev 1.1" /sys/firmware/devicetree/base/model; then
      wake_pin=573
   elif grep -q "Compute Module 5" /sys/firmware/devicetree/base/model; then
      wake_pin=573
   elif grep -q "Pi 4" /sys/firmware/devicetree/base/model; then
      wake_pin=516
   elif grep -q "Compute Module 4" /sys/firmware/devicetree/base/model; then
      wake_pin=516
   else
      :
   fi
   if [ -n "$wake_pin" ]; then
      echo "ZK_GPIO_WAKE_PIN=$wake_pin" > /var/lib/zymbit/zkenv.conf
   fi
fi

#jammy uses dialout group for i2c. Add zymbit to dialout group
if [[ "${distro}" == jammy ]] || [[ "$distro" == noble ]]
then
   adduser zymbit dialout
fi

systemctl restart zkifc
sync
sleep 10

# reboot
echo "Rebooting now..."
reboot
```