let theShader = undefined;
let shaderLoaded = false;
let next = undefined;
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
let titleText,
    trackText,
    volumeSlider,
    donateButton,
    muteButton,
    vizModeButton,
    bandcampLinkButton,
    sketchRunButton;
let titleFont, uiFont, radioData;
let timeRemaining = -1;
let lastRequest = 0;
// Image assets
let playImage, pauseImage, volumeImage, muteImage;
let TITLE_TEXT_SIZE, RADIO_TEXT_SIZE, UI_SIZE, fps;

let mode3D = true;
let viz = null;
let sketch_running = true;

const NOW_PLAYING_URL = "https://borschtrecords.ca/api/nowplaying";
const isMob = /Android|webOS|iPhone|iPad|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
);
// As of this writing, there appears to be a much-reported bug in Safari that prevents audio capture from a stream
// All calls succeed without error, yet the output of the analyzer is always zeroes (only in Safari)
// As a result, we'll include a special case for Safari to make the visualizer move based on a Perlin noise value while the stream is playing and unmuted
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function shaderSuccess() {
    //console.log("Shader loaded");
    shaderLoaded = true;
}

function shaderFailed(e) {
    console.log("Shader failed to load:");
    console.log(e.message);
    shaderLoaded = false;
}

// p5 source that runs in 3D mode
let p_3d = function (p) {
    p.preload = function () {
        if (isMob) {
            theShader = p.loadShader(
                "./src/shaders/blob/vert.glsl",
                "./src/shaders/blob/frag-mobile.glsl",
                shaderSuccess,
                shaderFailed,
            );
        } else {
            theShader = p.loadShader(
                "./src/shaders/blob/vert.glsl",
                "./src/shaders/blob/frag.glsl",
                shaderSuccess,
                shaderFailed,
            );
        }
    };

    p.setup = function () {
        // disables scaling for retina screens which can create inconsistent scaling between displays
        p.pixelDensity(1);
        cnv = p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
        p.imageMode(p.CENTER);
        p.frameRate(fps);
        next = p.createFramebuffer();
        fft = new p5.FFT(0.6, 32);
        p.background(0);
        p.colorMode(p.HSB);
        p.noStroke();
        p.textAlign(p.CENTER);
        LEVEL_GAIN = 0.1;
        Z_GAIN = 0.07;
        sketch_running = true;
        p.fill(0);
    };

    p.draw = function () {
        if (p.frameRate() != 0) {
            rate_mod = Math.min(60 / p.frameRate(), 2);
        }

        if (isSafari && !streamElement.paused && !stream.muted) {
            prelevel = 0.1 + 0.8 * p.noise(p.frameCount / 100);
        } else if (audio_started && fft) {
            fft.analyze();
            prelevel = GAIN * fft.getEnergy(32, 16384);
        } else {
            prelevel = 0;
        }
        z += rate_mod * Z_GAIN * prelevel;
        level += rate_mod * LEVEL_GAIN * (prelevel - level);
        // shader() sets the active shader with our shader
        next.begin();
        p.clear();
        // Ther
        if (shaderLoaded) {
            // setUniform() sends values to the shader
            theShader.setUniform("u_resolution", [p.width, p.height]);
            theShader.setUniform("u_time", p.millis() / 1000);
            theShader.setUniform("u_z", z);
            theShader.setUniform("u_level", 2 * level);
            p.shader(theShader);

            // rect gives us some geometry on the screen
            p.rect(0, 0, p.width, p.height);
        } else {
            console.log("Preload didn't preload!");
        }

        next.end();
        p.image(next, 0, 0);

        const title_size_mod = isMob ? 0 : 0.5 * TITLE_TEXT_SIZE * prelevel;
        if (title_size_mod != 0) {
            titleText.style.fontSize = TITLE_TEXT_SIZE + title_size_mod + "px";
        }
    };

    p.initAudio = function () {
        if (!audio_started) {
            p.userStartAudio();
            let context = p.getAudioContext();
            // wire all media elements up to the p5.sound AudioContext
            for (let elem of p.selectAll("audio")) {
                mediaSource = context.createMediaElementSource(elem.elt);
                mediaSource.connect(p.soundOut);
            }
            audio_started = true;
            streamElement.play();
            getNowPlaying();
        }
    };

    p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
    };

    p.toggleDrawLoop = function () {
        sketch_running = !sketch_running;
        if (sketch_running) {
            p.loop();
        } else {
            p.noLoop();
        }
    };
};

