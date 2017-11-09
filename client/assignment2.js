/*
COMP 2406 A
Assignment 2
2017-11-01

Name:           William Da Silva
Student Email:  williamcovell@cmail.carleton.ca
*/

let canvas = document.getElementById('canvas'); // obtain canvas from the html
let context = canvas.getContext('2d');

let ws = new WebSocket('ws://' + window.document.location.host);

ws.onopen = function(event) {
    ws.send(JSON.stringify({type: 'minesweeperFetch'}));
};

let minesweeper = {}; // The minesweeper object, containing the board

let colour = 'black'; // Used as user ID

let canvasX, canvasY; // Mouse coordinate relative to the canvas

let playerCursors = new Map(); // `canvasX` and `canvasY` of other players

let colWidth = 0;   // Width of a column; will be assigned the correct value later
let rowHeight = 0;  // Height of a row; will be assigned the correct value later

let getTileAtLocation = function(canvasX, canvasY) {
    // returns the index of the tile at (canvasX, canvasY)
    return [Math.trunc(canvasX/colWidth), Math.trunc(canvasY/rowHeight)];
};

let drawMinesweeperElements = function() {
    let xOffset = 8;
    let yOffset = 25;
    // Mines, flags, and pressed tiles are drawn
    for (let x = 0; x < minesweeper.numColumns; ++x) {
        for (let y = 0; y < minesweeper.numRows; ++y) {
            let tile = minesweeper.board[x][y];
            if (tile.pressed) {
                // Draw the number of adjacent mines, or the detonated mine
                context.fillStyle = tile.whoPressed;
                if (tile.isMine) {
                    context.fillRect(
                        x * colWidth,
                        y * rowHeight,
                        colWidth,
                        rowHeight
                    );
                    context.fillStyle = 'black';
                    context.fillText(
                        '⚙',
                        x * colWidth + xOffset - 3,
                        y * rowHeight + yOffset
                    );
                }
                else {
                    context.fillRect(
                        x * colWidth,
                        y * rowHeight,
                        colWidth,
                        rowHeight
                    );
                    if (tile.numAdjacentMines !== 0) {
                        context.fillStyle = 'black';
                        context.fillText(
                            tile.numAdjacentMines,
                            x * colWidth + xOffset,
                            y * rowHeight + yOffset
                        );
                    }
                }
            }
            else if (tile.flag !== '') {    // Draw the flag
                context.fillStyle = tile.flagColour;
                context.fillText(
                    tile.flag,
                    x * colWidth + xOffset,
                    y * rowHeight + yOffset
                );
            }
        }
    }
};

let drawGrid = function() {
    colWidth = Math.trunc(canvas.width/minesweeper.numColumns);
    rowHeight = Math.trunc(canvas.height/minesweeper.numRows);
    // A grid is drawn on the canvas to indicate the tiles on the board
    for (let i = 1; i < minesweeper.numColumns; ++i) { // Draw vertical lines
        context.beginPath();
        context.moveTo(colWidth * i, 0);
        context.lineTo(colWidth * i, canvas.height);
        context.stroke();
    }
    for (let i = 1; i < minesweeper.numRows; ++i) { // Draw horizontal lines
        context.beginPath();
        context.moveTo(0, rowHeight * i);
        context.lineTo(canvas.width, rowHeight * i);
        context.stroke();
    }
};

let drawCursors = function() {
    for (let [otherPlayerColour, otherPlayerCanvasXY] of playerCursors) {
        context.fillStyle = otherPlayerColour;
        context.beginPath();
        context.arc(
            otherPlayerCanvasXY[0],
            otherPlayerCanvasXY[1],
            4,
            0,
            2 * Math.PI
        );
        context.fill();
        context.strokeStyle = 'black';
        context.stroke();
    }
};

let drawCanvas = function() {
    context.fillStyle = 'white'; // canvas background
    context.fillRect(0, 0, canvas.width, canvas.height); // erase canvas
    context.fillStyle = colour;
    context.font = '18pt Courier New';
    context.strokeStyle = 'rgb(128, 128, 128)';

    drawMinesweeperElements();
    drawGrid();
    drawCursors();
};

let handleMinesweeperUpdate = function(message) {
    // `message.data` is what the server has stored as the minesweeper board
    // Not the most efficient way of delivering the updates, but since the
    // minesweeper board is a small amount of data, it will not notably affect
    // the preformance of the site under normal conditions.
    minesweeper = message.data;
    drawCanvas(); // The minesweeper board has changed, so it is drawn again
};

let handleCursorUpdate = function(message) {
    if (message.remove) {
        playerCursors.delete(message.colour)
    }
    else {
        playerCursors.set(message.colour, [message.x, message.y]);
    }
    drawCanvas();
};

