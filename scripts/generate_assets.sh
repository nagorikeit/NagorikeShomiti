#!/bin/bash
set -e

SRC_LOGO="./src/assets/images/amar_somiti_logo_1790106703913.jpg"
FONT_PATH="./src/assets/fonts/NotoSansBengali.ttf"

echo "=== 1. Generating Public PWA and Web Icons ==="
mkdir -p public
convert "$SRC_LOGO" -resize 512x512 public/app_icon.png
convert "$SRC_LOGO" -resize 512x512 public/app_icon-512.png
convert "$SRC_LOGO" -resize 384x384 public/app_icon-384.png
convert "$SRC_LOGO" -resize 256x256 public/app_icon-256.png
convert "$SRC_LOGO" -resize 192x192 public/app_icon-192.png
convert "$SRC_LOGO" -resize 128x128 public/app_icon-128.png
convert "$SRC_LOGO" -resize 96x96 public/app_icon-96.png
convert "$SRC_LOGO" -resize 192x192 public/apple-touch-icon.png

echo "=== 2. Generating Android Launcher Icons (Mipmap) ==="
# mdpi (48x48, foreground 108x108)
mkdir -p android/app/src/main/res/mipmap-mdpi
convert "$SRC_LOGO" -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert "$SRC_LOGO" -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
convert -size 108x108 xc:none \( "$SRC_LOGO" -resize 70x70 \) -gravity center -composite android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png

# hdpi (72x72, foreground 162x162)
mkdir -p android/app/src/main/res/mipmap-hdpi
convert "$SRC_LOGO" -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert "$SRC_LOGO" -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
convert -size 162x162 xc:none \( "$SRC_LOGO" -resize 106x106 \) -gravity center -composite android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png

# xhdpi (96x96, foreground 216x216)
mkdir -p android/app/src/main/res/mipmap-xhdpi
convert "$SRC_LOGO" -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert "$SRC_LOGO" -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
convert -size 216x216 xc:none \( "$SRC_LOGO" -resize 140x140 \) -gravity center -composite android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png

# xxhdpi (144x144, foreground 324x324)
mkdir -p android/app/src/main/res/mipmap-xxhdpi
convert "$SRC_LOGO" -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert "$SRC_LOGO" -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
convert -size 324x324 xc:none \( "$SRC_LOGO" -resize 210x210 \) -gravity center -composite android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png

# xxxhdpi (192x192, foreground 432x432)
mkdir -p android/app/src/main/res/mipmap-xxxhdpi
convert "$SRC_LOGO" -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
convert "$SRC_LOGO" -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
convert -size 432x432 xc:none \( "$SRC_LOGO" -resize 280x280 \) -gravity center -composite android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png

echo "=== 3. Creating Master Splash Emblem (Pure White, No Black Artifacts) ==="
# 1. Clean feathered circular blend on pure white canvas to prevent any corner clipping
convert -size 340x340 xc:black -fill white -draw "circle 170,170 170,18" -blur 0x2 /tmp/circle_mask.png
convert -size 340x340 xc:white \
  \( "$SRC_LOGO" -resize 340x340 \) \
  /tmp/circle_mask.png \
  -composite /tmp/logo_silky_white.png

# 2. Render master splash badge with pure white background and crisp typography
ffmpeg -y \
  -f lavfi -i "color=c=white:s=800x800:d=1" \
  -i /tmp/logo_silky_white.png \
  -filter_complex "[1:v]scale=340:340[logo];[0:v][logo]overlay=(W-w)/2:120[bg];[bg]drawtext=fontfile=${FONT_PATH}:text='আমার সমিতি':fontcolor=#1e293b:fontsize=56:x=(w-text_w)/2:y=490,drawtext=fontfile=${FONT_PATH}:text='সমিতির সব হিসাব, এক জায়গায়':fontcolor=#059669:fontsize=26:x=(w-text_w)/2:y=565" \
  -frames:v 1 /tmp/splash_master_badge.png

echo "=== 4. Generating All Android Splash Screens (100% Pure White Background) ==="
# Default drawable (480x800)
mkdir -p android/app/src/main/res/drawable
convert -size 480x800 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 440x440 \) -gravity center -composite android/app/src/main/res/drawable/splash.png

# Portrait splash screens
mkdir -p android/app/src/main/res/drawable-port-mdpi
convert -size 320x480 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 300x300 \) -gravity center -composite android/app/src/main/res/drawable-port-mdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-hdpi
convert -size 480x800 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 440x440 \) -gravity center -composite android/app/src/main/res/drawable-port-hdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xhdpi
convert -size 720x1280 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 640x640 \) -gravity center -composite android/app/src/main/res/drawable-port-xhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xxhdpi
convert -size 960x1600 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 800x800 \) -gravity center -composite android/app/src/main/res/drawable-port-xxhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xxxhdpi
convert -size 1280x1920 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 960x960 \) -gravity center -composite android/app/src/main/res/drawable-port-xxxhdpi/splash.png

# Landscape splash screens
mkdir -p android/app/src/main/res/drawable-land-mdpi
convert -size 480x320 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 300x300 \) -gravity center -composite android/app/src/main/res/drawable-land-mdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-hdpi
convert -size 800x480 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 440x440 \) -gravity center -composite android/app/src/main/res/drawable-land-hdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xhdpi
convert -size 1280x720 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 620x620 \) -gravity center -composite android/app/src/main/res/drawable-land-xhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xxhdpi
convert -size 1600x960 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 800x800 \) -gravity center -composite android/app/src/main/res/drawable-land-xxhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xxxhdpi
convert -size 1920x1280 xc:"#FFFFFF" \( /tmp/splash_master_badge.png -resize 960x960 \) -gravity center -composite android/app/src/main/res/drawable-land-xxxhdpi/splash.png

echo "=== Asset Generation Complete! All Splash Screens Flawless. ==="
