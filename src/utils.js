function easeInSine(x) {
    return 1 - Math.cos((x * Math.PI) / 2);
}

function easeInCubic(x) {
    return x * x * x;
}