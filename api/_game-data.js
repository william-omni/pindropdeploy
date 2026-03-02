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
  ["Phi Phi Islands, Thailand",    "Dramatic limestone cliffs rising from turquoise Andaman Sea waters",              7.7407,  98.7784,  12],
  ["Guilin Karst, China",          "Surreal landscape of limestone peaks rising from rice paddies and rivers",       24.8138, 110.4980,  15],

  // ── AFRICA & MIDDLE EAST ────────────────────────────────
  ["Great Pyramid of Giza",        "Last surviving wonder of the ancient world, built for Pharaoh Khufu",            29.9792,  31.1342, 2],

  ["Victoria Falls, Zambia",       "World's largest waterfall by combined width and height",                         -17.9244,  25.8567, 2],

  ["Mount Kilimanjaro, Tanzania",  "Africa's highest peak, a freestanding volcanic mountain capped in snow",          -3.0674,  37.3556, 2],

  ["Sossusvlei, Namibia",          "Towering red sand dunes surrounding a stark white clay pan in the Namib Desert", -24.7272,  15.3445,  20],
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

  ["Milford Sound, New Zealand",   "Fiord of sheer cliffs, waterfalls and wildlife in Fiordland National Park",     -44.6414, 167.8974],
  ["Waitomo Glowworm Caves, NZ",   "Limestone caves illuminated by thousands of bioluminescent glowworms",          -38.2608, 175.1038, 4],

  ["Bora Bora, French Polynesia",  "Volcanic island ringed by turquoise lagoon and overwater bungalows",            -16.5004,-151.7415],
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
  ["Oaxaca, Mexico",               "Colonial city known for Zapotec ruins, mezcal and one of Mexico's richest cuisines", 17.0732, -96.7266],
  ["Corcovado, Costa Rica",        "Incredibly biodiverse national park on the Osa Peninsula, a global hotspot",         8.5417, -83.5920, 4],

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
  ["Svalbard Global Seed Vault",   "Doomsday vault buried in permafrost preserving the world's crop diversity",         78.2380,  15.4910, 4],

  ["Inaccessible Island",          "Uninhabited volcanic island — one of the most remote places on the planet",        -37.3120, -12.6780, 5],


  // ── MAJOR WORLD CITIES ──────────────────────────────────
  // Asia — East & Southeast
  ["Tokyo, Japan",                 "World's most populous metropolitan area, a neon-lit megacity on Tokyo Bay",              35.6762, 139.6503, 1],

  ["Seoul, South Korea",           "Ultra-modern capital of South Korea, home to K-pop, palaces and street food",            37.5665, 126.9780, 1],

  ["Shanghai, China",              "China's financial hub, famous for its futuristic skyline along the Huangpu River",       31.2304, 121.4737, 1],

  ["Beijing, China",               "China's ancient capital, home to the Forbidden City and the Great Wall",                 39.9042, 116.4074, 1],

  ["Osaka, Japan",                 "Japan's street-food capital, known for takoyaki, okonomiyaki and vibrant nightlife",     34.6937, 135.5023, 1],

  ["Guangzhou, China",             "Southern China's trade hub and gateway city, known as the City of Flowers",              23.1291, 113.2644, 3],

  ["Shenzhen, China",              "China's tech boomtown, transformed from fishing village to megacity in one generation",  22.5431, 114.0579, 3],

  ["Chongqing, China",             "Vast inland Chinese megacity built on misty hills where the Yangtze meets the Jialing", 29.4316, 106.9123, 3],

  ["Tianjin, China",               "Major port city near Beijing, blending European colonial architecture with Chinese culture", 39.1042, 117.1442, 3],

  ["Wuhan, China",                 "Sprawling central Chinese city at the confluence of the Yangtze and Han rivers",         30.5928, 114.3055, 3],

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

  ["Hyderabad, India",             "City of Nizams, pearls and biryani, now a major IT and pharmaceutical hub",              17.3850,  78.4867, 3],

  ["Ahmedabad, India",             "India's fifth-largest city, a textile and commercial powerhouse on the Sabarmati River", 23.0225,  72.5714, 3],

  ["Chennai, India",               "Gateway to South India, a coastal metropolis of temples, classical music and filter coffee", 13.0827,  80.2707, 3],

  ["Dhaka, Bangladesh",            "One of the world's most densely populated capitals, the Rickshaw Capital of the World",  23.8103,  90.4125, 3],

  ["Karachi, Pakistan",            "Pakistan's largest city and economic engine, a port megacity on the Arabian Sea",        24.8607,  67.0011, 1],

  ["Lahore, Pakistan",             "Pakistan's cultural heart, famed for Mughal gardens, the Lahore Fort and street food",   31.5204,  74.3587, 3],

  ["Kabul, Afghanistan",           "Afghanistan's mountain capital, one of the world's fastest-growing cities",              34.5553,  69.2075, 3],


  // Asia — West/Central
  ["Tehran, Iran",                 "Iran's sprawling capital, set against the Alborz mountains at the edge of a vast plateau", 35.6892,  51.3890, 1],

  ["Baghdad, Iraq",                "Cradle of Islamic civilization, built as a round city by Abbasid caliphs on the Tigris", 33.3152,  44.3661, 3],

  ["Riyadh, Saudi Arabia",         "Saudi Arabia's ultra-modern capital, a forest of skyscrapers rising from the Nejd plateau", 24.7136,  46.6753, 1],


  // Africa
  ["Cairo, Egypt",                 "Africa's largest city, spread along the Nile with the Great Pyramid visible from its suburbs", 30.0444,  31.2357, 1],

  ["Lagos, Nigeria",               "West Africa's megacity, Nigeria's economic powerhouse and cultural capital on the Bight of Benin", 6.5244,   3.3792, 1],

  ["Kinshasa, DRC",                "Africa's second-largest city, a vast, chaotic capital on the Congo River opposite Brazzaville", -4.4419,  15.2663, 3],

  ["Khartoum, Sudan",              "Sudan's capital where the Blue and White Nile converge in a Y-shaped confluence",        15.5007,  32.5599, 3],

  ["Luanda, Angola",               "Angola's oil-rich capital, a fast-growing city on the Atlantic with Portuguese colonial roots", -8.8390,  13.2894, 3],

  ["Dar es Salaam, Tanzania",      "Tanzania's largest city and main port, a busy commercial hub on the Indian Ocean coast", -6.7924,  39.2083, 3],

  ["Nairobi, Kenya",               "East Africa's hub city, where safari and skyscraper coexist within the same horizon",    -1.2921,  36.8219, 1],

  ["Addis Ababa, Ethiopia",        "Ethiopia's mile-high capital, the diplomatic capital of Africa and seat of the African Union", 9.0250,  38.7469, 1],

  ["Abidjan, Ivory Coast",         "West Africa's most cosmopolitan city, the commercial giant of the Ivory Coast",           5.3600,  -4.0083, 3],

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


  // ── PREVIOUSLY MISSING ICONIC CITIES (D1) ───────────────────────────────
  ["Paris, France",                "The City of Light — Europe's most-visited capital, home to the Eiffel Tower and the Louvre",  48.8566,   2.3522, 1],

  ["London, UK",                   "The capital of the United Kingdom, a global hub of history, culture and finance on the Thames", 51.5074,  -0.1278, 1],

  ["New York, USA",                "The Big Apple — America's most iconic city, a vertical island metropolis on the Hudson River", 40.7128,  -74.0060, 1],

  ["Sydney, Australia",            "Australia's harbour city, where the Opera House sails meet the world's most beautiful natural bay", -33.8688, 151.2093, 1],

  ["Dubai, UAE",                   "City of superlatives rising from the Gulf desert — home to the world's tallest building",   25.2048,  55.2708, 1],

  ["Rome, Italy",                  "The Eternal City, built on seven hills with 3,000 years of history at every street corner", 41.9028,  12.4964, 1],

  ["Istanbul, Turkey",             "The city straddling two continents, bridging Europe and Asia across the Bosphorus Strait",  41.0082,  28.9784, 1],

  ["Rio de Janeiro, Brazil",       "Cidade Maravilhosa — city of carnival, samba and Christ the Redeemer above Guanabara Bay", -22.9068, -43.1729, 1],


  // ── NEW D2 LANDMARK ADDITIONS ────────────────────────────────────────────
  ["Mount Everest, Nepal",         "Earth's highest peak at 8,849 m, the ultimate challenge on the Nepal-Tibet border",       27.9881,  86.9250, 5],

  ["Leaning Tower of Pisa",        "Medieval marble bell tower celebrated worldwide for its dramatic unintended tilt",         43.7230,  10.3966, 2],

  ["Table Mountain, South Africa", "Iconic flat-topped mountain towering over Cape Town, one of the New 7 Wonders of Nature", -33.9628,  18.4098, 5],


  // ── NEW D4 ADDITIONS ─────────────────────────────────────────────────────
  ["Lofoten Islands, Norway",      "Dramatic Arctic archipelago of jagged peaks, colourful fishing villages and northern lights", 68.1596,  14.0100, 20],

  ["Geirangerfjord, Norway",       "UNESCO-listed serpentine fjord flanked by dramatic waterfalls and abandoned cliffside farms", 62.1000,   7.2000, 10],

  ["Mount Bromo, Indonesia",       "Active volcano rising from a vast ash caldera, its crater rim a pilgrimage at sunrise",   -7.9425, 112.9530, 5],

  ["Sundarbans, Bangladesh",       "World's largest mangrove forest, a tidal labyrinth and last stronghold of Bengal tigers",  22.0000,  89.1500, 30],

  ["Colca Canyon, Peru",           "One of Earth's deepest canyons, where Andean condors soar on thermals at sunrise",        -15.6533, -71.9675, 15],


  // ── NEW D5 ADDITIONS ─────────────────────────────────────────────────────
  ["Kerguelen Islands",            "France's sub-Antarctic territory — one of the most remote and wind-battered places on Earth", -49.2500,  69.5833, 50],

  ["Pitcairn Island",              "Tiny volcanic dot in the South Pacific, settled by the HMS Bounty mutineers in 1790",     -25.0660,-130.1006, 10],

  ["Bouvet Island",                "Norway's uninhabited sub-Antarctic island — possibly the single most remote place on Earth", -54.4208,   3.3464, 20],

  ["Magadan, Russia",              "Remote Siberian city at the end of the Road of Bones, gateway to the former Gulag camps",  59.5613, 150.8121, 10],


  // ── SPECIAL / ANNIVERSARY LOCATIONS ─────────────────────────────────────
  ["Detroit, Michigan",            "Motor City on the Detroit River — birthplace of Motown, the assembly line and American rock", 42.3314, -83.0458, 1],

  ["Mount Mitchell, North Carolina","Highest peak east of the Mississippi at 6,684 ft, deep in the Black Mountains of Appalachia", 35.7648, -82.2650, 5],

  ["The Matterhorn, Switzerland",  "The iconic pyramid-shaped Alpine peak straddling the Swiss-Italian border above Zermatt",    45.9766,   7.6586, 5],

  ["Salisbury Cathedral",          "Medieval English Gothic cathedral housing the world's best-preserved copy of Magna Carta",   51.0648,  -1.7985, 2],


  // ── WESTERN CITIES — D1 ADDITIONS (70/30 rebalance) ─────────────────────────

  // USA (15)
  ["San Francisco, USA",     "City of fog, hills and the Golden Gate, a compact peninsula jutting into the Pacific",              37.7749, -122.4194, 1],
  ["Miami, USA",             "Subtropical city of Art Deco beaches, Latin rhythms and neon-lit Ocean Drive on Biscayne Bay",     25.7617,  -80.1918, 1],
  ["Seattle, USA",           "Pacific Northwest city of coffee, rain and the Space Needle rising above Puget Sound",             47.6062, -122.3321, 1],
  ["Boston, USA",            "America's cradle of independence — a walkable harbour city of red-brick history and ivy-league universities", 42.3601, -71.0589, 1],
  ["Houston, USA",           "Space City — America's most diverse metropolis, home to NASA's mission control",                   29.7604,  -95.3698, 1],
  ["Philadelphia, USA",      "Birthplace of American democracy, a city of cheesesteaks, the Liberty Bell and mural-covered streets", 39.9526, -75.1652, 1],
  ["Las Vegas, USA",         "Neon oasis rising from the Mojave Desert — the Entertainment Capital of the World",                36.1699, -115.1398, 1],
  ["Atlanta, USA",           "Capital of the American South, home to Coca-Cola, CNN and the world's busiest airport",           33.7490,  -84.3880, 1],
  ["Denver, USA",            "The Mile High City at the foot of the Rocky Mountains, gateway to the American mountain West",    39.7392, -104.9903, 1],
  ["Phoenix, USA",           "The Valley of the Sun — America's hottest major city, rising from the Sonoran Desert",            33.4484, -112.0740, 1],
  ["Dallas, USA",            "Big D — Texas's cosmopolitan commercial hub where oil money meets modern architecture",            32.7767,  -96.7970, 1],
  ["New Orleans, USA",       "The Big Easy — America's most unique city, where jazz, Creole food and Mardi Gras meet the Mississippi", 29.9511, -90.0715, 1],
  ["Nashville, USA",         "Music City — country music's glittering capital on the Cumberland River in Tennessee",            36.1627,  -86.7816, 1],
  ["Portland, USA",          "The City of Roses on the Pacific Northwest coast, famous for its food scene and quirky culture",  45.5051, -122.6750, 1],
  ["San Diego, USA",         "America's Finest City — a sun-soaked Pacific beach city on the US-Mexico border",                32.7157, -117.1611, 1],

  // Canada (5)
  ["Vancouver, Canada",      "Stunning Pacific city framed by mountains and ocean, one of the world's most liveable cities",    49.2827, -123.1207, 1],
  ["Montreal, Canada",       "North America's French-speaking cultural heartland, a city of festivals, bagels and underground cities", 45.5017, -73.5673, 1],
  ["Calgary, Canada",        "Gateway to the Canadian Rockies, an oil-boom city famous for the Calgary Stampede rodeo",        51.0447, -114.0719, 1],
  ["Ottawa, Canada",         "Canada's tidy national capital on the Ottawa River, home to Parliament Hill and the Rideau Canal", 45.4215, -75.6972, 1],
  ["Quebec City, Canada",    "North America's only walled city north of Mexico, a French fortress overlooking the St. Lawrence", 46.8139, -71.2082, 1],

  // Europe (25)
  ["Milan, Italy",           "Italy's fashion and finance capital, home to La Scala, da Vinci's Last Supper and the soaring Duomo", 45.4642,   9.1900, 1],
  ["Munich, Germany",        "Bavaria's beer-garden capital — home to Oktoberfest, BMW and the medieval Marienplatz city heart", 48.1351,  11.5820, 1],
  ["Lisbon, Portugal",       "Europe's westernmost capital, a sun-drenched city of yellow trams, azulejo tiles and fado music",  38.7223,  -9.1393, 1],
  ["Stockholm, Sweden",      "Nordic capital spread across 14 islands where Lake Mälaren meets the Baltic Sea",                  59.3293,  18.0686, 1],
  ["Copenhagen, Denmark",    "Denmark's colourful harbour capital, home to Nyhavn, the Little Mermaid and world-class dining",   55.6761,  12.5683, 1],
  ["Dublin, Ireland",        "Ireland's warm-hearted capital — a city of Georgian squares, literary pubs and the River Liffey",  53.3498,  -6.2603, 1],
  ["Prague, Czech Republic", "The City of a Hundred Spires — a remarkably preserved medieval capital on the Vltava River",      50.0755,  14.4378, 1],
  ["Budapest, Hungary",      "The Pearl of the Danube — a grand twin city of baroque Buda and elegant Pest split by the river", 47.4979,  19.0402, 1],
  ["Edinburgh, Scotland",    "Scotland's dramatic capital, where a volcanic castle rock dominates a medieval Royal Mile",        55.9533,  -3.1883, 1],
  ["Zurich, Switzerland",    "Switzerland's financial capital on the lake — one of the world's most prosperous and liveable cities", 47.3769,   8.5417, 1],
  ["Oslo, Norway",           "Norway's compact waterfront capital, gateway to the fjords and one of the world's greenest cities", 59.9139,  10.7522, 1],
  ["Brussels, Belgium",      "The de facto capital of Europe, a city of grand squares, surrealist art and Belgian chocolate",    50.8503,   4.3517, 1],
  ["Helsinki, Finland",      "Nordic capital on a granite peninsula where design, saunas and Baltic ferries define city life",   60.1699,  24.9384, 1],
  ["Florence, Italy",        "The Cradle of the Renaissance — a compact city of unparalleled art, the Uffizi and the Duomo",    43.7696,  11.2558, 1],
  ["Venice, Italy",          "La Serenissima — a city of canals, gondolas and crumbling palaces built on 118 lagoon islands",   45.4408,  12.3155, 1],
  ["Naples, Italy",          "Chaotic, passionate southern Italian city — birthplace of pizza, overlooking Mount Vesuvius",      40.8518,  14.2681, 1],
  ["Hamburg, Germany",       "Germany's gateway to the world — a port city of canals, warehouses and legendary nightlife",      53.5753,  10.0153, 1],
  ["Frankfurt, Germany",     "Germany's financial capital, a skyline of towers rising beside the medieval Old Town on the Main", 50.1109,   8.6821, 1],
  ["Lyon, France",           "France's gastronomic capital, a UNESCO-listed city at the confluence of the Rhône and Saône rivers", 45.7640,   4.8357, 1],
  ["Seville, Spain",         "Andalusia's passionate capital — birthplace of flamenco, tapas and the orange-scented Giralda",   37.3891,  -5.9845, 1],
  ["Porto, Portugal",        "Hillside port city of azulejo tiles, port wine cellars and the dramatic Douro River gorge",       41.1579,  -8.6291, 1],
  ["Manchester, UK",         "England's Northern Powerhouse — a city of Mancunian pride, football, music and industrial heritage", 53.4808,  -2.2426, 1],
  ["Glasgow, UK",            "Scotland's largest city, a former industrial giant reinvented as a hub of art, music and food",   55.8642,  -4.2518, 1],
  ["Liverpool, UK",          "Birthplace of the Beatles, a proud port city of Merseyside wit and a spectacular waterfront",     53.4084,  -2.9916, 1],
  ["Reykjavik, Iceland",     "World's northernmost capital, gateway to the Northern Lights, geysers and volcanic landscapes",   64.1466, -21.9426, 1],

  // Australia / New Zealand (5)
  ["Brisbane, Australia",    "Sunny Queensland capital on the Brisbane River, host city of the 2032 Olympic Games",            -27.4698, 153.0251, 1],
  ["Perth, Australia",       "The most isolated major city on Earth, a sun-drenched Indian Ocean capital of beaches and wine", -31.9505, 115.8605, 1],
  ["Auckland, New Zealand",  "New Zealand's largest city, straddling two harbours on a slender volcanic isthmus",             -36.8509, 174.7645, 1],
  ["Adelaide, Australia",    "Festival city of South Australia, famous for wine regions, world-class museums and a planned grid", -34.9285, 138.6007, 1],
  ["Wellington, New Zealand","Compact, wind-blown capital of New Zealand perched on a stunning harbour at the Cook Strait",   -41.2866, 174.7756, 1],

  // ── WESTERN CITIES — ROUND 2 ADDITIONS ───────────────────────────────────────

  // USA (10)
  ["Austin, USA",          "Texas's live-music capital — a booming tech and culture hub on the Colorado River",              30.2672,  -97.7431, 1],
  ["Minneapolis, USA",     "Twin Cities — Minnesota's cultural hub of lakes, music and the mighty Mississippi headwaters",   44.9778,  -93.2650, 1],
  ["Tampa, USA",           "Florida's Gulf Coast city of Cuban heritage, craft beer and one of the USA's top beaches",      27.9506,  -82.4572, 1],
  ["Pittsburgh, USA",      "Steel City reinvented — a dramatic city of bridges at the confluence of three rivers",          40.4406,  -79.9959, 1],
  ["Salt Lake City, USA",  "Utah's capital at the foot of the Wasatch Mountains, gateway to world-class ski resorts",      40.7608, -111.8910, 1],
  ["Kansas City, USA",     "Heartland city famous for BBQ, jazz, fountains and straddling two US states",                   39.0997,  -94.5786, 1],
  ["Charlotte, USA",       "The Queen City — America's second-largest banking hub, booming in the Carolina Piedmont",       35.2271,  -80.8431, 1],
  ["San Antonio, USA",     "Home of the Alamo, River Walk and one of the oldest Spanish colonial cities in North America",  29.4241,  -98.4936, 1],
  ["Raleigh, USA",         "North Carolina's Research Triangle capital — a fast-growing Southern tech city",                35.7796,  -78.6382, 1],
  ["Cincinnati, USA",      "Queen City on the Ohio River — known for chili, craft beer and stunning Art Deco architecture", 39.1031,  -84.5120, 1],

  // Canada (3)
  ["Edmonton, Canada",     "Alberta's capital on the North Saskatchewan River, gateway to the Canadian wilderness",         53.5461, -113.4938, 1],
  ["Halifax, Canada",      "Maritime capital of Nova Scotia — a harbour city of wooden churches and the world's second-largest natural harbour", 44.6488, -63.5752, 1],
  ["Winnipeg, Canada",     "Prairie crossroads city where the Red and Assiniboine rivers meet at the heart of Canada",     49.8951,  -97.1384, 1],

  // Mexico (2)
  ["Cancún, Mexico",       "Caribbean resort city on the Yucatán Peninsula, gateway to Mayan ruins and turquoise waters",  21.1619,  -86.8515, 1],
  ["Monterrey, Mexico",    "Mexico's industrial powerhouse — a dynamic northern city ringed by the dramatic Sierra Madre",  25.6866, -100.3161, 1],

  // Europe (15)
  ["Geneva, Switzerland",  "International city on Lac Léman — home to the UN, Red Cross and the world's largest particle accelerator", 46.2044,   6.1432, 1],
  ["Nice, France",         "Jewel of the French Riviera, a pastel city of beaches, belle époque promenades and Matisse",   43.7102,   7.2620, 1],
  ["Marseille, France",    "France's oldest city and its busiest port, a sun-drenched melting pot on the Mediterranean",   43.2965,   5.3698, 1],
  ["Toulouse, France",     "The Pink City — France's aerospace capital on the Garonne, home of Airbus",                    43.6047,   1.4442, 1],
  ["Cologne, Germany",     "Rhineland city dominated by its twin-towered Gothic cathedral, Germany's carnival capital",    50.9333,   6.9500, 1],
  ["Düsseldorf, Germany",  "Elegant Rhineland fashion capital, known for its old town pubs and cutting-edge architecture", 51.2217,   6.7762, 1],
  ["Valencia, Spain",      "Spain's third city — birthplace of paella, home of La Tomatina and the futuristic City of Arts", 39.4699,  -0.3763, 1],
  ["Turin, Italy",         "Italy's automotive capital — an elegant Baroque city of porticoed streets and the Shroud of Turin", 45.0703,   7.6869, 1],
  ["Bologna, Italy",       "La Grassa — Italy's gastronomic heart, a medieval university city of arcaded streets",         44.4949,  11.3426, 1],
  ["Kraków, Poland",       "Poland's royal capital and cultural heart — a stunning medieval old town on the Vistula River", 50.0647,  19.9450, 1],
  ["Tallinn, Estonia",     "Best-preserved medieval old town in Northern Europe, a Baltic gem of turrets and spires",       59.4370,  24.7536, 1],
  ["Riga, Latvia",         "Art Nouveau capital of Latvia — the largest city in the Baltic states",                        56.9496,  24.1052, 1],
  ["Belgrade, Serbia",     "Serbia's vibrant capital at the confluence of the Sava and Danube, with a fortress and legendary nightlife", 44.8176,  20.4569, 1],
  ["Sofia, Bulgaria",      "Bulgaria's compact capital beneath Mount Vitosha — one of Europe's oldest continuously inhabited cities", 42.6977,  23.3219, 1],
  ["Bratislava, Slovakia", "One of the smallest capital cities in the world, perched above the Danube bordering Austria",  48.1486,  17.1077, 1],

  // UK (1)
  ["Birmingham, UK",       "England's second city — a multicultural powerhouse that gave the world the industrial revolution", 52.4862,  -1.8904, 1],


  // ── REPLACEMENT LOCATIONS ─────────────────────────────────────────────────
  // Specific, pinnable replacements for removed massive/vague regions
  ["Tamanrasset, Algeria",          "Major oasis city deep in the Algerian Sahara, gateway to the Hoggar Mountains and Tuareg territory",      22.7850,   5.5228],
  ["El Chaltén, Argentina",         "Remote Patagonian trekking village at the base of Mount Fitz Roy's iconic granite towers",               -49.3306, -72.8858],
  ["Belém, Brazil",                 "Amazonian gateway city where the world's mightiest river meets the Atlantic in a vast green estuary",     -1.4558,  -48.5044],
  ["Bonito, Brazil",                "Ecotourism capital of the Pantanal, known for crystal-clear rivers and the world's best freshwater diving",-21.1214, -56.4817],
  ["Charyn Canyon, Kazakhstan",     "Dramatic canyon of 300m-high walls carved by the Charyn River — Central Asia's answer to the Grand Canyon", 43.3500, 79.0700],
  ["Kolmanskop, Namibia",           "Abandoned diamond-mining ghost town slowly swallowed by Namib Desert sand dunes since the 1950s",        -26.7021,  15.2301],
  ["Valley of Geysers, Kamchatka",  "World's second-largest geyser field, discovered in 1941 in a remote volcanic valley in Russia's Far East", 54.4370, 160.1423],
  ["San Pedro de Atacama, Chile",   "Andean oasis village at 2,400m — base for Moon Valley, salt flats and the world's finest stargazing",    -22.9087, -68.1996],
  ["Ningaloo Reef, Australia",      "World Heritage fringing reef off Western Australia — one of the few places to swim with whale sharks",    -22.6833, 113.7719, 10],
  ["Malé, Maldives",                "One of the most densely populated capital cities on Earth, a compact island of mosques and markets",        4.1755,  73.5093],
  ["Deception Island, Antarctica",  "Active Antarctic volcano where ships sail inside a sunken caldera and hot springs warm the beaches",      -62.9728, -60.6519],
  ["Agadez, Niger",                 "Ancient Saharan trading city and UNESCO World Heritage site, heart of the Tuareg homeland in northern Niger", 16.9736, 7.9956],
  ["Maasai Mara, Kenya",            "Kenya's most celebrated wildlife reserve, heart of the Great Migration where wildebeest cross the Mara River", -1.5044, 35.1444, 10],

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
  const epoch = 1741046400000; // 2026-03-04 00:00:00 UTC — Official launch day (Day 1)
  let nowMs;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    nowMs = Date.UTC(y, m - 1, d);
  } else {
    nowMs = Date.now();
  }
  return Math.floor((nowMs - epoch) / 86400000) + 1;
}

