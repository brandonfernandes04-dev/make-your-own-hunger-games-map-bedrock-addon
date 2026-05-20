import { system, world } from "@minecraft/server"
import { gameControlItems, giveItems, Map } from "./map_making"
import {garbageCollector} from "./lose_item_garbage_collector"
import "./start_game_logic"
import "./map_making"
import "./lobby_making"
import "./lose_item_garbage_collector"

system.run(() => {
    Map.loadAllMaps()
})

system.runInterval(() => {
    const players = world.getPlayers({excludeTags: ['inGame']})
    for (const player of players) {
        player.getComponent('minecraft:health').resetToMaxValue
        player.getComponent('minecraft:player.hunger').resetToMaxValue
        player.getComponent('minecraft:player.saturation').resetToMaxValue
        const effects = player.getEffects()
        for (const effect of effects) {
            player.removeEffect(effect.typeId)
        }
    }
}, 100)


async function waitTillPlayerLoadsIn(playerName) {
    return new Promise((resolve, reject) => {
        let currentTick = 0
        const interval = system.runInterval(() => {
            const player = world.getPlayers({name: playerName})[0]
            if (player) {
                resolve(player)
                system.clearRun(interval)
            }
            else if (currentTick === 1200) {
                reject('Player did not load in within 1 minute')
                system.clearRun(interval)
            }
            currentTick += 20
        }, 20)
    })
}

world.afterEvents.playerJoin.subscribe(async (event) => {
    const playerName = event.playerName
    const lobbyProp = world.getDynamicProperty('lobby')
    if (!lobbyProp) {return world.sendMessage('You have not created a lobby for players to start at. To create one use the Map Manager Item.')}
        const lobby = JSON.parse(lobbyProp)
        const location = lobby.location
        const dimension = world.getDimension(lobby.dimension)
        try {
            const player = await waitTillPlayerLoadsIn(playerName)
            player.setSpawnPoint({x: location.x, y: location.y, z: location.z, dimension: dimension})
            player.teleport(lobby.location, {dimension: dimension})
            giveItems(player, gameControlItems, true)
            console.warn(`${playerName}'s spawn point has been set to the lobby`)
            const leaveCondition = world.getDynamicProperty(playerName)
            if (!leaveCondition) {return};
            if (leaveCondition === "leftDuringGame") {
                player.sendMessage('You have left during a game. Shame on you do you know how long it took me to program in saftey guards just for people like you?')
                world.setDynamicProperty(playerName)
                if (player.hasTag('alive')) {
                    player.removeTag('alive')
                }
            }
        } catch (error) {
            console.warn(error)
        }
})

world.beforeEvents.playerLeave.subscribe((event) => {
    const player = event.player
    if (player.hasTag('inGame') || player.hasTag('Ready')) {
        world.setDynamicProperty(player.name, "leftDuringGame")
    }
})

world.afterEvents.worldLoad.subscribe(() => {
    world.setDynamicProperty("game_active", false);
    const remainingLocations = world.getDynamicProperty('garbageCollectorToDo')
    if (!remainingLocations) {return}
    const locations = JSON.parse(remainingLocations)
    for (const location of locations) {
        garbageCollector.locations.push(location)
    }
    garbageCollector.removeItems()
})

world.beforeEvents.itemUse.subscribe((event) => { //handles players queing into the game by using the join game item
    const item = event.itemStack.typeId
    const player = event.source
    if (item === "b_minigames:join_game_item") {
        if (player.isSneaking) {
            system.run(() => {
                player.removeTag("Ready")
                player.playSound('playerLeaveQueue', {volume: 8})
                player.onScreenDisplay.setActionBar("You have left the queue!")
            })
        }
        else {
          system.run(() => {
                player.addTag("Ready")
                player.playSound('playerJoinQueue', {volume: 8})
                player.onScreenDisplay.setActionBar("You have joined the queue!")
            })  
        }

    }
    else if (item === "b_minigames:spectate_current_match") {
        system.run(() => {
            if (world.getDynamicProperty('game_active')) {
                player.addTag('Spectating')
                player.setGameMode('Spectator')
                system.runTimeout(() => {
                    player.playSound("startSpectate", {volume: 8})
                }, 40)
                const inGamePlayer = world.getPlayers({tags: ["inGame"]})[0]
                if (inGamePlayer) {
                    const location = inGamePlayer.location
                    const dimension = inGamePlayer.dimension
                    player.teleport(location, {dimension: dimension})
                }
            }
            else {player.onScreenDisplay.setActionBar("No match to spectate")}
        })
    }
})



