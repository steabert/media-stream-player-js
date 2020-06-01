#!/usr/bin/env bash

# Install `rtp-to-webrtc`, make sure go bin directory is in your PATH
GO111MODULE=on go get github.com/pion/webrtc/v2/examples/rtp-to-webrtc

# Start example RTP server with test video
gst-launch-1.0 videotestsrc ! 'video/x-raw, width=640, height=480' ! videoconvert ! video/x-raw,format=I420 ! vp8enc error-resilient=partitions keyframe-max-dist=10 auto-alt-ref=true cpu-used=5 deadline=1 ! rtpvp8pay ! udpsink host=127.0.0.1 port=5004 >& gst.log &

# Start WebSocket signaling server on ws://localhost:8080
# which will in turn initiate the rtp-to-webrtc server
node webrtc.js
