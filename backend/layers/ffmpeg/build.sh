#!/bin/bash

# Create directories
mkdir -p ffmpeg-layer/bin

# Download ffmpeg binary for Lambda
curl -O https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz

# Extract the archive
tar xf ffmpeg-git-amd64-static.tar.xz

# Find the extracted directory (it changes based on version)
FFMPEG_DIR=$(find . -type d -name "ffmpeg-git-*" -print | head -n1)

# Copy ffmpeg binary to layer
cp "$FFMPEG_DIR/ffmpeg" ffmpeg-layer/bin/

# Clean up
rm ffmpeg-git-amd64-static.tar.xz
rm -rf "$FFMPEG_DIR"

# Create layer zip
cd ffmpeg-layer
zip -r ../ffmpeg-layer.zip .
cd ..

# Clean up build directory
rm -rf ffmpeg-layer 