/*
COMP 2406 A
Assignment 2
2017-11-01

Name:           William Da Silva
Student Email:  williamcovell@cmail.carleton.ca
*/

// adjacents is the offsets from a coordinate that surround that coordinate
const adjacents = [[1,0],[0,1],[-1,0],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1]];

let minesweeper = {
    numColumns: 2,  // Minimum number of columns
    numRows: 2,     // Minimum number of rows
    numMines: 1     // Minimum number of mines
};

let checkBounds = function(tileX, tileY) {
    // Checks if tileX is out of bounds
    let xBounds = tileX < 0 || tileX >= minesweeper.numColumns;
    // Checks if tileY is out of bounds
    let yBounds = tileY < 0 || tileY >= minesweeper.numRows;
    return xBounds || yBounds; // returns true if the tile is out of bounds
};

minesweeper.shuffleBoard = function() {
    // Randomly rearranges the tiles in the board
    for (let i = this.numRows * this.numColumns - 1; i >= 0; --i) {
        let k = Math.floor((i + 1) * Math.random());
        // Convert i and k into indexes for a 2d array
        let [a, b] = [Math.trunc(i / this.numColumns), i % this.numRows];
        let [c, d] = [Math.trunc(k / this.numColumns), k % this.numRows];
        // Swap the location of two tiles
        [this.board[a][b], this.board[c][d]] = [this.board[c][d], this.board[a][b]];
        // Swap their stored x coordinate
        [this.board[a][b].x, this.board[c][d].x] = [this.board[c][d].x, this.board[a][b].x];
        // Swap their stored y coordinate
        [this.board[a][b].y, this.board[c][d].y] = [this.board[c][d].y, this.board[a][b].y];
    }
};

minesweeper.setAdjacentMineValues = function() {
    for (let tileX = 0; tileX < this.numColumns; ++tileX) {
        for (let tileY = 0; tileY < this.numRows; ++tileY) {
            let numMines = 0;
            for (let [a, b] of adjacents) {
                // Skips iteration if `tileX + a` or `tileY + b` is out of bounds
                if (checkBounds(tileX + a, tileY + b)) continue;
                numMines += this.board[tileX + a][tileY + b].isMine;
            }
            numMines += this.board[tileX][tileY].isMine; // Includes self in count
            this.board[tileX][tileY].numAdjacentMines = numMines;
        }
    }
};

minesweeper.generateBoard = function(numColumns=16, numRows=16, numMines=40) {
    if (numColumns > this.numColumns) this.numColumns = numColumns;
    if (numRows > this.numRows) this.numRows = numRows;
    if (numMines > this.numMines) this.numMines = numMines;
    if (this.numMines > this.numColumns * this.numRows) {
        // The maximum number of mines occurs when every tile is a mine
        this.numMines =  this.numColumns * this.numRows;
    }
    this.board = new Array(numColumns);

    let minesPlaced = 0;
    for (let tileX = 0; tileX < this.numColumns; ++tileX) { // Generate new tiles
        this.board[tileX] = new Array(this.numRows);
        for (let tileY = 0; tileY < this.numRows; ++tileY) {
            this.board[tileX][tileY] = {    // New Tile Object
                x: tileX,
                y: tileY,
                flag: '', // What is displayed on the mine before it is pressed
                flagColour: '',
                pressed: false,
                numAdjacentMines: 0,   // will be set later
                // The first `this.numMines` tiles have mines initially
                // Board is shuffled later to randomize their locations
                isMine: this.numMines > minesPlaced,
                whoPressed: ''
            }
            ++minesPlaced;
        }
    }
    this.shuffleBoard();
    this.setAdjacentMineValues();
};

minesweeper.cascade = function(tileX, tileY, whoPressed) {
    let tileStack = [this.board[tileX][tileY]];
    let tile = null;
    while (tile = tileStack.shift()) {
        if (tile.numAdjacentMines === 0) {
            for (let [a, b] of adjacents) {
                if (checkBounds(tile.x + a, tile.y + b)) continue;
                let adjacentTile = this.board[tile.x + a][tile.y + b];
                if (!adjacentTile.pressed) {
                    adjacentTile.pressed = true;
                    adjacentTile.whoPressed = whoPressed;
                    tileStack.push(adjacentTile);
                }
            }
        }
    }
};

minesweeper.determineState = function() {
    // Returns the state of the game, which is one of:
    // (Victory, Pristine, Ongoing)
    let tilesClicked = 0;
    let minesClicked = 0;
    let minesFlagged = 0;
    let tilesFlagged = 0;
    for (column of this.board) {
        for (tile of column) {
            if (tile.pressed) {
                ++tilesClicked;
                if (tile.isMine) {
                    ++minesClicked;
                }
            }
            else {
                if (tile.flag !== '') {
                    ++tilesFlagged;
                    if (tile.isMine && tile.flag === '!') {
                        ++minesFlagged;
                    }
                }
            }
        }
    }
    if (minesFlagged + minesClicked === this.numMines) {
        // All the mines have been flagged with '!', or
        // clicked. Either way, they've all been dealt with
        return 'Victory';
    }
    else if (tilesFlagged === 0 && tilesClicked === 0) {
        return 'Pristine'; // Nothing on the board has been affected
    }
    else {
        // The board has been affected,
        // but not all mines have been flagged with '!'
        return 'Ongoing';
    }
    // In this implementation of minesweeper, there is no way to lose.
    // Instead of losing, a player will receive a less than optimal score if
    // they click on mines.
    // The implementation of the score system has been left to the user of the
    // module.
};

module.exports = minesweeper; // Provide access to the minesweeper object
