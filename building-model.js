// Wohnkomplex — a large multi-party building the camera can fly through.
// buildComplex(THREE) → { group, wire, materials, floorY }
// Meters, y-up, ground at y = 0. Two wings along x joined by an atrium.

export const FL = 3.35;      // floor height
export const FLOORS = 6;     // storeys
export const DEPTH = 15;     // wing depth (z)

export function buildComplex(THREE) {
  const group = new THREE.Group();
  group.name = 'wohnkomplex';
  const wireGeos = [];

  const mat = (name, color, o = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ name, color, roughness: 0.85, transparent: true, opacity: 1 }, o));

  const M = {
    beton: mat('beton', 0xb9b3a7, { roughness: 0.9, side: THREE.DoubleSide }),
    beton_dunkel: mat('beton_dunkel', 0x6e737b, { roughness: 0.88, side: THREE.DoubleSide }),
    putz: mat('putz', 0xd9d3c7, { roughness: 0.86, side: THREE.DoubleSide }),
    stahl: mat('stahl', 0x3a4049, { roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }),
    glas: mat('glas', 0x2b3a52, { roughness: 0.18, metalness: 0.2, opacity: 0.32, side: THREE.DoubleSide }),
    messing: mat('messing', 0xc79a52, { roughness: 0.34, metalness: 0.35 }),
    holz: mat('holz', 0x8a6a45, { roughness: 0.7 }),
    gruen: mat('gruen', 0x56684a, { roughness: 0.9 }),
  };

  const geoCache = new Map();
  const box = (w, h, d) => {
    const k = w.toFixed(3) + ':' + h.toFixed(3) + ':' + d.toFixed(3);
    if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(k);
  };

  const add = (geo, material, name, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = opts.shadow !== false;
    m.receiveShadow = opts.shadow !== false;
    group.add(m);
    if (opts.wire !== false) wireGeos.push({ geo, m });
    return m;
  };

  // ---------- ground / site ----------
  add(box(120, 0.4, 90), M.beton_dunkel, 'gelaende', 0, -0.2, 0, { wire: false });

  // ---------- a wing ----------
  function wing(tag, x0, x1, sign) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const z0 = -DEPTH / 2, z1 = DEPTH / 2;

    for (let f = 0; f < FLOORS; f++) {
      const y = f * FL;
      const p = tag + '_e' + f;
      // floor slab
      add(box(w, 0.3, DEPTH), M.beton, p + '_decke', cx, y + 0.15, 0, { shadow: f === 0 });
      // columns: two rows
      const cols = Math.max(3, Math.round(w / 4.4));
      for (let i = 0; i <= cols; i++) {
        const x = x0 + (w * i) / cols;
        [-DEPTH / 2 + 1.1, DEPTH / 2 - 1.1].forEach((z, j) => {
          add(box(0.42, FL - 0.3, 0.42), M.beton, p + '_stuetze_' + i + '_' + j, x, y + 0.3 + (FL - 0.3) / 2, z, { shadow: false });
        });
      }
      // corridor walls (leaving a 2.6 m corridor at z = 0)
      add(box(w, FL - 0.3, 0.18), M.putz, p + '_flurwand_a', cx, y + 0.3 + (FL - 0.3) / 2, -1.3, { shadow: false });
      add(box(w, FL - 0.3, 0.18), M.putz, p + '_flurwand_b', cx, y + 0.3 + (FL - 0.3) / 2, 1.3, { shadow: false });
      // apartment partitions
      const units = Math.max(2, Math.round(w / 6));
      for (let u = 1; u < units; u++) {
        const x = x0 + (w * u) / units;
        add(box(0.16, FL - 0.3, DEPTH / 2 - 1.5), M.putz, p + '_trennwand_' + u + '_a', x, y + 0.3 + (FL - 0.3) / 2, -(DEPTH / 4 + 0.75), { shadow: false });
        add(box(0.16, FL - 0.3, DEPTH / 2 - 1.5), M.putz, p + '_trennwand_' + u + '_b', x, y + 0.3 + (FL - 0.3) / 2, (DEPTH / 4 + 0.75), { shadow: false });
      }
      // facade: band + mullions + glass, both long sides
      [z0, z1].forEach((z, s) => {
        const zz = z + (s === 0 ? -0.12 : 0.12);
        add(box(w + 0.3, 0.5, 0.26), M.stahl, p + '_bruestung_' + s, cx, y + 0.32, zz, { shadow: false });
        add(box(w + 0.3, 0.34, 0.26), M.stahl, p + '_sturz_' + s, cx, y + FL - 0.18, zz, { shadow: false });
        const mull = Math.round(w / 3.1);
        for (let i = 0; i <= mull; i++) {
          add(box(0.14, FL - 0.9, 0.2), M.stahl, p + '_pfosten_' + s + '_' + i, x0 + (w * i) / mull, y + 0.57 + (FL - 0.9) / 2, zz, { shadow: false, wire: false });
        }
        add(box(w, FL - 0.9, 0.06), M.glas, p + '_glas_' + s, cx, y + 0.57 + (FL - 0.9) / 2, zz, { shadow: false, wire: false });
      });
      // balconies on the sunny side
      if (f > 0) {
        const bal = Math.max(2, Math.round(w / 7));
        for (let i = 0; i < bal; i++) {
          const x = x0 + (w * (i + 0.5)) / bal;
          const bz = sign * (DEPTH / 2 + 0.95);
          add(box(3.4, 0.2, 1.9), M.beton, p + '_balkon_' + i, x, y + 0.3, bz, { shadow: f % 2 === 0 });
          add(box(3.4, 0.06, 0.06), M.messing, p + '_balkon_handlauf_' + i, x, y + 1.4, bz + sign * 0.92, { shadow: false, wire: false });
          add(box(3.4, 1.05, 0.04), M.glas, p + '_balkon_glas_' + i, x, y + 0.9, bz + sign * 0.92, { shadow: false, wire: false });
        }
      }
      // a little interior furniture so the flight has something to read
      if (f > 0) {
        add(box(2.1, 0.42, 0.9), M.holz, p + '_moebel_a', x0 + w * 0.28, y + 0.51, -DEPTH / 4 - 1.2, { shadow: false, wire: false });
        add(box(0.9, 0.75, 1.8), M.holz, p + '_moebel_b', x0 + w * 0.72, y + 0.68, DEPTH / 4 + 1.0, { shadow: false, wire: false });
      }
    }

    // roof: parapet + technique
    const ry = FLOORS * FL;
    add(box(w, 0.3, DEPTH), M.beton, tag + '_dach', cx, ry + 0.15, 0, { shadow: true });
    [[-DEPTH / 2 + 0.2, 0], [DEPTH / 2 - 0.2, 1]].forEach(([z, i]) =>
      add(box(w + 0.3, 0.85, 0.24), M.beton, tag + '_attika_' + i, cx, ry + 0.72, z, { shadow: false }));
    add(box(0.24, 0.85, DEPTH), M.beton, tag + '_attika_x0', x0 + 0.1, ry + 0.72, 0, { shadow: false });
    add(box(0.24, 0.85, DEPTH), M.beton, tag + '_attika_x1', x1 - 0.1, ry + 0.72, 0, { shadow: false });
    add(box(3.6, 1.3, 2.6), M.stahl, tag + '_technik', cx + w * 0.22, ry + 0.95, -2.4, { shadow: true });
    add(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 20), M.stahl, tag + '_lueftung', cx - w * 0.28, ry + 1.05, 2.2, { shadow: false });
  }

  wing('west', -26, -6, 1);
  wing('ost', 6, 26, 1);

  // ---------- atrium / stair core between the wings ----------
  const AX = 12, AZ = 9;
  for (let f = 0; f <= FLOORS; f++) {
    const y = f * FL;
    // ring slab, open in the middle
    add(box(AX, 0.28, 2.4), M.beton, 'atrium_galerie_a_e' + f, 0, y + 0.14, -(AZ / 2 - 1.2));
    add(box(AX, 0.28, 2.4), M.beton, 'atrium_galerie_b_e' + f, 0, y + 0.14, AZ / 2 - 1.2);
    add(box(2.2, 0.28, AZ - 4.8), M.beton, 'atrium_galerie_c_e' + f, -(AX / 2 - 1.1), y + 0.14, 0);
    add(box(2.2, 0.28, AZ - 4.8), M.beton, 'atrium_galerie_d_e' + f, AX / 2 - 1.1, y + 0.14, 0);
    if (f < FLOORS) {
      // stair run, alternating direction
      const dir = f % 2 === 0 ? 1 : -1;
      for (let s = 0; s < 9; s++) {
        add(box(1.5, 0.16, 0.34), M.beton_dunkel, 'treppe_e' + f + '_' + s, dir * 2.6, y + 0.28 + (FL / 9) * (s + 0.5), dir * (-1.9 + s * 0.42), { shadow: false, wire: false });
      }
      add(box(0.08, 1.0, 4.2), M.messing, 'treppe_handlauf_e' + f, dir * 1.78, y + 1.3, 0, { shadow: false, wire: false });
    }
    // gallery railings
    add(box(AX, 0.05, 0.05), M.messing, 'atrium_handlauf_a_e' + f, 0, y + 1.1, -(AZ / 2 - 2.4), { shadow: false, wire: false });
    add(box(AX, 0.05, 0.05), M.messing, 'atrium_handlauf_b_e' + f, 0, y + 1.1, AZ / 2 - 2.4, { shadow: false, wire: false });
  }
  // atrium glazing (north/south) + glass roof
  add(box(AX, FLOORS * FL, 0.08), M.glas, 'atrium_glas_nord', 0, (FLOORS * FL) / 2, -AZ / 2, { shadow: false, wire: false });
  add(box(AX, FLOORS * FL, 0.08), M.glas, 'atrium_glas_sued', 0, (FLOORS * FL) / 2, AZ / 2, { shadow: false, wire: false });
  add(box(AX, 0.12, AZ), M.glas, 'atrium_glasdach', 0, FLOORS * FL + 1.0, 0, { shadow: false, wire: false });
  for (let i = 0; i <= 6; i++) {
    add(box(0.16, 0.3, AZ), M.stahl, 'atrium_dachtraeger_' + i, -AX / 2 + (AX * i) / 6, FLOORS * FL + 1.1, 0, { shadow: false, wire: false });
  }

  // ---------- ground level: entrance, trees ----------
  add(box(4.6, 3.0, 0.2), M.messing, 'eingang_portal', 0, 1.5, AZ / 2 + 0.2, { shadow: false });
  [[-34, 16], [-30, -18], [32, 14], [36, -16], [-2, 22], [14, -22]].forEach(([x, z], i) => {
    add(new THREE.CylinderGeometry(0.13, 0.17, 2.6, 10), M.beton_dunkel, 'baum_' + i + '_stamm', x, 1.3, z, { shadow: false, wire: false });
    const k = add(new THREE.SphereGeometry(1.5, 18, 12), M.gruen, 'baum_' + i + '_krone', x, 4.1, z, { shadow: false, wire: false });
    k.scale.set(1, 1.25, 1);
  });

  // ---------- blueprint wireframe twin ----------
  const wire = new THREE.Group();
  wire.name = 'blueprint';
  const lineMat = new THREE.LineBasicMaterial({ color: 0x9db2d8, transparent: true, opacity: 0.55 });
  lineMat.name = 'blueprint_linie';
  const edgeCache = new Map();
  for (const { geo, m } of wireGeos) {
    if (!edgeCache.has(geo)) edgeCache.set(geo, new THREE.EdgesGeometry(geo, 25));
    const ls = new THREE.LineSegments(edgeCache.get(geo), lineMat);
    ls.position.copy(m.position);
    ls.rotation.copy(m.rotation);
    ls.scale.copy(m.scale);
    wire.add(ls);
  }
  const grid = new THREE.GridHelper(140, 56, 0x9db2d8, 0x39465c);
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  grid.position.y = 0.02;
  wire.add(grid);

  return { group, wire, materials: Object.values(M), lineMat, gridMat: grid.material, floorY: (f) => f * FL };
}
