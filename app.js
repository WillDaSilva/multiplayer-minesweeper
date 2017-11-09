/*
COMP 2406 A
Assignment 2
2017-11-01

Name:           William Da Silva
Student Email:  williamcovell@cmail.carleton.ca
*/

let http = require('http');                 // HTTP module
let path = require('path');                 // OS agnostic path joining
let WebSocketServer = require('ws').Server; // web sockets module
let ecStatic = require('ecstatic');         // static file server module
let minesweeper = require('./minesweeper'); // minesweeper backend

minesweeper.generateBoard();

const ROOT = 'client'; // directory from which to server static files
const PORT = process.env.PORT || 3000;
const MAX_HISTORY_LENGTH = 250; // number of messages to save in the history

let history = new Array();  // List of previously broadcasted messages
let scores = new Map();     // Map of player colours to scores

// static file server
let server = http.createServer(ecStatic({root: path.join(__dirname, ROOT)}));

// web socket server
let wss = new WebSocketServer({server: server});

let broadcast = function(ws, message) {
    wss.clients.forEach(function(client) {
        client.send(JSON.stringify({
            updateType: 'messageUpdate',
            data: message,
            colour: ws.colour,
            backgroundColour: ws.backgroundColour || 'rgba(255, 255, 255, 0)'
        }));
    });
}

let messageUpdate = function(ws, message) {
    broadcast(ws, message.text);
    if (message.text !== '') { // Record message in history
        history.push({
            text: message.text,
            colour: ws.colour,
            backgroundColour: ws.backgroundColour || 'rgba(255, 255, 255, 0)'
        });
        while (history.length >= MAX_HISTORY_LENGTH) {
            history.shift(); // removes the oldest message from the history
        }
    }
}

let minesweeperFetch = function(ws, update) {
    if (update.all) { // send update to all clients
        for(let client of wss.clients) {
            client.send(JSON.stringify({
                updateType: 'minesweeperPush',
                data: minesweeper
            }));
        }
    }
    else {
        ws.send(JSON.stringify({
            updateType: 'minesweeperPush',
            data: minesweeper
        }));
    }
};

const validColours = new RegExp([
    // RegExp to check if the client entered a valid colour
    `^(#[a-f0-9]{6}|`,
    `maroon|navy|red|blue|purple|olive|teal|`,
    `green|silver|gray|fuchsia|aqua|yellow|orange)$`
].join(''), 'i');

let commandUpdate = function(ws, command) {
    command = command['text'].slice(1); // Remove the '/' from the command
    command = command.split(/\s/g);     // Splits the command on whitespace
    let response = new Array();
    switch(command[0]) {
        default: // Command not found, display help
            response.push(`${command[0]} is not a valid command`);
        case 'h':
        case 'help':
            response.push([
                'Chat Commands:',
                '/help, /h: Lists available commands.',
                '/setColour, /c: Sets your colour.',
                '/listColours, /lc: Lists available colours.',
                '/instructions, /i: Provide instructions for minesweeper',
                'Any other text entered will be sent for all players',
                'to see in the chat box.',
                'You can see the cursors of the other players as',
                'coloured dots on your screen.'
            ].join('<br>'));
            break;
        case 'i':
        case 'instructions':
            response.push([
                'Welcome to multiplayer minesweeper!',
                'Firstly, you must choose your colour with the /c',
                'command. For example: `/c red`',
                'Once you\'ve selected your colour, you can start',
                'playing. Each tile on the board may contain a mine.',
                'You can reveal a tile by left clicking it. If you',
                'reveal a mine, your score will decrease by 20.',
                'Revealing a non-mine tile will increases your score',
                'by 1. You can right click a tile to cycle through',
                'its flags. The ! means there is a mine under that',
                'tile, and the ? mean you think there might be a',
                'mine under that tile. To win the game, you must',
                'detonate/flag every mine on the board. Work with',
                'the other players to try and find every mine, and',
                'see who can get the highest score!',
                'Revealing a non-mine tile will show the number of',
                'mines directly surrounding it (blank means 0).',
                'Revealing a tile with no mines surrounding it will',
                'trigger a cascading effect that can reveal a large',
                'area of the board.'
            ].join('<br>'));
            break;
        case 'c':
        case 'setColour':
            if (command[1] && validColours.test(command[1])) {
                let colourAvailable = true;
                for (client of wss.clients) {
                    if (client.userID === ws.userID) continue;
                    if (client.colour === command[1]) colourAvailable = false;
                }
                if (colourAvailable) {
                    ws.colour = command[1]; // Change the player's colour
                    response.push(`Your colour has been set to ${command[1]}`);
                    if (scores.get(ws.colour) == null) {
                        // Initialize the player's score
                        scores.set(ws.colour, 0);
                    }
                }
                else {
                    response.push(`Colour ${command[1]} is not available`);
                }
            }
            break;
        case 'lc':
        case 'listColours':
            response.push('Available colours are:')
            response.push('maroon, blue, green, silver, gray, olive, yellow,');
            response.push('navy, red, purple, teal, fuchsia, aqua, orange');
            response.push('Or any hex colour: #XXXXXX');
            break;
        case 'r':
        case 'restart':
            minesweeper.generateBoard(); // Generate new board
            scores = new Map(); // Reset all scores
            let fakeWS = {colour: 'black', backgroundColour: 'red'};
            minesweeperFetch(fakeWS, {all: true})
            messageUpdate(fakeWS, {text: 'Game reset'});
            break;
        case 's':
        case 'scores':
            response.push('Scores:');
            for (let [playerColour, score] of scores) {
                response.push(`${playerColour}: ${score}`);
            }
            break;
    }
    if (response.length > 0) {
        ws.send(JSON.stringify({
            updateType: 'messageUpdate',
            data: response.join('<br>'),
            colour: 'black',
            playerColour: ws.colour,
            backgroundColour: 'lightblue'
        }));
    }
};

