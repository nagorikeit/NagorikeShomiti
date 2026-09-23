#!/bin/bash
set -e

SRC_LOGO="./src/assets/images/amar_somiti_logo_1790106703913.jpg"

echo "=== 1. Tightly Cropping Logo Emblem (Eliminating Excess White Margins) ==="
# The original 1024x1024 image had huge white padding.
# Crop tightly around the 3D circular medal (810x810 at offset +120+135)
convert "$SRC_LOGO" -crop 810x810+120+135 +repage /tmp/logo_tight.png

echo "=== 2. Generating Public PWA and Web Icons (Full-Bleed Emblem) ==="
mkdir -p public
convert /tmp/logo_tight.png -resize 512x512 public/app_icon.png
convert /tmp/logo_tight.png -resize 512x512 public/app_icon-512.png
convert /tmp/logo_tight.png -resize 384x384 public/app_icon-384.png
convert /tmp/logo_tight.png -resize 256x256 public/app_icon-256.png
convert /tmp/logo_tight.png -resize 192x192 public/app_icon-192.png
convert /tmp/logo_tight.png -resize 128x128 public/app_icon-128.png
convert /tmp/logo_tight.png -resize 96x96 public/app_icon-96.png
convert /tmp/logo_tight.png -resize 192x192 public/apple-touch-icon.png

echo "=== 3. Generating Android Launcher Icons (Large, Clear, Prominent) ==="
# mdpi (48x48, foreground 108x108)
mkdir -p android/app/src/main/res/mipmap-mdpi
convert /tmp/logo_tight.png -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png
convert /tmp/logo_tight.png -resize 48x48 \( -size 48x48 xc:none -fill white -draw "circle 24,24 24,1" \) -compose DstIn -composite android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
convert -size 108x108 xc:none \( /tmp/logo_tight.png -resize 76x76 \) -gravity center -composite android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png

# hdpi (72x72, foreground 162x162)
mkdir -p android/app/src/main/res/mipmap-hdpi
convert /tmp/logo_tight.png -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png
convert /tmp/logo_tight.png -resize 72x72 \( -size 72x72 xc:none -fill white -draw "circle 36,36 36,1" \) -compose DstIn -composite android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
convert -size 162x162 xc:none \( /tmp/logo_tight.png -resize 114x114 \) -gravity center -composite android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png

# xhdpi (96x96, foreground 216x216)
mkdir -p android/app/src/main/res/mipmap-xhdpi
convert /tmp/logo_tight.png -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
convert /tmp/logo_tight.png -resize 96x96 \( -size 96x96 xc:none -fill white -draw "circle 48,48 48,1" \) -compose DstIn -composite android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
convert -size 216x216 xc:none \( /tmp/logo_tight.png -resize 152x152 \) -gravity center -composite android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png

# xxhdpi (144x144, foreground 324x324)
mkdir -p android/app/src/main/res/mipmap-xxhdpi
convert /tmp/logo_tight.png -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
convert /tmp/logo_tight.png -resize 144x144 \( -size 144x144 xc:none -fill white -draw "circle 72,72 72,1" \) -compose DstIn -composite android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
convert -size 324x324 xc:none \( /tmp/logo_tight.png -resize 228x228 \) -gravity center -composite android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png

# xxxhdpi (192x192, foreground 432x432)
mkdir -p android/app/src/main/res/mipmap-xxxhdpi
convert /tmp/logo_tight.png -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
convert /tmp/logo_tight.png -resize 192x192 \( -size 192x192 xc:none -fill white -draw "circle 96,96 96,1" \) -compose DstIn -composite android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
convert -size 432x432 xc:none \( /tmp/logo_tight.png -resize 304x304 \) -gravity center -composite android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png

echo "=== 4. Pure Clean Native Splash (Seamless Hand-off to Web Splash) ==="
# Pure white splash ensures no raw/broken static image is shown on launch.
# The user sees clean white and immediately the crisp vector React splash (Logo + Text).
mkdir -p android/app/src/main/res/drawable
convert -size 480x800 xc:"#FFFFFF" android/app/src/main/res/drawable/splash.png

mkdir -p android/app/src/main/res/drawable-port-mdpi
convert -size 320x480 xc:"#FFFFFF" android/app/src/main/res/drawable-port-mdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-hdpi
convert -size 480x800 xc:"#FFFFFF" android/app/src/main/res/drawable-port-hdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xhdpi
convert -size 720x1280 xc:"#FFFFFF" android/app/src/main/res/drawable-port-xhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xxhdpi
convert -size 960x1600 xc:"#FFFFFF" android/app/src/main/res/drawable-port-xxhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-port-xxxhdpi
convert -size 1280x1920 xc:"#FFFFFF" android/app/src/main/res/drawable-port-xxxhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-mdpi
convert -size 480x320 xc:"#FFFFFF" android/app/src/main/res/drawable-land-mdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-hdpi
convert -size 800x480 xc:"#FFFFFF" android/app/src/main/res/drawable-land-hdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xhdpi
convert -size 1280x720 xc:"#FFFFFF" android/app/src/main/res/drawable-land-xhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xxhdpi
convert -size 1600x960 xc:"#FFFFFF" android/app/src/main/res/drawable-land-xxhdpi/splash.png

mkdir -p android/app/src/main/res/drawable-land-xxxhdpi
convert -size 1920x1280 xc:"#FFFFFF" android/app/src/main/res/drawable-land-xxxhdpi/splash.png

echo "=== All Launcher Icons & Splash Screens Successfully Regenerated! ==="
