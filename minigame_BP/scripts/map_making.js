import {world, system, Player, ItemStack, Dimension } from "@minecraft/server";
import { ModalFormData, ActionFormData, MessageFormData } from "@minecraft/server-ui";
import {waitTillPlayerValid} from "./start_game_functions"
import { hungerGamesMap } from "./start_game_logic";


const mapMakerItems = ["b_minigames:clear_all", "b_minigames:set_name", "b_minigames:set_spawn", "b_minigames:set_barrier", "b_minigames:set_chest", "b_minigames:set_door", "b_minigames:set_mins", "b_minigames:point_setter", "b_minigames:confirm_and_create", "b_minigames:cancel"]
const mapEditorItems = ["b_minigames:clear_all", "b_minigames:set_name", "b_minigames:set_spawn", "b_minigames:set_barrier", "b_minigames:set_chest", "b_minigames:set_door", "b_minigames:set_mins", "b_minigames:point_setter", "b_minigames:confirm_edits", "b_minigames:cancel"]
export const allowedChests = ["minecraft:chest","minecraft:barrel", "minecraft:trapped_chest", "minecraft:copper_chest", "minecraft:exposed_copper_chest", "minecraft:oxidized_copper_chest", "minecraft:waxed_copper_chest", "minecraft:waxed_exposed_copper_chest", "minecraft:waxed_oxidized_copper_chest", "minecraft:waxed_weathered_copper_chest", "minecraft:weathered_copper_chest", "minecraft:undyed_shulker_box", "minecraft:black_shulker_box", "minecraft:blue_shulker_box", "minecraft:brown_shulker_box", "minecraft:cyan_shulker_box", "minecraft:gray_shulker_box", "minecraft:green_shulker_box", "minecraft:light_blue_shulker_box", "minecraft:light_gray_shulker_box", "minecraft:lime_shulker_box", "minecraft:magenta_shulker_box", "minecraft:orange_shulker_box", "minecraft:pink_shulker_box", "minecraft:purple_shulker_box", "minecraft:red_shulker_box", "minecraft:white_shulker_box", "minecraft:yellow_shulker_box"]



export async function giveItems(player, items, clearInventory = false) {
    if (player === undefined) {return}
    if (!player.isValid) {
        await waitTillPlayerValid(player)
    }
    const inventory = player.getComponent("minecraft:inventory").container
    if (clearInventory === true) {
        inventory.clearAll()
        const equippable = player.getComponent("minecraft:equippable")
        const slots = ["Head", "Chest", "Legs", "Feet", "Offhand"]
        for (let i = 0; i < 5; i++) {
            equippable.setEquipment(slots[i])
        }
    }
    for (let i = 0; i < items.length; i++) {
        const slot = inventory.getSlot(i)
        const item = new ItemStack(items[i], 1)
        slot.setItem(item)
    }
}

export function takeItems(player, items, clearInventory = false) {
    const inventory = player.getComponent("minecraft:inventory").container
    if (clearInventory === true) {
        inventory.clearAll()
    }
    for (let i = 0; i < items.length; i++) {
        const itemId = items[i]
        const item = new ItemStack(itemId, 1)
        const indexOfItem = inventory.find(item)
        const slot = inventory.getSlot(indexOfItem)
        slot.setItem(null)
    }
}

async function saveChanges(name, data) {
    const newMap = new hungerGamesMap(name, data)
    await newMap.save()
    hungerGamesMap.allMaps.length = 0
    hungerGamesMap.loadAllMaps()
}



let cachedName = ""

let mapMakerCache = {
    spawns: [],
    barriers: [],
    chests: [],
    doors: [],
    numOfTicks: 1200,
    dimension: null,
    startPoint: null,
    endPoint: null
}

let arrayToInspect
let inspectedArrayType

function putMapInCache(map) {
    const data = JSON.parse(map.mapData)
    cachedName = map.name
    mapMakerCache.spawns = data.spawns
    mapMakerCache.barriers = data.barriers
    mapMakerCache.chests = data.chests
    mapMakerCache.doors = data.doors
    mapMakerCache.numOfTicks = data.numOfTicks
    mapMakerCache.dimension = data.dimension
    mapMakerCache.startPoint = data.startPoint
    mapMakerCache.endPoint = data.endPoint
}