// ── Difficulty map ────────────────────────────────────────────────────────────
// Override difficulty per location name. Anything not listed → 3 (medium).
// 1 = Major world city   2 = World-famous landmark
// 3 = Well-known dest.   4 = Needs real geo knowledge   5 = Obscure / remote
const DIFFICULTY_MAP = {
  // ── D1: Major world cities ────────────────────────────────────────────────
  'Tokyo, Japan':1,'Seoul, South Korea':1,'Shanghai, China':1,'Beijing, China':1,
  'Osaka, Japan':1,'Chengdu, China':1,"Xi'an, China":1,
  // Demoted D1→D3 (obscure to western players):
  'Guangzhou, China':3,'Shenzhen, China':3,'Chongqing, China':3,
  'Tianjin, China':3,'Wuhan, China':3,
  'Hong Kong':1,'Taipei, Taiwan':1,'Bangkok, Thailand':1,
  'Ho Chi Minh City, Vietnam':1,'Hanoi, Vietnam':1,'Jakarta, Indonesia':1,
  'Manila, Philippines':1,'Singapore':1,'Kuala Lumpur, Malaysia':1,
  'Yangon, Myanmar':1,'Delhi, India':1,'Mumbai, India':1,'Kolkata, India':1,
  'Bangalore, India':1,'Karachi, Pakistan':1,
  'Tehran, Iran':1,'Riyadh, Saudi Arabia':1,'Cairo, Egypt':1,
  'Lagos, Nigeria':1,'Nairobi, Kenya':1,
  'Addis Ababa, Ethiopia':1,'Accra, Ghana':1,
  // Demoted D1→D3 (obscure to western players):
  'Hyderabad, India':3,'Ahmedabad, India':3,'Chennai, India':3,
  'Dhaka, Bangladesh':3,'Lahore, Pakistan':3,'Kabul, Afghanistan':3,
  'Baghdad, Iraq':3,'Kinshasa, DRC':3,'Khartoum, Sudan':3,
  'Luanda, Angola':3,'Dar es Salaam, Tanzania':3,'Abidjan, Ivory Coast':3,
  'Casablanca, Morocco':1,'Alexandria, Egypt':1,
  'Johannesburg, South Africa':1,'Cape Town, South Africa':1,
  'Moscow, Russia':1,'Saint Petersburg, Russia':1,'Madrid, Spain':1,
  'Berlin, Germany':1,'Barcelona, Spain':1,'Vienna, Austria':1,
  'Warsaw, Poland':1,'Kyiv, Ukraine':1,'Athens, Greece':1,
  'Amsterdam, Netherlands':1,'Bucharest, Romania':1,
  'São Paulo, Brazil':1,'Mexico City, Mexico':1,'Buenos Aires, Argentina':1,
  'Lima, Peru':1,'Bogotá, Colombia':1,'Santiago, Chile':1,
  'Los Angeles, USA':1,'Chicago, USA':1,'Toronto, Canada':1,
  'Guadalajara, Mexico':1,'Medellín, Colombia':1,'Melbourne, Australia':1,
  // Previously missing iconic cities — now added to D1
  'Paris, France':1,'London, UK':1,'New York, USA':1,'Sydney, Australia':1,
  'Dubai, UAE':1,'Rome, Italy':1,'Istanbul, Turkey':1,'Rio de Janeiro, Brazil':1,
  // Western city additions — round 2
  'Austin, USA':1,'Minneapolis, USA':1,'Tampa, USA':1,'Pittsburgh, USA':1,
  'Salt Lake City, USA':1,'Kansas City, USA':1,'Charlotte, USA':1,
  'San Antonio, USA':1,'Raleigh, USA':1,'Cincinnati, USA':1,
  'Edmonton, Canada':1,'Halifax, Canada':1,'Winnipeg, Canada':1,
  'Cancún, Mexico':1,'Monterrey, Mexico':1,
  'Geneva, Switzerland':1,'Nice, France':1,'Marseille, France':1,
  'Toulouse, France':1,'Cologne, Germany':1,'Düsseldorf, Germany':1,
  'Valencia, Spain':1,'Turin, Italy':1,'Bologna, Italy':1,
  'Kraków, Poland':1,'Tallinn, Estonia':1,'Riga, Latvia':1,
  'Belgrade, Serbia':1,'Sofia, Bulgaria':1,'Bratislava, Slovakia':1,
  'Birmingham, UK':1,
  // Western city additions (70/30 rebalance)
  'San Francisco, USA':1,'Miami, USA':1,'Seattle, USA':1,'Boston, USA':1,
  'Houston, USA':1,'Philadelphia, USA':1,'Las Vegas, USA':1,'Atlanta, USA':1,
  'Denver, USA':1,'Phoenix, USA':1,'Dallas, USA':1,'New Orleans, USA':1,
  'Nashville, USA':1,'Portland, USA':1,'San Diego, USA':1,
  'Vancouver, Canada':1,'Montreal, Canada':1,'Calgary, Canada':1,
  'Ottawa, Canada':1,'Quebec City, Canada':1,
  'Milan, Italy':1,'Munich, Germany':1,'Lisbon, Portugal':1,
  'Stockholm, Sweden':1,'Copenhagen, Denmark':1,'Dublin, Ireland':1,
  'Prague, Czech Republic':1,'Budapest, Hungary':1,'Edinburgh, Scotland':1,
  'Zurich, Switzerland':1,'Oslo, Norway':1,'Brussels, Belgium':1,
  'Helsinki, Finland':1,'Florence, Italy':1,'Venice, Italy':1,
  'Naples, Italy':1,'Hamburg, Germany':1,'Frankfurt, Germany':1,
  'Lyon, France':1,'Seville, Spain':1,'Porto, Portugal':1,
  'Manchester, UK':1,'Glasgow, UK':1,'Liverpool, UK':1,'Reykjavik, Iceland':1,
  'Brisbane, Australia':1,'Perth, Australia':1,'Auckland, New Zealand':1,
  'Adelaide, Australia':1,'Wellington, New Zealand':1,

  // ── D2: World-famous landmarks & iconic destinations ──────────────────────
  'Eiffel Tower, Paris':2,'Colosseum, Rome':2,'Sagrada Família, Barcelona':2,
  'Acropolis, Athens':2,'Stonehenge, England':2,'Big Ben, London':2,
  'Hagia Sophia, Istanbul':2,'Mont Saint-Michel, France':2,
  'Dubrovnik Old City, Croatia':2,'Vatican City':2,
  'Mount Fuji, Japan':2,'Taj Mahal, Agra':2,'Angkor Wat, Cambodia':2,
  'Great Wall of China':2,'Petra, Jordan':2,'Burj Khalifa, Dubai':2,
  'Great Pyramid of Giza':2,'Victoria Falls, Zambia':2,
  'Mount Kilimanjaro, Tanzania':2,'Machu Picchu, Peru':2,
  'Grand Canyon, USA':2,'Iguazu Falls, Argentina':2,
  'Chichén Itzá, Mexico':2,'Statue of Liberty, New York':2,
  'Golden Gate Bridge':2,'Christ the Redeemer, Rio':2,
  'Easter Island, Chile':2,'Niagara Falls, Canada':2,
  'Sydney Opera House':2,'Uluru, Australia':2,
  'Kinkaku-ji, Kyoto':2,'Varanasi Ghats, India':2,
  // D3 → D2 promotions (globally iconic, universally recognised)
  'Santorini Caldera, Greece':2,'Halong Bay, Vietnam':2,
  'Galápagos Islands, Ecuador':2,'Yellowstone, USA':2,
  'Bora Bora, French Polynesia':2,'Dead Sea, Jordan':2,'Pompeii, Italy':2,
  'Cappadocia, Turkey':2,'Pamukkale, Turkey':2,
  // New D2 landmark additions
  'Mount Everest, Nepal':2,'Leaning Tower of Pisa':2,'Table Mountain, South Africa':2,

  // ── D4: Hard — needs real geographic knowledge ────────────────────────────
  'Jiuzhaigou Valley, China':4,'Bagan, Myanmar':4,'Ha Giang Loop, Vietnam':4,
  'Preah Vihear, Cambodia':4,'Hitachi Seaside Park, Japan':4,
  'Hampi, India':4,'Ellora Caves, India':4,'Nubra Valley, India':4,
  'Wadi Halfa, Sudan':4,'Mount Nyiragongo, DRC':4,
  'Lamu Old Town, Kenya':4,'Danakil Depression, Ethiopia':4,'Dallol, Ethiopia':4,
  'Bwindi Forest, Uganda':4,'Fish River Canyon, Namibia':4,'Omo Valley, Ethiopia':4,
  'Bazaruto Archipelago, Mozambique':4,'Rwenzori Mountains, Uganda':4,
  'Simien Mountains, Ethiopia':4,'Lavaux Vineyards, Switzerland':4,
  'Rila Monastery, Bulgaria':4,'Bran Castle, Romania':4,
  'Mostar Bridge, Bosnia':4,'Hashima Island, Japan':4,
  'Mergui Archipelago, Myanmar':4,'Wadi Draa, Morocco':4,
  'Socotra Island, Yemen':4,'Coron Island, Philippines':4,
  'Chocolate Hills, Philippines':4,
  'Canaima, Venezuela':4,'Chiloé Island, Chile':4,
  'Copper Canyon, Mexico':4,'Lord Howe Island, Australia':4,
  'Raja Ampat, Indonesia':4,'Svalbard Global Seed Vault':4,
  'Bioluminescent Bay, Menorca':4,'Dominica':4,
  'Hsipaw, Myanmar':4,'Timbuktu, Mali':4,'Al-Ula, Saudi Arabia':4,
  'Choquequirao, Peru':4,'Tsingy de Bemaraha, Madagascar':4,
  // D3 → D4 demotions (requires real geographic knowledge to locate)
  'Svalbard, Norway':4,'Kirkjufell, Iceland':4,'Ronda, Spain':4,
  'Český Krumlov, Czechia':4,'Gdańsk, Poland':4,'Guanajuato, Mexico':4,
  'Oaxaca, Mexico':4,'Florianópolis, Brazil':4,
  'Okavango Delta, Botswana':4,'Sossusvlei, Namibia':4,
  'Quebrada de Humahuaca, Argentina':4,
  'Dakar, Senegal':4,'Carnaval, Rio de Janeiro':4,'Chernobyl, Ukraine':4,
  'Palau, Micronesia':4,'Tonga':4,'Samoa':4,'Kakadu, Australia':4,
  'Samarkand, Uzbekistan':4,'Ngorongoro Crater, Tanzania':4,
  // New D4 additions
  'Lofoten Islands, Norway':4,'Geirangerfjord, Norway':4,
  'Mount Bromo, Indonesia':4,'Sundarbans, Bangladesh':4,'Colca Canyon, Peru':4,
  // Replacement locations — D4
  'Tamanrasset, Algeria':4,'El Chaltén, Argentina':4,
  'Bonito, Brazil':4,'Charyn Canyon, Kazakhstan':4,
  'Kolmanskop, Namibia':4,'Valley of Geysers, Kamchatka':4,
  'Ningaloo Reef, Australia':4,'Agadez, Niger':4,

  // ── D5: Very hard — obscure or very remote (used sparingly in Round 5) ───
  'Surtsey, Iceland':5,'Tristan da Cunha':5,'Oymyakon, Russia':5,
  'Inaccessible Island':5,'Nauru':5,
  // New D5 additions
  'Kerguelen Islands':5,'Pitcairn Island':5,'Bouvet Island':5,'Magadan, Russia':5,
  // Replacement locations — D5
  'Deception Island, Antarctica':5,

  // ── Special / anniversary locations ───────────────────────────────────────
  'Detroit, Michigan':1,
  'Mount Mitchell, North Carolina':3,
  'The Matterhorn, Switzerland':2,
  'Salisbury Cathedral':3,

  // ── Replacement locations — D3 ────────────────────────────────────────────
  'Belém, Brazil':3,'San Pedro de Atacama, Chile':3,
  'Malé, Maldives':3,'Maasai Mara, Kenya':3,
};