// p5 source that runs in 2D mode
let p_2d = function (p) {
    p.setup = function () {
        // disables scaling for retina screens which can create inconsistent scaling between displays
        p.pixelDensity(1);
        cnv = p.createCanvas(window.innerWidth, window.innerHeight);
        p.imageMode(p.CENTER);
        p.frameRate(fps);
        streamElement = document.getElementById("stream");
        // instantiate UI
        fft = new p5.FFT(0.6, 32);
        p.background(0);
        p.colorMode(p.HSB);
        p.noStroke();
        p.textAlign(p.CENTER);
        LEVEL_GAIN = 0.06;
        Z_GAIN = 0.05;
        short_side = Math.min(p.width, p.height);
        sketch_running = true;
    };

    p.draw = function () {
        p.background(0);
        if (p.frameRate() != 0) {
            rate_mod = Math.min(60 / p.frameRate(), 2);
        }

        if (isSafari && !streamElement.paused && !stream.muted) {
            prelevel = 0.1 + 0.8 * p.noise(p.frameCount / 100);
        } else if (audio_started && fft) {
            fft.analyze();
            prelevel = GAIN * fft.getEnergy(32, 16384);
        } else {
            prelevel = 0;
        }
        z += rate_mod * Z_GAIN * prelevel;
        level += rate_mod * LEVEL_GAIN * (prelevel - level);
        const NUM_CIRCLES = 8;
        for (let i = 0; i < NUM_CIRCLES; i++) {
            let pos = wobble(level, i, 0.88 * z);
            p.fill(0, 100, 70, pos.r);
            p.circle(
                short_side * level * pos.x + p.width / 2,
                short_side * level * pos.y + p.height / 2,
                pos.r * short_side * 0.5,
            );
        }

        const title_size_mod = isMob ? 0 : 0.5 * TITLE_TEXT_SIZE * prelevel;
        if (title_size_mod != 0) {
            titleText.style.fontSize = TITLE_TEXT_SIZE + title_size_mod + "px";
        }
    };

    p.initAudio = function () {
        if (!audio_started) {
            p.userStartAudio();
            let context = p.getAudioContext();
            // wire all media elements up to the p5.sound AudioContext
            for (let elem of p.selectAll("audio")) {
                mediaSource = context.createMediaElementSource(elem.elt);
                mediaSource.connect(p.soundOut);
            }
            audio_started = true;
            streamElement.play();
            getNowPlaying();
        }
    };

    p.windowResized = function () {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        short_side = Math.min(p.width, p.height);
    };

    p.toggleDrawLoop = function () {
        sketch_running = !sketch_running;
        if (sketch_running) {
            p.loop();
        } else {
            p.noLoop();
        }
    };
};

// Resizing things for mobile and initializing the p5 sketch
if (isMob) {
    UI_SIZE = 84;
    TITLE_TEXT_SIZE = 100;
    RADIO_TEXT_SIZE = 44;
    fps = 30;
    mode3D = false;
    viz = new p5(p_2d);
} else {
    UI_SIZE = 42;
    TITLE_TEXT_SIZE = 50;
    RADIO_TEXT_SIZE = 22;
    fps = 60;
    mode3D = true;
    viz = new p5(p_3d);
}