world.afterEvents.itemUse.subscribe((event) => {
    const item = event.itemStack.typeId;
    if (item === "b_minigames:map_manager") {

        const directoryForm = new ActionFormData() //Form that allows navigation to other forms
        .title("Welcome to Hunger Games Map Maker")
        .button("Add a new map")
        .button('Edit a Map')
        .button("Delete a map")
        .button("Tutorial")
        .button("Credits");

        const player = event.source
        directoryForm.show(player).then(response => {
            if (response.canceled) {return};
            const selection = response.selection;
            switch(selection) {
                case 0:
                    const mapMaker = new MessageFormData() //Form That gives all map maker items to the player if they select yes
                    .title('Welcome to map maker')
                    .body('To get Started Select Yes. Warning This will clear your hotbar!')
                    .button1('Yes Continue')
                    .button2('Close Form');

                    mapMaker.show(player).then(response => {
                    if (world.getPlayers({tags: ['makingMap']}).length > 0 || world.getPlayers({tags: ['editingMap']}).length > 0) {return world.sendMessage('Someone is editing or making a map at this point in time. Please wait until they are finished. If you are sure this is not the case try completley restarting the world.')}
                    else if (response.canceled) return
                    else if (response.selection === 0) {
                        giveItems(player, mapMakerItems)
                        player.addTag('makingMap')
                    }
                    else if (response.selection === 1) {return};
                }); break;
                case 1:
                    const mapEditorDir = new ModalFormData() //form that allows for navigation between precise or general edit mode. Allows for picking a map and item within the map to affect. 
                    .title('Welcome to map editor')
                    .header('Select the map to make changes to')
                    .dropdown('Map', hungerGamesMap.getAllMapIds(), {defaultValueIndex: 0, tooltip: 'The map you wish to change'})
                    .dropdown('General mode or Precise mode', ['General mode', 'Precise Mode'], {tooltip: "General edit mode will give you the items needed to make a map and move your selected map to the cache to add more coordinates too. Precise mode will allow for instertion deletion or replacment of coordinates saved to the map.", defaultValueIndex: 0})
                    .dropdown('Map item to change', ['Spawns', 'Barriers', 'Chests', 'Doors'], {tooltip: "If the item to change you have selected is empty an error will occur. If this happens use general editor mode to add your coordinates in. If you are entering general edit mode this field is non applicable.", defaultValueIndex: 0})
                    .submitButton('Submit'); 

                    mapEditorDir.show(player).then(response => {
                    if (world.getPlayers({tags: ['makingMap']}).length > 0 || world.getPlayers({tags: ['editingMap']}).length > 0) {return world.sendMessage('Someone is editing or making a map at this point in time. Please wait until they are finished. If you are sure this is not the case try completley restarting the world.')}
                    else if (response.canceled) {return}
                    else if (hungerGamesMap.getAllMapIds()[0] === "No maps created") {return world.sendMessage('There are no maps to edit to get started visit the add a map section of this book.')};
                    player.addTag('editingMap')
                    const chosenIndex = response.formValues[1]
                    const chosenMap = hungerGamesMap.allMaps[chosenIndex]
                    const mapId = chosenMap.name
                    putMapInCache(chosenMap)
                    const modeToEnter = response.formValues[2]
                    const itemToChange = response.formValues[3]
                    switch(itemToChange) {
                        case 0: arrayToInspect = mapMakerCache.spawns.map(spawn => JSON.stringify(spawn)); inspectedArrayType = 'spawns'; break;
                        case 1: arrayToInspect = mapMakerCache.barriers.map(barrier => JSON.stringify(barrier)); inspectedArrayType = 'barriers'; break;
                        case 2: arrayToInspect = mapMakerCache.chests.map(chest => JSON.stringify(chest)); inspectedArrayType = 'chests'; break;
                        case 3: arrayToInspect = mapMakerCache.doors.map(door => JSON.stringify(door)); inspectedArrayType = 'doors'; break;
                    }
                    if (modeToEnter === 0) {
                        giveItems(player, mapEditorItems)
                    }
                    else if (modeToEnter === 1) {
                                const mapEditorChange = new ModalFormData() //form that allows for precise insertion, deletion, and replacment of coordinates for the the list of doors, chests, spawns, and barriers for the map selected in the previous form.
                                .title('Please Select a coordinate')
                                .dropdown('Coordinate to remove, change, or insert', arrayToInspect)
                                .toggle('Replace/delete above coordinate or insert coodinate before above coordiante', {defaultValue: false, tooltip: 'If this is set to on the above coordinate will be replaced by the values you enter. If all those values are blank the coordinate will be deleted instead. If this is set to off the coordinates you enter below will be inserted before the above coordinate in the maps list.'})
                                .textField('X', '102', {tooltip: 'For the purposes of this form all three values being zero is the same as leaving all blank. If you need to add a point at 0, 0, 0 use general edit mode.'})
                                .textField('Y', '64', {tooltip: 'For the purposes of this form all three values being zero is the same as leaving all blank. If you need to add a point at 0, 0, 0 use general edit mode.'})
                                .textField('Z', '92', {tooltip: 'For the purposes of this form all three values being zero is the same as leaving all blank. If you need to add a point at 0, 0, 0 use general edit mode.'})
                                .submitButton('Submit');

                                mapEditorChange.show(player).then(response => {
                                if (response.canceled) {player.removeTag('editingMap'); return};
                                const index = response.formValues[0]
                                console.warn(index)
                                const ReplaceDeleteOrInsert = response.formValues[1]
                                const rawData = {
                                    x: response.formValues[2],
                                    y: response.formValues[3],
                                    z: response.formValues[4]
                                }
                                const cleanlocation = {
                                    x: Number(rawData.x),
                                    y: Number(rawData.y),
                                    z: Number(rawData.z)
                                }
                                if (ReplaceDeleteOrInsert === true) {
                                    if (Object.values(cleanlocation).every(value => !Number.isNaN(value) && value !== 0)) {
                                        switch(inspectedArrayType) {
                                            case 'spawns': 
                                                mapMakerCache.spawns.splice(index, 1, cleanlocation)
                                            break;
                                            case 'barriers':
                                                mapMakerCache.barriers.splice(index, 1, cleanlocation)
                                            break;
                                            case 'chests':
                                                mapMakerCache.chests.splice(index, 1, cleanlocation)
                                            break;
                                            case 'doors':
                                                mapMakerCache.doors.splice(index, 1, cleanlocation)
                                            break;
                                        }
                                    }
                                    else if (Object.values(rawData).every(input => input === 0 || input.trim() === "")) {
                                        switch(inspectedArrayType) {
                                            case 'spawns': 
                                                mapMakerCache.spawns.splice(index, 1)
                                            break;
                                            case 'barriers':
                                                mapMakerCache.barriers.splice(index, 1)
                                            break;
                                            case 'chests':
                                                mapMakerCache.chests.splice(index, 1)
                                            break;
                                            case 'doors':
                                                mapMakerCache.doors.splice(index, 1)
                                            break;
                                        }
                                    }
                                    else {world.sendMessage('There was a problem with your inputs if you are trying to remove a coordinate leave all of the values blank.'); player.removeTag('editingMap'); return}
                                }
                                else if (ReplaceDeleteOrInsert === false) {
                                    if (Object.values(cleanlocation).every(value => !Number.isNaN(value) && value !== 0)) {
                                        switch(inspectedArrayType) {
                                            case 'spawns': 
                                                mapMakerCache.spawns.splice(index, 0, cleanlocation)
                                            break;
                                            case 'barriers':
                                                mapMakerCache.barriers.splice(index, 0, cleanlocation)
                                            break;
                                            case 'chests':
                                                mapMakerCache.chests.splice(index, 0, cleanlocation)
                                            break;
                                            case 'doors':
                                                mapMakerCache.doors.splice(index, 0, cleanlocation)
                                            break;
                                        }
                                    }
                                    else {world.sendMessage('The coordinates you entered are not valid numbers so your input could not be added to the list'); player.removeTag('editingMap'); return}
                                }
                                saveChanges(mapId, JSON.stringify(mapMakerCache))
                                player.removeTag('editingMap')
                            })
                        }
                    }); break
                    case 2:
                        const mapErase = new ModalFormData() //Form that allows for deletion of maps this form will erase maps from the worlds dynamic properties as well as the allMaps array in the Map Class 
                        .title('Map eraser')
                        .header('Select the map you wish to erase')
                        .dropdown('Maps', hungerGamesMap.getAllMapIds())
                        .submitButton('Delete Map'); 

                        mapErase.show(player).then(response => {
                        if (response.canceled) return;
                        const chosenMap = response.formValues[1]
                        const MapId = hungerGamesMap.allMaps[chosenMap].name
                        world.setDynamicProperty(`Hunger Games: ${MapId}`)
                        hungerGamesMap.allMaps.splice(chosenMap, 1)
                    }); break;
                    case 3:
                    const tutorialform = new MessageFormData() //Explanation of how to use the system as well as importnant notes for filling out the map maker form
                    .title('How to use this addon')
                    .body('') //Need to rewrite the tutorial now that methods for making a map have changed.
                    .button1('Close'); 

                    tutorialform.show(player); break;
                    case 4:
                    const credits = new MessageFormData() //credits for the Programmer and Map builder!
                    .title('Credits')
                    .body('This addon was made with much care and effort by me (Brandon) It is my intent that people will use this addon to create memories with their friends as well form new friendships!\nThe maps that come included with this addon were made with dedication and talent by my friend Richie. If this addon helps you in any way consider helping others with your craft! Thank you!')
                    .button1('Close'); 

                    credits.show(player); break;
                }
            })
        }
    })



    world.beforeEvents.playerInteractWithBlock.subscribe(async (event) => { //handles players editing a map with general mode or making a map.
        if (event.itemStack === undefined) return;
        if (event.isFirstEvent === false) return;
        const player = event.player;
        if (player.hasTag('makingMap') || player.hasTag('editingMap')) {
            const item = event.itemStack.typeId
            if (!item) return;
            const block = event.block
            const location = block.location
            switch (item) {
                case "b_minigames:clear_all": 
                cachedName = ""
                mapMakerCache.spawns = []
                mapMakerCache.barriers = []
                mapMakerCache.chests.length = []
                mapMakerCache.doors.length  = []
                mapMakerCache.numOfTicks = 12000
                mapMakerCache.dimension = null
                mapMakerCache.startPoint = null
                mapMakerCache.endPoint = null
                world.sendMessage('Cleared cache')
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
                        .slider('How many minutes should the game run', 5, 20, {defaultValue: 10})
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
                            world.sendMessage('You have no barriers made for this Map if this is intentional you may ignore this message!')
                        }
                        if (mapMakerCache.chests.length === 0) {
                            world.sendMessage('You have no chests made for this Map if this is intentional you may ignore this message!')
                        }
                        if (mapMakerCache.doors.length === 0) {
                            world.sendMessage('You have given no doors to reset if this is intentional you may ignore this message!')
                        }
                        if (mapMakerCache.numOfTicks === 1200) {
                            world.sendMessage('You have not set a time for this Map or have left it as the default. The default of 10 minutes has been chosen if that is intentional you may ignore this message!')
                        }
                        const dataString = JSON.stringify(mapMakerCache)
                        const createdMap = new hungerGamesMap(cachedName, dataString)
                        createdMap.save()
                        hungerGamesMap.allMaps.push(createdMap)
                        system.run(() => {
                            if (player.hasTag('makingMap')) {
                                player.removeTag('makingMap')
                            }
                            if (player.hasTag('editingMap')) {
                                player.removeTag('editingMap')
                            }
                            takeItems(player, mapMakerItems)
                        })
                    break;
                    case "b_minigames:point_setter":
                        event.cancel = true
                        if (player.isSneaking) {
                            mapMakerCache.startPoint = block.location
                        }
                        else {
                            mapMakerCache.endPoint = block.location
                        }
                        break;
                    case "b_minigames:confirm_edits":
                        event.cancel = true
                        mapMakerCache.dimension = player.dimension.id
                        if (cachedName.length === 0) {
                            return world.sendMessage('You must input a name for your map first!')
                        }
                        if (!mapMakerCache.startPoint) {
                            return world.sendMessage('You must input a start point for this map')
                        }
                        if (!mapMakerCache.endPoint) {
                            return world.sendMessage('You must input an end point for this map')
                        }
                        try {
                            await world.tickingAreaManager.createTickingArea('mapTest', {from: mapMakerCache.startPoint, to: mapMakerCache.endPoint, dimension: world.getDimension(mapMakerCache.dimension)})
                            world.tickingAreaManager.removeTickingArea('mapTest')
                        } catch(error) {
                            world.sendMessage('There was an error attempting to load your map. It may be too large! Please note that you are only aloted about 250 chuncks of space.')
                        }
                        if (mapMakerCache.barriers.length === 0) {
                            world.sendMessage('You have no barriers made for this Map if this is intentional you may ignore this message!')
                        }
                        if (mapMakerCache.chests.length === 0) {
                            world.sendMessage('You have no chests made for this Map if this is intentional you may ignore this message!')
                        }
                        if (mapMakerCache.doors.length === 0) {
                            world.sendMessage('You have given no doors to reset if this is intentional you may ignore this message!')
                        }
                        if (mapMakerCache.numOfTicks === 1200) {
                            world.sendMessage('You have not set a time for this Map or have left it as the default. The default of 10 minutes has been chosen if that is intentional you may ignore this message!')
                        }
                        system.runTimeout(() => {
                            world.sendMessage('If the changes you have just made included a name change you will need to delete the map with the previous name manually via the delete a map feature in the map manager book. It is also highly recommened to do a full reload of the world after making any and all changes to a map!')
                        }, 160)
                        system.run(() => {
                            saveChanges(cachedName, JSON.stringify(mapMakerCache))
                            takeItems(player, mapEditorItems)
                            if (player.hasTag('editingMap')) {
                                player.removeTag('editingMap')
                            }
                        }); break
                    case "b_minigames:cancel":
                        event.cancel = true
                        system.run(() => {
                            if (player.hasTag('editingMap')) {
                                takeItems(player, mapEditorItems)
                                player.removeTag('editingMap')
                            }
                            else if (player.hasTag('makingMap')) {
                                takeItems(player, mapMakerItems)
                                player.removeTag('makingMap')
                            }
                        }); break
                    return;
            }

        }

    })

    
