import {world, system, TickingAreaManager, World } from "@minecraft/server";
import { giveItems, takeItems} from "./map_making";
import { garbageCollector } from "./lose_item_garbage_collector";
import { allowedChests } from "./map_making"
import { Lobby } from "./lobby_making";
import { waitTillPlayerValid, resetPlayersToLobby, movePlayers, startLobbyCount, pickMap, setBarriers, insertItems, resetAndFillChests, resetDoors, barrierDropCount, dropBarriers} from "./start_game_functions"

export const gameControlItems = ["b_minigames:join_game_item", "b_minigames:start_game_item", "b_minigames:game_vote_item", "b_minigames:spectate_current_match"]

export class HGgameLoop {
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
                if (!player.hasTag('inGame')) {return};
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
            if (killedPlayer.typeId !== "minecraft:player" || !killedPlayer.hasTag('inGame')) {return};
            killedPlayer.removeTag('inGame')
            killedPlayer.playSound("playerFail", {volume: 12})
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

export class hungerGamesMap { //Class that provides methods and Properties for Making a Map as well as saving it to the world via a dynamic property. 
    constructor(name, mapData) {
        this.name = name;
        this.mapData = mapData;
    }
    static allMaps = []; //array that holds instnaces of this class. Maps are pushed to this array with the static method loadAllMaps() Which pulls from the worlds dynamic properties.
    static loadAllMaps() {
       const IDs = world.getDynamicPropertyIds().filter(id => id.startsWith("Hunger Games:"));
       if(!IDs) return;
       IDs.forEach(id => {
        const dynamicProperty = world.getDynamicProperty(id);
        id = id.split(":")[1].trim()
        const map = new hungerGamesMap(id, dynamicProperty);
        hungerGamesMap.allMaps.push(map);
       })
    };
    static getAllMapIds() {
        if(hungerGamesMap.allMaps.length < 1) {
            return ['No maps created']
        }
        else if (hungerGamesMap.allMaps.length >= 1) {
            const IDs = hungerGamesMap.allMaps.map(map => map.name)
            return IDs
        } 
    };
    static getMapByID(id) {
       return this.allMaps.find(map => map.name === id)
    }
    load() {
       const rawData = JSON.parse(this.mapData);
       return rawData;
    };
    save() {
        world.setDynamicProperty(`Hunger Games: ${this.name}`, this.mapData);
        return world.sendMessage(`Created Map: ${this.name}, with this data attached: ${this.mapData}`);
    }
    static async runProcess(players) {
        world.sendMessage('Picking map and return lobby')
        const map = await pickMap(players);
        if (!map) {
            return world.sendMessage("No Map was found!")
        }
        const parsedData = JSON.parse(map.mapData);
        const dimension = world.getDimension(parsedData.dimension)
        const startPoint = parsedData.startPoint
        const endPoint = parsedData.endPoint
        const name = map.name;
        let lobby
        const lobbyChoice = world.getDynamicProperty('lobbyChoice')
        if (!lobbyChoice) {return world.sendMessage('You have not selected a lobby to return to. To do so use the lobby manager item.')};
        if (lobbyChoice === 'random') {
            lobby = Lobby.getRandomLobby()
        }
        else if (lobbyChoice === 'perferCurrrentDim') {
            const lobbies = Lobby.allLobbies.filter(lob => JSON.parse(lob.data).dimension === dimension.id)
            if (lobbies.length > 1) {
                const randomNum = Math.floor(Math.random() * lobbies.length + 1)   
                const pickedlobby = lobbies[randomNum - 1]
                lobby = pickedlobby
            }
            else {lobby = lobbies[0]}
        }
        else {
            lobby = Lobby.getLobbyByID(lobbyChoice)
        }
        if (!lobby) {return world.sendMessage('You have not created a lobby for players to start at. To create one use the lobby manager item.')}
        world.setDynamicProperty('currentLobby', lobby.name)
        world.sendMessage(`Next Lobby: ${lobby.name}`)
        world.sendMessage(`Next Map: ${name}`) 
        const LobbyData = JSON.parse(lobby.data)
        const Lobbylocation = LobbyData.location
        const LobbyDimension = world.getDimension(LobbyData.dimension)
        for (const player of players) {
            player.setGameMode("Adventure")
            const inventory = player.getComponent("minecraft:inventory").container
            inventory.clearAll()
            player.playSound("lobbyCountStart", {volume: 12})
            player.setSpawnPoint({x: Lobbylocation.x, y: Lobbylocation.y, z: Lobbylocation.z, dimension: LobbyDimension})
        }
        await world.tickingAreaManager.createTickingArea(`${name}`, {from: startPoint, to: endPoint, dimension: dimension})
        const barriers = parsedData.barriers;
        world.sendMessage('Setting Barriers...')
        await system.runJob(setBarriers(barriers, dimension))
        const chests = parsedData.chests;
        world.sendMessage('Filling chests...')
        await system.runJob(resetAndFillChests(chests, dimension))
        const doors = parsedData.doors
        await system.runJob(resetDoors(doors, dimension))
        await startLobbyCount(players, 30);
        const spawns = parsedData.spawns;
        await movePlayers(spawns, players, dimension);
        await barrierDropCount(players, 10);
        await system.runJob(dropBarriers(barriers, dimension));
        world.tickingAreaManager.removeTickingArea(`${name}`)
        const numOfTicks = parsedData.numOfTicks;
        const gamePlayLoop = new HGgameLoop(numOfTicks, spawns, dimension, players);
        await gamePlayLoop.startgame()
        world.sendMessage("Starting clean up process")
        world.setDynamicProperty('garbageCollectorCurrentProcess', `${name}`)
        await world.tickingAreaManager.createTickingArea(`${name}`, {from: startPoint, to: endPoint, dimension: dimension})
        await garbageCollector.removeItems(dimension)
        world.tickingAreaManager.removeTickingArea(`${name}`)
        world.sendMessage("Clean up process complete")
    }
};

world.afterEvents.itemUse.subscribe(async (event) => { //handles starting the game when any player uses the start game item and there is more than 1 player ready in the lobby.
    const item = event.itemStack.typeId
    if (item === "b_minigames:start_game_item" && !world.getDynamicProperty("lobby_count_started")) {
        if (world.getDynamicProperty("game_active")) {
            return world.sendMessage('A game is active please wait until it is finished!')
        }
        const players = world.getPlayers({tags: ['Ready'], excludeTags: ['inGame', 'alive']});
        if (players.length >= 1) { // turn 1 to 2 when done with testing phase
            const votes = []
            for (const player of players) {
                const vote = player.getDynamicProperty('gameVote')
                votes.push(vote)
                //Need to learn to take a tally of votes and pick highest value
            }
        }
    }
})




























system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "b_minigames:tempFix") {
        world.setDynamicProperty('garbageCollectorCurrentProcess')
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

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "b_minigames:clearLobby") {
        world.setDynamicProperty('lobby')
        const lobbies = Lobby.allLobbies.map(Lobby => Lobby.name)
        for (const lobby of lobbies) {
            world.setDynamicProperty(`lobby: ${lobby}`)
        }
        Lobby.allLobbies.length = 0
    } 
})

system.afterEvents.scriptEventReceive.subscribe(async (event) => {
    const player = event.sourceEntity
    const dimension = player.dimension
    if (event.id === "b_minigames:mark1") {
        world.setDynamicProperty('mark1', JSON.stringify(player.location))
    }
    else if (event.id === "b_minigames:mark2") {
        world.setDynamicProperty('mark2', JSON.stringify(player.location))
    }
    else if (event.id === "b_minigames:create") {
        await world.tickingAreaManager.createTickingArea('test', {from: JSON.parse(world.getDynamicProperty('mark1')), to: JSON.parse(world.getDynamicProperty('mark2')), dimension: dimension})
        player.sendMessage('Ticking area done!')
    }
    else if (event.id === "b_minigames:del") {
        await world.tickingAreaManager.removeTickingArea('test')
        player.sendMessage('Ticking area removed')
    }
})