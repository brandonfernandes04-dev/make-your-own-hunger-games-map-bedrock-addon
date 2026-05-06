import {world, system, Player, ItemStack, Dimension } from "@minecraft/server";
import { ModalFormData, ActionFormData, MessageFormData } from "@minecraft/server-ui";

export class Map { //Class that provides methods and Properties for Making a Map as well as saving it to the world via a dynamic property. 
    constructor(name, mapData) {
        this.name = name;
        this.mapData = mapData;
    }
    static allMaps = []; //array that holds instnaces of this class. Maps are pushed to this array with the static method loadAllMaps() Which pulls from the worlds dynamic properties.
    static allMapIds = [] //aray that holds ids of created Maps.
    static loadAllMaps() {
       const IDs = world.getDynamicPropertyIds().filter(id => id.startsWith("map:"));
       if(!IDs) return;
       IDs.forEach(id => {
        const dynamicProperty = world.getDynamicProperty(id);
        const map = new Map(id, dynamicProperty);
        Map.allMaps.push(map);
        Map.allMapIds.push(id)
       })
    };
    static getAllMapIds() {
        if(Map.allMapIds.length < 1) {
            return ["No maps created"]
        }
        if (Map.allMapIds.length > 1) {
            return Map.allMapIds
        } 
    };
    load() {
       const rawData = JSON.parse(this.mapData);
       return rawData;
    };
    save() {
        world.setDynamicProperty(`map: ${this.name}`, `${this.mapData}`);
        return world.sendMessage(`Created Map: ${this.name}, with this data attached: ${this.mapData}`);
    }

};

function giveMapMakerItems(player) {
    const items = ["b_minigames:clear_all", "b_minigames:set_name", "b_minigames:set_spawn", "b_minigames:set_barrier", "b_minigames:set_chest", "b_minigames:set_door", "b_minigames:set_mins", "b_minigames:confirm_and_create"]
    const inventory = player.getComponent("minecraft:inventory").container
    for (let i = 0; i < items.length; i++) {
        const slot = inventory.getSlot(i)
        const item = new ItemStack(items[i], 1)
        slot.setItem(item)
    }
}

function takeMapMakerItems(player) {
    const items = ["b_minigames:clear_all", "b_minigames:set_name", "b_minigames:set_spawn", "b_minigames:set_barrier", "b_minigames:set_chest", "b_minigames:set_door", "b_minigames:set_mins", "b_minigames:confirm_and_create"]
    const inventory = player.getComponent("minecraft:inventory").container
    for (let i = 0; i < items.length; i++) {
        const itemId = items[i]
        const item = new ItemStack(itemId, 1)
        const indexOfItem = inventory.find(item)
        const slot = inventory.getSlot(indexOfItem)
        slot.setItem(null)
    }
}