function initUI() {
    // Get references to all the elements we want to access
    titleText = document.getElementById("titleText");
    trackText = document.getElementById("trackText");
    muteButton = document.getElementById("muteButton");
    volumeSlider = document.getElementById("volumeSlider");
    donateButton = document.getElementById("donateButton");
    vizModeButton = document.getElementById("vizModeButton");
    bandcampLinkButton = document.getElementById("bandcampButton");
    sketchRunButton = document.getElementById("sketchRunButton");
    streamElement = document.getElementById("stream");
    // Add event listeners
    muteButton.addEventListener("mousedown", toggleMute);
    donateButton.addEventListener("mousedown", openDonateLink);
    vizModeButton.addEventListener("mousedown", toggleVizMode);
    bandcampLinkButton.addEventListener("mousedown", openBandcampLink);
    sketchRunButton.addEventListener("mousedown", toggleSketchRunning);
    // This sets custom behaviour for media keys to override defaults
    navigator.mediaSession.setActionHandler("play", function () {
        console.log("Received play media key");
    });
    navigator.mediaSession.setActionHandler("pause", function () {
        console.log("Received pause media key, toggling mute");
        toggleMute();
    });
    navigator.mediaSession.setActionHandler("stop", function () {
        console.log("Received stop media key");
    });

    vizModeButton.src = mode3D
        ? "./assets/viz3d-mode-button.svg"
        : "./assets/viz2d-mode-button.svg";
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
        vizModeButton.style.width = UI_SIZE + "px";
        vizModeButton.style.height = UI_SIZE + "px";
        bandcampLinkButton.style.width = UI_SIZE + "px";
        bandcampLinkButton.style.height = UI_SIZE + "px";
        sketchRunButton.style.width = UI_SIZE + "px";
        sketchRunButton.style.height = UI_SIZE + "px";
    } else {
        volumeSlider.addEventListener("input", setVolume);
        setVolume();
    }
}

document.addEventListener("DOMContentLoaded", function () {
    initUI();
});

function getNowPlaying() {
    const now = Date.now();
    if (audio_started && now - lastRequest > RATE_LIMIT) {
        lastRequest = now;
        fetch(NOW_PLAYING_URL)
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                radioData = data[0];
                console.log(radioData);
                if (radioData.live.is_live) {
                    timeRemaining = 30 * 1000;
                    trackText.innerText =
                        "> LIVE <" + "\n" + radioData.live.streamer_name;
                } else {
                    timeRemaining = 1000 * radioData.now_playing.remaining;
                    trackText.innerText =
                        radioData.now_playing.song.artist +
                        "\n" +
                        radioData.now_playing.song.title;
                }
                setTimeout(getNowPlaying, 1500 + timeRemaining);
            })
            .catch(function (err) {
                console.log("Fetch Error :-S", err);
                setTimeout(getNowPlaying, 30 * 1000);
            });
    }
}

function toggleMute() {
    viz.initAudio();
    if (streamElement.muted) {
        streamElement.muted = false;
        muteButton.src = "./assets/volume-button.svg";
    } else {
        streamElement.muted = true;
        muteButton.src = "./assets/mute-button.svg";
    }
}

function openBandcampLink() {
    window.open("https://borschtrecords.bandcamp.com/");
}

function openDonateLink() {
    window.open("https://www.paypal.com/paypalme/DMorgacheva");
}

function setVolume() {
    streamElement.volume = easeInSine(volumeSlider.value);
}

function toggleVizMode() {
    mode3D = !mode3D;
    viz.remove();
    if (mode3D) {
        shaderLoaded = false;
        viz = new p5(p_3d);
        vizModeButton.src = "./assets/viz3d-mode-button.svg";
    } else {
        viz = new p5(p_2d);
        vizModeButton.src = "./assets/viz2d-mode-button.svg";
    }
    sketchRunButton.src = "./assets/sketch-running-button.svg";
}

function toggleSketchRunning() {
    viz.toggleDrawLoop();
    if (sketch_running) {
        sketchRunButton.src = "./assets/sketch-running-button.svg";
    } else {
        sketchRunButton.src = "./assets/sketch-paused-button.svg";
    }
}