let handleLeftClickOnBoard = function(ws, update, clickedTile) {
    // If there is a flag set, and the client who is clicking on the tile
    // is not the one who set it, they cannot left click the tile
    if (clickedTile.flag !== '' && clickedTile.flagColour !== ws.colour) return;
    clickedTile.flag = ''; // Remove the flag
    clickedTile.pressed = true;
    clickedTile.whoPressed = ws.colour;
    if (clickedTile.isMine) { // BOOM
        // Initialize the player's score if needed, and give them a penalty
        if (scores.get(ws.colour) == null) scores.set(ws.colour, -20);
        else scores.set(ws.colour, scores.get(ws.colour) - 20);
    }
    else { // The tile wasn't a mine => the surrounding area is revealed
        minesweeper.cascade(update.tileX, update.tileY, ws.colour);
        // Initialize the player's score if needed, and give them a point
        if (scores.get(ws.colour) == null) scores.set(ws.colour, 1);
        else scores.set(ws.colour, scores.get(ws.colour) + 1);
    }
};

let handleRightClickOnBoard = function(ws, clickedTile) {
    if (clickedTile.flag === '' || clickedTile.flagColour === ws.colour) {
        // For a client to change the flag, either the flag must not be
        // set, or they had to be the one to set the flag
        clickedTile.flag = new Map([ // Switches the flag to the next one
            ['', '!'],
            ['!', '?'],
            ['?', '']
        ]).get(clickedTile.flag);
        clickedTile.flagColour = ws.colour;
    }
};

let checkGameState = function() {
    if (minesweeper.determineState() === 'Victory') {
            let message = [ // Message to send clients
                'You Win!',
                `Enter '/r' to restart`,
                `Enter '/s' to view scores`
            ].join('<br>');
            let fakeWS = {colour: 'black', backgroundColour: 'red'};
            messageUpdate(fakeWS, {text: message});
    }
};

let minesweeperUpdate = function(ws, update) {
    // Players cannot update the board if they have not selected a colour
    if (ws.colour == null || ws.colour === 'black') return;
    let clickedTile = minesweeper.board[update.tileX][update.tileY];
    // Players cannot click a tile that has already been pressed
    if (clickedTile.pressed) return;
    // Message for all clients to see; The result of the minesweeperUpdate
    let messageText = '';
    if (update.clickType === 'left') {
        handleLeftClickOnBoard(ws, update, clickedTile);
    }
    else if (update.clickType === 'right') {
        handleRightClickOnBoard(ws, clickedTile);
    }
    wss.clients.forEach(function(client) { // Send every client the new board
        client.send(JSON.stringify({
            updateType: 'minesweeperUpdate',
            data: minesweeper
        }));
    });
    if (messageText !== '') {
        messageUpdate(ws, {text: messageText});
    }
    checkGameState();
};

let cursorUpdate = function(ws, message) {
    // Sends all clients the cursor location on the canvas of the players
    for (let client of wss.clients) {
        // Only
        if (ws.colour !== 'black' && ws.colour !== client.colour) {
            client.send(JSON.stringify({
                updateType: 'cursorUpdate',
                colour: ws.colour,
                x: message.canvasX,
                y: message.canvasY
            }))
        }
    }
};

connectionCount = 0;    // Number of connections made
                        // Used as a userID for each connection

wss.on('connection', function(ws) {
    ws.userID = connectionCount;
    ++connectionCount
    console.log('user #' + ws.userID + ' connected');
    ws.colour = 'black'         // set initial colour
    ws.send(JSON.stringify({    // send message box history to the client
        updateType: 'messageUpdate',
        data: history
    }));
    ws.send(JSON.stringify({    // send the board to the client
        updateType: 'minesweeperUpdate',
        data: minesweeper
    }));
    ws.on('message', function(message) { // New message received by client
        message = JSON.parse(message);
        let handler = new Map([ // Set the appropriate handler for the message
            ['message', messageUpdate],
            ['command', commandUpdate],
            ['minesweeperUpdate', minesweeperUpdate],
            ['minesweeperFetch', minesweeperFetch],
            ['cursorUpdate', cursorUpdate]
        ]).get(message.type);
        handler(ws, message);   // Call the appropriate handler for the message
    });
    ws.on('close', function() {
        wss.clients.forEach(function(client) {  // Remove cursor
            client.send(JSON.stringify({
                updateType: 'cursorUpdate',
                colour: ws.colour,
                remove: true
            }));
        });
        console.log('user #' + ws.userID + ' left');
    });
});

server.listen(PORT, (error) => {
    if (error) {
        console.log(error);
    }
    else {
        console.log(`Server running at port ${PORT}\nCNTL-C to quit`);
    }
});
