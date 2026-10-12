# 🔻 Smart Filter Hopper Add-On (Minecraft Bedrock Edition)

**Smart Filter Hopper** is an advanced sorting automation add-on for Minecraft Bedrock (1.20.80+ / 1.21.x) created by **AllensCreations**. It modernizes vanilla item sorting with single-slot template filtering, Whitelist/Blacklist routing, high-speed bulk transfers, and Redstone locking.

---

## ✨ Features

- 🎯 **1 Item Filter Slot**: Open the hopper to access a single, streamlined filter slot. Tap with an item to lock it as the filter; tap empty-handed to clear it.
- 🔄 **Whitelist & Blacklist Modes**: Toggle with a single click between **Whitelist** (only allow the item through) and **Blacklist** (block the item and allow everything else).
- 🧭 **Authentic Vanilla Nozzle Placement**: Attach against any surface (chests, hoppers, walls, floors). The nozzle connects directly **INTO** the clicked block face.
- 🧱 **Vanilla Crouch Placement**: Crouching/sneaking allows you to place blocks directly against the hopper without accidentally opening the menu.
- 🥊 **In-World Sneak-Punch Toggle**: Crouch and punch the placed hopper with an empty hand to toggle flow ON/OFF anytime with an on-screen alert.
- ⚡ **High-Speed Transfer Engine**: Transfers items in bulk (16 items per pulse) from the container directly above into the connected destination container.
- 🔴 **Redstone Signal Control**: Apply a Redstone signal to pause and lock the hopper flow (vanilla behavior).
- 🎨 **Enhanced Textures**: Upgraded vanilla hopper textures featuring brass reinforcement rivets, a glowing ruby filter lens, and subtle conduit accents.

---

## 🛠️ Survival Crafting Recipes

Crafted in a 3×3 Crafting Table:

### Recipe 1 (Redstone Torch)
```
[   ] [Hopper] [   ]
[   ] [Torch ] [   ]
```
* **Ingredients**: 1× Vanilla Hopper (`minecraft:hopper`) + 1× Redstone Torch (`minecraft:redstone_torch`)

### Recipe 2 (Redstone Dust)
```
[   ] [Hopper] [   ]
[   ] [Redstone] [ ]
```
* **Ingredients**: 1× Vanilla Hopper (`minecraft:hopper`) + 1× Redstone Dust (`minecraft:redstone`)

---

## 🎮 How to Use

1. **Place the Hopper**:
   - Crouch and place against your destination chest or container. The nozzle will point directly into it.
2. **Configure the Filter**:
   - Right-click / tap the hopper to open the **Item Filter** screen.
   - Tap the **Filter Slot** while holding an item to lock it.
   - Tap **Whitelist** to switch between Whitelist and Blacklist.
3. **Automate**:
   - Place a storage chest directly above the hopper. Matching items will automatically route into the destination container at high speed!

---

## 📦 Repository Structure

```
smart-filter-hopper/
├── behavior_pack/
│   ├── blocks/filter_hopper.block.json
│   ├── items/filter_hopper.json
│   ├── loot_tables/blocks/filter_hopper.json
│   ├── recipes/filter_hopper.json
│   ├── recipes/filter_hopper_dust.json
│   ├── scripts/main.js
│   ├── pack_icon.png
│   └── manifest.json
├── resource_pack/
│   ├── blocks.json
│   ├── models/blocks/filter_hopper.geo.json
│   ├── textures/
│   │   ├── blocks/
│   │   ├── items/
│   │   ├── terrain_texture.json
│   │   └── item_texture.json
│   ├── texts/en_US.lang
│   ├── pack_icon.png
│   └── manifest.json
└── Smart_Filter_Hopper.mcaddon
```

---

## 📥 Installation

1. Download [Smart_Filter_Hopper.mcaddon](Smart_Filter_Hopper.mcaddon).
2. Tap the file to open and import into Minecraft Bedrock.
3. Enable **Beta APIs** under your world's Experiments settings.
