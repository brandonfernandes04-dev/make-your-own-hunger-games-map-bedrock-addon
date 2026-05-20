import {world, system, TickingAreaManager, World } from "@minecraft/server";
import { Map } from "./map_making";
import { giveItems, takeItems, gameControlItems } from "./map_making";
import { garbageCollector } from "./lose_item_garbage_collector";
import { allowedChests } from "./map_making"


export async function waitTillPlayerValid(player) {
    return new Promise((resolve, reject) => {
        let ticksPast = 0
        const interval = system.runInterval(() => {
            if (!player) {reject('Player is undefined')};
                if (ticksPast === 200) {
                    system.clearRun(interval)
                    reject('Player was not valid after 10 seconds')
                }
                else if (player.isValid) {
                    system.clearRun(interval)
                    resolve()
                }
                ticksPast += 20
        }, 20)
    })
}

async function resetPlayersToLobby(players) {
    const lobbyProperty = world.getDynamicProperty('lobby')
    if (!lobbyProperty) {return console.warn('no lobby to return to!')};
    const lobby = JSON.parse(lobbyProperty)
    for (const player of players) {
        if (!player) {
            continue
        }
        if (!player.isValid) {
            try {
                await waitTillPlayerValid(player)
            } catch (error) {
                console.warn(error)
                continue
            }
        }
        const gamemode = player.getGameMode()
        if (gamemode !== "Adventure") {
            player.setGameMode("Adventure")
        }
        if (player.hasTag('inGame')) {
            player.removeTag('inGame')
        }
        if (player.hasTag('alive')) {
            player.removeTag('alive')
        }
        player.teleport(lobby.location, {dimension: world.getDimension(lobby.dimension)})
    }
}

function movePlayers(spawns, players, dimension) {
    for (let i=0; i < players.length; i++) {
        const currentPlayer = players[i]
        if (!currentPlayer.isValid || currentPlayer === undefined) {
            players.splice(i, 1)
            i--
            continue;
        }
        currentPlayer.teleport(spawns[i], {dimension: dimension})
        if (currentPlayer.hasTag('Ready')) {
            currentPlayer.removeTag("Ready")
            currentPlayer.addTag('inGame')
        }
    }
    return world.sendMessage('All players in position')
}

class gameLoop {
    constructor(ticks, spawns, dimension, players) {
        this.ticks = ticks
        this.spawns = spawns;
        this.dimension = dimension
        this.players = players;
        
    }
    async startgame() {
        return new Promise((resolve) => {
            let currentTick = 0
            let isSuddenDeath = false
            let leaveHandler
            let deathHandler
            let interval
            world.setDynamicProperty("game_active", true)
            const cleanUp = async () => {
                if (interval) system.clearRun(interval);
                if (leaveHandler) world.beforeEvents.playerLeave.unsubscribe(leaveHandler);
                if (deathHandler) world.afterEvents.entityDie.unsubscribe(deathHandler);
                world.setDynamicProperty("game_active", false);
                for (const player of this.players) {
                    giveItems(player, gameControlItems, true);
                }
                const spectators = world.getPlayers({tags: ['Spectating']})
                resetPlayersToLobby(spectators)
                resetPlayersToLobby(this.players);
            };
            interval = system.runInterval(async () => {
                currentTick += 200
                const remainingTicks = this.ticks - currentTick
                if (remainingTicks <= 2400 && !isSuddenDeath) {
                    world.sendMessage('Sudden Death!')
                    isSuddenDeath = true
                    movePlayers(this.spawns, this.players, this.dimension)
                }
                else if (remainingTicks <= 0) {
                    world.sendMessage(`The game has ended due to the time limit congrats ${JSON.stringify(this.players.map(player => player.name))} you have been saved by the bell you cowards.`)
                    await cleanUp()
                    resolve()
                }
            }, 200)
            leaveHandler = async (event) => {
                const player = event.player
                const index = this.players.findIndex(p => p.id === player.id)
                this.players.splice(index, 1)
                if (this.players.length <= 1) {
                    world.sendMessage("Not enough players to continue. The game has ended.")
                    system.run(async () => {
                        await cleanUp()
                        resolve()
                    })
                }
            }
            world.beforeEvents.playerLeave.subscribe(leaveHandler) 
            deathHandler = async (event) => {
            const killedPlayer = event.deadEntity
            if (killedPlayer.typeId !== "minecraft:player") {return};
            await waitTillPlayerValid(killedPlayer)
            killedPlayer.removeTag('alive')
            killedPlayer.removeTag('inGame')
            killedPlayer.playSound("playerFail", {volume: 6})
            giveItems(killedPlayer, gameControlItems)
            const index = this.players.findIndex(p => p.id === killedPlayer.id)
            this.players.splice(index, 1)
            if (this.players.length <= 1) {
                if (this.players[0]) { //quick check in case of weird double kill event happening
                    world.sendMessage(`${this.players[0].name} has won the match!`)
                    system.runTimeout(() => {
                        this.players[0].playSound("playerWin", {volume: 8})
                    }, 40)
                }
                else {world.sendMessage('The match has ended in a draw as both players killed each other!')}
                await cleanUp()
                resolve()
                }
            }
            world.afterEvents.entityDie.subscribe(deathHandler)
        })
    } 
}

