import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const HOPPER_BLOCK_ID = "custom:filter_hopper";
const REGISTRY_PROPERTY = "sfh_registry_v1";

// Cache for active hoppers: "dim:x,y,z" -> config
let hopperCache = new Map();

// Tracks player interaction before placement to capture clicked block face accurately
const pendingPlacements = new Map();

/**
 * Loads registered hoppers from world dynamic properties
 */
function loadRegistry() {
  try {
    const raw = world.getDynamicProperty(REGISTRY_PROPERTY);
    if (typeof raw === "string" && raw.length > 0) {
      const data = JSON.parse(raw);
      hopperCache = new Map(Object.entries(data));
    }
  } catch (e) {
    console.warn("[SmartFilterHopper] Error loading registry: " + e);
    hopperCache = new Map();
  }
}

/**
 * Saves current hopper cache to world dynamic properties
 */
function saveRegistry() {
  try {
    const obj = Object.fromEntries(hopperCache);
    world.setDynamicProperty(REGISTRY_PROPERTY, JSON.stringify(obj));
  } catch (e) {
    console.warn("[SmartFilterHopper] Error saving registry: " + e);
  }
}

function getHopperKey(dimensionId, x, y, z) {
  return `${dimensionId}:${x},${y},${z}`;
}

loadRegistry();

/**
 * Maps player placement face to custom:facing_direction string state.
 * To point INTO the clicked block (exact vanilla hopper behavior):
 * - Click North face of target -> hopper attaches towards South (into target)
 * - Click South face of target -> hopper attaches towards North (into target)
 * - Click West face of target  -> hopper attaches towards East  (into target)
 * - Click East face of target  -> hopper attaches towards West  (into target)
 * - Click Top (Up) or Down face -> hopper attaches straight Down
 */
function getFacingFromClickedFace(blockFace) {
  const faceStr = String(blockFace).toLowerCase();
  if (faceStr.includes("north")) return "south";
  if (faceStr.includes("south")) return "north";
  if (faceStr.includes("west"))  return "east";
  if (faceStr.includes("east"))  return "west";
  return "down";
}

/**
 * Returns destination block that the hopper nozzle connects into
 */
function getDestinationBlock(block, facing) {
  try {
    switch (facing) {
      case "north": return block.north();
      case "south": return block.south();
      case "west": return block.west();
      case "east": return block.east();
      case "down":
      default: return block.below();
    }
  } catch (e) {
    return undefined;
  }
}

// ----------------------------------------------------
// EVENT: Player Interacts with Block
// ----------------------------------------------------
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, blockFace, itemStack } = event;
  if (!player) return;

  // Track placement of Smart Filter Hopper to capture clicked face
  if (itemStack && itemStack.typeId === HOPPER_BLOCK_ID) {
    pendingPlacements.set(player.id, {
      blockFace: String(blockFace),
      tick: system.currentTick
    });
    return; // Allow placement to proceed
  }

  if (block.typeId !== HOPPER_BLOCK_ID) return;

  // SNEAK BEHAVIOR:
  // When crouching/sneaking: allow placing blocks against the hopper (vanilla behavior)
  if (player.isSneaking) {
    return;
  }

  // NORMAL RIGHT-CLICK:
  // Open the "Item Filter" UI matching the reference layout
  event.cancel = true;
  system.run(() => {
    openItemFilterUI(player, block);
  });
});

// ----------------------------------------------------
// EVENT: Block Placed
// ----------------------------------------------------
world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { block, dimension, player } = event;
  if (block.typeId !== HOPPER_BLOCK_ID) return;

  let clickedFace = "Up";
  if (player && pendingPlacements.has(player.id)) {
    const p = pendingPlacements.get(player.id);
    if (system.currentTick - p.tick <= 10) {
      clickedFace = p.blockFace;
    }
    pendingPlacements.delete(player.id);
  }

  // Determine nozzle facing: attaches directly INTO the clicked block
  const facing = getFacingFromClickedFace(clickedFace);

  try {
    const perm = block.permutation.withState("custom:facing_direction", facing);
    block.setPermutation(perm);
  } catch (e) {
    console.warn("[SmartFilterHopper] Error setting permutation: " + e);
  }

  const key = getHopperKey(dimension.id, block.x, block.y, block.z);
  hopperCache.set(key, {
    x: block.x,
    y: block.y,
    z: block.z,
    dimensionId: dimension.id,
    facing: facing,
    enabled: true,
    mode: "whitelist",
    batchSize: 16,
    filterTypeId: null
  });
  saveRegistry();

  dimension.playSound("dig.stone", block.location, { volume: 0.8, pitch: 1.2 });
});

// ----------------------------------------------------
// EVENT: Block Broken
// ----------------------------------------------------
world.afterEvents.playerBreakBlock.subscribe((event) => {
  const { block, dimension } = event;
  if (event.brokenBlockPermutation?.type?.id !== HOPPER_BLOCK_ID) return;

  const key = getHopperKey(dimension.id, block.x, block.y, block.z);
  if (hopperCache.has(key)) {
    hopperCache.delete(key);
    saveRegistry();
  }
});

