// Halcyon core: deterministic area generator.
// IMPORTANT: AreaGenerator.cs in Unity mirrors this file step by step.
// If you change the order of RNG calls here, change it there too.
var HalcyonCore = (function () {
  function fnv1a(str) {
    // FNV-1a 32-bit over UTF-8 bytes (keys are ASCII ids, so bytes == chars)
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function Rng(seed) { this.a = seed >>> 0; }
  // mulberry32
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ ((t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0)) >>> 0)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (n) { return Math.floor(this.next() * n); };

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function has(arr, v) { return arr.indexOf(v) !== -1; }

  function areaKey(serverId, aId, bId, cId) { return serverId + "|" + aId + "|" + bId + "|" + cId; }

  function generate(data, serverId, aId, bId, cId) {
    var server = byId(data.servers, serverId);
    var A = byId(data.wordsA, aId), B = byId(data.wordsB, bId), C = byId(data.wordsC, cId);
    if (!server || !A || !B || !C) return null;
    var key = areaKey(serverId, aId, bId, cId);
    var rng = new Rng(fnv1a(key));

    // 1. level
    var level = server.levelBase + A.level + B.level + C.level + (rng.int(5) - 2);
    // 2. element (always consume)
    var randomElement = data.elements[rng.int(data.elements.length)].id;
    var elementId = A.element !== "" ? A.element : randomElement;
    // 3. weather
    var weather = B.weathers[rng.int(B.weathers.length)];
    // 4. time of day
    var time = data.times[rng.int(data.times.length)];
    // 5. dungeon floors
    var dungeon = byId(data.dungeons, B.dungeon);
    var floors = dungeon.floorsMin + rng.int(dungeon.floorsMax - dungeon.floorsMin + 1);
    // 6. magic portals in the field
    var portals = 3 + rng.int(4);
    // 7. monsters: partial Fisher-Yates over the filtered pool (data order)
    var biome = byId(data.biomes, C.biome);
    var pool = [];
    for (var i = 0; i < data.monsters.length; i++) {
      var m = data.monsters[i];
      var okE = has(m.elements, "*") || has(m.elements, elementId);
      var okB = has(m.biomes, "*") || has(m.biomes, biome.id);
      if (okE && okB) pool.push(m);
    }
    var take = Math.min(3, pool.length);
    for (var k = 0; k < take; k++) {
      var j = k + rng.int(pool.length - k);
      var tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
    }
    var monsters = [];
    for (var q = 0; q < take; q++) monsters.push(pool[q].name);
    // 8. treasure
    var treasure = dungeon.treasures[rng.int(dungeon.treasures.length)];
    // 9. music
    var music = biome.music[rng.int(biome.music.length)];
    // 10. random corruption (3%)
    var corrupted = rng.next() < 0.03;

    var description = biome.desc;
    var name = server.symbol + " " + A.text + " " + B.text + " " + C.text;
    var special = false;

    for (var s = 0; s < data.specialAreas.length; s++) {
      var sp = data.specialAreas[s];
      if (sp.key === key) {
        special = true;
        if (sp.name) name = sp.name;
        if (sp.level >= 0) level = sp.level;
        if (sp.corrupted) corrupted = true;
        if (sp.description) description = sp.description;
        if (sp.treasure) treasure = sp.treasure;
      }
    }
    if (level < 1) level = 1;
    if (level > 99) level = 99;

    return {
      key: key, name: name, serverId: serverId, level: level, element: elementId,
      biome: biome.id, biomeName: biome.name, dungeon: dungeon.id, dungeonName: dungeon.name,
      floors: floors, portals: portals, weather: weather, time: time,
      monsters: monsters, treasure: treasure, music: music,
      corrupted: corrupted, special: special, description: description
    };
  }

  return { fnv1a: fnv1a, Rng: Rng, generate: generate, areaKey: areaKey };
})();
if (typeof module !== "undefined") module.exports = HalcyonCore;
