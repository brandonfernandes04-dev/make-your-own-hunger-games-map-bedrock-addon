import { system, world } from "@minecraft/server"
import { giveItems } from "./map_making"
import { hungerGamesMap } from "./start_game_logic"
import { gameControlItems } from './start_game_logic'
import {waitTillPlayerValid} from "./start_game_functions"
import {garbageCollector} from "./lose_item_garbage_collector"
import { Lobby } from "./lobby_making"
import "./start_game_logic"
import "./start_game_functions"
import "./game_vote"
import "./map_making"
import "./lobby_making"
import "./lose_item_garbage_collector"
import "./barrier_tool"

system.run(() => {
    hungerGamesMap.loadAllMaps()
    Lobby.loadAllLobbies()
})

system.runInterval(async () => {
    const players = world.getPlayers({excludeTags: ['inGame', 'Spectating', 'alive']})
    if (players.length === 0) {return}
    for (const player of players) {
        await waitTillPlayerValid(player)
        player.addEffect('minecraft:instant_health', 2, {showParticles: false})
        // player.getComponent('minecraft:health').resetToMaxValue() //this traps player in weird death state if it occurs when they are at deathscreen remove after
        player.getComponent('minecraft:player.hunger').resetToMaxValue()
        player.getComponent('minecraft:player.saturation').resetToMaxValue()
        const effects = player.getEffects()
        for (const effect of effects) {
            if (effect.typeId !== 'minecraft:instant_health')
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
    const player = await waitTillPlayerLoadsIn(playerName)
    let lobby
    const lobbyChoice = world.getDynamicProperty('lobbyChoice')
    if (!lobbyChoice) {return world.sendMessage('You have not chosen a lobby for players to start at. To do so use the lobby manager item')};
    if (lobbyChoice === 'random' || lobbyChoice === 'perferCurrrentDim') {
        lobby = JSON.parse(Lobby.getRandomLobby().data)
    }
    else {
        const getLobby = Lobby.getLobbyByID(lobbyChoice)
        if (getLobby) {
            lobby = JSON.parse(Lobby.getLobbyByID(lobbyChoice).data)
        }
    }
    if (!lobby) {
        return world.sendMessage('You have not created and or registered a lobby for players to start at. To create one use the lobby manager item.')
    }
        const location = lobby.location
        const dimension = world.getDimension(lobby.dimension)
        try {
            player.setSpawnPoint({x: location.x, y: location.y, z: location.z, dimension: dimension})
            player.teleport(location, {dimension: dimension})
            giveItems(player, gameControlItems, true)
            console.warn(`${playerName}'s spawn point has been set to the lobby`)
            if (player.hasTag('makingMap')) {
                player.removeTag('makingMap')
            }
            if (player.hasTag('editingMap')) {
                player.removeTag('editingMap')
            }
            if (player.hasTag('Spectating')) {
                player.removeTag('Spectating')
            }
            if (player.hasTag('Ready')) {
                player.removeTag('Ready')
            }
            if (player.hasTag('alive')) {
                player.removeTag('alive')
            }
            if (player.hasTag('inGame')) {
                player.removeTag('inGame')
            }
            const leaveCondition = world.getDynamicProperty(playerName)
            if (!leaveCondition) {return};
            if (leaveCondition === "leftDuringGame") {
                player.sendMessage('You have left during a game. Shame on you. Do you know how long it took me to program in saftey guards just for people like you?')
                world.setDynamicProperty(playerName)
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

world.afterEvents.worldLoad.subscribe(async () => {
    const gameActive = world.getDynamicProperty("game_active")
    if (gameActive) {
        const activeMap = Map.getMapByID(gameActive)
        const data = JSON.parse(activeMap.mapData)
        const dimension = world.getDimension(data.dimension)
        world.setDynamicProperty("game_active");
        await garbageCollector.removeItems(dimension)
        world.tickingAreaManager.removeAllTickingAreas()
    }
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

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player
    const gamemode = player.getGameMode()
    if (gamemode === 'Creative') {return};
    const target = event.target
    if (target.typeId === 'minecraft:armor_stand') {
        event.cancel = true
        world.sendMessage(`${player.name}, the dirty cheater has attempted to steal armor off an armor stand everyone shame them!`)
    }
})

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player
    const gamemode = player.getGameMode()
    if (gamemode === 'Creative') {return};
    const blockId = event.block.typeId
    if (blockId === 'minecraft:bed') {
        event.cancel = true
    } 
})