// ----------------------------------------------------
// EVENT: Sneak-Punch to Toggle Flow in World
// ----------------------------------------------------
world.afterEvents.entityHitBlock.subscribe((event) => {
  const { damagingEntity: player, block } = event;
  if (!player || player.typeId !== "minecraft:player" || !player.isSneaking) return;
  if (block.typeId !== HOPPER_BLOCK_ID) return;

  const key = getHopperKey(block.dimension.id, block.x, block.y, block.z);
  const config = hopperCache.get(key);
  if (!config) return;

  config.enabled = !config.enabled;
  saveRegistry();

  block.dimension.playSound("random.click", block.location, { volume: 0.6, pitch: config.enabled ? 1.6 : 0.8 });
  player.onScreenDisplay?.setActionBar(
    config.enabled ? "§6[Item Filter] §a✔ FLOW ACTIVE" : "§6[Item Filter] §c✖ FLOW PAUSED"
  );
});

/**
 * UI styled directly after reference image (https://ibb.co/XZg1z62M)
 * Header: "Item Filter"
 * [ 1 Filter Slot ] on left  +  [ Whitelist / Blacklist ] button on right
 */
function openItemFilterUI(player, block) {
  const key = getHopperKey(block.dimension.id, block.x, block.y, block.z);
  let config = hopperCache.get(key);

  if (!config) {
    let currentFacing = "down";
    try {
      currentFacing = block.permutation.getState("custom:facing_direction") || "down";
    } catch (e) {}

    config = {
      x: block.x,
      y: block.y,
      z: block.z,
      dimensionId: block.dimension.id,
      facing: currentFacing,
      enabled: true,
      mode: "whitelist",
      batchSize: 16,
      filterTypeId: null
    };
    hopperCache.set(key, config);
  }

  const heldItem = player.getComponent("inventory")?.container?.getItem(player.selectedSlotIndex);
  const heldItemName = heldItem ? heldItem.typeId.replace("minecraft:", "") : null;

  const currentFilterName = config.filterTypeId 
    ? config.filterTypeId.replace("minecraft:", "") 
    : "Empty";

  const isWhitelist = (config.mode || "whitelist") === "whitelist";

  const form = new ActionFormData()
    .title("§l§8Item Filter§r")
    .body(
      `§7══════════════════════════════════§r\n` +
      `  §8[SLOT]§r                     §8[MODE]§r\n` +
      `  §f${config.filterTypeId ? `[ §e${currentFilterName} §f]` : "[ Empty Slot ]"}§r   §7➔§r  ${isWhitelist ? "§a[ Whitelist ]" : "§c[ Blacklist ]"}\n` +
      `§7══════════════════════════════════§r\n` +
      `• Nozzle Direction: §b${config.facing.toUpperCase()}§r\n` +
      `• Hopper Flow: ${config.enabled ? "§2ACTIVE§r" : "§4PAUSED§r"}\n\n` +
      `§8Inventory: ${heldItemName ? `Holding §e${heldItemName}§r` : "Empty hand"}`
    );

  // 1. THE FILTER SLOT BUTTON
  if (config.filterTypeId) {
    form.button(`§6[ 📦 ${currentFilterName} ]\n§7Tap to Remove / Replace`);
  } else if (heldItemName) {
    form.button(`§d[ ➕ Insert: ${heldItemName} ]\n§7Tap to lock into slot`);
  } else {
    form.button("§8[ ➕ Empty Filter Slot ]\n§7Hold an item & tap to set");
  }

  // 2. THE WHITELIST / BLACKLIST TOGGLE BUTTON (Matches reference image)
  if (isWhitelist) {
    form.button("§a✔ Whitelist\n§7(Only allow matching item)");
  } else {
    form.button("§c✖ Blacklist\n§7(Block matching item)");
  }

  // 3. FLOW ON/OFF TOGGLE
  if (config.enabled) {
    form.button("§2▶ Flow: Active\n§7Tap to Pause");
  } else {
    form.button("§4⏸ Flow: Paused\n§7Tap to Activate");
  }

  // 4. TOP CHEST HELPER
  form.button("§6📦 Pick from Top Chest\n§7Select item from chest above");

  form.show(player).then((response) => {
    if (response.canceled) return;

    switch (response.selection) {
      case 0: // Slot Button
        if (heldItem) {
          config.filterTypeId = heldItem.typeId;
          player.sendMessage(`§6[Item Filter]§r Filter slot locked to: §e${heldItemName}`);
          block.dimension.playSound("random.levelup", block.location, { volume: 0.5, pitch: 1.8 });
        } else if (config.filterTypeId) {
          config.filterTypeId = null;
          player.sendMessage("§6[Item Filter]§r Filter slot cleared (Idle standby mode).");
          block.dimension.playSound("random.break", block.location, { volume: 0.4, pitch: 1.0 });
        } else {
          player.sendMessage("§c[Item Filter]§r Hold the item you want to filter in your hand and tap the slot again!");
        }
        break;

      case 1: // Whitelist / Blacklist Toggle
        config.mode = isWhitelist ? "blacklist" : "whitelist";
        player.sendMessage(`§6[Item Filter]§r Filter Mode switched to: §e${config.mode.toUpperCase()}`);
        block.dimension.playSound("random.click", block.location, { volume: 0.5, pitch: 1.4 });
        break;

      case 2: // Flow On / Off Toggle
        config.enabled = !config.enabled;
        player.sendMessage(`§6[Item Filter]§r Hopper Flow set to: ${config.enabled ? "§aACTIVE" : "§cPAUSED"}`);
        block.dimension.playSound("random.click", block.location, { volume: 0.5, pitch: config.enabled ? 1.6 : 0.8 });
        break;

      case 3: // Pick from top chest
        openTopChestSelector(player, block, config);
        return;
    }

    saveRegistry();
  });
}

