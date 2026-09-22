#!/bin/bash
set -e

SRC_LOGO="./src/assets/images/amar_somiti_logo_1790106703913.jpg"

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

echo "=== 3. Generating Pure Minimalist Android Splash Screens ==="
# Default drawable
mkdir -p android/app/src/main/res/drawable
convert -size 480x800 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 220x220 \) -gravity center -composite android/app/src/main/res/drawable/splash.png

# Portrait splash screens
mkdir -p android/app/src/main/res/drawable-port-mdpi
convert -size 320x480 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 150x150 \) -gravity center -composite android/app/src/main/res/drawable-port-mdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-hdpi
convert -size 480x800 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 220x220 \) -gravity center -composite android/app/src/main/res/drawable-port-hdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xhdpi
convert -size 720x1280 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 320x320 \) -gravity center -composite android/app/src/main/res/drawable-port-xhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xxhdpi
convert -size 960x1600 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 420x420 \) -gravity center -composite android/app/src/main/res/drawable-port-xxhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xxxhdpi
convert -size 1280x1920 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 520x520 \) -gravity center -composite android/app/src/main/res/drawable-port-xxxhdpi/splash.png

# Landscape splash screens
mkdir -p android/app/src/main/res/drawable-land-mdpi
convert -size 480x320 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 140x140 \) -gravity center -composite android/app/src/main/res/drawable-land-mdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-hdpi
convert -size 800x480 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 200x200 \) -gravity center -composite android/app/src/main/res/drawable-land-hdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xhdpi
convert -size 1280x720 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 280x280 \) -gravity center -composite android/app/src/main/res/drawable-land-xhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xxhdpi
convert -size 1600x960 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 360x360 \) -gravity center -composite android/app/src/main/res/drawable-land-xxhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xxxhdpi
convert -size 1920x1280 xc:"#FFFFFF" \( "$SRC_LOGO" -resize 440x440 \) -gravity center -composite android/app/src/main/res/drawable-land-xxxhdpi/splash.png

echo "=== Asset Generation Complete! ==="
