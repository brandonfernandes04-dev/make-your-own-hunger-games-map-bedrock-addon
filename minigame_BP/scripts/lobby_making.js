import { world, system, Dimension } from "@minecraft/server";
import { takeItems } from "./map_making";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { giveItems } from "./map_making";

export class Lobby {
    constructor(name, data) {
        this.name = name
        this.data = data
    }
    static allLobbies = []
    static getRandomLobby() {
        const randomNum = Math.floor(Math.random() * this.allLobbies.length + 1)   
        const pickedlobby = this.allLobbies[randomNum - 1]
        return pickedlobby
    }
    static getLobbyByID(id) {
        const lobby = this.allLobbies.filter(lob => lob.name === id)[0]
        if (lobby) {
            console.warn(JSON.stringify(lobby))
            return lobby
        }
    }
    static loadAllLobbies() {
       const IDs = world.getDynamicPropertyIds().filter(id => id.startsWith("lobby:"));
       if(!IDs) return;
       IDs.forEach(id => {
        const dynamicProperty = world.getDynamicProperty(id);
        id = id.split(":")[1].trim()
        const lobby = new Lobby(id, dynamicProperty);
        Lobby.allLobbies.push(lobby);
       })
    };
    static getAllLobbyIDs() {
        if (this.allLobbies.length === 0) {
            return ['No lobbies created']
        }
        else {
            const IDs = this.allLobbies.map(Lobby => Lobby.name)
            return IDs
        }
    }
    save() {
        world.setDynamicProperty(`lobby: ${this.name}`, this.data)
        world.sendMessage(`Created lobby: ${this.name} with this data attached: ${this.data}`)
    }
}
let lobbyName

let lobbyMakerCache = {
    location: null,
    dimension: null,
}

const lobbySettingItems = ["b_minigames:cancel", "b_minigames:set_lobby_item", "b_minigames:set_name", "b_minigames:confirm_and_create", "b_minigames:clear_all"]

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (!event.isFirstEvent) {return};
    system.run(() => {
        const player = event.player
        if (!player.hasTag('settingLobby')) {return};
        const item = event.itemStack
        if (item.typeId === "b_minigames:set_lobby_item") {
            lobbyMakerCache.location = event.block.location
            world.sendMessage(`Lobby location set to ${JSON.stringify(event.block.location)}`)
        }
        else if (item.typeId === "b_minigames:set_name") {
            const setLobbyName = new ModalFormData()
                .title('Set lobby name')
                .textField('Name of lobby', 'Name here')
                .submitButton('Submit');
    
                setLobbyName.show(player).then(response => {
                    if (response.canceled) {return};
                    const name = response.formValues[0]
                    if (name.trim() !== "") {
                        lobbyName = name
                        world.sendMessage(`Lobby name set to ${name}`)
                    }
                    else {world.sendMessage('You have not entered a name')}
                })
        }
        else if (item.typeId === "b_minigames:confirm_and_create") {
            lobbyMakerCache.dimension = player.dimension.id
            const lobby = new Lobby(lobbyName, JSON.stringify(lobbyMakerCache))
            lobby.save()
            Lobby.allLobbies.push(lobby)
            player.removeTag('settingLobby')
            takeItems(player, lobbySettingItems)
        }
        else if (item.typeId === "b_minigames:cancel") {
            player.removeTag('settingLobby')
            takeItems(player, lobbySettingItems)
        }
        else if (item.typeId === "b_minigames:clear_all") {
            lobbyName = ""
            lobbyMakerCache.location = null
            lobbyMakerCache.dimension = null
            world.sendMessage('Cleared cache')
        }
    })
})


world.afterEvents.itemUse.subscribe((event) => {
    const item = event.itemStack
    if (item.typeId !== 'b_minigames:lobby_manager') {return};
    const player = event.source
    const lobbyManagerDir = new ActionFormData()
        .title('Welcome to lobby manager')
        .button('Register a new lobby')
        .button('Delete a lobby')
        .button('Choose a lobby to use');
    
    lobbyManagerDir.show(player).then(response => {
        if (response.canceled) {return};
        switch(response.selection) {
            case 0:
                const lobbyMaker = new MessageFormData() //Form that gives all lobby making items
                    .title('Welcome to lobby maker')
                    .body('To get Started Select Yes. Warning this will clear spaces in your hotbar!')
                    .button1('Yes Continue')
                    .button2('Close Form');
                
                    lobbyMaker.show(player).then(response => {
                    if (response.canceled) {return}
                    else if (response.selection === 0) {
                    giveItems(player, lobbySettingItems)
                    player.addTag('settingLobby')
                }
            }); break
            case 1:
                const lobbyDeleteFrom = new ModalFormData()
                    .title('Delete a lobby')
                    .dropdown('Lobby to delete', Lobby.getAllLobbyIDs(), {defaultValueIndex: 0})
                    .submitButton('Delete lobby');

                    lobbyDeleteFrom.show(player).then(response => {
                        if (response.canceled) {return}
                        const index = response.formValues[0]
                        const lobby = Lobby.allLobbies[index]
                        const name = lobby.name
                        world.sendMessage(`Deleting ${name}`)
                        world.setDynamicProperty(`lobby: ${name}`)
                        Lobby.allLobbies.splice(index, 1)
                        world.sendMessage('Deleted')
                    }); break
            case 2:
                const allChoices = Lobby.getAllLobbyIDs()
                allChoices.push('Random every time', 'Perfer current dimension')
                const lobbySelector = new ModalFormData()
                    .title('Welcome to Lobby Selector')
                    .dropdown('Lobby to use', allChoices, {defaultValueIndex: 0, tooltip: 'Random brings players to a new lobby every match. Perfer current brings players to a a lobby within the dimension of the map being played if possible. If not a random roll determines the lobby. Note both options will result in players spawning in different lobbies when loading in. This is a non issue all players will still be able to queue up together.'})
                    .submitButton('Submit');

                    lobbySelector.show(player).then(response => {
                        if (response.canceled) {return};
                        const index = response.formValues[0]
                        const choice = allChoices[index]
                        if (choice === 'Random every time') {
                            world.setDynamicProperty('lobbyChoice', 'random')
                            world.sendMessage('The lobby will change every match.')
                        }
                        else if (choice === 'Perfer current dimension') {
                            world.setDynamicProperty('lobbyChoice', 'perferCurrrentDim')
                            world.sendMessage('The lobby that will be used after each map will be in the same dimension if possible.')
                        }
                        else {
                            world.setDynamicProperty('lobbyChoice', choice)
                            world.sendMessage(`${choice} will be used as the lobby to return to`)
                        }
                    }); break
        }
    })
})

