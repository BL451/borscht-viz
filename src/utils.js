function easeInSine(x) {
    return 1 - Math.cos((x * Math.PI) / 2);
}

function easeInCubic(x) {
    return x * x * x;
}

function wobble(u_l, i, u_z) {
    const x = u_l * Math.sin(0.2 * i + u_z) * Math.cos(i + 0.5 * u_z);
    const y = u_l * Math.cos(i * 0.1 + u_z) * Math.sin(i + 0.8 * u_z);
    const z = 5 + u_l * Math.cos(i * 0.6) * Math.sin(i + 0.55 * u_z);
    const r = 0.1 + 0.3 * Math.abs(Math.sin(u_z + i));
    return { x: x, y: y, z: z, r: r };
  }