import {world, system } from "@minecraft/server";
import { ModalFormData, ActionFormData, MessageFormData } from "@minecraft/server-ui";

export class Map { //Class that provides methods and Properties for Making a Map as well as saving it to the world via a dynamic property. 
    constructor(name, mapData) {
        this.name = name;
        this.mapData = mapData;
    }
    static allMaps = []; //array that holds instnaces of this class. Maps are pushed to this array with the static method loadAllMaps() Which pulls from the worlds dynamic properties.
    static loadAllMaps() {
       const IDs = world.getDynamicPropertyIds().filter(id => id.startsWith("map:"));
       if(!IDs) return;
       IDs.forEach(id => {
        const dynamicProperty = world.getDynamicProperty(id);
        const map = new Map(id, dynamicProperty);
        Map.allMaps.push(map);
       })
    };
    load() {
       const rawData = JSON.parse(this.mapData);
       return rawData;
    };
    save() {
        world.setDynamicProperty(`map: ${this.name}, ${this.mapData}`);
        return world.sendMessage(`Created Map: ${this.name}, with this data attached: ${this.mapData}`);
    }

};
const directoryForm = new ActionFormData() //Form that allows navigation to other forms
    .title("Welcome to Hunger Games Map Maker")
    .button("Add a new map")
    .button("Delete a map")
    .button("Tutorial")
    .button("Credits");

const mapMaker = new ModalFormData() //form that allows the player to make their own map by inputing relevant information that the system will use to fill chests place players and place barriers
    .title("Map Maker")
    .header("Add the coordinates/name into the field(s) as prompted.\nBe sure to follow the format shown")
    .textField("Name:", "Enter the map name")
    .textField("Spawns:", '[x, y, z], [x, y, z], [x, y, z]')
    .textField("Barriers:", '[x, y, z], [x, y, z], [x, y, z]')
    .textField("Chests:", '[x, y, z], [x, y, z], [x, y, z]')
    .dropdown("Dimension:", ["Overworld", "Nether", "End"])
    .slider('Number of minutes game should run for this map:', 1, 30)
    .slider('Max number of players:', 2, 20)
    .submitButton("Submit");

const mapErase = new ModalFormData() //Form that allows for deletion of maps this form will erase maps from the worlds dynamic properties as well as the allMaps array in the Map Class 
    .title('Map Eraser')
    .header('Select the map you wish to erase')
    .dropdown('Maps:', Map.allMaps.map(m => m.name))
    .submitButton('Delete Map');


const tutorialform = new MessageFormData() //Explanation of how to use the system as well as importnant notes for filling out the map maker form
    .title('How to use this addon')
    .body('This addon can be used to make your very own maps for the Hunger Games.\nThe first thing to do is build your very own map! Please note the following key points:\n1.The max number of players for any given map is 20\n2. Having many barriers and chests can increase lag. Because of this it is best practice to build your spawn points with regular blocks around the player and one single barrier block instead of multiple per spawn.\n3.As you build your maps take note of the coordinates of chests, Player spawns as well as barrier blocks. Be sure you are getting the actualy coordinate and not the block above it! Make sure to write these down you will need every coordinate later!\n\nFirst open this item again and click on the option for making a map. Then Input the coordinates to all chests, spawns and barriers. (A barrier is an invisible block that will stop the player from leaving spawn until the timer is done)\nMake sure to structure it like such: "x, y, z", "x, y, z", "x, y, z" with a comma between each coordinate and one between each set of coordinates. In addition each set of coordinates should be wrapped in a set of quote marks.');


const credits = new MessageFormData() //credits for the Programmer and Map builder!
    .title('Credits')
    .body('This addon was made with much care and effort by me (Brandon) It is my intent that people will use this addon to create memories with their friends as well form new friendships!\nThe maps that come included with this addon were made with dedication and talent by My friend Richie. If this addon helps you in any way consider helping others with your craft! Thank you!');

const chestLootForm = new ActionFormData()
    .title('Set Chest Loot')
    .button('Set chest to low level loot')
    .button('Set chest to mid level loot')
    .button('Set chest to high level loot')
    .button('Erase this chest from Map');


world.afterEvents.itemUse((event) => { //Handels showing the forms starting from directory from when a player uses the map manager item calls methods from Map class to save the information as a string that can later be parsed to grab relevant information
    const player = event.source
    const item = event.item.typeId;
    if (item = "b_minigames:map_manager") {
        directoryForm.show(player).then(response => {
            if (response.canceled) {return};
           const selection = response.selection;
           switch(selection) {
            case 0: mapMaker.show(player).then(response => {
                if (response.canceled) return;
                const name = response.formValues[0]
                const spawns = response.formValues[1]
                const barriers = response.formValues[2]
                const chests = response.formValues[3]
                const dimension = response.formValues[4]
                const numOfTicks = response.formValues[5] * 1200
                const numOfPlayers = response.formValues[6]
                const dataString = `{"spawns": [${spawns}], "barriers": [${barriers}], "chests": [${chests}], "dimension": "${dimension}", "numOfTicks": ${numOfTicks}, "numOfPlayers": ${numOfPlayers}}` //Creates a string out of the data given on the from for lookup later when the map in initialized for gameplay
                const createdMap = new Map(name, dataString); // Creates a new instnace of the Map class and passes in the name of the Map as well as the data string created from the form reponses
                createdMap.save() //Saves the Map to the world dynamic properties for persistance when loading the world
                Map.allMaps.push(createdMap) //cache map to static property 
            }); break;
            case 1: mapErase.show(player).then(response => {
                if (response.canceled) return
                const chosenMap = formValues[0]
                const chosenMapInArray = Map.allMaps.findIndex(map => map.name === chosenMap)
                Map.allMaps.splice(chosenMapInArray, 1) //Erases instance of map from allMaps array
                world.setDynamicProperty(chosenMap) //reases dynamic property for given map
            }); break;
            case 2: tutorialform.show(player); break;
            case 3: credits.show(player); break;
           }
        })
    }
})

world.beforeEvents.playerInteractWithBlock.subscribe((event) => { //handles setting which tier of loot a chest will recieve during game initlization
    const gamemode = event.player.getGameMode()
    const block = event.block
    if(gamemode === "Creative" && event.player.isSneaking === true && block.typeId === "minecraft:chest") {
        chestLootForm.show(event.player).then(response => {
            if(response.canceled) return;
            switch(response) {
                case 0: world.setDynamicProperty(`${block.location.x}, ${block.location.y}, ${block.location.z}`, "low"); break;
                case 1: world.setDynamicProperty(`${block.location.x}, ${block.location.y}, ${block.location.z}`, "mid"); break;
                case 2: world.setDynamicProperty(`${block.location.x}, ${block.location.y}, ${block.location.z}`, "high"); break;
                case 3: 
                const chestExists = world.getDynamicProperty(`${block.location.x}, ${block.location.y}, ${block.location.z}`)
                if (chestExists) {world.setDynamicProperty(`${block.location.x}, ${block.location.y}, ${block.location.z}`)} 
                else return;
            }
        })
    }
})


