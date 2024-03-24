var hostAddress = 'http://localhost:8080';
//python3 -m http.server --bind 0.0.0.0 8081


var parametr = window.location.search.substring(1);
var playerNick = parametr.split('=')[1];

function getOpponent() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress + '/players', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Fetching players error!');
                return
            }
            var data = JSON.parse(xhr.responseText);
            var players = data.players;
            if (players.p1 == playerNick || players.p2 == playerNick) {
                if(players.p2 === null){
                    document.getElementById('player_info').innerHTML = players.p1 + '\'s symbol: X';   
                    document.getElementById('opponent_info').innerHTML = 'Waiting for an opponent...';
                }
                else if (players.p2 === playerNick){
                    document.getElementById('opponent_info').innerHTML = players.p1 + '\'s symbol: X';
                    document.getElementById('player_info').innerHTML = players.p2 + '\'s symbol: O';   
                }
                else {
                    document.getElementById('player_info').innerHTML = players.p1 + '\'s symbol: X';
                    document.getElementById('opponent_info').innerHTML = players.p2 + '\'s symbol: O';                               
                }
            }               
        }
    };

}

function makeMove(move) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostAddress +'/send_move', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({move: move, playerNick: playerNick}));       

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Move error!');
                return
            }
            updateBoard();
        }
    };
}

function updateBoard() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress +'/board', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Getting board error!');
                return
            }
            var data = JSON.parse(xhr.responseText);
            var board = data.board;
            renderBoard(board);
        }
    };

}

function renderBoard(board) {
    var cells = document.getElementsByClassName('cell');
    for (var i = 0; i < cells.length; i++) {
        if (board[i] === '') {
            cells[i].setAttribute('onclick', 'makeMove(' + i + ')');
        } else if (board[i] === 'x') {
            cells[i].innerHTML  = `<img src='x_image.png'>`;
        } else if (board[i] === 'o') {
            cells[i].innerHTML  = `<img src='o_image.png'>`;
        }
    }
}

function checkWin() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress +'/winner', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Error getting winner');
                return
            }
            var data = JSON.parse(xhr.responseText);
            var winner = data.winner;
            if(winner == playerNick){
                document.getElementById('topInfo').innerHTML = 'You won!';
            }
            else if(winner == 'draw'){
                document.getElementById('topInfo').innerHTML = 'Draw!';
            }
            else if(winner != 'None'){
                document.getElementById('topInfo').innerHTML = 'You lost!';
            }
        }
    };

}

function endGame(){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostAddress + '/end_current_game', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();       

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Error ending game');
                return
            }
            checkEndGame();
        }
    };
}

function checkEndGame(){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress +'/game_running', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Error checking game end');
                return
            }
            var data = JSON.parse(xhr.responseText);
            var gameRunning = data.gameRunning;
            if (gameRunning == false) {
                window.location = "index.html";
            }
        }
    };
}

function updateGame(){
    checkWin()
    getOpponent()
    updateBoard()
    checkEndGame()
}

setInterval(updateGame, 1000);
