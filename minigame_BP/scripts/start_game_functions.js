import {world, system} from "@minecraft/server"
import { hungerGamesMap } from "./start_game_logic"
import { Lobby } from "./lobby_making"
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

export async function resetPlayersToLobby(players) {
    const currentLobby = world.getDynamicProperty('currentLobby')
    let lobby = JSON.parse(Lobby.getLobbyByID(currentLobby).data)
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
        if (!player.hasTag('alive')) {continue};
        player.teleport(lobby.location, {dimension: world.getDimension(lobby.dimension)})
        const gamemode = player.getGameMode()
        if (gamemode !== "Adventure") {
            player.setGameMode("Adventure")
        }
        if (player.hasTag('inGame')) {
            player.removeTag('inGame')
        }
        if (player.hasTag('Spectating')) {
            player.removeTag('Spectating')
        }
    }
}

export function movePlayers(spawns, players, dimension) {
    for (let i=0; i < players.length; i++) {
        const currentPlayer = players[i]
        if (!currentPlayer.isValid || currentPlayer === undefined) {
            players.splice(i, 1)
            i--
            continue;
        }
        currentPlayer.teleport(spawns[i], {dimension: dimension})
        currentPlayer.addTag('inGame')
        if (currentPlayer.hasTag('Ready')) {
            currentPlayer.removeTag("Ready")
        }
    }
    return world.sendMessage('All players in position')
}

export async function startLobbyCount(players, seconds) {
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


export function pickMap(players) { //Rewrite using new vote framwork!!!!
    const numOfPlayers = players.length
    const allMaps = hungerGamesMap.allMaps
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


export function* setBarriers(barriers, dimension) {
    for (const barrier of barriers) {
        yield dimension.setBlockType(barrier, "minecraft:barrier")
    }
    world.sendMessage('All Barriers Set')
}


export function insertItems(inventory, items) {
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

export function* resetAndFillChests(chests, dimension) {
    for (const chest of chests) {
        const block = dimension.getBlock(chest)
            if (allowedChests.includes(block.typeId)) {
                const inventory = block.getComponent('minecraft:inventory').container
                inventory.clearAll()
                const typeToFill = world.getDynamicProperty(JSON.stringify(chest))
                if (!typeToFill) {world.sendMessage(`Chest with no tier of loot assigned to it found at x: ${chest.x}, y: ${chest.y}, z: ${chest.z} this chest will be skipped`); continue;}
                const manager = world.getLootTableManager()
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
            else {world.sendMessage(`A block that is not a chest was found at x: ${chest.x}, y: ${chest.y}, z: ${chest.z} please be sure you have input the correct cooridinate.`)}
    }
    world.sendMessage('All chests filled')
}

export function* resetDoors(doors, dimension) {
    for (const door of doors) {
        const block = dimension.getBlock(door)
        const permutation = block.permutation
        const openCloseState = permutation.getState('open_bit')
        const doorAbove = block.above(1)
        const doorBelow = block.below(1)
        const locations = [door, doorAbove, doorBelow]
        let stateToSet
        for (const location of locations) {
            const tryStateToSet = world.getDynamicProperty(JSON.stringify(location))
            if (tryStateToSet !== undefined) {
                stateToSet =  tryStateToSet
            } 
        }
        if (stateToSet === undefined) {world.sendMessage(`Door with no perfered open or closed state found at x: ${door.x}, y: ${door.y}, z: ${door.z} this door will be skipped`); continue;}
            yield;
            const openState = permutation.withState('open_bit', true)
            const closedState = permutation.withState('open_bit', false)
            const randomNum = Math.random()
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
    world.sendMessage('All Doors set')
}


export async function barrierDropCount(players, seconds) {
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
    

export function* dropBarriers(barriers, dimension) { // turn barriers to air
    for (const barrier of barriers) {
        yield dimension.setBlockType(barrier, 'minecraft:air')
    }
}