async function startLobbyCount(players, seconds) {
    world.setDynamicProperty("lobby_count_started", true);
    return new Promise((resolve) => {
        function count(currentSeconds) {
            if (currentSeconds <= 0) {
                world.setDynamicProperty('lobby_count_started', false)
                resolve()
                return
            }
            for (const player of players) {
                player.onScreenDisplay.setActionBar(`Seconds till game starts: ${currentSeconds}`)
            }
            system.runTimeout(() => {
                count(currentSeconds - 1)
            }, 20)
        }

        count(seconds)
    })
}

function pickMap(numOfPlayers) { //Returns an instance of the class Map from the static property allMaps based on a random number after ensuring the map is capable of handling the number of players in the que
    const allMaps = Map.allMaps
    const validMaps = []
    for (const map of allMaps) {
        const data = JSON.parse(map.mapData)
        const cleanUpInProgress = world.getDynamicProperty('garbageCollectorCurrentProcess')
        if (data.spawns.length >= numOfPlayers && map.name !== cleanUpInProgress) {
            validMaps.push(map)
        }
    }
    const randomNum = Math.floor(Math.random() * validMaps.length + 1)   
    const pickedMap = validMaps[randomNum - 1]
    return pickedMap
}


function* setBarriers(Barriers, dimension) {
    const barriers = [...Barriers]
    while (barriers.length > 0) {
        const first = barriers[0]
        world.tickingAreaManager.createTickingArea('barrier_working_area', {from: first, to: first, dimension: dimension})
        while (!dimension.isChunkLoaded(first)) {
            yield;
        }
        const loadedSpaces = []
        let spacesLoaded = 0
        for (const barrier of barriers) {
            if (dimension.isChunkLoaded(barrier)) {
                loadedSpaces.push(barrier)
                spacesLoaded ++
            }
            else {break};
        } 
        for(const loadedSpace of loadedSpaces) {
            yield dimension.setBlockType(loadedSpace, "minecraft:barrier")
        }
        yield;
        world.tickingAreaManager.removeTickingArea('barrier_working_area')
        barriers.splice(0, spacesLoaded)
    }
    world.sendMessage('All Barriers Set')
}



function insertItems(inventory, items) {
    let currentSlot = 0
    for (const item of items) {
        if (currentSlot <= 26) {
            inventory.setItem(currentSlot, item)
            const numberToIncrease = Math.floor(Math.random() * 3 + 1)
            currentSlot += numberToIncrease
        }
        if (currentSlot > 26) {
            const firstOpen = inventory.firstEmptySlot()
            inventory.setItem(firstOpen, item)
        }
    }
}

