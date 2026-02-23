# Cryo Facility — Game Flow

## Story

You're the last one awake. Power is failing. 10,000 people in cryo stasis depend on you. Fix the engine or they all die.

## Rooms

| # | Room | Contents |
|---|------|----------|
| 1 | **Cryo Pod Room** | Scanning console, your cryo pod, other pods |
| 2 | **Loading Bay** | Isopress, Isolathe, three doors (cryo, engine shaft, one more) |
| 3 | **Operations** | Terminal, three-slot machine (one per cryo pod, one light on), kinetic power device, cryo ruinMark, engine ruinMark |
| 4 | **Engine Shaft** | Corridor connecting cryo to its engine |
| 5 | **Engine Room** | Generator with cracked IsoMark (both halves damaged — junk) |

## Items & Mechanics

### Plate Types

| Item | Description |
|------|-------------|
| **blank_Mark** | Blank rectangular base plate |
| **ruinMark** | blank_Mark with a ruin stamped on it — perfectly square, orientation unknown from looking at it |
| **IsoPlate** | Blank hex gold plate |
| **IsoMark** | ruinMark + IsoPlate forged at the Isopress — formalized, can operate systems |
| **Spindial** | Player's identity and universal tool — doors, map, holds ruin symbols |

### Rules

- **Spindial = doors.** Always. No exceptions. IsoMarks do not open doors.
- **IsoMarks = systems.** Plug into machines to operate them.
- **Isopress** forges IsoMarks (ruinMark + IsoPlate). Player chooses orientation. Only symbols loaded on the spindial are available at the press.
- **Isolathe** disassembles IsoMarks → ruinMark + blank IsoPlate. The IsoPlate always comes out blank (symbol wiped).
- **Terminal** displays loaded plates or all symbols on the spindial.
- **RuinMarks are square** — you cannot determine correct orientation by looking at them.
- **Orientation matters** — wrong orientation on the spindial won't open doors. The ideogram/meta map requires correct orientations.
- **Single-use IsoMarks** — IsoMarks without an identity dot are single-use as keys (symbol fades). The spindial is permanent.

### Symbols Available in Cryo

- **Cryo** — the facility identity
- **Engine** — cryo's local generator

## Player Walkthrough

### Cryo Pod Room

Player wakes up in cryo pod. Takes IsoPlate from cryo bed — it has the dot (player identity) and the cryo symbol. Uses scanning console. Scanner issues the spindial with cryo symbol loaded and returns a blank IsoPlate. The dot becomes the spindial — they are the same thing.

### Loading Bay

Player enters the loading bay. No power to machinery. Three doors — came from cryo, two remain (one to operations, one to engine shaft — locked). The Isopress and Isolathe are here.

### Operations

Player enters operations. Powers the room with kinetic device. Finds cryo ruinMark and engine ruinMark. The terminal can show symbols from the spindial and display loaded plates. Player learns about orientations here — the cryo ruinMark serves as tutorial/practice material.

Player loads engine ruin onto spindial at the terminal.

### Forging Cryo IsoMark (Optional — Reason TBD)

Player forges cryo IsoMark at the Isopress (cryo ruinMark + blank IsoPlate, chooses orientation). Plugs into three-slot machine. Blank IsoPlate is now used up.

**Placeholder:** There should be a reason the player must forge the cryo IsoMark before proceeding to the engine, but this is TBD. Currently this step is optional.

### Engine Shaft

The engine symbol is visible on the engine door — this is the orientation clue. Player must have the engine symbol on the spindial with the correct orientation. Spindial opens the engine shaft door. Player traverses the corridor.

### Engine Room

Player reaches the engine room. The IsoMark powering the generator is cracked — both halves are damaged, completely unusable.

Player retrieves the cracked IsoMark. Takes it to the Isolathe — junk. Neither the ruinMark nor the IsoPlate is salvageable.

### The Swap

If the player forged the cryo IsoMark first: player pulls cryo IsoMark from the three-slot machine. Isolathes it — cryo ruinMark returned + blank IsoPlate recovered. Forges engine IsoMark (engine ruinMark + blank IsoPlate, chooses orientation). Plugs into engine console. Power restored.

If the player skipped the cryo IsoMark: player forges engine IsoMark directly (engine ruinMark + blank IsoPlate). Plugs into engine console. Power restored.

### Power Restored

Restoring power unlocks a compartment in the loading bay containing a new blank IsoPlate.

Player forges cryo IsoMark (cryo ruinMark + blank IsoPlate, chooses orientation). Plugs into three-slot machine.

### Meta Map

Player uses the terminal to arrange and orient all symbols on the spindial. The correct arrangement and orientations form the ideogram — the meta map puzzle that spans the entire game. Cryo's symbols are the first pieces.

## Item Inventory

Items the player encounters in the cryo facility:

IsoPlates: 2 total
  1. From scanner (returned after spindial is issued)
  2. Reward from restoring power (compartment in loading bay)

RuinMarks: 3 total
  1. Cryo ruinMark (found in operations)
  2. Engine ruinMark (found somewhere in facility)
  3. Cracked engine ruinMark (from Isolathing the cracked IsoMark — junk, unusable)

IsoMarks: 2 created, 1 found
  1. Cryo IsoMark (forged by player)
  2. Engine IsoMark (forged by player)
  3. Cracked engine IsoMark (found in engine room — junk, both halves damaged)

Spindial: 1
  Issued at scanner, holds cryo + engine symbols

Map: 1
  Tapestry inside cylinder compartment in operations desk, revealed later as reward for solving the meta map ideogram


## Item Tracking

| IsoPlate | Journey |
|----------|---------|
| **#1** (from scanner) | → cryo IsoMark → three-slot machine → Isolathed → engine IsoMark → engine console |
| **#2** (reward from restoring power) | → cryo IsoMark (rebuilt) → three-slot machine |

If cryo IsoMark step is skipped:

| IsoPlate | Journey |
|----------|---------|
| **#1** (from scanner) | → engine IsoMark → engine console |
| **#2** (reward from restoring power) | → cryo IsoMark → three-slot machine |

## Assets Needed

Cryo Pod Room:
  - Wall console background (scanner)

Loading Bay:
  -

Operations:
  -

Engine Shaft:
  -

Engine Room:
  -


## Editor Updates Needed

Hotspot config menu:
  - Currently: action select, then accepts item / required item
  - Need: after required item is set, add another action menu


Puzzle hotspots — crafting support:
  - Need a method to require two items (e.g. ruinMark + IsoPlate) as crafting inputs
  - On use, consumes both items and rewards a new item (e.g. IsoMark) as pickup
  - Isopress and Isolathe both need this two-in-one-out pattern

Puzzle editor:
  - Ability to position the puzzle panel and lock it to a certain part of the screen
  - Button to reset it back to centered


## Open Questions
t
- What forces the player to forge the cryo IsoMark before the engine IsoMark?
- What are the orientation clues for the cryo symbol?
- What does the three-slot machine do when the cryo IsoMark is inserted?
- The circle on the desk in operations is the spindial dock — place the spindial there to interact with the kinetic power puzzle that generates temporary power to the room.
- The third door in the loading bay leads to the engine shaft.
