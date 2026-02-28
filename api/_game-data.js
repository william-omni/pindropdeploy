// api/game.js — Server-side game logic (Vercel serverless function)
// LOCATIONS, seed functions, and scoring are kept here so they are never
// exposed in the client HTML.

const LOCATIONS = [
  // ── EUROPE ──────────────────────────────────────────────
  ["Eiffel Tower, Paris",          "Europe's most-photographed iron lattice tower, built in 1889",                   48.8584,   2.2945, 2],

  ["Colosseum, Rome",              "Ancient amphitheater that once held 80,000 spectators",                          41.8902,  12.4922, 2],

  ["Sagrada Família, Barcelona",   "Gaudí's unfinished basilica, under construction since 1882",                     41.4036,   2.1744, 2],

  ["Acropolis, Athens",            "Ancient citadel containing the Parthenon, overlooking Athens",                   37.9715,  23.7267, 2],

  ["Stonehenge, England",          "Prehistoric ring of standing stones on Salisbury Plain",                         51.1789,  -1.8262, 2],

  ["Big Ben, London",              "Iconic clock tower at the north end of the Houses of Parliament",                51.5007,  -0.1246, 2],

  ["Hagia Sophia, Istanbul",       "6th-century cathedral turned mosque, a symbol of two great empires",             41.0086,  28.9802, 2],

  ["Neuschwanstein Castle",        "Fairy-tale Bavarian castle that inspired Disney's Sleeping Beauty",              47.5576,  10.7498],
  ["Santorini Caldera, Greece",    "Volcanic island famous for blue-domed churches and sunsets",                     36.3932,  25.4615,  12],
  ["Alhambra Palace, Granada",     "Stunning Moorish palace and fortress complex in southern Spain",                 37.1760,  -3.5881],
  ["Mont Saint-Michel, France",    "Tidal island commune topped by a medieval abbey off the Normandy coast",         48.6360,  -1.5114, 2],

  ["Dubrovnik Old City, Croatia",  "Walled medieval city on the Adriatic coast, known as the Pearl of the Adriatic", 42.6507,  18.0944, 2],

  ["Colmar, France",               "Picturesque Alsatian town of half-timbered houses on canals",                    48.0793,   7.3585],
  ["Hallstatt, Austria",           "Tiny lakeside village in the Austrian Alps, one of Europe's oldest towns",       47.5622,  13.6493],
  ["Cinque Terre, Italy",          "Five colorful clifftop fishing villages strung along the Ligurian coast",        44.1461,   9.6439,  10],
  ["Plitvice Lakes, Croatia",      "Cascading turquoise lakes and waterfalls in a UNESCO national park",             44.8654,  15.5820,  10],
  ["Meteora, Greece",              "Byzantine monasteries perched atop soaring sandstone rock pillars",              39.7217,  21.6306],
  ["Bruges, Belgium",              "Impeccably preserved medieval city crisscrossed by canals",                      51.2093,   3.2247],
  ["Ronda, Spain",                 "Dramatic clifftop city split by a 120-meter gorge in Andalusia",                 36.7464,  -5.1613],
  ["Amalfi Coast, Italy",          "Dramatic stretch of coastline with clifftop villages above the Tyrrhenian Sea",  40.6340,  14.6027,  15],
  ["Vatican City",                 "World's smallest country, home to St. Peter's Basilica and the Sistine Chapel", 41.9029,  12.4534, 2],

  ["Charles Bridge, Prague",       "14th-century Gothic bridge lined with Baroque statues over the Vltava River",   50.0865,  14.4114],
  ["Loch Ness, Scotland",          "Deep glacial loch in the Scottish Highlands, famously home to a mythical beast", 57.3229,  -4.4244,  18],
  ["Cappadocia, Turkey",           "Surreal landscape of fairy chimneys and cave dwellings in central Anatolia",    38.6431,  34.8289,  20],
  ["Trolltunga, Norway",           "Dramatic rock ledge jutting horizontally above a fjord in western Norway",       60.1241,   6.7398, 4],

  ["Fiordland, New Zealand",       "Remote fjordland of dramatic peaks, waterfalls and dark waters",                -45.4169, 167.7180],
  ["Pamukkale, Turkey",            "Natural terraces of mineral-rich thermal waters cascading down white travertine", 37.9199,  29.1202],
  ["Sintra, Portugal",             "Fairy-tale hilltop town of colorful palaces hidden in forested mountains",       38.7978,  -9.3876],
  ["Cliffs of Moher, Ireland",     "Dramatic sea cliffs rising 214m above the Atlantic on Ireland's west coast",    52.9715,  -9.4309,  10],
  ["Lake Bled, Slovenia",          "Alpine lake with an island church and medieval castle on a cliff above",         46.3683,  14.0938],

  // ── ASIA ────────────────────────────────────────────────
  ["Mount Fuji, Japan",            "Japan's highest peak, a near-perfect volcanic cone visible from Tokyo",          35.3606, 138.7274, 2],

  ["Taj Mahal, Agra",              "Ivory-white marble mausoleum on the south bank of the Yamuna River",            27.1751,  78.0421, 2],

  ["Angkor Wat, Cambodia",         "World's largest religious monument, ancient Khmer capital",                      13.4125, 103.8670, 2],

  ["Great Wall of China",          "Fortification spanning thousands of miles across northern China",                40.4319, 116.5704, 2],

  ["Halong Bay, Vietnam",          "Emerald waters studded with thousands of limestone karst islands",               20.9101, 107.1839,  20],
  ["Bagan, Myanmar",               "Ancient plain scattered with thousands of Buddhist temples and pagodas",         21.1717,  94.8585,  12],
  ["Petra, Jordan",                "Rose-red city half as old as time, carved into sandstone cliffs",               30.3285,  35.4444, 2],

  ["Burj Khalifa, Dubai",          "World's tallest building at 828 meters in the UAE",                             25.1972,  55.2744, 2],

  ["Borobudur, Indonesia",         "9th-century Mahayana Buddhist temple, the world's largest",                     -7.6079, 110.2038],
  ["Sigiriya, Sri Lanka",          "Ancient rock fortress rising 180m above the jungle with frescoed walls",          7.9570,  80.7603],
  ["Shwedagon Pagoda, Myanmar",    "98-meter gilded Buddhist stupa dominating the Yangon skyline",                  16.7986,  96.1497],
  ["Jiuzhaigou Valley, China",     "Remote valley of multi-colored lakes and waterfalls in Sichuan province",        33.2600, 103.9200,  12],
  ["Zhangjiajie, China",           "Towering sandstone pillar mountains that inspired Avatar's floating peaks",      29.1260, 110.4790,  15],
  ["Kyoto Bamboo Grove, Japan",    "Dense forest of towering bamboo stalks in the Arashiyama district",             35.0117, 135.6761],
  ["Uluru, Australia",             "Sacred sandstone monolith rising from Australia's Red Centre",                  -25.3444, 131.0369, 2],

  ["Dead Sea, Jordan",             "Earth's lowest point and saltiest body of water, where you float effortlessly",  31.5590,  35.4732,  20],
  ["Wadi Rum, Jordan",             "Vast desert landscape of rose-red sandstone mountains and valleys",              29.5797,  35.4229,  20],
  ["Maldives Atolls",              "Low-lying coral atolls scattered across the Indian Ocean",                        4.1755,  73.5093,  75],
  ["Phi Phi Islands, Thailand",    "Dramatic limestone cliffs rising from turquoise Andaman Sea waters",              7.7407,  98.7784,  12],
  ["Guilin Karst, China",          "Surreal landscape of limestone peaks rising from rice paddies and rivers",       24.8138, 110.4980,  15],

  // ── AFRICA & MIDDLE EAST ────────────────────────────────
  ["Great Pyramid of Giza",        "Last surviving wonder of the ancient world, built for Pharaoh Khufu",            29.9792,  31.1342, 2],

  ["Victoria Falls, Zambia",       "World's largest waterfall by combined width and height",                         -17.9244,  25.8567, 2],

  ["Mount Kilimanjaro, Tanzania",  "Africa's highest peak, a freestanding volcanic mountain capped in snow",          -3.0674,  37.3556, 2],

  ["Serengeti, Tanzania",          "Vast savanna ecosystem famous for the annual wildebeest migration",               -2.3333,  34.8333,  50],
  ["Sossusvlei, Namibia",          "Towering red sand dunes surrounding a stark white clay pan in the Namib Desert", -24.7272,  15.3445,  20],
  ["Sahara Desert, Algeria",       "World's largest hot desert, stretching across North Africa",                     23.4162,   5.0418,  75],
  ["Okavango Delta, Botswana",     "World's largest inland delta, a lush oasis in the middle of the Kalahari",       -19.2948,  22.9411,  40],
  ["Wadi Halfa, Sudan",            "Ancient town on the banks of the Nile near the Egyptian border",                 21.8006,  31.3503, 4],

  ["Mount Nyiragongo, DRC",        "Active stratovolcano with the world's largest lava lake in its crater",           -1.5216,  29.2497, 4],

  ["Lamu Old Town, Kenya",         "Swahili stone town and the oldest living settlement in East Africa",             -2.2696,  40.9020, 4],

  ["Djemaa el-Fna, Marrakech",     "Legendary square and marketplace at the heart of Marrakech's medina",           31.6258,  -7.9892],
  ["Timbuktu, Mali",               "Fabled Saharan city, once the world's most important center of Islamic learning", 16.7735,  -3.0074, 4],

  ["Danakil Depression, Ethiopia", "One of the hottest and most alien landscapes on Earth, with lava lakes and salt flats", 14.2417, 40.3100,  35],

  // ── AMERICAS ────────────────────────────────────────────
  ["Machu Picchu, Peru",           "Lost Inca citadel high in the Andes, rediscovered in 1911",                     -13.1631, -72.5450, 2],

  ["Grand Canyon, USA",            "Mile-deep gorge carved by the Colorado River over millions of years",            36.1069,-112.1129,  25],
  ["Iguazu Falls, Argentina",      "Spectacular waterfall system on the Argentine-Brazilian border",                 -25.6953, -54.4367, 2],

  ["Chichén Itzá, Mexico",         "Mayan pyramid dedicated to Kukulcan, built circa 600 AD",                       20.6843, -88.5678, 2],

  ["Statue of Liberty, New York",  "French gift to the US standing in New York Harbor since 1886",                  40.6892, -74.0445, 2],

  ["Golden Gate Bridge",           "Iconic suspension bridge spanning the entrance to San Francisco Bay",            37.8199,-122.4783, 2],

  ["Christ the Redeemer, Rio",     "Art Deco statue of Jesus atop Corcovado mountain overlooking Rio",              -22.9519, -43.2105, 2],

  ["Galápagos Islands, Ecuador",   "Pacific archipelago that inspired Darwin's theory of evolution",                  -0.9538, -90.9656,  60],
  ["Antelope Canyon, USA",         "Narrow slot canyon carved by flash floods in the Arizona sandstone",             36.8619,-111.3743, 4],

  ["Yellowstone, USA",             "World's first national park, sitting atop a supervolcano",                      44.4280,-110.5885,  35],
  ["Patagonia, Argentina",         "Remote wilderness of jagged peaks, glaciers and vast steppe at the end of the world", -50.9423, -73.4068,  75],
  ["Amazon River Delta, Brazil",   "Where the world's largest river meets the Atlantic in a vast maze of channels",   0.1500, -50.0000,  60],
  ["Tikal, Guatemala",             "Ancient Mayan city rising above the jungle canopy, abandoned for a thousand years", 17.2220, -89.6237],
  ["Salar de Uyuni, Bolivia",      "World's largest salt flat, a mirror-like expanse at 3,600m altitude",           -20.1338, -67.4891,  40],
  ["Easter Island, Chile",         "Remote Pacific island famous for its 900 monolithic Moai statues",              -27.1127,-109.3497, 2],

  ["Niagara Falls, Canada",        "Twin waterfalls on the US-Canada border drawing millions of visitors yearly",    43.0896, -79.0849, 2],

  ["Monument Valley, USA",         "Iconic sandstone buttes rising from the Colorado Plateau on Navajo land",        36.9980,-110.0985,  15],
  ["Torres del Paine, Chile",      "Dramatic granite towers soaring above glaciers and turquoise lakes in Patagonia",-50.9423, -72.9956,  20],
  ["Havana Old City, Cuba",        "Colorful colonial architecture and vintage cars in Cuba's historic capital",      23.1360, -82.3590],
  ["Cartagena, Colombia",          "Walled colonial city on the Caribbean coast with brightly painted buildings",    10.3910, -75.4794],

  // ── OCEANIA & POLAR ─────────────────────────────────────
  ["Sydney Opera House",           "Sail-shaped performing arts center on Sydney Harbour",                           -33.8568, 151.2153, 2],

  ["Great Barrier Reef, Australia","World's largest coral reef system, visible from space",                          -18.2871, 147.6992,  75],
  ["Milford Sound, New Zealand",   "Fiord of sheer cliffs, waterfalls and wildlife in Fiordland National Park",     -44.6414, 167.8974],
  ["Waitomo Glowworm Caves, NZ",   "Limestone caves illuminated by thousands of bioluminescent glowworms",          -38.2608, 175.1038, 4],

  ["Bora Bora, French Polynesia",  "Volcanic island ringed by turquoise lagoon and overwater bungalows",            -16.5004,-151.7415],
  ["Antarcic Peninsula",           "Icy wilderness of glaciers, penguins and icebergs at the bottom of the world",  -63.4000, -57.0000,  75],
  ["Rotorua, New Zealand",         "Geothermal city of bubbling mud pools, geysers and Māori culture",             -38.1368, 176.2497],
  ["Kakadu, Australia",            "Ancient Aboriginal land of rock art, wetlands and dramatic escarpments",         -12.6767, 132.8851,  40],
  ["Palau, Micronesia",            "Remote Pacific archipelago of pristine reefs and jellyfish lakes",                7.5150, 134.5825,  25],

  // ── MORE EUROPE ─────────────────────────────────────────
  ["Svalbard, Norway",             "Arctic archipelago halfway between Norway and the North Pole, land of polar bears",  78.2232,  15.6267,  40],
  ["Pompeii, Italy",               "Roman city frozen in time by the eruption of Vesuvius in 79 AD",                    40.7462,  14.4989],
  ["Dolomites, Italy",             "Jagged pale limestone peaks forming one of the world's most dramatic mountain ranges", 46.4102,  11.8440,  25],
  ["Whitby, England",              "Clifftop ruined abbey and fishing town that inspired Bram Stoker's Dracula",          54.4858,  -0.6206],
  ["Gorëme, Turkey",               "Village in the heart of Cappadocia surrounded by cone-shaped fairy chimneys",        38.6431,  34.8289],
  ["Faroe Islands",                "Remote North Atlantic archipelago of dramatic cliffs, puffins and waterfalls",        62.0000,  -6.7900,  25],
  ["Bioluminescent Bay, Menorca",  "Magical sea cave where the water glows electric blue at night",                      39.9063,   4.0600, 4],

  ["Delphi, Greece",               "Ancient sanctuary of Apollo perched on the slopes of Mount Parnassus",               38.4824,  22.5010],
  ["Lake Como, Italy",             "Elegant glacial lake ringed by villas and the foothills of the Alps",                46.0160,   9.2570,  15],
  ["Kirkjufell, Iceland",          "Arrow-shaped mountain beside a waterfall, Iceland's most photographed peak",         64.9280, -23.3070],
  ["Skógafoss, Iceland",           "Massive curtain waterfall on Iceland's south coast where rainbows appear daily",     63.5322, -19.5133],
  ["Blue Lagoon, Iceland",         "Geothermal spa of milky blue water in a lava field on the Reykjanes Peninsula",     63.8804, -22.4495],
  ["Lavaux Vineyards, Switzerland","UNESCO terraced vineyards cascading down to Lake Geneva beneath the Alps",           46.4900,   6.7600, 4],

  ["Rila Monastery, Bulgaria",     "Striking medieval monastery hidden in a forested mountain valley",                   42.1337,  23.3407, 4],

  ["Bran Castle, Romania",         "Hilltop medieval fortress associated with the legend of Dracula in Transylvania",    45.5152,  25.3673, 4],

  ["Mostar Bridge, Bosnia",        "Elegant 16th-century Ottoman stone bridge spanning the Neretva River",               43.3363,  17.8157, 4],

  ["Kotor, Montenegro",            "Walled medieval town tucked into a dramatic bay on the Adriatic",                   42.4247,  18.7712],
  ["Piazza San Marco, Venice",     "Grand Byzantine basilica and campanile at the ceremonial heart of Venice",           45.4341,  12.3388],
  ["Gdańsk, Poland",               "Hanseatic port city of colorful guild houses on the Baltic Sea",                    54.3520,  18.6466],
  ["Český Krumlov, Czechia",       "Perfectly preserved medieval town wrapped in a bend of the Vltava River",           48.8127,  14.3175],

  // ── MORE ASIA ────────────────────────────────────────────
  ["Varanasi Ghats, India",        "Ancient city on the Ganges, the world's holiest Hindu site",                        25.3176,  83.0062, 2],

  ["Hampi, India",                 "Ruins of the mighty Vijayanagara Empire scattered across a boulder-strewn landscape", 15.3350,  76.4600, 4],

  ["Ellora Caves, India",          "Rock-cut cave temples representing Buddhism, Hinduism and Jainism",                  20.0269,  75.1780, 4],

  ["Ha Giang Loop, Vietnam",       "Breathtaking mountain passes and rice terraces in Vietnam's far north",              23.2080, 104.9800,  20],
  ["Batu Caves, Malaysia",         "Limestone hill with a series of caves and cave temples near Kuala Lumpur",            3.2379, 101.6840],
  ["Preah Vihear, Cambodia",       "Stunning Khmer temple perched on a cliff at the edge of the Dangrek escarpment",    14.3914, 104.6786, 4],

  ["Kinkaku-ji, Kyoto",            "Golden Pavilion Zen temple reflected in a still pond, Japan's most visited site",   35.0394, 135.7292, 2],

  ["Miyajima Island, Japan",       "Sacred island where a torii gate appears to float on the sea at high tide",         34.2957, 132.3192],
  ["Hitachi Seaside Park, Japan",  "Fields of nemophila flowers turning hillsides vivid blue every spring",              36.4031, 140.6060, 4],

  ["Zhangye Danxia, China",        "Layered mineral deposits creating a rainbow of striped rock formations",             38.9300, 100.9200,  12],
  ["Hsipaw, Myanmar",              "Quiet Shan town surrounded by tea plantations and tribal villages",                  22.6200,  97.3000, 5],

  ["Nubra Valley, India",          "High-altitude cold desert valley with sand dunes between Himalayan ranges",          34.6500,  77.5500,  20],
  ["Tian Shan, Kazakhstan",        "Vast snowy mountain range stretching across Central Asia",                           42.0000,  78.0000,  75],
  ["Samarkand, Uzbekistan",        "Silk Road city of turquoise-domed mosques and madrasas in Central Asia",             39.6270,  66.9750],
  ["Paro Taktsang, Bhutan",        "Tiger's Nest monastery clinging to a cliff 900m above the Paro Valley",             27.4914,  89.3634, 4],

  ["Coron Island, Philippines",    "Limestone karst island with crystal-clear lagoons and World War II wrecks",          11.9987, 120.2046, 4],

  ["Chocolate Hills, Philippines", "Over 1,200 perfectly conical hills that turn brown in the dry season",              9.8000, 124.1667, 4],

  ["Mergui Archipelago, Myanmar",  "Remote chain of 800 islands in the Andaman Sea, barely touched by tourism",         12.4000,  98.2000,  50],
  ["Wadi Draa, Morocco",           "Long river valley of palm oases and kasbahs cutting through the Sahara",            29.0000,  -6.5000,  30],
  ["Al-Ula, Saudi Arabia",         "Ancient Nabataean city of monumental rock tombs in a dramatic desert canyon",       26.6167,  37.9167, 4],

  ["Socotra Island, Yemen",        "Remote island with alien-looking dragon blood trees found nowhere else on Earth",   12.4634,  53.8237, 4],


  // ── MORE AFRICA ──────────────────────────────────────────
  ["Bwindi Forest, Uganda",        "Impenetrable forest reserve home to nearly half the world's mountain gorillas",      -1.0636,  29.6636,  15],
  ["Tsingy de Bemaraha, Madagascar","Forest of razor-sharp limestone pinnacles, a UNESCO natural wonder",               -18.7500,  44.7500,  20],
  ["Omo Valley, Ethiopia",         "Remote valley where ancient tribal cultures have remained largely unchanged",          5.5000,  36.0000,  30],
  ["Saharan Tuareg Camps, Niger",  "Salt caravans and nomadic Tuareg camps deep in the Sahara",                         16.0000,   8.0000,  75],
  ["Bazaruto Archipelago, Mozambique","Pristine coral islands with dugongs, manta rays and dhow sailboats",             -21.6000,  35.4667,  25],
  ["Simien Mountains, Ethiopia",   "Dramatic highlands plateau with vertical escarpments and gelada baboons",            13.2350,  38.0640,  25],
  ["Rwenzori Mountains, Uganda",   "Glaciated equatorial Mountains of the Moon straddling the DRC-Uganda border",        0.3833,  29.9000,  25],
  ["Fish River Canyon, Namibia",   "Second largest canyon in the world, carved over 500 million years",                 -27.6740,  17.5757,  20],
  ["Zanzibar Stone Town, Tanzania","UNESCO Swahili trading port of labyrinthine alleys, spices and carved doors",       -6.1622,  39.1921],
  ["Ngorongoro Crater, Tanzania",  "Vast volcanic caldera sheltering the world's densest concentration of wildlife",     -3.1667,  35.5833,  15],
  ["Dakar, Senegal",               "Westernmost point of continental Africa on a wind-swept Atlantic peninsula",         14.7167, -17.4677],
  ["Chefchaouen, Morocco",         "The Blue Pearl — a mountain town where every wall is painted in shades of blue",    35.1688,  -5.2636, 2],


  // ── MORE AMERICAS ────────────────────────────────────────
  ["Bryce Canyon, USA",            "Natural amphitheater of crimson hoodoos and spires in Utah",                        37.5930,-112.1871, 3],

  ["Banff, Canada",                "Turquoise glacial lakes and Rocky Mountain peaks in Canada's oldest national park",  51.4968,-115.9281],
  ["Guanajuato, Mexico",           "Colonial city of colorful houses tumbling down hillsides in central Mexico",         21.0190,-101.2574],
  ["Carnaval, Rio de Janeiro",     "Sambadrome where samba schools parade through in an explosion of color and rhythm", -22.9000, -43.1956],
  ["Atacama Desert, Chile",        "World's driest non-polar desert of salt flats, geysers and alien landscapes",       -23.8634, -69.0742,  60],
  ["Oaxaca, Mexico",               "Colonial city known for Zapotec ruins, mezcal and one of Mexico's richest cuisines", 17.0732, -96.7266],
  ["Corcovado, Costa Rica",        "Incredibly biodiverse national park on the Osa Peninsula, a global hotspot",         8.5417, -83.5920, 4],

  ["Pantanal, Brazil",             "World's largest tropical wetland, the best place on Earth to see jaguars",          -17.0000, -57.0000,  75],
  ["Quebrada de Humahuaca, Argentina","Colourful gorge of multicoloured hills and pre-Columbian ruins in the Andes",   -23.2061, -65.3464,  25],
  ["Tayrona, Colombia",            "Lush national park where the Andes meet white-sand beaches on the Caribbean",       11.3204, -73.9192,  15],
  ["Lake Titicaca, Peru",          "World's highest navigable lake straddling the Peru-Bolivia border",                 -15.8402, -69.3361,  60],
  ["Canaima, Venezuela",           "Tepui plateau landscape where Angel Falls — world's highest waterfall — plunges",    5.9430, -62.8475,  25],
  ["Choquequirao, Peru",           "Remote Inca citadel perched on a ridge, larger than Machu Picchu and rarely visited", -13.5332, -72.8506, 5],

  ["Florianópolis, Brazil",        "Island city with 42 beaches and a lively surf culture off Brazil's southern coast", -27.5954, -48.5480],
  ["Chiloé Island, Chile",         "Mythical island of wooden churches, palafito stilt houses and misty forests",       -42.6000, -73.9000,  30],
  ["Dominica",                     "Volcanic island of boiling lakes, rainforest and whale-watching in the Caribbean",   15.4150, -61.3710, 4],

  ["Copper Canyon, Mexico",        "System of canyons deeper and wider than the Grand Canyon in the Sierra Madre",      27.5500,-107.7500,  30],

  // ── MORE OCEANIA ─────────────────────────────────────────
  ["Whitsunday Islands, Australia","74 tropical islands inside the Great Barrier Reef with pure white silica beaches",  -20.2734, 148.8930,  25],
  ["Karijini, Australia",          "Ancient gorges of striped rock plunging into crystal pools in the Pilbara",         -22.3350, 118.3020,  20],
  ["Vanuatu Volcanoes",            "Pacific island nation where you can hike to the rim of an active lava lake",        -15.3767, 166.9592,  25],
  ["Lord Howe Island, Australia",  "Remote crescent island of coral reefs and 300m basalt sea stacks in the Tasman Sea", -31.5540, 159.0820, 4],

  ["Aoraki/Mt Cook, New Zealand",  "New Zealand's highest peak, rising above a valley of glaciers",                    -43.5950, 170.1418],
  ["Raja Ampat, Indonesia",        "Remote archipelago with the highest marine biodiversity on Earth",                  -0.2333, 130.5167,  40],
  ["Komodo Island, Indonesia",     "Home of the Komodo dragon, the world's largest living lizard",                      -8.5500, 119.4500],
  ["Tonga",                        "Polynesian kingdom of 170 islands where you can swim with humpback whales",        -21.1790,-175.1982,  40],
  ["Samoa",                        "Lush volcanic islands of To Sua ocean trenches and to-the-last-resort beaches",    -13.7590,-172.1046,  30],

  // ── UNIQUE & OFFBEAT ────────────────────────────────────
  ["Surtsey, Iceland",             "Volcanic island that erupted from the sea in 1963 — one of Earth's newest lands",   63.3000, -20.6000, 5],

  ["Tristan da Cunha",             "The world's most remote inhabited island, 2,800km from the nearest land",          -37.1052, -12.2777, 5],

  ["Oymyakon, Russia",             "The coldest permanently inhabited place on Earth in the Siberian taiga",            63.4608, 142.7858, 5],

  ["Dallol, Ethiopia",             "Hottest year-round inhabited place on Earth, a psychedelic hydrothermal landscape",  14.2417,  40.2983, 4],

  ["Nauru",                        "World's smallest island nation and third-smallest country by area",                  -0.5228, 166.9315, 4],

  ["Hashima Island, Japan",        "Abandoned concrete island fortress that was once the world's most densely populated place", 32.6278, 129.7381, 4],

  ["Chernobyl, Ukraine",           "Exclusion zone around the 1986 nuclear disaster, now a haunting ghost landscape",   51.2731,  30.2219, 3],

  ["Salar de Atacama, Chile",      "Lithium-rich salt flat ringed by volcanoes, home to flamingo colonies",             -23.4935, -68.2500,  30],
  ["Skeleton Coast, Namibia",      "Foggy Atlantic coast of shipwrecks, seal colonies and desert-adapted lions",        -19.0000,  12.5000,  60],
  ["Kamchatka Peninsula, Russia",  "Remote volcanic peninsula of geysers, brown bears and undisturbed wilderness",      54.0000, 159.0000,  60],
  ["Svalbard Global Seed Vault",   "Doomsday vault buried in permafrost preserving the world's crop diversity",         78.2380,  15.4910, 4],

  ["Inaccessible Island",          "Uninhabited volcanic island — one of the most remote places on the planet",        -37.3120, -12.6780, 5],


  // ── MAJOR WORLD CITIES ──────────────────────────────────
  // Asia — East & Southeast
  ["Tokyo, Japan",                 "World's most populous metropolitan area, a neon-lit megacity on Tokyo Bay",              35.6762, 139.6503, 1],

  ["Seoul, South Korea",           "Ultra-modern capital of South Korea, home to K-pop, palaces and street food",            37.5665, 126.9780, 1],

  ["Shanghai, China",              "China's financial hub, famous for its futuristic skyline along the Huangpu River",       31.2304, 121.4737, 1],

  ["Beijing, China",               "China's ancient capital, home to the Forbidden City and the Great Wall",                 39.9042, 116.4074, 1],

  ["Osaka, Japan",                 "Japan's street-food capital, known for takoyaki, okonomiyaki and vibrant nightlife",     34.6937, 135.5023, 1],

  ["Guangzhou, China",             "Southern China's trade hub and gateway city, known as the City of Flowers",              23.1291, 113.2644, 1],

  ["Shenzhen, China",              "China's tech boomtown, transformed from fishing village to megacity in one generation",  22.5431, 114.0579, 1],

  ["Chongqing, China",             "Vast inland Chinese megacity built on misty hills where the Yangtze meets the Jialing", 29.4316, 106.9123, 1],

  ["Tianjin, China",               "Major port city near Beijing, blending European colonial architecture with Chinese culture", 39.1042, 117.1442, 1],

  ["Wuhan, China",                 "Sprawling central Chinese city at the confluence of the Yangtze and Han rivers",         30.5928, 114.3055, 1],

  ["Chengdu, China",               "Giant panda capital of China, famous for spicy Sichuan cuisine and laid-back teahouse culture", 30.5728, 104.0668, 1],

  ["Xi'an, China",                 "Ancient Silk Road terminus, home to the Terracotta Army and Tang Dynasty city walls",    34.3416, 108.9398, 1],

  ["Hong Kong",                    "Compact city of sky-high towers, dim sum and Victoria Harbour, a gateway between East and West", 22.3193, 114.1694, 1],

  ["Taipei, Taiwan",               "Vibrant city famous for its night markets, bubble tea and Taipei 101 skyscraper",        25.0330, 121.5654, 1],

  ["Bangkok, Thailand",            "Thailand's 'City of Angels', a sensory-overload of golden temples, floating markets and street food", 13.7563, 100.5018, 1],

  ["Ho Chi Minh City, Vietnam",    "Vietnam's largest city, buzzing with motorbikes, French colonial buildings and pho stalls", 10.8231, 106.6297, 1],

  ["Hanoi, Vietnam",               "Vietnam's charming capital, a city of ancient streets, lakes and Vietnamese coffee culture", 21.0278, 105.8342, 1],

  ["Jakarta, Indonesia",           "One of the world's most populated cities, sprawling across Java's northwest coast",      -6.2088, 106.8456, 1],

  ["Manila, Philippines",          "Southeast Asia's densely packed capital, a city of contrasts on Manila Bay",             14.5995, 120.9842, 1],

  ["Singapore",                    "The Lion City — a tiny island nation of gleaming towers, hawker centres and lush gardens", 1.3521, 103.8198, 1],

  ["Kuala Lumpur, Malaysia",       "Malaysia's modern capital, dominated by the twin Petronas Towers above a street-food labyrinth", 3.1390, 101.6869, 1],

  ["Yangon, Myanmar",              "Myanmar's former capital, a city of golden pagodas and faded colonial grandeur",         16.8661,  96.1951, 1],


  // Asia — South
  ["Delhi, India",                 "India's vast capital, spanning millennia from Mughal monuments to modern metro lines",   28.7041,  77.1025, 1],

  ["Mumbai, India",                "India's city of dreams, home to Bollywood, the Gateway of India and teeming street life", 19.0760,  72.8777, 1],

  ["Kolkata, India",               "City of Joy — the cultural capital of India, built by the British on the Hooghly River", 22.5726,  88.3639, 1],

  ["Bangalore, India",             "India's Silicon Valley, a garden city turned global tech hub in the Deccan Plateau",    12.9716,  77.5946, 1],

  ["Hyderabad, India",             "City of Nizams, pearls and biryani, now a major IT and pharmaceutical hub",              17.3850,  78.4867, 1],

  ["Ahmedabad, India",             "India's fifth-largest city, a textile and commercial powerhouse on the Sabarmati River", 23.0225,  72.5714, 1],

  ["Chennai, India",               "Gateway to South India, a coastal metropolis of temples, classical music and filter coffee", 13.0827,  80.2707, 1],

  ["Dhaka, Bangladesh",            "One of the world's most densely populated capitals, the Rickshaw Capital of the World",  23.8103,  90.4125, 1],

  ["Karachi, Pakistan",            "Pakistan's largest city and economic engine, a port megacity on the Arabian Sea",        24.8607,  67.0011, 1],

  ["Lahore, Pakistan",             "Pakistan's cultural heart, famed for Mughal gardens, the Lahore Fort and street food",   31.5204,  74.3587, 1],

  ["Kabul, Afghanistan",           "Afghanistan's mountain capital, one of the world's fastest-growing cities",              34.5553,  69.2075, 1],


  // Asia — West/Central
  ["Tehran, Iran",                 "Iran's sprawling capital, set against the Alborz mountains at the edge of a vast plateau", 35.6892,  51.3890, 1],

  ["Baghdad, Iraq",                "Cradle of Islamic civilization, built as a round city by Abbasid caliphs on the Tigris", 33.3152,  44.3661, 1],

  ["Riyadh, Saudi Arabia",         "Saudi Arabia's ultra-modern capital, a forest of skyscrapers rising from the Nejd plateau", 24.7136,  46.6753, 1],


  // Africa
  ["Cairo, Egypt",                 "Africa's largest city, spread along the Nile with the Great Pyramid visible from its suburbs", 30.0444,  31.2357, 1],

  ["Lagos, Nigeria",               "West Africa's megacity, Nigeria's economic powerhouse and cultural capital on the Bight of Benin", 6.5244,   3.3792, 1],

  ["Kinshasa, DRC",                "Africa's second-largest city, a vast, chaotic capital on the Congo River opposite Brazzaville", -4.4419,  15.2663, 1],

  ["Khartoum, Sudan",              "Sudan's capital where the Blue and White Nile converge in a Y-shaped confluence",        15.5007,  32.5599, 1],

  ["Luanda, Angola",               "Angola's oil-rich capital, a fast-growing city on the Atlantic with Portuguese colonial roots", -8.8390,  13.2894, 1],

  ["Dar es Salaam, Tanzania",      "Tanzania's largest city and main port, a busy commercial hub on the Indian Ocean coast", -6.7924,  39.2083, 1],

  ["Nairobi, Kenya",               "East Africa's hub city, where safari and skyscraper coexist within the same horizon",    -1.2921,  36.8219, 1],

  ["Addis Ababa, Ethiopia",        "Ethiopia's mile-high capital, the diplomatic capital of Africa and seat of the African Union", 9.0250,  38.7469, 1],

  ["Abidjan, Ivory Coast",         "West Africa's most cosmopolitan city, the commercial giant of the Ivory Coast",           5.3600,  -4.0083, 1],

  ["Accra, Ghana",                 "Ghana's welcoming capital on the Gulf of Guinea, a beacon of stability in West Africa",   5.6037,  -0.1870, 1],

  ["Casablanca, Morocco",          "Morocco's economic powerhouse, a sprawling port city immortalized in a 1942 film",       33.5731,  -7.5898, 1],

  ["Alexandria, Egypt",            "Egypt's Mediterranean jewel, founded by Alexander the Great and home to the ancient library", 31.2001,  29.9187, 1],

  ["Johannesburg, South Africa",   "South Africa's City of Gold, built on the wealth of the Witwatersrand goldfields",      -26.2041,  28.0473, 1],

  ["Cape Town, South Africa",      "The Mother City, dramatically set between Table Mountain and the Cape Peninsula",        -33.9249,  18.4241, 1],


  // Europe
  ["Moscow, Russia",               "Russia's capital, home to the Kremlin, Red Square and St. Basil's Cathedral",           55.7558,  37.6176, 1],

  ["Saint Petersburg, Russia",     "Russia's Venice, Peter the Great's baroque waterfront capital on the Baltic",           59.9311,  30.3609, 1],

  ["Madrid, Spain",                "Spain's sunlit capital, a city of world-class art, tapas bars and Real Madrid",          40.4168,  -3.7038, 1],

  ["Berlin, Germany",              "Germany's reunified capital, a city that rebuilt itself as a global hub of culture and creativity", 52.5200,  13.4050, 1],

  ["Barcelona, Spain",             "Gaudí's city on the Mediterranean, a carnival of modernist architecture and beach culture", 41.3851,   2.1734, 1],

  ["Vienna, Austria",              "The City of Music, Habsburg capital of grand palaces, coffee houses and the Vienna Philharmonic", 48.2082,  16.3738, 1],

  ["Warsaw, Poland",               "Poland's resilient capital, almost entirely rebuilt after WWII, now a buzzing modern city", 52.2297,  21.0122, 1],

  ["Kyiv, Ukraine",                "Ukraine's thousand-year-old capital, the spiritual birthplace of Eastern Slavic civilization", 50.4501,  30.5234, 1],

  ["Athens, Greece",               "The cradle of Western civilization, where the Parthenon watches over 5,000 years of history", 37.9838,  23.7275, 1],

  ["Amsterdam, Netherlands",       "The Venice of the North, a city of golden-age canals, bicycles and world-class museums", 52.3676,   4.9041, 1],

  ["Bucharest, Romania",           "Romania's grand capital, dubbed the Little Paris, with its Belle Époque boulevards",     44.4268,  26.1025, 1],


  // Americas
  ["São Paulo, Brazil",            "South America's largest city, a concrete jungle of 22 million people and incredible restaurants", -23.5505, -46.6333, 1],

  ["Mexico City, Mexico",          "North America's oldest major city, an Aztec capital rebuilt by Spain, now home to 22 million", 19.4326,  -99.1332, 1],

  ["Buenos Aires, Argentina",      "The Paris of South America, a city of tango, steak and European-style boulevards",       -34.6037, -58.3816, 1],

  ["Lima, Peru",                   "Peru's coastal capital, built on the edge of the Pacific desert, gateway to Machu Picchu", -12.0464, -77.0428, 1],

  ["Bogotá, Colombia",             "Colombia's high-altitude capital, set on a cool Andean plateau at 2,600 metres elevation", 4.7110,  -74.0721, 1],

  ["Santiago, Chile",              "Chile's Andean capital, a modern city with the snow-capped Andes as its backdrop",       -33.4489, -70.6693, 1],

  ["Los Angeles, USA",             "City of Angels, the entertainment capital of the world, sprawling beside the Pacific",   34.0522, -118.2437, 1],

  ["Chicago, USA",                 "The Windy City, an architectural jewel on the southwestern shore of Lake Michigan",      41.8781,  -87.6298, 1],

  ["Toronto, Canada",              "Canada's largest city, one of the world's most multicultural urban centres on Lake Ontario", 43.6532,  -79.3832, 1],

  ["Guadalajara, Mexico",          "Mexico's second city and birthplace of mariachi, tequila and the Mexican hat dance",     20.6597, -103.3496, 1],

  ["Medellín, Colombia",           "Colombia's City of Eternal Spring, transformed from crisis to model of urban innovation", 6.2442,  -75.5812, 1],


  // Oceania
  ["Melbourne, Australia",         "Australia's cultural capital, a liveable city of laneways, coffee culture and footy",   -37.8136, 144.9631, 1],

];