function* resetAndFillChests(chests, dimension) {
    while (chests.length > 0) {
        const first = chests[0]
        world.tickingAreaManager.createTickingArea('chest_working_area', {from: first, to: first, dimension: dimension})
        while (!dimension.isChunkLoaded(first)) {
            yield;
        }
        const loadedChests = []
        let chestsLoaded = 0
        for (const chest of chests) {
            if (dimension.isChunkLoaded(chest)) {
                loadedChests.push(chest)
                chestsLoaded ++
            }
            else {break};
        }
        for (const loadedChest of loadedChests) {
            const block = dimension.getBlock(loadedChest)
            if (allowedChests.includes(block.typeId)) {
                const inventory = block.getComponent('minecraft:inventory').container
                inventory.clearAll()
                const typeToFill = world.getDynamicProperty(JSON.stringify(loadedChest))
                if (!typeToFill) {world.sendMessage(`Chest with no tier of loot assigned to it found at x: ${loadedChest.x}, y: ${loadedChest.y}, z: ${loadedChest.z} this chest will be skipped`); continue;}
                const manager = world.getLootTableManager()
                yield;
                switch (typeToFill) {
                    case "low":
                        const lowLootTable = manager.getLootTable("hunger_games/chests/low_tier_chest")
                        const lowLoot = manager.generateLootFromTable(lowLootTable)
                        yield insertItems(inventory, lowLoot); break;
                    case "mid":
                        const midLootTable = manager.getLootTable("hunger_games/chests/mid_tier_chest")
                        const midLoot = manager.generateLootFromTable(midLootTable)
                        yield insertItems(inventory, midLoot); break;
                    case "high":
                        const highLootTable = manager.getLootTable("hunger_games/chests/high_tier_chest")
                        const highLoot = manager.generateLootFromTable(highLootTable)
                        yield insertItems(inventory, highLoot); break;
                }
            }
            else {world.sendMessage(`A block that is not a chest was found at x: ${loadedChest.x}, y: ${loadedChest.y}, z: ${loadedChest.z} please be sure you have input the correct cooridinate.`)}
        }
        world.tickingAreaManager.removeTickingArea('chest_working_area')
        chests.splice(0, chestsLoaded);
    }
    world.sendMessage('All chests filled')
}



function* resetDoors(doors, dimension) {
    while (doors.length > 0) {
        const first = doors[0]
        world.tickingAreaManager.createTickingArea('door_working_area', {from: first, to: first, dimension: dimension})
        while (!dimension.isChunkLoaded(first)) {
            yield;
        }
        const loadedDoors = []
        let doorsLoaded = 0
        for (const door of doors) {
            if (dimension.isChunkLoaded(door)) {
                loadedDoors.push(door)
                doorsLoaded ++
            }
            else {break};
        }
        for (const loadedDoor of loadedDoors) {
            const block = dimension.getBlock(loadedDoor)
            const permutation = block.permutation
            const openCloseState = permutation.getState('open_bit')
            const doorAbove = {...loadedDoor, y: loadedDoor.y + 1}
            const doorBelow = {...loadedDoor, y: loadedDoor.y - 1}
            const locations = [loadedDoor, doorAbove, doorBelow]
            let stateToSet
            for (const location of locations) {
                const tryStateToSet = world.getDynamicProperty(JSON.stringify(location))
                if (tryStateToSet !== undefined) {
                    stateToSet =  tryStateToSet
                } 
            }
            if (stateToSet === undefined) {world.sendMessage(`Door with no perfered open or closed state found at x: ${loadedDoor.x}, y: ${loadedDoor.y}, z: ${loadedDoor.z} this door will be skipped`); continue;}
                yield;
                const openState = permutation.withState('open_bit', true)
                const closedState = permutation.withState('open_bit', false)
                switch (stateToSet) {
                    case "open":
                        if (openCloseState === true) {
                            continue
                        }
                        else {
                            block.setPermutation(openState)
                        }; break;
                    case "closed":
                        if (openCloseState === false) {
                            continue
                        }
                        else {
                            block.setPermutation(closedState)
                        }; break;
                        const randomNum = Math.random()
                    case "random":
                        if (randomNum >= 0.5 && openCloseState === false) {
                            block.setPermutation(openState)
                        }
                        else if (randomNum < 0.5 && openCloseState === true) {
                            block.setPermutation(closedState)
                        }
                        else {continue}; break;
                    case "9/10":
                        if (randomNum >= 0.9 && openCloseState === false) {
                            block.setPermutation(openState)
                        }
                        else if (randomNum < 0.9 && openCloseState === true) {
                            block.setPermutation(closedState)
                        }
                        else {continue}; break; 

                }
        }
        world.tickingAreaManager.removeTickingArea('door_working_area')
        doors.splice(0, doorsLoaded);
    }
    world.sendMessage('All Doors set')
}



