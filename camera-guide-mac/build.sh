#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
APP_NAME="CameraGuide15"
APP_BUNDLE="${DIR}/${APP_NAME}.app"

echo "==> Compilando ${APP_NAME} para macOS..."

# Cria estrutura de pastas do .app
rm -rf "${APP_BUNDLE}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

# Cria o Info.plist
cat << 'EOF' > "${APP_BUNDLE}/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>CameraGuide15</string>
    <key>CFBundleIdentifier</key>
    <string>com.antigravity.cameraguide15</string>
    <key>CFBundleName</key>
    <string>CameraGuide15</string>
    <key>CFBundleDisplayName</key>
    <string>CameraGuide 15%</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Compila o código Swift com otimização
swiftc -O \
    "${DIR}/CameraGuideApp.swift" \
    -o "${APP_BUNDLE}/Contents/MacOS/CameraGuide15"

# Assina localmente (ad-hoc) para execução sem avisos de segurança no Mac
if which codesign >/dev/null 2>&1; then
    codesign -s - --force "${APP_BUNDLE}" >/dev/null 2>&1 || true
fi

echo "==> Sucesso! Aplicativo gerado em: ${APP_BUNDLE}"