world.afterEvents.itemUse.subscribe((event) => { 
    const item = event.itemStack.typeId;
    if (item === "b_minigames:map_manager") {
    const directoryForm = new ActionFormData() //Form that allows navigation to other forms
        .title("Welcome to Hunger Games Map Maker")
        .button("Add a new map")
        .button("Delete a map")
        .button("Tutorial")
        .button("Credits");

    const mapMaker = new MessageFormData()
        .title('Welcome to Map Maker')
        .body('To get Started Select Yes. Warning This will Clear your hotbar!')
        .button1('Yes Continue')
        .button2('Close Form');
    
    const mapErase = new ModalFormData() //Form that allows for deletion of maps this form will erase maps from the worlds dynamic properties as well as the allMaps array in the Map Class 
        .title('Map Eraser')
        .header('Select the map you wish to erase')
        .dropdown('Maps', Map.allMapIds)
        .submitButton('Delete Map');
    
    
    const tutorialform = new MessageFormData() //Explanation of how to use the system as well as importnant notes for filling out the map maker form
        .title('How to use this addon')
        .body('') //Need to rewrite the tutorial now that methods for making a map have changed.
        .button1('Close');
    
    const credits = new MessageFormData() //credits for the Programmer and Map builder!
        .title('Credits')
        .body('This addon was made with much care and effort by me (Brandon) It is my intent that people will use this addon to create memories with their friends as well form new friendships!\nThe maps that come included with this addon were made with dedication and talent by My friend Richie. If this addon helps you in any way consider helping others with your craft! Thank you!')
        .button1('Close');
        const player = event.source
            directoryForm.show(player).then(response => {
                if (response.canceled) {return};
                const selection = response.selection;
                switch(selection) {
                    case 0: mapMaker.show(player).then(response => {
                        if (response.canceled) return
                        if (response.selection === 0) {
                            giveMapMakerItems(player)
                            player.addTag('makingMap')
                        }
                        if (response.selection === 1) {return};
                    }); break;
                    case 1: mapErase.show(player).then(response => {
                        if (response.canceled) return;
                        const chosenMap = response.formValues[1]
                        const MapId = Map.allMapIds[chosenMap]
                        Map.allMaps.splice(chosenMap, 1)
                        Map.allMapIds.splice(chosenMap, 1)
                        world.setDynamicProperty(MapId)
                    }); break;
                    case 2: tutorialform.show(player); break;
                    case 3: credits.show(player); break;
                }
            })
        }
    })

    let cachedName = ""

    let mapMakerCache = {
        spawns: [],
        barriers: [],
        chests: [],
        spawns: [],
        doors: [],
        numOfTicks: 1200,
        dimension: "minecraft:overworld"
    }


    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        if (event.isFirstEvent === false) return
        const player = event.player;
        if (player.hasTag('makingMap')) {
            const block = event.block
            const location = block.location
            const item = event.itemStack.typeId;
            switch (item) {
                case "b_minigames:clear_all": 
                cachedName = ""
                mapMakerCache.spawns = []
                mapMakerCache.barriers = []
                mapMakerCache.chests = []
                mapMakerCache.spawns = []
                mapMakerCache.doors = []
                mapMakerCache.numOfTicks = 1200
                mapMakerCache.dimension = "minecraft:overworld"
                break;
                case "b_minigames:set_name":
                    event.cancel = true
                    const setName = new ModalFormData()
                        .title('Map Name Input')
                        .textField('Please input a Name for you Map', 'Enter name here')
                        .submitButton('Submit Name');
                    system.run(() => {
                        setName.show(player).then(response => {
                            if (response.canceled) {
                                return;
                            }
                            const name = response.formValues[0]
                            cachedName = name
                        })
                    })
                break;
                case "b_minigames:set_spawn":
                    event.cancel = true
                    if (player.isSneaking === false) {
                        mapMakerCache.spawns.push(location)
                        world.sendMessage(`Spawn saved at: ${location.x}, ${location.y}, ${location.z}`)
                    }
                    if (player.isSneaking === true) {
                        const removedSpawn = mapMakerCache.spawns.pop()
                        world.sendMessage(`Spawn removed at: ${removedSpawn.x}, ${removedSpawn.y}, ${removedSpawn.z}`)
                    }
                    break;
                case "b_minigames:set_barrier":
                    event.cancel = true
                    if (player.isSneaking === false) {
                        mapMakerCache.barriers.push(location)
                        world.sendMessage(`Barrier saved at: ${location.x}, ${location.y}, ${location.z}`)
                    }
                    if (player.isSneaking === true) {
                       const removedBarrier = mapMakerCache.barriers.pop()
                       world.sendMessage(`Barrier removed at: ${removedBarrier.x}, ${removedBarrier.y}, ${removedBarrier.z}`)
                    }
                    break;
                case "b_minigames:set_chest":
                    event.cancel = true
                    if (player.isSneaking === false) {
                        mapMakerCache.chests.push(location)
                        world.sendMessage(`Chest saved at: ${location.x}, ${location.y}, ${location.z}`)
                    }
                    if (player.isSneaking === true) {
                        const removedChest = mapMakerCache.chests.pop()
                        world.sendMessage(`Chest removed at: ${removedChest.x}, ${removedChest.y}, ${removedChest.z}`)
                    }
                    break;
                case "b_minigames:set_door":
                    event.cancel = true
                    if (player.isSneaking === false) {
                        mapMakerCache.doors.push(location)
                        world.sendMessage(`Door saved at: ${location.x}, ${location.y}, ${location.z}`)
                    }
                    if (player.isSneaking === true) {
                        const removedDoor = mapMakerCache.doors.pop()
                        world.sendMessage(`Door removed at: ${removedDoor.x}, ${removedDoor.y}, ${removedDoor.z}`)
                    }
                    break;
                    case "b_minigames:set_mins":
                        event.cancel = true
                        const setMinsForm = new ModalFormData()
                        .title('Set the Number of Minutes')
                        .slider('How many minutes should the game run', 1, 20, {defaultValue: 10})
                        .submitButton('Submit');
                        system.run(() => {
                            setMinsForm.show(player).then(respone => {
                                if (respone.canceled) return;
                                const numberOfMins = respone.formValues[0]
                                const numberOfSecs = numberOfMins * 60
                                const numberOfTicks = numberOfSecs * 20
                                mapMakerCache.numOfTicks = numberOfTicks
                            })
                        })
                    break;
                    case "b_minigames:confirm_and_create":
                        event.cancel = true
                        mapMakerCache.dimension = player.dimension.id
                        if (cachedName.length === 0) {
                            return world.sendMessage('You must input a name for your map first!')
                        }
                        if (mapMakerCache.barriers.length === 0) {
                            world.sendMessage('You have no barriers made for this Map you may want to delete it!')
                        }
                        if (mapMakerCache.chests.length === 0) {
                            world.sendMessage('You have no chests made for this Map you may want to delete it!')
                        }
                        if (mapMakerCache.doors.length === 0) {
                            world.sendMessage('You have given no doors to reset if this is intentional you may ignore this message!')
                        }
                        if (mapMakerCache.numOfTicks === 1200) {
                            world.sendMessage('You have not set a time for this Map the default of 10 minutes has been chosen if that is intentional you may ignore this message!')
                        }
                        const dataString = JSON.stringify(mapMakerCache)
                        const createdMap = new Map(`${cachedName}`, dataString)
                        createdMap.save()
                        Map.allMapIds.push(`map: ${cachedName}`)
                        system.run(() => {
                            player.removeTag('makingMap')
                            takeMapMakerItems(player)
                        })
                    break;
                    return;
            }

        }

    })

    
    world.beforeEvents.playerInteractWithBlock.subscribe((event) => { //handles setting which tier of loot a chest will recieve during game initlization
        if (event.isFirstEvent === false) return
        const chestLootForm = new ActionFormData()
            .title('Set Chest Loot')
            .button('Set chest to low level loot')
            .button('Set chest to mid level loot')
            .button('Set chest to high level loot')
            .button('Erase this chest from Map');
    const gamemode = event.player.getGameMode()
    const block = event.block
    const location = block.location
    if(gamemode === "Creative" && event.player.isSneaking === true && block.typeId === "minecraft:chest") {
        event.cancel = true
        system.run(() => {
            chestLootForm.show(event.player).then(response => {
                if(response.canceled) return;
                switch(response.selection) {
                    case 0: world.setDynamicProperty(`${location.x}, ${location.y}, ${location.z}`, "low")
                    world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to recieve low lvl loot`); break;
                    case 1: world.setDynamicProperty(`${location.x}, ${location.y}, ${location.z}`, "mid")
                    world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to recieve mid lvl loot`); break;
                    case 2: world.setDynamicProperty(`${location.x}, ${location.y}, ${location.z}`, "high")
                    world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to recieve high lvl loot`); break;
                    case 3: 
                    const chestExists = world.getDynamicProperty(JSON.stringify(block.location))
                    if (chestExists) {
                        world.setDynamicProperty(JSON.stringify(block.location))
                        world.sendMessage(`${JSON.stringify(block.location)} set to recieve no loot`)
                    } 
                    else return world.sendMessage("This chest has not been set to be filled with loot!"); break;
                }
            })

        })
    }
})


