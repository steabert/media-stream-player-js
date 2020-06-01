const {Server} = require('ws')
const fs = require('fs')
const {exec} = require('child_process')

const browserSDP = 'browserSDP.txt'

const wss = new Server({port: 8080})
wss.on('connection', socket => {
    socket.on('message', function(data) {
	    console.log(data.toString())
	    fs.writeFileSync(browserSDP, data)
	    const rtpToWebRTC = exec(`rtp-to-webrtc < ${browserSDP}`)
	    rtpToWebRTC.stdout.on('data', (data) => {
		    console.log(data.toString())
		    if (data.toString().startsWith('ey')) {
			    socket.send(data)
		    }
	    })
	    rtpToWebRTC.stderr.on('data', (data) => {
		    console.log(data.toString())
	    })
    })
})