async function barrierDropCount(players, seconds) {
    world.setDynamicProperty("lobby_count_started", true);
    return new Promise((resolve) => {
        function count(currentSeconds) {
            if (currentSeconds <= -1) {
                world.setDynamicProperty('lobby_count_started', false)
                resolve()
                return
            }
            for (const player of players) {
                player.onScreenDisplay.setActionBar(`Seconds till barriers drop: ${currentSeconds}`)
                player.playSound("gameStartCountDown", {volume: 8})
            }
            system.runTimeout(() => {
                count(currentSeconds - 1)
            }, 20)
        }

        count(seconds)
    })
}
    

function* dropBarriers (barriers, dimension) { // turn barriers to air
    for (const barrier of barriers) {
        yield dimension.setBlockType(barrier, 'minecraft:air')
    }
}

world.afterEvents.itemUse.subscribe(async (event) => { //handles starting the game when any player uses the start game item and there is more than 1 player ready in the lobby.
    const item = event.itemStack.typeId
    if (item === "b_minigames:start_game_item" && !world.getDynamicProperty("lobby_count_started")) {
        if (world.getDynamicProperty("game_active")) {
            return world.sendMessage('A game is active please wait until it is finished!')
        }
        const players = world.getPlayers({tags: ['Ready'], excludeTags: ['inGame']});
        if (players.length >= 1) { // turn 1 to 2 when done with testing phase
            world.sendMessage('Picking Map...')
            const map = await pickMap(players.length);
            if (!map) {
                return world.sendMessage("No Map was found!")
            }
            const parsedData = JSON.parse(map.mapData);
            const dimension = world.getDimension(parsedData.dimension)
            const name = map.name;
            world.sendMessage(`Next up: ${name}`) //Tells the players what map they will be playing next
            for (const player of players) {
                player.setGameMode("Adventure")
                const inventory = player.getComponent("minecraft:inventory").container
                inventory.clearAll()
                player.addTag('alive')
                player.playSound("lobbyCountStart", {volume: 8})
            }
            const barriers = parsedData.barriers;
            world.sendMessage('Setting Barriers...')
            await system.runJob(setBarriers(barriers, dimension))
            const chests = parsedData.chests;
            world.sendMessage('filling chests...')
            await system.runJob(resetAndFillChests(chests, dimension))
            const doors = parsedData.doors
            await system.runJob(resetDoors(doors, dimension))
            await startLobbyCount(players, 30);
            const spawns = parsedData.spawns;
            await movePlayers(spawns, players, dimension);
            await barrierDropCount(players, 10);
            await system.runJob(dropBarriers(barriers, dimension));
            const numOfTicks = parsedData.numOfTicks;
            const gamePlayLoop = new gameLoop(numOfTicks, spawns, dimension, players);
            await gamePlayLoop.startgame()
            world.sendMessage("Starting clean up process")
            world.setDynamicProperty('garbageCollectorCurrentProcess', `${name}`)
            await garbageCollector.removeItems()
            world.sendMessage("clean up process complete")

        }
    }
})

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "b_minigames:tempFix") {
        world.setDynamicProperty("game_active")
        world.setDynamicProperty("lobby_count_started")
        if (world.tickingAreaManager.getTickingArea('garbageCollector')) {
                world.tickingAreaManager.removeTickingArea('garbageCollector')
            }
        const players = world.getPlayers({tags: ["inGame"]})
        players.forEach(player => {
            player.removeTag('inGame')
        })
    } 
})

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "b_minigames:clearProp") {
        world.clearDynamicProperties()
    } 
})