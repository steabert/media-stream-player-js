import React, { useState, useEffect, useRef } from 'react'
import styled from 'styled-components'
import debug from 'debug'

import useEventState from './hooks/useEventState'
import { VideoProperties } from './PlaybackArea'

const debugLog = debug('msp:webrtc-video')

const VideoNative = styled.video`
  max-height: 100%;
  object-fit: contain;
  width: 100%;
`

/**
 * WebSocket + RTSP playback component.
 */

interface WebRTCVideoProps {
  forwardedRef?: React.Ref<HTMLVideoElement>
  /**
   * The _intended_ playback state.
   */
  play?: boolean
  /**
   * The source URI for the WebRTC signaling server.
   */
  ws?: string
  /**
   * Activate automatic playback.
   */
  autoPlay?: boolean
  /**
   * Default mute state.
   */
  muted?: boolean
  /**
   * Callback to signal video is playing.
   */
  onPlaying: (videoProperties: VideoProperties) => void
}

export const WebRTCVideo: React.FC<WebRTCVideoProps> = ({
  forwardedRef,
  play,
  ws = 'ws://localhost:8080',
  autoPlay = true,
  muted = true,
  onPlaying,
}) => {
  let videoRef = useRef<HTMLVideoElement>(null)

  // Forwarded refs can either be a callback or the result of useRef
  if (typeof forwardedRef === 'function') {
    forwardedRef(videoRef.current)
  } else if (forwardedRef) {
    videoRef = forwardedRef
  }

  /**
   * Internal state:
   * -> canplay: there is enough data on the video element to play.
   * -> playing: the video element playback is progressing.
   */
  const [canplay, unsetCanplay] = useEventState(videoRef, 'canplay')
  const [playing, unsetPlaying] = useEventState(videoRef, 'playing')

  // State tied to resources
  const [pipeline, setPipeline] = useState<null | RTCPeerConnection>(null)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    const videoEl = videoRef.current

    if (videoEl === null) {
      return
    }

    if (play && canplay && !playing) {
      debugLog('play')
      videoEl.play().catch((err) => {
        console.error('VideoElement error: ', err.message)
      })
    } else if (!play && playing) {
      debugLog('pause')
      videoEl.pause()
      unsetPlaying()
    } else if (play && playing) {
      onPlaying({
        el: videoEl,
        width: videoEl.videoWidth,
        height: videoEl.videoHeight,
      })
    }
  }, [play, canplay, playing])

  useEffect(() => {
    const videoEl = videoRef.current

    if (videoEl) {
      debugLog('create pipeline', ws)
      const pipeline = new RTCPeerConnection({
        // iceServers: [
        //   {
        //     urls: 'stun:stun.l.google.com:19302',
        //   },
        // ],
      })
      pipeline.addTransceiver('audio', { direction: 'sendrecv' })
      pipeline.addTransceiver('video', { direction: 'sendrecv' })
      pipeline.ontrack = (e) => {
        videoEl.srcObject = e.streams[0]
      }
      setPipeline(pipeline)

      return () => {
        debugLog('close pipeline and clear video')
        pipeline.close()
        videoEl.srcObject = null
        setPipeline(null)
        setFetching(false)
        unsetCanplay()
        unsetPlaying()
      }
    }
  }, [])

  useEffect(() => {
    if (ws && play && pipeline && !fetching) {
      const socket = new WebSocket(ws)
      socket.onopen = () => {
        // When receiving SDP, set the remote description
        socket.onmessage = (msg) => {
          const answer = JSON.parse(atob(msg.data))
          debugLog('remote answer', answer.sdp.split('\r\n'))
          pipeline.setRemoteDescription(new RTCSessionDescription(answer))
        }
        // Create an offer and send it to the signaling server
        pipeline.createOffer().then((offer) => {
          debugLog('local offer', offer.sdp?.split('\r\n'))
          pipeline.setLocalDescription(offer)
          const msg = btoa(JSON.stringify(offer))
          socket.send(msg)
        })
      }
      debugLog('initiated data fetching')
      setFetching(true)
    }
  }, [ws && play, pipeline, fetching])

  return <VideoNative autoPlay={autoPlay} muted={muted} ref={videoRef} />
}
