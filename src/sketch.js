let theShader, prev, next;
let z = 0;
let level = 0;
let prelevel = 0;
const GAIN = 0.004;
const RATE_LIMIT = 10 * 1000;
let Z_GAIN = 0.07;
let LEVEL_GAIN = 0.1;
let rate_mod = 1;
let fft, mediaSource, audio_started;
// Non-UI elements
let streamElement;
// UI elements
let titleText, trackText, volumeSlider, donateButton, muteButton;
let titleFont, uiFont, radioData;
let timeRemaining = -1;
let lastRequest = 0;
// Image assets
let playImage, pauseImage, volumeImage, muteImage;
let TITLE_TEXT_SIZE, RADIO_TEXT_SIZE, UI_SIZE, fps;
const NOW_PLAYING_URL = "https://borschtrecords.ca/api/nowplaying"

const isMob = /Android|webOS|iPhone|iPad|IEMobile|Opera Mini/i.test(navigator.userAgent);
// As of this writing, there appears to be a much-reported bug in Safari that prevents audio capture from a stream
// All calls succeed without error, yet the output of the analyzer is always zeroes (only in Safari)
// As a result, we'll include a special case for Safari to make the visualizer move based on a Perlin noise value while the stream is playing and unmuted
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isMob) {
    UI_SIZE = 84;
    TITLE_TEXT_SIZE = 100;
    RADIO_TEXT_SIZE = 44;
    fps = 30;
} else {
    UI_SIZE = 42;
    TITLE_TEXT_SIZE = 50;
    RADIO_TEXT_SIZE = 22;
    fps = 60;
}

function preload() {
    if (isMob) {
        theShader = loadShader('./src/shaders/blob/vert.glsl', './src/shaders/blob/frag-mobile.glsl');
    } else {
        theShader = loadShader('./src/shaders/blob/vert.glsl', './src/shaders/blob/frag.glsl');
    }
}

function initUI() {
    titleText = document.getElementById("titleText");
    trackText = document.getElementById("trackText");
    muteButton = document.getElementById("muteButton");
    volumeSlider = document.getElementById("volumeSlider");
    donateButton = document.getElementById("donateButton");
    muteButton.addEventListener("mousedown", toggleMute);
    donateButton.addEventListener("mousedown", openDonateLink);
    if (isMob) {
        volumeSlider.remove();
        titleText.style.fontSize = TITLE_TEXT_SIZE + "px";
        trackText.style.fontSize = RADIO_TEXT_SIZE + "px";
        trackText.style.lineHeight = 1.2 * RADIO_TEXT_SIZE + "px";
        muteButton.style.width = UI_SIZE + "px";
        muteButton.style.height = UI_SIZE + "px";
        muteButton.style.bottom = UI_SIZE / 3 + "px";
        donateButton.style.width = UI_SIZE + "px";
        donateButton.style.height = UI_SIZE + "px";
    } else {
        volumeSlider.addEventListener("input", setVolume);
        setVolume();
    }
}

function setup() {
    // disables scaling for retina screens which can create inconsistent scaling between displays
    pixelDensity(1);
    createCanvas(windowWidth, windowHeight, WEBGL);
    imageMode(CENTER);
    frameRate(fps);
    streamElement = document.getElementById("stream");
    // instantiate UI
    initUI();
    //prev = createFramebuffer();
    next = createFramebuffer();
    fft = new p5.FFT(0.6, 32);
    audio_started = false;
    background(255);
    textAlign(CENTER);
}

function draw() {
    if (frameRate() != 0) {
        rate_mod = Math.min(60 / frameRate(), 2);
    }

    if (isSafari && !streamElement.paused && !stream.muted) {
        prelevel = 0.1 + 0.8 * noise(frameCount / 100);
    } else if (audio_started && fft) {
        fft.analyze();
        prelevel = GAIN * fft.getEnergy(16, 16384);
    } else {
        prelevel = 0;
    }
    z += rate_mod * Z_GAIN * prelevel
    level += rate_mod * LEVEL_GAIN * (prelevel - level);

    // shader() sets the active shader with our shader
    next.begin();
    clear();
    // setUniform() sends values to the shader
    theShader.setUniform("u_resolution", [width, height]);
    theShader.setUniform("u_time", millis() / 1000.0);
    theShader.setUniform("u_z", z);
    theShader.setUniform("u_level", 2 * level);
    shader(theShader);

    // rect gives us some geometry on the screen
    rect(0, 0, width, height);
    next.end();
    image(next, 0, 0);

    const title_size_mod = isMob ? 0 : 0.5 * TITLE_TEXT_SIZE * prelevel;
    if (title_size_mod != 0) {
        titleText.style.fontSize = str(TITLE_TEXT_SIZE + title_size_mod) + 'px';
    }
}

function getNowPlaying() {
    const now = Date.now();
    if (audio_started && (now - lastRequest) > RATE_LIMIT) {
        lastRequest = now;
        fetch(NOW_PLAYING_URL).then(function (response) {
            return response.json();
        }).then(function (data) {
            radioData = data[0];
            console.log(radioData);
            if (radioData.live.is_live) {
                timeRemaining = 30 * 1000;
                trackText.innerText = "> LIVE <" + "\n" + radioData.live.streamer_name;
            } else {
                timeRemaining = 1000 * radioData.now_playing.remaining;
                trackText.innerText = radioData.now_playing.song.artist + "\n" + radioData.now_playing.song.title;
            }
            setTimeout(getNowPlaying, 1000 + timeRemaining);
        }).catch(function (err) {
            console.log('Fetch Error :-S', err);
            setTimeout(getNowPlaying, 30 * 1000);
        });
    }
}

function initAudio() {
    if (!audio_started) {
        userStartAudio();
        let context = getAudioContext();
        // wire all media elements up to the p5.sound AudioContext
        for (let elem of selectAll('audio')) {
            mediaSource = context.createMediaElementSource(elem.elt);
            mediaSource.connect(p5.soundOut);
        }
        audio_started = true;
        streamElement.play();
        getNowPlaying();
    }
}

function toggleMute() {
    initAudio();
    if (streamElement.muted) {
        streamElement.muted = false;
        muteButton.src = './assets/volume-button.svg';
    } else {
        streamElement.muted = true;
        muteButton.src = './assets/mute-button.svg';
    }
}

function openLink() {
    window.open("https://borschtrecords.ca");
}

function openDonateLink() {
    window.open("https://www.paypal.com/paypalme/DMorgacheva");
}

function setVolume() {
    streamElement.volume = easeInSine(volumeSlider.value);
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}