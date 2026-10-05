/* NAPWORLD - static data: geography, provinces, factions, units, generals */
(function () {
  const NAP = (window.NAP = window.NAP || {});

  // Map projection (simple equirectangular, stretched for latitude)
  NAP.MAP = { W: 1050, H: 1110, lon0: -11, lat1: 66, kx: 19.8, ky: 30, cs: 2 };
  NAP.proj = (lon, lat) => [(lon - NAP.MAP.lon0) * NAP.MAP.kx, (NAP.MAP.lat1 - lat) * NAP.MAP.ky];

  // ---- Coastlines: flat [lon,lat,...] arrays. Each polygon is a landmass. ----
  NAP.LAND = {
    // Continental Europe (+ Scandinavia, Finland, Russia to the map edge). Black Sea & Baltic are the coast.
    europe: [
      -5.4,36.1, -4.4,36.7, -2.2,36.8, -0.9,37.6, -0.5,38.35, 0.2,38.7, -0.3,39.5, 0.1,40.1, 0.9,40.7, 1.2,41.1,
      2.2,41.4, 3.2,41.9, 3.1,42.7, 3.2,43.3, 4.0,43.5, 4.8,43.4, 5.3,43.3, 6.1,43.1, 6.7,43.15, 7.4,43.7,
      8.6,44.3, 9.2,44.4, 9.8,44.1, 10.2,43.9, 10.3,43.4, 10.9,42.8, 11.8,42.1, 12.3,41.7, 13.0,41.3, 13.8,41.2,
      14.3,40.8, 14.9,40.4, 15.3,40.0, 15.9,39.4, 16.2,38.9, 15.8,38.2, 15.65,38.0, 16.1,38.0, 16.6,38.4,
      17.1,38.9, 17.2,39.4, 16.7,39.7, 16.7,40.3, 17.2,40.5, 17.9,40.3, 18.3,40.1, 18.5,39.9, 18.4,40.3,
      18.0,40.7, 17.2,41.0, 16.8,41.15, 16.0,41.55, 16.1,41.9, 15.0,41.9, 14.1,42.2, 13.8,42.7, 13.6,43.4,
      13.0,43.7, 12.6,44.1, 12.4,44.6, 12.3,45.1, 12.3,45.4, 13.0,45.65, 13.5,45.7, 13.8,45.6, 13.6,45.2,
      14.4,45.35, 14.9,44.9, 15.2,44.2, 16.0,43.7, 16.4,43.5, 17.3,43.1, 18.1,42.65, 18.8,42.35, 19.3,41.9,
      19.5,41.4, 19.4,40.7, 19.6,40.3, 20.0,39.8, 20.3,39.35, 20.75,38.95, 21.1,38.3, 21.3,37.9, 21.5,36.9,
      22.4,36.5, 22.8,36.6, 22.95,37.1, 23.1,37.5, 23.6,37.95, 24.0,37.65, 24.0,38.3, 23.3,39.0, 22.95,39.35,
      22.6,40.0, 22.95,40.6, 23.7,40.2, 24.0,40.1, 23.8,40.5, 24.4,40.9, 25.5,40.85, 26.0,40.75, 26.1,40.2,
      27.0,40.5, 27.8,40.95, 28.4,41.0, 29.0,41.1, 28.7,41.4, 28.0,42.0, 28.0,42.8, 27.9,43.2, 28.6,43.8,
      28.6,44.2, 29.6,45.1, 29.7,45.4, 30.2,45.8, 30.7,46.5, 31.5,46.6, 32.0,46.5, 33.0,46.1, 33.6,46.0,
      32.8,45.7, 32.5,45.35, 33.5,44.55, 34.5,44.4, 35.5,44.8, 36.5,45.3, 36.6,45.4, 37.5,44.7, 38.3,44.4,
      39.7,43.6, 41.0,42.3, 41.6,41.6, 42.0,41.6,
      42.0,66.0, 12.8,66.0,
      12.0,65.4, 11.0,64.8, 10.0,64.2, 10.4,63.5, 8.5,63.2, 7.5,62.7, 6.0,62.2, 5.0,61.0, 5.0,60.0, 5.4,59.2,
      5.7,58.8, 6.5,58.1, 7.5,58.0, 8.5,58.2, 9.5,58.9, 10.4,59.2, 10.7,59.8, 10.7,59.5, 11.1,59.0, 11.2,58.2,
      11.9,57.7, 12.4,56.9, 12.6,56.2, 12.9,55.6, 13.5,55.4, 14.2,55.4, 14.8,55.6, 15.6,56.2, 16.4,56.7,
      16.7,57.5, 16.6,58.0, 17.3,58.8, 18.2,59.4, 18.9,59.7, 17.8,60.5, 17.2,60.7, 17.2,61.7, 17.5,62.5,
      18.5,63.3, 19.5,63.7, 20.3,63.8, 21.5,64.5, 22.1,65.6, 23.5,65.8, 24.1,65.8, 25.3,65.0, 24.5,64.4,
      23.5,63.9, 22.7,63.2, 21.6,62.6, 21.3,61.9, 21.8,61.5, 21.4,60.9, 22.2,60.4, 22.9,59.8, 24.5,60.0,
      25.0,60.15, 26.5,60.4, 26.9,60.45, 28.7,60.7, 29.3,60.1, 30.3,59.9, 29.0,59.8, 28.1,59.5, 26.5,59.5,
      25.0,59.5, 24.7,59.4, 23.5,59.2, 23.4,58.6, 24.5,58.4, 24.3,57.8, 24.1,57.0, 23.2,57.1, 22.6,57.7,
      21.7,57.6, 21.1,56.8, 21.0,56.5, 21.1,55.7, 20.9,55.3, 20.5,54.7, 19.9,54.4, 18.65,54.35, 18.8,54.7,
      17.0,54.7, 16.4,54.5, 15.5,54.2, 14.5,53.9, 13.6,54.5, 12.5,54.4, 12.1,54.2, 10.9,53.95, 10.9,54.4,
      10.2,54.4, 9.8,54.8, 10.0,55.4, 10.2,56.15, 10.6,56.5, 10.5,57.2, 10.6,57.7, 9.8,57.2, 8.5,56.7,
      8.1,56.0, 8.4,55.5, 8.7,54.9, 8.9,54.0, 8.2,53.6, 7.0,53.5, 6.0,53.4, 5.5,53.3, 4.8,52.9, 4.5,52.4,
      4.1,52.0, 3.7,51.4, 2.5,51.1, 1.85,50.95, 1.6,50.2, 1.1,49.9, 0.1,49.5, -0.5,49.3, -1.6,49.65,
      -1.5,48.65, -2.5,48.7, -3.2,48.85, -4.0,48.7, -4.5,48.4, -4.4,47.8, -3.3,47.7, -2.5,47.4, -2.2,47.2,
      -1.9,46.7, -1.2,46.15, -1.15,45.5, -1.2,44.6, -1.4,43.5, -3.0,43.4, -4.0,43.4, -5.5,43.6, -7.0,43.6,
      -8.4,43.4, -9.3,43.2, -8.9,42.2, -8.7,41.15, -9.0,40.2, -9.4,39.3, -9.5,38.8, -9.0,38.5, -8.8,37.9,
      -8.95,37.0, -7.4,37.2, -6.3,36.5, -5.6,36.0
    ],
    // North Africa, the Levant and Anatolia
    africa: [
      -10.3,29.0, -9.8,30.0, -9.6,30.4, -9.8,31.5, -9.25,32.3, -7.6,33.6, -6.85,34.0, -6.1,35.2, -5.9,35.8,
      -5.3,35.9, -4.4,35.2, -2.9,35.3, -2.0,35.1, -0.65,35.7, 0.5,36.1, 1.5,36.5, 3.0,36.8, 4.5,36.9, 5.1,36.8,
      6.9,36.9, 7.8,36.9, 9.9,37.3, 11.1,37.05, 10.6,36.4, 10.6,35.8, 10.8,34.7, 10.1,33.9, 11.5,33.2,
      13.2,32.9, 15.1,32.4, 16.6,31.2, 18.5,30.4, 19.8,30.6, 20.1,32.1, 22.0,32.9, 22.65,32.77, 24.0,32.1,
      25.2,31.6, 27.0,31.3, 29.0,30.9, 29.9,31.2, 31.2,31.5, 32.3,31.3, 34.2,31.3, 34.75,32.05, 35.1,33.0,
      35.5,33.9, 35.8,34.7, 35.8,35.5, 36.15,36.6, 35.5,36.8, 34.6,36.7, 33.5,36.2, 32.8,36.05, 32.0,36.5,
      30.7,36.9, 30.15,36.3, 29.2,36.2, 28.3,36.85, 27.4,37.0, 27.25,37.85, 27.1,38.4, 26.3,38.3, 26.7,39.3,
      26.2,39.6, 26.5,40.0, 27.0,40.35, 27.9,40.35, 28.8,40.4, 29.9,40.75, 29.7,41.05, 30.9,41.2, 31.8,41.45,
      33.0,42.0, 33.8,42.0, 35.1,42.0, 36.3,41.3, 37.9,41.0, 39.7,41.0, 41.5,41.55, 42.0,41.5, 42.0,29.0
    ],
    britain: [
      -5.7,50.1, -4.8,50.3, -4.1,50.35, -3.4,50.6, -2.4,50.6, -1.3,50.75, -0.8,50.75, 0.25,50.75, 0.9,50.9,
      1.4,51.15, 1.4,51.4, 0.7,51.45, 1.0,51.9, 1.75,52.5, 1.3,52.95, 0.35,52.9, 0.2,53.4, 0.0,53.6, -0.1,54.1,
      -0.6,54.5, -1.2,54.7, -1.4,55.0, -1.6,55.6, -2.0,55.8, -2.6,56.0, -3.2,56.0, -2.8,56.3, -2.0,57.15,
      -1.8,57.5, -3.0,57.7, -4.2,57.5, -3.8,58.0, -3.05,58.65, -5.0,58.6, -5.4,58.0, -5.8,57.5, -5.6,57.0,
      -6.0,56.7, -5.5,56.4, -5.7,55.7, -5.7,55.3, -4.9,55.8, -4.65,55.5, -5.0,54.65, -3.4,54.95, -3.6,54.55,
      -2.9,54.1, -3.05,53.4, -3.2,53.3, -4.6,53.4, -4.1,52.9, -4.2,52.4, -4.9,52.1, -5.3,51.9, -3.9,51.6,
      -3.2,51.45, -2.6,51.5, -3.0,51.2, -4.2,51.2, -4.6,50.95, -5.2,50.5
    ],
    ireland: [
      -8.5,51.8, -7.0,52.15, -6.35,52.3, -6.0,53.0, -6.1,53.35, -6.0,53.9, -5.7,54.6, -5.8,55.2, -7.0,55.25,
      -7.3,55.4, -8.3,54.7, -8.5,54.3, -10.0,54.2, -9.9,53.5, -9.2,53.2, -9.9,52.8, -10.4,52.1, -10.0,51.7
    ],
    sicily: [12.4,38.0, 13.4,38.2, 15.6,38.3, 15.2,37.2, 15.0,36.7, 14.3,37.0, 12.5,37.7],
    sardinia: [8.2,41.0, 9.0,41.3, 9.7,40.9, 9.6,39.2, 8.5,38.9, 8.4,39.5],
    corsica: [8.6,42.3, 9.4,43.0, 9.5,42.0, 9.2,41.4, 8.7,41.7],
    zealand: [11.0,55.8, 11.9,56.0, 12.6,56.0, 12.7,55.6, 12.3,55.2, 11.3,55.2, 11.0,55.5]
  };

  // ---- Decoration ----
  NAP.MOUNTAINS = [
    [[6.5,44.0],[7.0,45.5],[8.5,46.2],[10.5,46.5],[12.5,46.7],[14.5,46.5],[16.0,47.3]],
    [[-1.8,43.2],[0,42.7],[1.5,42.6],[3.0,42.4]],
    [[18.5,49.3],[21,49.4],[23,48.5],[25,47.8],[25.5,46.5],[25,45.5],[23,45.2],[22,44.7]],
    [[9.0,44.5],[11.0,44.0],[12.5,42.6],[14.0,41.7],[15.5,40.5],[16.2,39.0]],
    [[6,60.5],[8,61.5],[10,62.5],[12,64],[13,65.5]],
    [[20.5,40.5],[21.2,39.5],[21.8,38.8]],
    [[22.5,43.3],[25,42.8],[28,42.8]],
    [[37.5,44.3],[40,43.4],[42,42.5]],
    [[-8,31.5],[-5,33],[-2,34],[2,35.3],[6,35.5]],
    [[2.5,45.7],[3.2,44.8],[3.0,44.2]],
    [[12.5,50.3],[15.5,50.8],[17,50.2]],
    [[30,37.2],[33,37.0],[36,37.4],[39,38.2]],
    [[-6,42.6],[-4,42.2],[-3,40.8],[-4.5,40.3],[-6,40.2]],
    [[-5,37.0],[-3.2,37.1],[-2.5,37.0]]
  ];
  NAP.RIVERS = [
    [[8.3,47.6],[7.6,48.5],[8.2,49.7],[7.6,50.4],[6.8,51.3],[6.0,51.8],[4.6,52.0]],
    [[8.5,48.0],[10.5,48.4],[13.0,48.6],[16.4,48.2],[19.0,47.6],[19.0,46.0],[21.0,45.3],[22.5,44.6],[25,43.7],[27.0,44.2],[28.8,45.2]],
    [[4.2,45.5],[3.5,47.0],[2.0,47.6],[0,47.3],[-1.5,47.2],[-2.2,47.28]],
    [[4.5,47.9],[3.0,48.4],[2.3,48.8],[1.0,49.3],[0.2,49.45]],
    [[15.5,50.5],[14.4,50.3],[13.8,51.0],[12.5,51.8],[11.6,52.3],[10.0,53.2],[9.0,53.8]],
    [[19.5,50.0],[21.5,50.5],[21.0,52.2],[19.0,52.8],[18.7,54.0]],
    [[17.5,50.0],[16.8,51.1],[15.3,52.2],[14.5,53.0],[14.4,53.8]],
    [[32,53.5],[30.5,50.4],[34,48.5],[33,47.0],[32.5,46.5]],
    [[39.5,52],[40.0,49.8],[40.0,47.3]],
    [[-4,40.4],[-6,39.7],[-8,39.5],[-9.2,38.7]],
    [[-3.5,42.7],[-1.5,42.2],[0.5,41.4],[0.8,40.7]],
    [[7.5,44.7],[9.0,45.1],[11,44.95],[12.4,44.9]],
    [[6,46.2],[5,45.5],[4.8,44.2],[4.8,43.4]],
    [[0.5,42.8],[1.4,43.6],[0,44.4],[-0.6,44.9]],
    [[31,29.0],[31.2,30.0],[31.0,31.3]]
  ];
  NAP.SEA_LABELS = [
    ['ATLANTIC OCEAN', -8.0, 46.0], ['NORTH SEA', 3.5, 56.2], ['MEDITERRANEAN SEA', 17.5, 35.0],
    ['BLACK SEA', 34.0, 43.0], ['BALTIC SEA', 19.5, 57.8], ['ADRIATIC', 15.4, 43.3], ['IONIAN SEA', 18.5, 37.2],
    ['AEGEAN', 25.0, 38.4], ['BAY OF BISCAY', -5.5, 45.4], ['ENGLISH CHANNEL', -1.5, 50.0]
  ];

  // ---- Provinces ----
  // [id, name, lon, lat, owner, terrain(p/h/f/m), income, manpower, flags]
  // flags: C = capital, P = port, F = fortification level (each F = +1)
  const P = [
    // France
    ['paris','Paris',2.3,48.9,'france','p',9,6,'CFF'], ['normandy','Normandy',0.0,49.0,'france','p',5,3,'P'],
    ['brittany','Brittany',-3.0,48.1,'france','h',4,3,'P'], ['guyenne','Guyenne',-0.2,44.5,'france','p',5,3,'P'],
    ['languedoc','Languedoc',2.5,43.8,'france','h',4,3,'P'], ['provence','Provence',5.9,43.8,'france','h',4,2,'PF'],
    ['dauphine','Lyon & Dauphine',5.2,45.3,'france','h',5,3,''], ['burgundy','Burgundy',4.7,47.2,'france','p',4,3,''],
    ['lorraine','Champagne & Lorraine',5.2,48.9,'france','p',5,4,'F'], ['alsace','Alsace',7.6,48.2,'france','p',3,2,'F'],
    ['belgium','Belgium',4.6,50.7,'france','p',6,3,'P'], ['holland','Holland',5.2,52.2,'france','p',6,2,'P'],
    ['rhineland','Rhineland',6.9,50.6,'france','h',4,3,''], ['piedmont','Piedmont',7.9,44.9,'france','h',4,3,'F'],
    ['lombardy','Lombardy',9.6,45.4,'france','p',6,3,'F'], ['tuscany','Tuscany',11.0,43.4,'france','h',4,2,'P'],
    ['corsica','Corsica',9.1,42.2,'france','m',1,2,'P'],
    // Britain
    ['london','London',-0.3,51.6,'britain','p',10,5,'CPF'], ['southwest','South-West England',-3.7,50.8,'britain','h',4,3,'PF'],
    ['midlands','Midlands & Wales',-2.2,52.7,'britain','p',6,4,''], ['northengland','Northern England',-2.4,54.2,'britain','h',5,3,'P'],
    ['scotland','Scotland',-4.0,56.8,'britain','h',3,3,'P'], ['ireland','Ireland',-7.9,53.2,'britain','p',3,4,'P'],
    ['hanover','Hanover',9.6,52.6,'britain','p',3,2,'P'],
    // Spain
    ['galicia','Galicia',-8.0,42.7,'spain','h',3,3,'P'], ['leon','Old Castile',-4.7,41.8,'spain','p',4,3,''],
    ['navarre','Navarre & Basque',-1.8,42.9,'spain','m',3,3,'P'], ['aragon','Aragon',-0.8,41.6,'spain','h',3,3,'F'],
    ['catalonia','Catalonia',1.4,41.8,'spain','h',5,3,'PF'], ['valencia','Valencia & Murcia',-0.9,39.2,'spain','p',4,3,'P'],
    ['madrid','Madrid',-3.7,40.1,'spain','p',7,4,'C'], ['extremadura','Extremadura',-6.2,39.2,'spain','h',2,3,''],
    ['andalusia','Andalusia',-5.0,37.5,'spain','p',6,4,'PF'],
    // Portugal
    ['lisbon','Lisbon',-8.9,39.0,'portugal','p',5,3,'CPF'], ['porto','Porto & Minho',-8.0,41.3,'portugal','h',3,3,'P'],
    // Sweden
    ['stockholm','Stockholm',17.6,59.7,'sweden','p',5,3,'CPF'], ['gothenburg','West Sweden',13.0,57.3,'sweden','h',4,3,'PF'],
    ['norrland','Norrland',17.5,63.7,'sweden','f',2,3,''], ['finland','Finland',24.6,62.4,'sweden','f',3,3,'PF'],
    // Denmark-Norway
    ['copenhagen','Copenhagen',12.4,55.7,'denmark','p',6,3,'CPFF'], ['jutland','Jutland',9.3,56.2,'denmark','p',4,3,'P'],
    ['norway_s','South Norway',9.3,60.3,'denmark','m',3,3,'P'], ['norway_n','North Norway',12.3,64.9,'denmark','m',2,2,''],
    // Russia
    ['petersburg','St. Petersburg',30.4,59.9,'russia','p',8,5,'CPF'], ['estonia','Estonia',25.5,58.8,'russia','f',3,2,'P'],
    ['livonia','Livonia',24.8,57.0,'russia','p',4,3,'PF'], ['lithuania','Lithuania',25.3,54.8,'russia','f',4,3,''],
    ['belarus','Belarus',28.0,53.5,'russia','f',3,4,''], ['smolensk','Smolensk',32.0,54.8,'russia','p',4,4,'F'],
    ['moscow','Moscow',37.6,55.8,'russia','p',8,6,'F'], ['novgorod','Novgorod',33.8,58.4,'russia','f',3,3,''],
    ['karelia','Karelia',33.0,63.0,'russia','f',2,2,''], ['kiev','Kiev',30.6,50.4,'russia','p',5,4,'F'],
    ['kharkov','Kharkov',36.2,49.8,'russia','p',4,4,''], ['kherson','Kherson',32.3,47.0,'russia','p',3,2,'P'],
    ['crimea','Crimea',34.2,45.0,'russia','p',2,2,'PF'], ['don','Don Cossacks',40.2,47.5,'russia','p',3,4,''],
    ['caucasus','Caucasus',41.0,43.5,'russia','m',2,2,'P'],
    // Prussia
    ['berlin','Berlin',13.4,52.5,'prussia','p',8,4,'CF'], ['pomerania','Pomerania',15.8,53.8,'prussia','p',3,3,'PF'],
    ['eastprussia','East Prussia',21.0,54.3,'prussia','f',4,3,'PF'], ['posen','Posen',17.0,52.3,'prussia','p',3,3,''],
    ['warsaw','Warsaw',21.0,52.3,'prussia','p',4,3,'F'], ['silesia','Silesia',16.8,51.0,'prussia','p',6,4,'F'],
    ['magdeburg','Magdeburg',11.5,52.0,'prussia','p',4,3,'F'], ['westphalia','Westphalia',8.2,51.7,'prussia','p',4,3,''],
    // Bavaria & Rhine allies
    ['bavaria','Bavaria',11.5,48.4,'bavaria','h',6,4,'CF'], ['wurttemberg','Wurttemberg & Baden',9.0,48.7,'bavaria','h',5,3,''],
    ['saxony','Saxony',13.3,51.0,'bavaria','p',5,3,'F'],
    // Austria
    ['vienna','Vienna',16.4,48.2,'austria','p',10,6,'CFF'], ['bohemia','Bohemia',14.5,49.9,'austria','h',7,4,'F'],
    ['moravia','Moravia',17.0,49.3,'austria','p',4,3,'F'], ['tyrol','Tyrol',11.4,47.0,'austria','m',3,3,'F'],
    ['styria','Styria',15.0,47.2,'austria','m',3,3,''], ['carniola','Illyria',14.3,45.9,'austria','h',3,2,'P'],
    ['croatia','Croatia',16.0,45.6,'austria','f',3,3,''], ['dalmatia','Dalmatia',16.8,43.7,'austria','m',2,2,'P'],
    ['venetia','Venetia',11.9,45.6,'austria','p',5,3,'PF'], ['hungary','Hungary',19.5,47.3,'austria','p',8,5,'F'],
    ['transylvania','Transylvania',24.5,46.0,'austria','m',3,3,''], ['galicia_pl','Galicia',23.0,49.8,'austria','h',4,4,'F'],
    // Naples
    ['naples','Naples',14.6,40.9,'naples','p',6,3,'CPFF'], ['apulia','Apulia',16.4,41.0,'naples','p',4,3,'P'],
    ['calabria','Calabria',16.3,39.0,'naples','m',2,3,'P'], ['sicily','Sicily',14.0,37.6,'naples','h',4,3,'P'],
    // Minor / neutral
    ['switzerland','Switzerland',8.2,46.8,'minor','m',4,3,'F'], ['papal','Papal States',12.5,42.6,'minor','h',4,2,'F'],
    ['sardinia','Sardinia',9.0,40.0,'minor','h',2,2,'P'], ['morocco','Morocco',-6.5,32.8,'minor','m',3,3,'P'],
    ['algiers','Algiers',2.8,35.2,'minor','h',2,2,'P'], ['tunis','Tunis',9.8,35.5,'minor','p',2,2,'P'],
    ['tripoli','Tripolitania',14.0,31.8,'minor','p',2,2,'P'],
    // Ottoman Empire
    ['constantinople','Constantinople',28.2,41.3,'ottoman','p',9,5,'CPFF'], ['bulgaria','Rumelia',25.4,42.6,'ottoman','h',4,4,'F'],
    ['serbia','Serbia & Bosnia',19.8,44.2,'ottoman','m',3,4,'F'], ['albania','Albania',20.0,41.0,'ottoman','m',2,3,'P'],
    ['macedonia','Macedonia',22.4,40.9,'ottoman','h',3,3,'P'], ['greece','Greece',22.1,39.0,'ottoman','h',3,3,'P'],
    ['morea','Morea',22.2,37.5,'ottoman','h',2,2,'P'], ['wallachia','Wallachia',25.0,44.5,'ottoman','p',4,3,'F'],
    ['moldavia','Moldavia',27.0,47.0,'ottoman','p',3,3,''], ['anatolia_w','Western Anatolia',30.0,38.8,'ottoman','p',5,4,'P'],
    ['anatolia_e','Eastern Anatolia',37.5,38.8,'ottoman','m',3,4,''], ['syria','Syria',36.7,34.5,'ottoman','p',4,3,'P'],
    ['egypt','Egypt',31.0,30.4,'ottoman','p',7,4,'PF']
  ];
  NAP.PROVINCE_DEFS = P.map((r) => ({
    id: r[0], name: r[1], lon: r[2], lat: r[3], owner: r[4], terrain: r[5], income: r[6], manpower: r[7],
    capital: r[8].includes('C'), port: r[8].includes('P'), fort: (r[8].match(/F/g) || []).length
  }));

  // Sea zones: ports in a zone can sail to each other when within `range` map pixels.
  NAP.SEA_ZONES = [
    { range: 470, ports: ['london','southwest','ireland','scotland','normandy','brittany','belgium','holland','hanover','jutland','norway_s','guyenne','galicia','porto','lisbon','andalusia','morocco','gothenburg'] },
    { range: 340, ports: ['catalonia','valencia','andalusia','morocco','algiers','tunis','provence','languedoc','corsica','sardinia','tuscany','naples','sicily','calabria','tripoli'] },
    { range: 380, ports: ['sicily','calabria','apulia','venetia','carniola','dalmatia','albania','macedonia','greece','morea','anatolia_w','syria','egypt','tripoli','constantinople'] },
    { range: 330, ports: ['constantinople','kherson','crimea','caucasus'] },
    { range: 360, ports: ['copenhagen','stockholm','gothenburg','pomerania','eastprussia','livonia','estonia','petersburg','finland','jutland'] }
  ];

  // ---- Factions ----
  NAP.FACTIONS = {
    france:   { name:'French Empire',      adj:'French',    color:'#2a52be', leader:'Napoleon Bonaparte', gold:600, aggr:0.9, morale:1.08, fire:1.0,  playable:true,
                desc:'Master of the continent. Strong armies, brilliant generals and a central position, but surrounded by enemies and challenged at sea by Britain.' },
    britain:  { name:'United Kingdom',     adj:'British',   color:'#c8283a', leader:'William Pitt', gold:900, aggr:0.5, morale:1.0, fire:1.12, playable:true,
                desc:'Mistress of the seas with a vast treasury. Small army, but disciplined volleys and the money to bankroll coalitions.' },
    austria:  { name:'Austrian Empire',    adj:'Austrian',  color:'#e2dcb4', leader:'Francis II', gold:500, aggr:0.6, morale:1.0, fire:1.0, playable:true,
                desc:'Heart of the old order. Large armies and rich provinces in Central Europe, eager to reverse the French tide.' },
    prussia:  { name:'Kingdom of Prussia', adj:'Prussian',  color:'#4d5a6b', leader:'Frederick William III', gold:450, aggr:0.4, morale:1.0, fire:1.06, playable:true,
                desc:'Proud heirs of Frederick the Great. A drilled but untested army; neutral at first, with a choice of side.' },
    russia:   { name:'Russian Empire',     adj:'Russian',   color:'#2f7d4a', leader:'Alexander I', gold:500, aggr:0.6, morale:1.1, fire:0.97, playable:true,
                desc:'Endless manpower and stoic infantry. Vast but poorly connected; a deep homeland swallows invaders.' },
    ottoman:  { name:'Ottoman Empire',     adj:'Ottoman',   color:'#d0791e', leader:'Selim III', gold:450, aggr:0.4, morale:0.88, fire:0.92, playable:true,
                desc:'A sprawling empire in decline across three continents, with swarming cavalry and a modernising army in the making.' },
    spain:    { name:'Kingdom of Spain',   adj:'Spanish',   color:'#e0b300', leader:'Charles IV', gold:450, aggr:0.3, morale:0.92, fire:0.95, playable:true,
                desc:'Allied to France against Britain. Rich colonial revenues, a modest army and a fleet awaiting its fate.' },
    portugal: { name:'Portugal',           adj:'Portuguese',color:'#8e44ad', leader:'Prince John', gold:250, aggr:0.2, morale:0.95, fire:1.0, playable:true,
                desc:'Britain\'s oldest ally, small but tenacious, squeezed between Spain and the sea.' },
    sweden:   { name:'Kingdom of Sweden',  adj:'Swedish',   color:'#3fa7e0', leader:'Gustav IV Adolf', gold:300, aggr:0.5, morale:1.02, fire:1.0, playable:true,
                desc:'A fading Baltic power still holding Finland, with a hard-fighting army and an unpredictable king.' },
    denmark:  { name:'Denmark-Norway',     adj:'Danish',    color:'#e0607e', leader:'Frederick VI', gold:350, aggr:0.2, morale:1.0, fire:1.0, playable:true,
                desc:'Neutral Baltic trading power with a strong fleet — tempting prize for both sides.' },
    naples:   { name:'Kingdom of Naples',  adj:'Neapolitan',color:'#a9d34a', leader:'Ferdinand IV', gold:300, aggr:0.3, morale:0.9, fire:0.95, playable:true,
                desc:'A Bourbon kingdom in southern Italy, caught between French ambition and British gold.' },
    bavaria:  { name:'Bavaria & Allies',   adj:'Bavarian',  color:'#69b7e8', leader:'Maximilian I Joseph', gold:500, aggr:0.3, morale:1.0, fire:1.0, playable:true,
                desc:'Small German states drifting into the French orbit, standing between Austria and the Rhine.' },
    minor:    { name:'Neutral States',     adj:'Neutral',   color:'#948f7c', leader:'—', gold:200, aggr:0, morale:0.9, fire:0.9, playable:false,
                desc:'Switzerland, the Papal States, Sardinia and the Barbary regencies.' }
  };

  // Treaties at game start
  NAP.START_WARS = [['britain','france'], ['britain','spain']];
  NAP.START_ALLIES = [['france','spain'], ['france','bavaria'], ['britain','portugal'], ['russia','austria'], ['britain','sweden']];
  // Base opinion modifiers
  NAP.START_REL = [
    ['france','britain',-70], ['france','austria',-45], ['france','russia',-35], ['france','prussia',-15],
    ['russia','ottoman',-50], ['austria','ottoman',-35], ['britain','russia',30], ['britain','austria',25],
    ['spain','portugal',-20], ['france','portugal',-25], ['austria','bavaria',-30], ['prussia','sweden',-10],
    ['denmark','sweden',-30], ['denmark','britain',-15], ['prussia','austria',-20], ['naples','france',-30],
    ['britain','naples',30], ['russia','prussia',15], ['russia','sweden',-30], ['france','ottoman',20],
    ['britain','ottoman',10], ['russia','britain',25]
  ];

  // ---- Unit types ----
  // men: regiment size, cost: gold, mp: manpower (=men), upkeep: gold/turn
  NAP.UNITS = {
    line:      { name:'Line Infantry',    short:'Line',     men:800, cost:90,  upkeep:3, time:1, cls:'inf', power:1.0,  morale:70,  speed:22, w:80, d:12,
                 desc:'The backbone of every army. Dependable volley fire and cheap to raise.' },
    light:     { name:'Light Infantry',   short:'Light',    men:600, cost:100, upkeep:3, time:1, cls:'inf', power:1.0,  morale:66,  speed:32, w:60, d:10,
                 desc:'Skirmishers who screen the line, harass the enemy and move quickly. Fragile in a straight fight.' },
    grenadier: { name:'Grenadiers',       short:'Grenadier',men:700, cost:150, upkeep:4, time:1, cls:'inf', power:1.35, morale:84,  speed:22, w:64, d:12, needs:'barracks',
                 desc:'Picked, taller veterans. Harder hitting and steadier than line infantry.' },
    guard:     { name:'Guard Infantry',   short:'Guard',    men:700, cost:230, upkeep:6, time:2, cls:'inf', power:1.75, morale:100, speed:22, w:62, d:12, needs:'academy',
                 desc:'The finest infantry a nation fields. Excellent fire and melee, almost never break.' },
    hussar:    { name:'Light Cavalry',    short:'Hussar',   men:250, cost:105, upkeep:4, time:1, cls:'cav', power:1.4,  morale:66,  speed:72, w:50, d:10,
                 desc:'Fast scouts and flankers. Good for chasing routers and hitting artillery.' },
    lancer:    { name:'Lancers',          short:'Lancer',   men:250, cost:125, upkeep:4, time:1, cls:'cav', power:1.6,  morale:70,  speed:66, w:50, d:10, needs:'stables',
                 desc:'Shock cavalry whose lances give a devastating first charge, weaker in a long melee.' },
    cuirass:   { name:'Heavy Cavalry',    short:'Cuirass',  men:250, cost:150, upkeep:5, time:2, cls:'cav', power:1.9,  morale:76,  speed:58, w:50, d:10, needs:'stables',
                 desc:'Armoured horsemen who break infantry lines and win long melees.' },
    art:       { name:'Artillery Battery',short:'Guns',     men:80,  cost:140, upkeep:4, time:1, cls:'art', power:5.0,  morale:62,  speed:12, w:30, d:14,
                 desc:'Long-range cannon: devastating against columns and squares, vulnerable if caught alone.' },
    hart:      { name:'Horse Artillery',  short:'H. Guns',  men:80,  cost:190, upkeep:5, time:2, cls:'art', power:4.6,  morale:66,  speed:24, w:28, d:14, needs:'arsenal',
                 desc:'Light guns drawn by galloping teams. Redeploy quickly to follow the fight.' }
  };
  NAP.BUILDINGS = {
    market:   { name:'Market',          cost:220, time:3, max:1, desc:'+50% province income.' },
    barracks: { name:'Barracks',        cost:260, time:3, max:1, desc:'+50% manpower growth. Unlocks Grenadiers here.' },
    stables:  { name:'Stables',         cost:240, time:3, max:1, desc:'Unlocks Lancers and Heavy Cavalry here; cavalry cost 10% less.' },
    arsenal:  { name:'Arsenal',         cost:280, time:3, max:1, desc:'Unlocks Horse Artillery here; all guns cost 20% less.' },
    academy:  { name:'Military Academy',cost:360, time:4, max:1, req:'barracks', desc:'Unlocks Guard Infantry here. New regiments raised here start as veterans (+morale, +firepower).' },
    fort:     { name:'Fortifications',  cost:320, time:4, max:3, desc:'+1 fort level: longer sieges and a stronger garrison.' }
  };
  // Beginner guidance shown on the start screen
  NAP.NATION_GUIDE = {
    russia:   { tier:'Beginner', rank:1, ribbon:'Best first pick', war:false, why:'Huge manpower and 15 provinces, far from the first fighting. Nobody can reach you for months, and Russian winters hurt invaders far more than you.', tips:['Spend early gold on Markets, then Barracks.','Your ally Austria meets France first.','Let enemy armies bleed on your deep territory, then counter-attack.'] },
    britain:  { tier:'Easy', rank:2, ribbon:'Relaxed start', war:true, why:'The richest treasury and a safe island. Few battles at first, so it is a gentle way to learn the economy and diplomacy.', tips:['Britain automatically subsidises its allies with gold.','Armies of up to 12 regiments can sail between ports.','Build Markets in every province.'] },
    austria:  { tier:'Medium', rank:3, war:false, why:'A big army and rich provinces, but a French-led war reaches you in mid-1805.', tips:['Fortify Tyrol and Bohemia.','Russia is your ally: join forces before fighting Napoleon.'] },
    prussia:  { tier:'Medium', rank:4, war:false, why:'Safe and neutral at the start, so you can build up first. Your well-drilled army is untested.', tips:['Choose your moment and your side.','Silesia and Saxony are the main prizes.'] },
    france:   { tier:'Hard', rank:5, war:true, why:'The strongest army and best generals, but you start at war with Britain and Austria and Russia join in 1805.', tips:['Win decisive battles early with Napoleon.','Garrison conquered lands or they revolt.'] },
    ottoman:  { tier:'Hard', rank:6, war:false, why:'Large and distant, but morale is weak, rebels stir, and Russia and Austria press you.', tips:['Fortified provinces and cavalry are your strengths.'] },
    spain:    { tier:'Hard', rank:7, war:true, why:'Allied to France against Britain, with a modest army and an uprising looming in 1808.', tips:['Keep your armies near Madrid.'] },
    sweden:   { tier:'Hard', rank:8, war:false, why:'A fading power with Finland exposed to Russia.', tips:['Hold Finland and Stockholm.'] },
    denmark:  { tier:'Hard', rank:9, war:false, why:'Small, neutral and tempting to both sides.', tips:['Stay out of wars as long as you can.'] },
    naples:   { tier:'Hard', rank:10, war:false, why:'A small kingdom between French ambition and British gold.', tips:['Defend the mainland passes.'] },
    portugal: { tier:'Expert', rank:11, war:false, why:'Only two provinces and squeezed between Spain and the sea.', tips:['Rely on British help.'] },
    bavaria:  { tier:'Expert', rank:12, war:false, why:'Tiny and sandwiched between Austria and France.', tips:['Stay close to your French ally.'] }
  };

  // ---- Generals ----
  // [name, faction, atk, def, lead, from-year, trait]
  NAP.GENERALS = [
    ['Napoleon Bonaparte','france',6,5,6,1805,'Master of manoeuvre'], ['Louis-Nicolas Davout','france',4,6,4,1805,'The Iron Marshal'],
    ['Joachim Murat','france',5,2,4,1805,'Cavalry dash'], ['Andre Massena','france',5,4,4,1805,'Spoiled child of victory'],
    ['Michel Ney','france',6,3,4,1805,'Bravest of the brave'], ['Jean Lannes','france',5,3,4,1805,'Fearless'],
    ['Nicolas Soult','france',4,4,3,1805,'Skilled strategist'], ['Jean Bernadotte','france',3,3,3,1805,'Ambitious'],
    ['Auguste Marmont','france',3,3,3,1807,'Artillery expert'], ['Laurent Gouvion St-Cyr','france',3,4,3,1808,'Cautious'],
    ['John Moore','britain',3,4,4,1805,'Light infantry reformer'], ['Ralph Abercromby','britain',3,4,3,1805,'Old guard'],
    ['Arthur Wellesley','britain',4,6,6,1808,'The Iron Duke'], ['Rowland Hill','britain',3,4,3,1808,'Steady'],
    ['Thomas Picton','britain',4,3,3,1810,'Fierce'], ['William Beresford','britain',3,3,3,1809,'Organiser'],
    ['Archduke Charles','austria',4,5,5,1805,'Best of the Habsburgs'], ['Karl Mack','austria',1,2,1,1805,'Unlucky'],
    ['Karl Schwarzenberg','austria',3,4,4,1805,'Diplomat-general'], ['Archduke John','austria',3,3,3,1805,'Alpine hero'],
    ['Johann Hiller','austria',3,3,3,1805,'Solid'], ['Josef Radetzky','austria',3,4,4,1810,'Staff genius'],
    ['Karl von Brunswick','prussia',2,3,2,1805,'Aged'], ['Gebhard von Blucher','prussia',5,3,6,1805,'Marshal Forwards'],
    ['Friedrich Hohenlohe','prussia',2,2,2,1805,'Overconfident'], ['August von Gneisenau','prussia',3,5,4,1807,'Reformer'],
    ['Gerhard Scharnhorst','prussia',3,5,3,1806,'Military reformer'], ['Ludwig Yorck','prussia',4,4,3,1808,'Steely'],
    ['Mikhail Kutuzov','russia',3,6,5,1805,'The Fox of the North'], ['Pyotr Bagration','russia',6,3,5,1805,'Lion of the Rearguard'],
    ['Mikhail Barclay de Tolly','russia',3,5,3,1805,'Methodical'], ['Levin Bennigsen','russia',3,3,3,1805,'Veteran'],
    ['Matvei Platov','russia',4,2,4,1805,'Cossack ataman'], ['Peter Wittgenstein','russia',4,3,3,1807,'Capable'],
    ['Grand Vizier Yusuf','ottoman',2,2,2,1805,'Conservative'], ['Hursid Pasha','ottoman',3,2,3,1805,'Energetic'],
    ['Ibrahim Pasha','ottoman',3,3,3,1805,'Governor'], ['Muhammad Ali','ottoman',4,3,4,1807,'Reformer'],
    ['Francisco Castanos','spain',2,3,3,1805,'Cautious'], ['Gregorio Cuesta','spain',1,1,1,1805,'Rash'],
    ['Joaquin Blake','spain',2,3,2,1805,'Methodical'], ['Gaspar de Jovellanos','spain',2,2,2,1806,'Patriot'],
    ['Gomes Freire','portugal',2,3,3,1805,'Loyal'], ['Bernardim Freire','portugal',2,2,2,1805,'Hesitant'],
    ['Gustav Adolf','sweden',2,2,3,1805,'Zealot'], ['Johan Cronstedt','sweden',3,3,2,1805,'Defender'],
    ['Prince Christian','denmark',2,3,3,1805,'Prince'], ['Hans Bulow','denmark',2,2,2,1805,'Traditional'],
    ['Michele Pignatelli','naples',2,2,2,1805,'Courtly'], ['Fra Diavolo','naples',3,2,3,1806,'Guerrilla leader'],
    ['Carl von Wrede','bavaria',3,3,3,1805,'Capable'], ['Prince Wrede','bavaria',2,3,3,1806,'Loyal'],
    ['Nicolas Oudinot','france',5,3,4,1805,'Grenadier commander'], ['Louis Suchet','france',4,5,5,1808,'Peninsular victor'],
    ['Edouard Mortier','france',3,4,3,1805,'Dependable'], ['Louis Berthier','france',2,4,5,1805,'Chief of staff'],
    ['Eugene de Beauharnais','france',3,4,4,1806,'Viceroy of Italy'], ['Jozef Poniatowski','france',4,3,4,1807,'Polish prince'],
    ['Emmanuel Grouchy','france',4,2,3,1807,'Cavalry general'], ['Claude Victor','france',3,3,3,1806,'Steady'],
    ['Jean-Baptiste Bessieres','france',4,3,4,1805,'Guard cavalry'], ['Jean-Andoche Junot','france',4,2,3,1805,'Impetuous'],
    ['Thomas Graham','britain',4,4,4,1810,'Barossa hero'], ['Stapleton Cotton','britain',4,3,3,1808,'Cavalry'],
    ['Charles Cornwallis','britain',3,4,4,1805,'Statesman-soldier'], ['Lord Cathcart','britain',3,3,3,1807,'Copenhagen expedition'],
    ['John Hope','britain',3,4,3,1808,'Rearguard'], ['Rowland Lord Lynedoch','britain',3,3,3,1809,'Volunteer'],
    ['Heinrich Bellegarde','austria',3,4,3,1805,'Careful'], ['Johann Klenau','austria',4,3,3,1809,'Sharp'],
    ['Karl Bubna','austria',3,3,4,1809,'Light cavalry'], ['Franz Kolowrat','austria',3,3,3,1808,'Noble'],
    ['Friedrich Kleist','prussia',4,3,3,1809,'Resolute'], ['Friedrich Bulow','prussia',4,3,3,1807,'Aggressive'],
    ['Bogislav Tauentzien','prussia',3,3,3,1805,'Veteran'], ['Ernst Ruchel','prussia',2,3,2,1805,'Old school'],
    ['Mikhail Miloradovich','russia',5,2,5,1807,'Fearless'], ['Aleksey Yermolov','russia',4,4,4,1807,'Artillery chief'],
    ['Alexander Tormasov','russia',3,4,3,1808,'Capable'], ['Pavel Chichagov','russia',3,3,3,1810,'Admiral turned general'],
    ['Nikolay Raevsky','russia',4,5,4,1806,'Steadfast'], ['Dmitry Dokhturov','russia',3,5,4,1805,'Rock'],
    ['Ali Pasha','ottoman',4,3,3,1805,'Lion of Ioannina'], ['Ahmed Cezzar','ottoman',3,5,3,1805,'The Butcher'],
    ['Francisco Palafox','spain',2,3,3,1808,'Defender of Zaragoza'], ['Juan Carlos Reding','spain',3,2,2,1808,'Swiss-born'],
    ['Manuel Silveira','portugal',3,3,3,1808,'Loyal governor'],
    ['Georg Adlercreutz','sweden',4,3,3,1805,'Hardy'], ['Carl Klingspor','sweden',2,3,3,1808,'Cautious'],
    ['Ernst Peymann','denmark',3,3,3,1807,'Copenhagen defender'], ['Guglielmo Pepe','naples',3,3,3,1806,'Patriot'],
    ['Bernhard Deroy','bavaria',4,3,3,1805,'Aggressive'], ['Carl Philipp Wrede','bavaria',3,4,4,1809,'Skilled'],
    ['Garrison Commander','minor',1,2,2,1805,'Local']
  ];

  // Starting armies [province, general name, composition]
  NAP.START_ARMIES = {
    france: [
      ['normandy','Napoleon Bonaparte','line:9 light:3 guard:1 cuirass:2 hussar:2 art:3'],
      ['belgium','Louis-Nicolas Davout','line:6 light:2 hussar:1 art:2'],
      ['lorraine','Joachim Murat','cuirass:3 hussar:3 light:1 line:2'],
      ['lombardy','Andre Massena','line:6 light:2 hussar:1 art:2'],
      ['alsace','Michel Ney','line:5 light:2 art:1 hussar:1'],
      ['brittany','Nicolas Soult','line:4 light:1 art:1'],
      ['paris','Jean Lannes','line:3 art:1']
    ],
    britain: [
      ['london','John Moore','line:5 light:2 art:1'],
      ['ireland','Ralph Abercromby','line:3 hussar:1 art:1'],
      ['hanover','', 'line:3 hussar:1 art:1'],
      ['southwest','', 'line:2 art:1']
    ],
    spain: [
      ['madrid','Francisco Castanos','line:6 hussar:1 art:2'],
      ['andalusia','Gregorio Cuesta','line:4 hussar:1 art:1'],
      ['catalonia','Joaquin Blake','line:3 light:1 art:1'],
      ['galicia','', 'line:2']
    ],
    portugal: [['lisbon','Gomes Freire','line:4 hussar:1 art:1'], ['porto','', 'line:2']],
    austria: [
      ['venetia','Archduke Charles','line:8 light:2 cuirass:2 hussar:1 art:2'],
      ['tyrol','Karl Mack','line:7 light:2 cuirass:1 hussar:2 art:2'],
      ['bohemia','Karl Schwarzenberg','line:5 cuirass:1 hussar:1 art:1'],
      ['vienna','Archduke John','line:4 light:1 art:1'],
      ['hungary','', 'line:4 hussar:3 art:1'],
      ['galicia_pl','Johann Hiller','line:3 hussar:2']
    ],
    prussia: [
      ['berlin','Karl von Brunswick','line:8 light:2 cuirass:3 hussar:2 art:2'],
      ['westphalia','Gebhard von Blucher','line:4 hussar:3 light:1 art:1'],
      ['silesia','Friedrich Hohenlohe','line:5 light:1 hussar:1 art:1'],
      ['warsaw','', 'line:4 cuirass:1 hussar:1 art:1'],
      ['eastprussia','', 'line:3 hussar:1']
    ],
    russia: [
      ['lithuania','Mikhail Kutuzov','line:8 light:3 cuirass:2 hussar:2 art:3'],
      ['livonia','Levin Bennigsen','line:5 hussar:2 art:1'],
      ['belarus','Pyotr Bagration','line:6 light:2 hussar:2 art:2'],
      ['kiev','Mikhail Barclay de Tolly','line:5 hussar:2 art:1'],
      ['petersburg','', 'line:3 guard:1 art:1'],
      ['moscow','', 'line:3 hussar:1'],
      ['kherson','Matvei Platov','hussar:3 line:2 art:1']
    ],
    ottoman: [
      ['bulgaria','Grand Vizier Yusuf','line:8 hussar:4 art:2'],
      ['serbia','Hursid Pasha','line:4 hussar:2 art:1'],
      ['egypt','Ibrahim Pasha','line:3 hussar:2'],
      ['anatolia_e','', 'line:4 hussar:2'],
      ['constantinople','', 'line:4 hussar:1 art:1'],
      ['syria','', 'line:3 hussar:1']
    ],
    sweden: [['stockholm','Gustav Adolf','line:4 art:1'], ['finland','Johan Cronstedt','line:4 art:1'], ['gothenburg','', 'line:2']],
    denmark: [['copenhagen','Prince Christian','line:4 art:1'], ['jutland','Hans Bulow','line:3 hussar:1'], ['norway_s','', 'line:2']],
    naples: [['naples','Michele Pignatelli','line:5 hussar:1 art:1'], ['sicily','', 'line:2'], ['calabria','', 'line:2']],
    bavaria: [['bavaria','Carl von Wrede','line:7 light:2 hussar:2 art:2'], ['saxony','', 'line:4 hussar:1 art:1'], ['wurttemberg','', 'line:4 art:1']],
    minor: [['switzerland','','line:2'], ['papal','','line:2'], ['sardinia','','line:1'], ['morocco','','line:2 hussar:1'], ['algiers','','line:2 hussar:1'], ['tunis','','line:1'], ['tripoli','','line:1']]
  };
})();