const ROUNDS_PER_GAME = 5;

// ── Deterministic LCG RNG ──────────────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function getDailySeed(dateStr) {
  // Use client-supplied local date (YYYY-MM-DD) so daily reset follows the
  // user's timezone, not the server's UTC clock.
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return y * 10000 + m * 100 + d;
  }
  // Fallback: server UTC date
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function getDayNumber(dateStr) {
  // 2025-01-01 00:00:00 UTC
  const epoch = 1740614400000; // 2026-02-27 00:00:00 UTC — App launch day
  let nowMs;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    nowMs = Date.UTC(y, m - 1, d);
  } else {
    nowMs = Date.now();
  }
  return Math.floor((nowMs - epoch) / 86400000) + 1;
}

// Difficulty: 1=very easy, 2=easy famous, 3=medium (default), 4=hard, 5=very hard
function getLocDifficulty(loc) {
  return loc[5] !== undefined ? loc[5] : 3;
}

function getTodayLocations(dateStr) {
  const rand = seededRand(getDailySeed(dateStr));
  const pool = [...Array(LOCATIONS.length).keys()];
  const chosen = [];
  for (let i = 0; i < ROUNDS_PER_GAME; i++) {
    const idx = Math.floor(rand() * pool.length);
    chosen.push(LOCATIONS[pool.splice(idx, 1)[0]]);
  }
  return chosen.sort((a, b) => getLocDifficulty(a) - getLocDifficulty(b));
}

// ── Scoring ────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function scoreFromDistance(km, perfectRadius = 5) {
  const d = Math.max(0, km - perfectRadius);
  if (d <= 0)     return 200;
  if (d <= 25)    return Math.round(200 - (d / 25) * 10);
  if (d <= 500)   return Math.round(190 - ((d - 25) / 475) * 110);
  if (d <= 2000)  return Math.round(80  - ((d - 500) / 1500) * 60);
  if (d <= 10000) return Math.round(20  - ((d - 2000) / 8000) * 20);
  return 0;
}

// ── Vercel Handler ────────────────────────────────────────────────────────

module.exports = {
  LOCATIONS,
  ROUNDS_PER_GAME,
  seededRand,
  getDailySeed,
  getDayNumber,
  getLocDifficulty,
  getTodayLocations,
  haversineKm,
  scoreFromDistance,
};