/**
 * Select filter item from items present in the container above
 */
function openTopChestSelector(player, block, config) {
  const topBlock = block.above();
  const topInv = topBlock?.getComponent("inventory")?.container;

  if (!topInv || topInv.size === 0) {
    player.sendMessage("§c[Item Filter] No container found above this hopper!");
    return;
  }

  const uniqueItems = new Set();
  for (let i = 0; i < topInv.size; i++) {
    const item = topInv.getItem(i);
    if (item) uniqueItems.add(item.typeId);
  }

  if (uniqueItems.size === 0) {
    player.sendMessage("§c[Item Filter] The container above is empty!");
    return;
  }

  const itemsList = Array.from(uniqueItems);
  const form = new ActionFormData()
    .title("§l§8Item Filter - Top Chest§r")
    .body("§7Tap an item from the top chest to place into the filter slot:§r");

  for (const id of itemsList) {
    form.button(`§e${id.replace("minecraft:", "")}`);
  }

  form.show(player).then((res) => {
    if (res.canceled) return;
    const selectedId = itemsList[res.selection];
    if (selectedId) {
      config.filterTypeId = selectedId;
      saveRegistry();
      player.sendMessage(`§6[Item Filter]§r Filter slot locked to: §e${selectedId.replace("minecraft:", "")}`);
      block.dimension.playSound("random.levelup", block.location, { volume: 0.5, pitch: 1.8 });
    }
  });
}

// ----------------------------------------------------
// TRANSFER ENGINE: system.runInterval (Every 4 Ticks = 0.2s)
// ----------------------------------------------------
system.runInterval(() => {
  if (hopperCache.size === 0) return;

  for (const [key, config] of hopperCache.entries()) {
    try {
      const dimension = world.getDimension(config.dimensionId || "overworld");
      if (!dimension) continue;

      const block = dimension.getBlock({ x: config.x, y: config.y, z: config.z });
      if (!block || !block.isValid() || block.typeId !== HOPPER_BLOCK_ID) {
        hopperCache.delete(key);
        saveRegistry();
        continue;
      }

      // 1. Redstone Signal Locking
      if (typeof block.getRedstonePower === "function" && block.getRedstonePower() > 0) {
        continue;
      }

      // 2. Manual Toggle Check
      if (config.enabled === false) {
        continue;
      }

      // 3. Filter Template Check: if slot is empty, IDLE (move nothing)
      if (!config.filterTypeId) {
        continue;
      }

      const targetFilter = config.filterTypeId;
      const isWhitelist = (config.mode || "whitelist") === "whitelist";
      const batchLimit = config.batchSize || 16;

      // 4. Source Container (Above)
      const topBlock = block.above();
      const topInv = topBlock?.getComponent("inventory")?.container;
      if (!topInv || topInv.size === 0) continue;

      // 5. Destination Container (Connected Nozzle direction)
      const destBlock = getDestinationBlock(block, config.facing || "down");
      const destInv = destBlock?.getComponent("inventory")?.container;
      if (!destInv || destInv.size === 0) continue;

      // 6. Fast Filter Routing: Whitelist vs Blacklist
      let movedCount = 0;

      for (let s = 0; s < topInv.size && movedCount < batchLimit; s++) {
        const item = topInv.getItem(s);
        if (!item) continue;

        const matches = (item.typeId === targetFilter);
        const shouldMove = isWhitelist ? matches : !matches;

        if (shouldMove) {
          const moveQuantity = Math.min(item.amount, batchLimit - movedCount);
          const stackToMove = new ItemStack(item.typeId, moveQuantity);

          const remainder = destInv.addItem(stackToMove);

          if (!remainder) {
            // Full stack moved
            if (item.amount <= moveQuantity) {
              topInv.setItem(s, undefined);
            } else {
              item.amount -= moveQuantity;
              topInv.setItem(s, item);
            }
            movedCount += moveQuantity;
          } else {
            // Partial move
            const actualMoved = moveQuantity - remainder.amount;
            if (actualMoved > 0) {
              if (item.amount <= actualMoved) {
                topInv.setItem(s, undefined);
              } else {
                item.amount -= actualMoved;
                topInv.setItem(s, item);
              }
              movedCount += actualMoved;
            }
            break; // Destination container full
          }
        }
      }

    } catch (err) {
      // Chunk unload safe recovery
    }
  }
}, 4);

console.warn("[SmartFilterHopper] Engine v1.5 loaded!");
