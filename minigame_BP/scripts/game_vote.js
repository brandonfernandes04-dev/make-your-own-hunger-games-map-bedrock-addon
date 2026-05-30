import { world } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import { hungerGamesMap } from "./start_game_logic"

world.beforeEvents.itemUse.subscribe((event) => {
    const item = event.itemStack
    if (item.typeId !== "b_minigames:game_vote_item") {return};
    const player = event.source
    if (!player.hasTag('Ready')) {return player.sendMessage('You must be in the queue to vote on the next map and game.')};

    const voteDir = new ActionFormData()
        .title('Select a gamemode')
        .button('Hunger Games')
    

    voteDir.show(player).then(response => {
        if (response.canceled) {return};
        switch (response.selection) {
            case 0:
            const hungerGamesMaps = hungerGamesMap.getAllMapIds()
            hungerGamesMaps.push('Random')
            const hungerGamesForm = new ModalFormData()
                .title('Choose Hunger Games Map')
                .dropdown('Map choice', hungerGamesMaps, {defaultValueIndex: 0, tooltip: 'Selecting Random will cast your vote for a random map from all Hunger games map to be picked. Majority Vote wins. If no majority is found a random map is picked instead.'})
                .submitButton('Submit')
            
            hungerGamesForm.show(player).then(response => {
                if (response.canceled) {return};
                const index = response.formValues[0]
                const choice = hungerGamesMaps[index]
                player.setDynamicProperty('gameVote', `HungerGames:${choice}`)
                world.sendMessage(`${player.name} has voted. Game: Hunger Games, Map: ${choice}`)
            })
            break;
        }
    })
})