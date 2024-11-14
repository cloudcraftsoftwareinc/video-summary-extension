#!/bin/bash
set -e

# Create directories
mkdir -p nodejs/bin

# Download ffmpeg static build
curl -O https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

# Extract the archive
tar xf ffmpeg-release-amd64-static.tar.xz

# Find the extracted directory
FFMPEG_DIR=$(find . -type d -name "ffmpeg-*-amd64-static" -print | head -n1)

# Copy ffmpeg binary to layer
cp "$FFMPEG_DIR/ffmpeg" nodejs/bin/

# Make it executable
chmod +x nodejs/bin/ffmpeg

# Clean up
rm ffmpeg-release-amd64-static.tar.xz
rm -rf "$FFMPEG_DIR"

# Create layer zip
zip -r ffmpeg-layer.zip nodejs/

# Clean up build directory but keep the zip
rm -rf nodejs/ 