let handleMessageUpdate = function(message) {
    colour = message.playerColour; // Server tells client what colour they are
    let textColour = message.colour || 'black';
    let backgroundColour = message.backgroundColour || 'rgba(255, 255, 255, 0)';
    messageBox = document.getElementById('messages');
    if (this.loadedHistory) {
        // The message box history has already been loaded
        // Create a div with the message text, and set its colours
        let messageDiv = document.createElement('div');
        messageDiv.style.color = textColour;
        if (backgroundColour !== '') {
            messageDiv.style.backgroundColor = backgroundColour;
        }
        messageDiv.innerHTML = message.data;
        // Determine if the message box needs to be scrolled down
        let needToScroll =  messageBox.scrollTop + messageBox.clientHeight ===
                            messageBox.scrollHeight;
        messageBox.appendChild(messageDiv);
        if (needToScroll) {
            // If the user was previously scrolled to the bottom of the message
            // box, then scroll to the bottom
            messageBox.scrollTop = messageBox.scrollHeight;
        }
    }
    else {
        // The message box history needs to be loaded
        for (historyElement of message.data) {
            // Add all of the messages to the message box
            let messageDiv = document.createElement('div');
            messageDiv.innerHTML = historyElement.text;
            messageDiv.style.color = historyElement.colour;
            messageDiv.style.backgroundColor = historyElement.backgroundColour;
            messageBox.appendChild(messageDiv);
        }
        // Scroll to the bottom of the message box
        messageBox.scrollTop = messageBox.scrollHeight;
        this.loadedHistory = true;
    }
    drawCanvas(); // Needed here because the client's colour might have changed
};
handleMessageUpdate.loadedHistory = false; // Flag to indicate first call

ws.onmessage = function(message) {
    message = JSON.parse(message.data);
    let handler = new Map([ // maps message.updateType to the appropriate function
        ['minesweeperUpdate', handleMinesweeperUpdate],
        ['messageUpdate', handleMessageUpdate],
        ['minesweeperPush', function(x) {minesweeper = x.data; drawCanvas()}],
        ['cursorUpdate', handleCursorUpdate]
    ]).get(message.updateType); // Sets the appropriate function to handle the message
    handler(message); // Calls the appropriate function to handle the message
};

let handleSendButton = function() {
    // Note: Send button can be "pressed" by the enter key
    console.log('Send button pressed');
    let textField = document.getElementById('textField');
    let message = {
        text: textField.value.trim(),
        // A preceeding slash indicates the client issuing a command to the server
        type: textField.value.trim()[0] === '/' ? 'command' : 'message',
    };
    ws.send(JSON.stringify(message)); // Send the text in the text field
    textField.value = ''; // Clear the text field
};

let handleKeyPress = function(event) {
    if (event.which === 13) { // The ENTER key is encoded as key 13
        handleSendButton(); // Use the ENTER key to open songs with the text field
    }
};

let handleMouseDown = function(event) {
    // Get mouse location (canvasX, canvasY) in pixels relative to the top left corner of the canvas
    if (minesweeper == null) return; // Exit early if the board has not been loaded
    // Mouse button 1 is left click
    // Mouse button 3 is right click
    // Only right click and left click are handled
    if (event.which !== 1 && event.which !== 3) return;
    canvasX = event.layerX; // X coordinate relative to the canvas
    canvasY = event.layerY; // Y coordinate relative to the canvas
    let [clickedTileX, clickedTileY] = getTileAtLocation(canvasX, canvasY);
    // Players cannot click a tile that has already been pressed
    if (!minesweeper.board[clickedTileX][clickedTileY].pressed) {
        ws.send(JSON.stringify({
            type: 'minesweeperUpdate',
            clickType: event.which === 1 ? 'left' : 'right',
            tileX: clickedTileX,
            tileY: clickedTileY
        }));
    }
    event.stopPropagation();    // Stops propogation of the event
    event.preventDefault();     // Stops the default browser action
};

let lastCursorUpdateTime = 0;
let handleMouseMove = function(event) {
    // Updates the mouse coordinate relative to the canvas
    canvasX = event.layerX; // X coordinate relative to the canvas
    canvasY = event.layerY; // Y coordinate relative to the canvas
    // Wait at least 40 milliseconds
    if (Date.now() - lastCursorUpdateTime > 40) {
        let message = { // Cursor information for other clients to use
            canvasX: canvasX,
            canvasY: canvasY,
            type: 'cursorUpdate',
        };
        ws.send(JSON.stringify(message));
        lastMove = Date.now();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('canvas').addEventListener('mousedown', handleMouseDown);
    document.getElementById('canvas').addEventListener('mousemove', handleMouseMove);
    document.getElementById('textField').addEventListener('keypress', handleKeyPress);
});