// Difficulty: 1=major city  2=famous landmark  3=medium (default)  4=hard  5=very hard
function getLocDifficulty(loc) {
  return DIFFICULTY_MAP[loc[0]] !== undefined ? DIFFICULTY_MAP[loc[0]] : 3;
}

// Extract the country name from a location string (e.g. "Paris, France" → "France").
// Special cases handle entries with no comma or US state names.
function getCountry(locName) {
  const OVERRIDES = {
    'Hong Kong': 'China',
    'Singapore': 'Singapore',
    'Detroit, Michigan': 'USA',
    'Mount Mitchell, North Carolina': 'USA',
    'Edinburgh, Scotland': 'UK',
  };
  if (OVERRIDES[locName]) return OVERRIDES[locName];
  const parts = locName.split(', ');
  return parts.length > 1 ? parts[parts.length - 1] : locName;
}

function getTodayLocations(dateStr) {
  // ── Build full difficulty pools ───────────────────────────────────────────
  const allPools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  LOCATIONS.forEach(loc => {
    const d = getLocDifficulty(loc);
    if (allPools[d]) allPools[d].push(loc);
  });

  // ── Pick 5 locations from (possibly cooldown-filtered) pools ─────────────
  // Uses loc[0] (name string) for dedup so same-day picks never repeat.
  function pickForPools(pools, rand, prevR1Country) {
    const usedToday = new Set();
    const countryCount = {}; // tracks how many times each country appears today
    function pick(pool, excludeCountry) {
      let avail = pool.filter(l => !usedToday.has(l[0]));
      if (excludeCountry) {
        const noSameCountry = avail.filter(l => getCountry(l[0]) !== excludeCountry);
        if (noSameCountry.length > 0) avail = noSameCountry; // only apply if non-empty (safety)
      }
      // Within-day country dedup: max 1 per country, max 2 for USA
      const countryFiltered = avail.filter(l => {
        const c = getCountry(l[0]);
        const limit = c === 'USA' ? 2 : 1;
        return (countryCount[c] || 0) < limit;
      });
      if (countryFiltered.length > 0) avail = countryFiltered; // only apply if non-empty (safety)
      const src = avail.length ? avail : pool; // safety fallback
      const loc = src[Math.floor(rand() * src.length)];
      usedToday.add(loc[0]);
      const c = getCountry(loc[0]);
      countryCount[c] = (countryCount[c] || 0) + 1;
      return loc;
    }
    return [
      pick(pools[1], prevR1Country),        // R1: major city, no same country as prev day R1
      pick(pools[1]),                       // R2: different major city
      pick(pools[2]),                       // R3: world-famous landmark
      pick([...pools[3], ...pools[4]]),     // R4: medium or hard
      pick([...pools[4], ...pools[5]]),     // R5: hard or very hard
    ];
  }

  // ── 28-day cooldown via iterative forward computation ────────────────────
  // We iterate from the first ever game day up to dateStr.  Each day sees
  // what the previous 27 days picked and excludes those locations from its
  // own pools.  This is fully deterministic: same dateStr always yields the
  // same result regardless of when the function is called.
  const FIRST_DAY_MS = Date.UTC(2026, 1, 28); // 2026-02-28 — soft-launch day
  const [ty, tm, td] = dateStr.split('-').map(Number);
  const targetMs = Date.UTC(ty, tm - 1, td);

  // Dates before the game existed: pick with no cooldown (no history yet)
  if (targetMs < FIRST_DAY_MS) {
    return pickForPools(allPools, seededRand(getDailySeed(dateStr)));
  }

  // ── Special date overrides — pinned locations for specific days ──────────
  // These bypass the seeded RNG entirely for that date.  The pinned locations
  // still participate in the 28-day cooldown (future days exclude them).
  const DATE_OVERRIDES = {
    '2026-03-02': [                          // Soft-launch day 3 — pinned to protect active game
      ['Cairo, Egypt',               "Africa's largest city, spread along the Nile with the Great Pyramid visible from its suburbs", 30.0444,  31.2357, 1],
      ['Kraków, Poland',             "Poland's royal capital and cultural heart — a stunning medieval old town on the Vistula River", 50.0647,  19.9450, 1],
      ['Dubrovnik Old City, Croatia',"Walled medieval city on the Adriatic coast, known as the Pearl of the Adriatic",               42.6507,  18.0944, 2],
      ['Shenzhen, China',            "China's tech boomtown, transformed from fishing village to megacity in one generation",         22.5431, 114.0579, 3],
      ['Sahara Desert, Algeria',     "World's largest hot desert, stretching across North Africa",                                   23.4162,   5.0418, 75],
    ],
    '2026-03-04': [                          // Launch day — parents' anniversary
      'Detroit, Michigan',
      'Mount Mitchell, North Carolina',
      'Mont Saint-Michel, France',
      'The Matterhorn, Switzerland',
      'Salisbury Cathedral',
    ],
  };

  const history = {}; // "YYYY-MM-DD" → [loc, loc, loc, loc, loc]

  for (let ms = FIRST_DAY_MS; ms <= targetMs; ms += 86400000) {
    const dt = new Date(ms);
    const ds = dt.getUTCFullYear() + '-'
             + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-'
             + String(dt.getUTCDate()).padStart(2, '0');

    // If this date has a pinned override, use it directly and skip RNG
    if (DATE_OVERRIDES[ds]) {
      history[ds] = DATE_OVERRIDES[ds].map(entry => Array.isArray(entry) ? entry : LOCATIONS.find(l => l[0] === entry));
      continue;
    }

    // Collect every location name used in the previous 27 days
    const excluded = new Set();
    for (let i = 1; i <= 27; i++) {
      const pMs = ms - i * 86400000;
      if (pMs < FIRST_DAY_MS) break; // nothing before day-1 to exclude
      const pd  = new Date(pMs);
      const pds = pd.getUTCFullYear() + '-'
                + String(pd.getUTCMonth() + 1).padStart(2, '0') + '-'
                + String(pd.getUTCDate()).padStart(2, '0');
      if (history[pds]) history[pds].forEach(l => excluded.add(l[0]));
    }

    // Also pre-exclude any override locations whose special day falls within
    // the next 1–27 days — so pinned locations can't appear randomly just
    // before their anniversary date.
    for (const [overrideDate, overrideNames] of Object.entries(DATE_OVERRIDES)) {
      const daysUntil = Math.round((new Date(overrideDate).getTime() - ms) / 86400000);
      if (daysUntil > 0 && daysUntil <= 27) {
        overrideNames.forEach(entry => excluded.add(Array.isArray(entry) ? entry[0] : entry));
      }
    }

    // Filter each difficulty tier; fall back to full tier if cooldown
    // would empty it entirely (safety net, shouldn't occur in practice)
    const pools = {};
    for (const k in allPools) {
      const filtered = allPools[k].filter(l => !excluded.has(l[0]));
      pools[k] = filtered.length > 0 ? filtered : allPools[k];
    }

    // R1 country dedup: prevent same country as previous day's R1
    const prevMs2 = ms - 86400000;
    let prevR1Country = null;
    if (prevMs2 >= FIRST_DAY_MS) {
      const pd2  = new Date(prevMs2);
      const pds2 = pd2.getUTCFullYear() + '-'
                 + String(pd2.getUTCMonth() + 1).padStart(2, '0') + '-'
                 + String(pd2.getUTCDate()).padStart(2, '0');
      if (history[pds2] && history[pds2][0]) {
        prevR1Country = getCountry(history[pds2][0][0]);
      }
    }

    history[ds] = pickForPools(pools, seededRand(getDailySeed(ds)), prevR1Country);
  }

  return history[dateStr];
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
  if (d <= 0)    return 200;
  if (d <= 25)   return Math.round(200 - (d / 25) * 10);    // 200→190 perfect zone
  if (d <= 2000) {
    // Accelerating power curve: high reward for precision, 0 at 2000 km
    const t = (2000 - d) / (2000 - 25);                     // 1.0 at d=25, 0 at d=2000
    return Math.round(190 * Math.pow(t, 3.4));
  }
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