world.beforeEvents.playerInteractWithBlock.subscribe((event) => { //handles setting which tier of loot a chest will recieve during game initlization as well as what door state a door will be or could be in when a game starts.
    if (event.isFirstEvent === false) return
    const gamemode = event.player.getGameMode()
    const block = event.block
    const location = block.location
    const isDoor = block.permutation.getState('open_bit')
    if(gamemode === "Creative" && event.player.isSneaking === true && allowedChests.includes(block.typeId)) {
        const chestLootForm = new ActionFormData()
            .title('Set Chest Loot')
            .button('Set chest to low level loot')
            .button('Set chest to mid level loot')
            .button('Set chest to high level loot')
            .button('Erase the fill data of this chest');
            event.cancel = true
            system.run(() => {
                chestLootForm.show(event.player).then(response => {
                    if(response.canceled) return;
                    switch(response.selection) {
                        case 0: world.setDynamicProperty(JSON.stringify(block.location), "low")
                        world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to recieve low lvl loot`); break;
                        case 1: world.setDynamicProperty(JSON.stringify(block.location), "mid")
                        world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to recieve mid lvl loot`); break;
                        case 2: world.setDynamicProperty(JSON.stringify(block.location), "high")
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
        else if (gamemode === "Creative" && event.player.isSneaking === true && isDoor !== undefined) {
        const doorStateForm = new ActionFormData()
            .title('Set The State of this Door')
            .button('Open')
            .button('Closed')
            .button('Random')
            .button('Closed roughly 9/10')
            .button('Remove From Map');
        event.cancel = true
        system.run(() => {
            doorStateForm.show(event.player).then(respone => {
                if (respone.canceled) return;
                switch (respone.selection) {
                    case 0: world.setDynamicProperty(JSON.stringify(block.location), "open")
                    world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to open`); break;
                    case 1: world.setDynamicProperty(JSON.stringify(block.location), "closed")
                    world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to closed`); break;
                    case 2: world.setDynamicProperty(JSON.stringify(block.location), "random")
                    world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to random`); break;
                    case 3: world.setDynamicProperty(JSON.stringify(block.location), "9/10")
                    world.sendMessage(`${location.x}, ${location.y}, ${location.z} set to usually closed`); break;
                    case 4: 
                    const doorExists = world.getDynamicProperty(JSON.stringify(block.location))
                    if (doorExists) {
                        world.setDynamicProperty(JSON.stringify(block.location))
                        world.sendMessage(`${JSON.stringify(block.location)} erased from world data`)
                    } 
                    else return world.sendMessage("This door has not been given a state"); break;
                }
            })
        })
    }
})


