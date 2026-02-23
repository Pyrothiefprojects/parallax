window.PARALLAX_PROJECT ={
  "scenes": [
    {
      "id": "cryo_1771308332754",
      "name": "cryo",
      "states": [
        {
          "background": "cryo.png",
          "backgroundData": "assets/scenes/cryo.png",
          "hotspots": [
            {
              "id": "hotspot_1771681914966",
              "name": "",
              "points": [
                [
                  1131,
                  622
                ],
                [
                  1131,
                  653
                ],
                [
                  1196,
                  655
                ],
                [
                  1195,
                  626
                ]
              ],
              "action": {
                "type": "puzzle",
                "puzzleId": "puzzle_1771690140341"
              },
              "requires": [],
              "clearAfterClick": false
            },
            {
              "id": "hotspot_1771681930095",
              "name": "",
              "points": [
                [
                  124,
                  329
                ],
                [
                  133,
                  427
                ],
                [
                  200,
                  427
                ],
                [
                  200,
                  340
                ]
              ],
              "action": {
                "type": "accepts_item",
                "onAccept": {
                  "type": "pickup",
                  "itemId": "spin_dial_1771308660868"
                },
                "requiredItemId": "cryoisoplate_1771830291417"
              },
              "requires": []
            },
            {
              "id": "hotspot_1771681965154",
              "name": "",
              "points": [
                [
                  437,
                  475
                ],
                [
                  438,
                  551
                ],
                [
                  502,
                  551
                ],
                [
                  502,
                  475
                ]
              ],
              "action": {
                "type": "accepts_item",
                "onAccept": {
                  "type": "navigate",
                  "target": "loadingbay_1771308338532"
                },
                "requiredItemId": "spin_dial_1771308660868"
              },
              "requires": [],
              "stateChange": null
            }
          ]
        }
      ],
      "editingStateIndex": 0,
      "music": null,
      "sceneAssets": [],
      "hotspotConnections": []
    },
    {
      "id": "loadingbay_1771308338532",
      "name": "loadingbay",
      "states": [
        {
          "background": "loadingbay.png",
          "backgroundData": "assets/scenes/loadingbay.png",
          "hotspots": [
            {
              "id": "hotspot_1771598906783",
              "name": "",
              "points": [
                [
                  388,
                  481
                ],
                [
                  387,
                  573
                ],
                [
                  345,
                  592
                ],
                [
                  342,
                  488
                ],
                [
                  294,
                  482
                ],
                [
                  289,
                  346
                ],
                [
                  332,
                  345
                ]
              ],
              "action": {
                "type": "puzzle",
                "puzzleId": "puzzle_1771598855578"
              },
              "requires": []
            },
            {
              "id": "hotspot_1771682713307",
              "name": "",
              "points": [
                [
                  1225,
                  575
                ],
                [
                  1220,
                  324
                ],
                [
                  1295,
                  311
                ],
                [
                  1299,
                  605
                ]
              ],
              "action": {
                "type": "navigate",
                "target": "cryooperations_1771308338532"
              },
              "requires": [],
              "stateChange": null
            },
            {
              "id": "hotspot_1771682766166",
              "name": "",
              "points": [
                [
                  1354,
                  626
                ],
                [
                  1353,
                  296
                ],
                [
                  1482,
                  279
                ],
                [
                  1487,
                  678
                ]
              ],
              "action": {
                "type": "navigate",
                "target": "generatorhub_1771682746524"
              },
              "requires": []
            }
          ]
        }
      ],
      "editingStateIndex": 0,
      "music": null,
      "sceneAssets": [],
      "hotspotConnections": []
    },
    {
      "id": "cryooperations_1771308338532",
      "name": "cryooperations",
      "states": [
        {
          "background": "cryooperations.png",
          "backgroundData": "assets/scenes/cryooperations.png",
          "hotspots": [
            {
              "id": "hotspot_1771315434579",
              "name": "",
              "points": [
                [
                  892,
                  381
                ],
                [
                  873,
                  472
                ],
                [
                  1096,
                  500
                ],
                [
                  1109,
                  392
                ]
              ],
              "action": {
                "type": "puzzle",
                "puzzleId": "puzzle_1771594307749"
              },
              "requires": []
            },
            {
              "id": "hotspot_1771682962226",
              "name": "",
              "points": [
                [
                  1523,
                  819
                ],
                [
                  1294,
                  875
                ],
                [
                  1375,
                  1018
                ],
                [
                  1528,
                  1016
                ]
              ],
              "action": {
                "type": "navigate",
                "target": "loadingbay_1771308338532"
              },
              "requires": []
            }
          ]
        }
      ],
      "editingStateIndex": 0,
      "music": null,
      "sceneAssets": [],
      "hotspotConnections": []
    },
    {
      "id": "generatorhub_1771682746524",
      "name": "GeneratorHub",
      "states": [
        {
          "background": "GeneratorHub.png",
          "backgroundData": "assets/scenes/GeneratorHub.png",
          "hotspots": [
            {
              "id": "hotspot_1771682794995",
              "name": "",
              "points": [
                [
                  495,
                  738
                ],
                [
                  729,
                  571
                ],
                [
                  1034,
                  694
                ],
                [
                  860,
                  983
                ]
              ],
              "action": {
                "type": "navigate",
                "target": "cryogenerator_1771682749923"
              },
              "requires": []
            },
            {
              "id": "hotspot_1771682812486",
              "name": "",
              "points": [
                [
                  930,
                  565
                ],
                [
                  950,
                  158
                ],
                [
                  1297,
                  134
                ],
                [
                  1229,
                  655
                ]
              ],
              "action": {
                "type": "navigate",
                "target": "loadingbay_1771308338532"
              },
              "requires": []
            }
          ]
        }
      ],
      "editingStateIndex": 0,
      "music": null,
      "sceneAssets": [],
      "hotspotConnections": []
    },
    {
      "id": "cryogenerator_1771682749923",
      "name": "CryoGenerator",
      "states": [
        {
          "background": "CryoGenerator.png",
          "backgroundData": "assets/scenes/CryoGenerator.png",
          "hotspots": []
        }
      ],
      "editingStateIndex": 0,
      "music": null,
      "sceneAssets": [],
      "hotspotConnections": []
    }
  ],
  "items": [
    {
      "id": "spin_dial_1771308660868",
      "name": "Spin Dial",
      "image": "assets/items/spindial.png",
      "uses": "infinite"
    },
    {
      "id": "lock_pin_1771308683540",
      "name": "Lock Pin",
      "image": "assets/items/lockpin.png",
      "uses": 1
    },
    {
      "id": "glowsticks_1771313874210",
      "name": "Glowsticks",
      "image": null,
      "uses": 1
    },
    {
      "id": "cryoisoplate_1771830291417",
      "name": "cryoisoplate",
      "image": "assets/items/Isoplate.png",
      "uses": 1
    },
    {
      "id": "isomarkblank_1771833140226",
      "name": "IsoMarkblank",
      "image": "assets/items/IsoMark.png",
      "uses": 1
    },
    {
      "id": "ruinmark_1771833281688",
      "name": "ruinMark",
      "image": "assets/items/ruin_Mark.png",
      "uses": 1
    }
  ],
  "puzzles": [
    {
      "id": "puzzle_1771308372319",
      "name": "Cryo Facility Window",
      "states": [
        {
          "backgroundImage": "assets/puzzles/cryofacility2.png",
          "assets": [],
          "assetGroups": [],
          "hotspots": []
        }
      ],
      "editingStateIndex": 0,
      "rewardItemId": "",
      "rewardSceneState": null,
      "isClue": false,
      "completionText": ""
    },
    {
      "id": "puzzle_1771308404837",
      "name": "Cryo Lockers",
      "states": [
        {
          "backgroundImage": "assets/puzzles/lockers.png",
          "assets": [],
          "assetGroups": [],
          "hotspots": []
        }
      ],
      "editingStateIndex": 0,
      "rewardItemId": "",
      "rewardSceneState": null,
      "isClue": false,
      "completionText": ""
    },
    {
      "id": "puzzle_1771594307749",
      "name": "Ideogram",
      "states": [
        {
          "backgroundImage": "assets/puzzles/ideogrampuzzle.png",
          "assets": [],
          "assetGroups": [],
          "hotspots": []
        }
      ],
      "editingStateIndex": 0,
      "rewardItemId": "",
      "rewardSceneState": null,
      "isClue": false,
      "completionText": ""
    },
    {
      "id": "puzzle_1771598855578",
      "name": "Isopress",
      "states": [
        {
          "backgroundImage": "assets/puzzles/Isopress.png",
          "assets": [],
          "assetGroups": [],
          "hotspots": [
            {
              "id": "hotspot_1771683015403",
              "name": "",
              "points": [
                [
                  785,
                  400
                ],
                [
                  789,
                  551
                ],
                [
                  663,
                  551
                ],
                [
                  665,
                  401
                ]
              ],
              "action": {
                "type": "craft"
              },
              "requires": []
            }
          ]
        }
      ],
      "editingStateIndex": 0,
      "rewardItemId": "",
      "rewardSceneState": null,
      "isClue": false,
      "completionText": "",
      "ideogramId": "ideogram_1771503169529_zl52",
      "ideogramState": {
        "codices": [
          {
            "id": "codex_1771586581401_3ai2",
            "image": "assets/puzzles/pieces/Codex_ring.png",
            "x": 374.8333333333335,
            "y": 114.5,
            "width": 210,
            "height": 210,
            "rotation": 216,
            "ruinCount": 5,
            "slotSize": 200,
            "name": "Codex ring",
            "slots": [
              {
                "image": "assets/puzzles/pieces/ruinengine.png",
                "name": "ruinengine",
                "width": 283,
                "height": 423,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinnavigation.png",
                "name": "ruinnavigation",
                "width": 445,
                "height": 726,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruincryo.png",
                "name": "ruincryo",
                "width": 621,
                "height": 362,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinweapons.png",
                "name": "ruinweapons",
                "width": 409,
                "height": 386,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinshield.png",
                "name": "ruinshield",
                "width": 440,
                "height": 401,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              }
            ],
            "solvedSlots": null,
            "isSpindial": false,
            "discOrientCoupling": false,
            "linkedSpindial": false,
            "mirrorCoupling": false,
            "gateRotate": false,
            "gateFlip": false,
            "imageOpacity": 1,
            "ruinScale": 0.15,
            "ruinProximity": -25
          },
          {
            "id": "codex_1771587348567_479c",
            "image": "assets/puzzles/pieces/spindial.png",
            "x": 408.7857142857142,
            "y": 148.0714285714289,
            "width": 140,
            "height": 140,
            "rotation": 0,
            "ruinCount": 5,
            "slotSize": 200,
            "name": "Spindial",
            "slots": [
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              }
            ],
            "solvedSlots": null,
            "isSpindial": true,
            "discOrientCoupling": false,
            "linkedSpindial": false,
            "mirrorCoupling": false,
            "gateRotate": false,
            "gateFlip": false,
            "linkedCodexId": "codex_1771586581401_3ai2"
          }
        ],
        "isopresses": [
          {
            "id": "isopress_1771587603806_r2dq",
            "image": "assets/puzzles/pieces/Iso_plate.png",
            "x": 671.2142857142858,
            "y": 418.0714285714291,
            "width": 120,
            "height": 120,
            "name": "Iso plate",
            "linkedCodexId": "codex_1771586581401_3ai2"
          }
        ],
        "isolathes": []
      }
    },
    {
      "id": "puzzle_1771680683381",
      "name": "isoplate console in pro room",
      "states": [
        {
          "backgroundImage": "assets/puzzles/Isoplateconsole.png",
          "assets": [],
          "assetGroups": [],
          "hotspots": []
        }
      ],
      "editingStateIndex": 0,
      "rewardItemId": "",
      "rewardSceneState": null,
      "isClue": false,
      "completionText": ""
    },
    {
      "id": "puzzle_1771690140341",
      "name": "cryopod",
      "states": [
        {
          "backgroundImage": "assets/puzzles/cryopod.png",
          "assets": [
            {
              "id": "asset_1771827482296",
              "type": "puzzle_asset",
              "x": 462.390625,
              "y": 316.59375,
              "name": "cryopodisoplate",
              "src": "assets/puzzles/pieces/cryopodisoplate.png",
              "imageData": null,
              "width": 30,
              "height": 33,
              "linkedItem": "cryoisoplate_1771830291417",
              "requires": [],
              "action": {
                "type": "pickup",
                "itemId": "cryoisoplate_1771825446290"
              },
              "stateChange": null,
              "assetChanges": [
                {
                  "assetId": "asset_1771827482296",
                  "mode": "hide"
                }
              ],
              "groupId": "group_1771827636718"
            },
            {
              "id": "asset_1771827489472",
              "type": "puzzle_asset",
              "x": 382.390625,
              "y": 317.59375,
              "name": "cryopodcircle",
              "src": "assets/puzzles/pieces/cryopodcircle.png",
              "imageData": null,
              "width": 23,
              "height": 22,
              "linkedItem": null,
              "requires": [],
              "groupId": "group_1771827636718"
            }
          ],
          "assetGroups": [
            {
              "id": "group_1771827636718",
              "name": "cryoisoplateclue",
              "assetIds": [
                "asset_1771827482296",
                "asset_1771827489472"
              ],
              "action": {
                "type": "pickup",
                "itemId": "cryoisoplate_1771825446290"
              },
              "requires": [],
              "assetChanges": [
                {
                  "assetId": "asset_1771827482296",
                  "mode": "hide"
                },
                {
                  "assetId": "asset_1771827489472",
                  "mode": "hide",
                  "effect": "long_fade"
                }
              ],
              "clearAfterClick": true
            }
          ],
          "hotspots": []
        }
      ],
      "editingStateIndex": 0,
      "rewardItemId": "",
      "rewardSceneState": null,
      "isClue": false,
      "completionText": ""
    }
  ],
  "gameState": [
    "solved_cryoisoplateclue"
  ],
  "progressionSteps": [],
  "blueprint": {
    "elements": [
      {
        "id": "bp_element_1771308748927_u8tv",
        "type": "room",
        "x": 600,
        "y": 280,
        "width": 600,
        "height": 480,
        "label": "Loading Bat",
        "color": "#ffffff",
        "sceneId": "loadingbay_1771308338532"
      },
      {
        "id": "bp_element_1771308844609_2ls0",
        "type": "room",
        "x": 1240,
        "y": 280,
        "width": 240,
        "height": 200,
        "label": "Operations",
        "color": "#ffffff",
        "sceneId": "cryooperations_1771308338532"
      },
      {
        "id": "bp_element_1771308855951_9i80",
        "type": "door",
        "x": 1200,
        "y": 400,
        "width": 40,
        "height": 80,
        "label": "",
        "color": "rgba(128, 128, 128, 0.5)",
        "fromRoom": null,
        "toRoom": null,
        "description": "",
        "puzzleId": null,
        "sceneId": null
      },
      {
        "id": "bp_element_1771308890476_j1cm",
        "type": "door",
        "x": 1200,
        "y": 520,
        "width": 40,
        "height": 80,
        "label": "",
        "color": "rgba(128, 128, 128, 0.5)",
        "fromRoom": null,
        "toRoom": null,
        "description": "",
        "puzzleId": null,
        "sceneId": null
      },
      {
        "id": "bp_element_1771308901947_s8jm",
        "type": "door",
        "x": 560,
        "y": 520,
        "width": 40,
        "height": 80,
        "label": "",
        "color": "rgba(128, 128, 128, 0.5)",
        "fromRoom": null,
        "toRoom": null,
        "description": "",
        "puzzleId": null,
        "sceneId": null
      },
      {
        "id": "bp_element_1771308929526_7zbr",
        "type": "room",
        "x": 280,
        "y": 280,
        "width": 280,
        "height": 400,
        "label": "Cryo Last Stand",
        "color": "#ffffff",
        "sceneId": "cryo_1771308332754"
      },
      {
        "id": "bp_element_1771308933642_n9w0",
        "type": "asset",
        "x": 480,
        "y": 600,
        "width": 40,
        "height": 80,
        "label": "?? Pod",
        "color": "#999999",
        "assetId": null,
        "puzzleId": null
      },
      {
        "id": "bp_element_1771308935088_wxc3",
        "type": "asset",
        "x": 400,
        "y": 600,
        "width": 40,
        "height": 80,
        "label": "? Pod",
        "color": "#999999",
        "assetId": null,
        "puzzleId": null
      },
      {
        "id": "bp_element_1771308936522_e70t",
        "type": "asset",
        "x": 320,
        "y": 600,
        "width": 40,
        "height": 80,
        "label": "Player Pod",
        "color": "#999999",
        "assetId": null,
        "puzzleId": null
      },
      {
        "id": "bp_element_1771309056617_vcbz",
        "type": "window",
        "x": 1280,
        "y": 240,
        "width": 160,
        "height": 40,
        "label": "Cryo Facility",
        "color": "#cccccc",
        "description": "",
        "puzzleId": "puzzle_1771308372319",
        "sceneId": null
      },
      {
        "id": "bp_element_1771309096372_mis1",
        "type": "door",
        "x": 720,
        "y": 240,
        "width": 360,
        "height": 40,
        "label": "",
        "color": "rgba(128, 128, 128, 0.5)",
        "fromRoom": null,
        "toRoom": null,
        "description": "",
        "puzzleId": null,
        "sceneId": null
      },
      {
        "id": "bp_element_1771309156269_z2bx",
        "type": "perspective",
        "x": 320,
        "y": 360,
        "width": 40,
        "height": 40,
        "label": "",
        "color": "#ffffff"
      },
      {
        "id": "bp_element_1771309164589_lxy4",
        "type": "perspective",
        "x": 880,
        "y": 720,
        "width": 40,
        "height": 40,
        "label": "",
        "color": "#ffffff"
      },
      {
        "id": "bp_element_1771309175535_qiz3",
        "type": "perspective",
        "x": 1240,
        "y": 400,
        "width": 40,
        "height": 40,
        "label": "",
        "color": "#ffffff"
      },
      {
        "id": "bp_element_1771309268834_ku67",
        "type": "item",
        "x": 520,
        "y": 440,
        "width": 40,
        "height": 40,
        "label": "Spin Dial",
        "color": "#ff6b35",
        "itemId": "spin_dial_1771308660868"
      },
      {
        "id": "bp_element_1771309277734_ninj",
        "type": "item",
        "x": 1040,
        "y": 280,
        "width": 40,
        "height": 40,
        "label": "Lock Pin",
        "color": "#ff6b35",
        "itemId": "lock_pin_1771308683540"
      },
      {
        "id": "bp_element_1771309279125_tmgt",
        "type": "item",
        "x": 720,
        "y": 280,
        "width": 40,
        "height": 40,
        "label": "Lock Pin",
        "color": "#ff6b35",
        "itemId": "lock_pin_1771308683540"
      },
      {
        "id": "bp_element_1771309802263_flmy",
        "type": "window",
        "x": 280,
        "y": 320,
        "width": 40,
        "height": 120,
        "label": "Lockers",
        "color": "#cccccc",
        "description": "There are 3 lockers, one for each cryo pod. To open your cryopod you need your spin dial. Your locker contains a ruinMark",
        "puzzleId": "puzzle_1771308404837",
        "sceneId": null
      },
      {
        "id": "bp_element_1771311958773_4jws",
        "type": "asset",
        "x": 520,
        "y": 480,
        "width": 40,
        "height": 40,
        "label": "Spin Dial Supplier",
        "color": "#999999",
        "assetId": null,
        "puzzleId": null
      },
      {
        "id": "bp_element_1771313213126_1o7k",
        "type": "room",
        "x": 1240,
        "y": 520,
        "width": 120,
        "height": 120,
        "label": "Cyro Power Shaft",
        "color": "#ffffff",
        "sceneId": "generatorhub_1771682746524"
      },
      {
        "id": "bp_element_1771313881505_p9m2",
        "type": "item",
        "x": 1160,
        "y": 320,
        "width": 40,
        "height": 40,
        "label": "Glowsticks",
        "color": "#ff6b35",
        "itemId": "glowsticks_1771313874210"
      },
      {
        "id": "bp_element_1771315164692_jmxe",
        "type": "door",
        "x": 1360,
        "y": 520,
        "width": 40,
        "height": 40,
        "label": "Shaft",
        "color": "rgba(128, 128, 128, 0.5)",
        "fromRoom": null,
        "toRoom": null,
        "description": "A shaft leading down to the power room, it has a large industrial lid. maybe unlocked via cryo isomark? as of now using spin dial for all doors, maybe hatches dont count?",
        "puzzleId": null,
        "sceneId": null
      },
      {
        "id": "bp_element_1771316829376_fr6q",
        "type": "asset",
        "x": 600,
        "y": 360,
        "width": 40,
        "height": 80,
        "label": "Isopress",
        "color": "#999999",
        "assetId": null,
        "puzzleId": null
      },
      {
        "id": "bp_element_1771833097338_9li6",
        "type": "room",
        "x": 1400,
        "y": 520,
        "width": 280,
        "height": 360,
        "label": "cryo generator - on repair load bay reveals new isoplate?",
        "color": "#ffffff",
        "sceneId": "cryogenerator_1771682749923"
      },
      {
        "id": "bp_element_1771833156942_h7d4",
        "type": "item",
        "x": 1440,
        "y": 720,
        "width": 40,
        "height": 40,
        "label": "IsoMarkblank - Engine (cracked)",
        "color": "#ff6b35",
        "itemId": "isomarkblank_1771833140226"
      },
      {
        "id": "bp_element_1771833158918_tfgz",
        "type": "item",
        "x": 640,
        "y": 360,
        "width": 40,
        "height": 40,
        "label": "IsoMarkblank",
        "color": "#ff6b35",
        "itemId": "isomarkblank_1771833140226"
      },
      {
        "id": "bp_element_1771833160143_lwb3",
        "type": "item",
        "x": 480,
        "y": 880,
        "width": 40,
        "height": 40,
        "label": "IsoMarkblank",
        "color": "#ff6b35",
        "itemId": "isomarkblank_1771833140226"
      },
      {
        "id": "bp_element_1771833161233_ziix",
        "type": "item",
        "x": 400,
        "y": 880,
        "width": 40,
        "height": 40,
        "label": "IsoMarkblank",
        "color": "#ff6b35",
        "itemId": "isomarkblank_1771833140226"
      },
      {
        "id": "bp_element_1771833162346_qxsj",
        "type": "item",
        "x": 320,
        "y": 880,
        "width": 40,
        "height": 40,
        "label": "IsoMarkblank",
        "color": "#ff6b35",
        "itemId": "isomarkblank_1771833140226"
      },
      {
        "id": "bp_element_1771833293260_k03j",
        "type": "item",
        "x": 1400,
        "y": 320,
        "width": 40,
        "height": 40,
        "label": "ruinMark - cryo",
        "color": "#ff6b35",
        "itemId": "ruinmark_1771833281688"
      },
      {
        "id": "bp_element_1771833536646_8ac5",
        "type": "item",
        "x": 320,
        "y": 560,
        "width": 40,
        "height": 40,
        "label": "cryoisoplate with dot (rewards spindial)",
        "color": "#ff6b35",
        "itemId": "cryoisoplate_1771830291417"
      },
      {
        "id": "bp_element_1771833982979_gak7",
        "type": "item",
        "x": 320,
        "y": 320,
        "width": 40,
        "height": 40,
        "label": "ruinMark - engine",
        "color": "#ff6b35",
        "itemId": "ruinmark_1771833281688"
      }
    ],
    "viewport": {
      "offsetX": 0,
      "offsetY": 0,
      "zoom": 1
    },
    "metadata": {
      "created": 1771308000000,
      "modified": 1771859659703
    }
  },
  "ideogramData": {
    "ruinLibrary": [
      {
        "id": "ruin_1771834883821_ei9n",
        "name": "Ruincryo",
        "image": "assets/puzzles/pieces/ruincryo.png"
      },
      {
        "id": "ruin_1771834883823_ehje",
        "name": "Ruinengine",
        "image": "assets/puzzles/pieces/ruinengine.png"
      },
      {
        "id": "ruin_1771834883823_ks9i",
        "name": "Ruinnavigation",
        "image": "assets/puzzles/pieces/ruinnavigation.png"
      },
      {
        "id": "ruin_1771834883824_g5qk",
        "name": "Ruinshield",
        "image": "assets/puzzles/pieces/ruinshield.png"
      },
      {
        "id": "ruin_1771834883824_6slf",
        "name": "Ruinweapons",
        "image": "assets/puzzles/pieces/ruinweapons.png"
      },
      {
        "id": "ruin_1771835345348_ff9i",
        "name": "Codex ring",
        "image": "assets/puzzles/pieces/Codex_ring.png"
      },
      {
        "id": "ruin_1771835357593_rq0e",
        "name": "Iso plate",
        "image": "assets/puzzles/pieces/Iso_plate.png"
      },
      {
        "id": "ruin_1771835375547_hg3q",
        "name": "Spindial",
        "image": "assets/puzzles/pieces/spindial.png"
      }
    ],
    "ideograms": [
      {
        "id": "ideogram_1771503169529_zl52",
        "name": "Ideogram Codex",
        "placedRuins": [],
        "clearRects": [],
        "textElements": [],
        "drawnShapes": [],
        "codices": [
          {
            "id": "codex_1771586581401_3ai2",
            "image": "assets/puzzles/pieces/Codex_ring.png",
            "x": -1930.2857142857138,
            "y": -1255.2380952380956,
            "width": 402,
            "height": 402,
            "rotation": 288,
            "ruinCount": 5,
            "slotSize": 200,
            "name": "Codex ring",
            "slots": [
              {
                "image": "assets/puzzles/pieces/ruinshield.png",
                "name": "ruinshield",
                "width": 440,
                "height": 401,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinengine.png",
                "name": "ruinengine",
                "width": 283,
                "height": 423,
                "rotation": 270,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinnavigation.png",
                "name": "ruinnavigation",
                "width": 445,
                "height": 726,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruincryo.png",
                "name": "ruincryo",
                "width": 621,
                "height": 362,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinweapons.png",
                "name": "ruinweapons",
                "width": 409,
                "height": 386,
                "rotation": 90,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              }
            ],
            "solvedSlots": null,
            "isSpindial": false,
            "discOrientCoupling": false,
            "linkedSpindial": false,
            "mirrorCoupling": false,
            "gateRotate": false,
            "gateFlip": false,
            "imageOpacity": 1,
            "ruinScale": 0.25,
            "ruinProximity": 0
          },
          {
            "id": "codex_1771587348567_479c",
            "image": "assets/puzzles/pieces/spindial.png",
            "x": -2300.333333333333,
            "y": -1156.6666666666667,
            "width": 140,
            "height": 140,
            "rotation": 270,
            "ruinCount": 5,
            "slotSize": 200,
            "name": "Spindial",
            "slots": [
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": ""
              }
            ],
            "solvedSlots": null,
            "isSpindial": true,
            "discOrientCoupling": false,
            "linkedSpindial": false,
            "mirrorCoupling": false,
            "gateRotate": false,
            "gateFlip": false,
            "linkedCodexId": "codex_1771586581401_3ai2"
          }
        ],
        "viewport": {
          "offsetX": 2494.333333333333,
          "offsetY": 1446.2380952380956,
          "zoom": 1
        },
        "metadata": {
          "created": 1771503169529,
          "modified": 1771859397704
        },
        "thumbnail": "assets/puzzles/pieces/Ideogram codex.png",
        "isopresses": [
          {
            "id": "isopress_1771587603806_r2dq",
            "image": "assets/puzzles/pieces/Iso_plate.png",
            "x": -1280.9047619047615,
            "y": -1161.6666666666665,
            "width": 212,
            "height": 212,
            "name": "Iso plate",
            "linkedCodexId": "codex_1771586581401_3ai2"
          }
        ],
        "isolathes": []
      },
      {
        "id": "ideogram_1771835330470_znts",
        "name": "Ideogram Test",
        "placedRuins": [],
        "clearRects": [],
        "textElements": [],
        "drawnShapes": [],
        "codices": [
          {
            "id": "codex_1771835454042_gtgw",
            "image": "assets/puzzles/pieces/Codex_ring.png",
            "x": 391,
            "y": 154.5450439453125,
            "width": 389,
            "height": 389,
            "rotation": 0,
            "ruinCount": 5,
            "slotSize": 200,
            "name": "Codex ring hidden",
            "slots": [
              {
                "image": "assets/puzzles/pieces/ruinweapons.png",
                "name": "ruinweapons",
                "width": 409,
                "height": 386,
                "rotation": 270,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinshield.png",
                "name": "ruinshield",
                "width": 440,
                "height": 401,
                "rotation": 180,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinengine.png",
                "name": "ruinengine",
                "width": 283,
                "height": 423,
                "rotation": 90,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinnavigation.png",
                "name": "ruinnavigation",
                "width": 445,
                "height": 726,
                "rotation": 90,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruincryo.png",
                "name": "ruincryo",
                "width": 621,
                "height": 362,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              }
            ],
            "solvedSlots": [
              {
                "image": "assets/puzzles/pieces/ruincryo.png",
                "name": "ruincryo",
                "width": 621,
                "height": 362,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinweapons.png",
                "name": "ruinweapons",
                "width": 409,
                "height": 386,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinshield.png",
                "name": "ruinshield",
                "width": 440,
                "height": 401,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinengine.png",
                "name": "ruinengine",
                "width": 283,
                "height": 423,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              },
              {
                "image": "assets/puzzles/pieces/ruinnavigation.png",
                "name": "ruinnavigation",
                "width": 445,
                "height": 726,
                "rotation": 0,
                "flipped": false,
                "lockPosition": false,
                "lockOrientation": false,
                "pinPosition": false
              }
            ],
            "isSpindial": false,
            "discOrientCoupling": true,
            "linkedSpindial": false,
            "mirrorCoupling": false,
            "gateRotate": false,
            "gateFlip": false,
            "ruinScale": 0.15,
            "ruinProximity": -125
          },
          {
            "id": "codex_1771835490575_c1df",
            "image": "assets/puzzles/pieces/spindial.png",
            "x": 449,
            "y": 210,
            "width": 273,
            "height": 273,
            "rotation": 90,
            "ruinCount": 5,
            "slotSize": 200,
            "name": "Spindial",
            "slots": [
              {
                "image": null,
                "name": ""
              },
              {
                "image": null,
                "name": "",
                "pinPosition": false
              },
              {
                "image": null,
                "name": "",
                "pinPosition": false
              },
              {
                "image": null,
                "name": "",
                "pinPosition": false
              },
              {
                "image": null,
                "name": "",
                "pinPosition": false
              }
            ],
            "solvedSlots": null,
            "isSpindial": true,
            "discOrientCoupling": false,
            "linkedSpindial": false,
            "mirrorCoupling": false,
            "gateRotate": false,
            "gateFlip": false,
            "linkedCodexId": "codex_1771835454042_gtgw"
          }
        ],
        "viewport": {
          "offsetX": 194,
          "offsetY": 120,
          "zoom": 1
        },
        "metadata": {
          "created": 1771835330470,
          "modified": 1771859659703
        },
        "isopresses": [
          {
            "id": "isopress_1771836509064_4wue",
            "image": "assets/puzzles/pieces/Iso_plate.png",
            "x": 480,
            "y": 174.27252197265625,
            "width": 200,
            "height": 200,
            "name": "Iso plate",
            "linkedCodexId": "codex_1771835454042_gtgw",
            "ruinScale": 0.25,
            "lockedSlot": null,
            "ruinOnTop": true,
            "useOriginalScale": true,
            "hideAsset": true
          },
          {
            "id": "isopress_1771842079772_7y99",
            "image": "assets/puzzles/pieces/Iso_plate.png",
            "x": 546.5,
            "y": 202.77252197265625,
            "width": 200,
            "height": 200,
            "name": "Iso plate",
            "linkedCodexId": "codex_1771835454042_gtgw",
            "lockedSlot": {
              "image": "assets/puzzles/pieces/ruinweapons.png",
              "rotation": 0,
              "flipped": false,
              "name": "Ruinweapons"
            },
            "ruinScale": 0.25,
            "ruinOnTop": true,
            "useOriginalScale": true,
            "hideAsset": true
          },
          {
            "id": "isopress_1771845368815_kfyw",
            "image": "assets/puzzles/pieces/Iso_plate.png",
            "x": 452.5,
            "y": 258.77252197265625,
            "width": 200,
            "height": 200,
            "name": "Iso plate",
            "linkedCodexId": "codex_1771835454042_gtgw",
            "lockedSlot": {
              "image": "assets/puzzles/pieces/ruinengine.png",
              "rotation": 0,
              "flipped": false,
              "name": "Ruinengine"
            },
            "ruinScale": 0.25,
            "ruinOnTop": true,
            "useOriginalScale": true,
            "hideAsset": true
          },
          {
            "id": "isopress_1771845371448_63y3",
            "image": "assets/puzzles/pieces/Iso_plate.png",
            "x": 432,
            "y": 260.27252197265625,
            "width": 200,
            "height": 200,
            "name": "Iso plate",
            "linkedCodexId": "codex_1771835454042_gtgw",
            "lockedSlot": {
              "image": "assets/puzzles/pieces/ruinnavigation.png",
              "rotation": 0,
              "flipped": false,
              "name": "Ruinnavigation"
            },
            "ruinScale": 0.25,
            "ruinOnTop": true,
            "useOriginalScale": true,
            "hideAsset": true
          },
          {
            "id": "isopress_1771845377957_trob",
            "image": "assets/puzzles/pieces/Iso_plate.png",
            "x": 522.5,
            "y": 281.77252197265625,
            "width": 238,
            "height": 238,
            "name": "Iso plate",
            "linkedCodexId": "codex_1771835454042_gtgw",
            "lockedSlot": {
              "image": "assets/puzzles/pieces/ruinshield.png",
              "rotation": 0,
              "flipped": false,
              "name": "Ruinshield"
            },
            "ruinScale": 0.25,
            "ruinOnTop": true,
            "useOriginalScale": true,
            "hideAsset": true
          }
        ],
        "isolathes": [],
        "thumbnail": "assets/puzzles/pieces/Ideogram test.png"
      }
    ]
  }
};
