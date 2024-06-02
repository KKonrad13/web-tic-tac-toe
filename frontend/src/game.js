var hostAddress = 'http://localhost:8080';
//python3 -m http.server --bind 0.0.0.0 8081


var playerNick = localStorage.getItem('nick');
var isAuthorized = true;
let nIntervId;
function getOpponent() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress + '/players', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.send();

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Fetching players error!');
                return;
            }
            var data = JSON.parse(xhr.responseText);
            var players = data.players;

            // Update player information based on the response
            for (var playerKey in players) {
                var player = players[playerKey];
                if (player && player.nickname === playerNick) {
                    var playerSymbol = playerKey === 'p1' ? 'X' : 'O';
                    var opponent = playerKey === 'p1' ? players.p2 : players.p1;
                    var opponentSymbol = playerKey === 'p1' ? 'O' : 'X';

                    document.getElementById('player_info').innerHTML = player.nickname + '\'s symbol: ' + playerSymbol;
                    document.getElementById('opponent_info').innerHTML = opponent ? opponent.nickname + '\'s symbol: ' + opponentSymbol : 'Waiting for an opponent...';

                    if (player.image_data) {
                        var playerImage = document.createElement('img');
                        playerImage.src = 'data:image/jpeg;base64,' + player.image_data;
                        playerImage.style.maxWidth = '200px';
                        playerImage.style.maxHeight = '200px';
                        document.getElementById('player_image').appendChild(playerImage);
                    } else {
                        console.error("Player image error: " + player.error);
                    }

                    if (opponent && opponent.image_data) {
                        var opponentImage = document.createElement('img');
                        opponentImage.src = 'data:image/jpeg;base64,' + opponent.image_data;
                        opponentImage.style.maxWidth = '200px';
                        opponentImage.style.maxHeight = '200px';
                        document.getElementById('opponent_image').appendChild(opponentImage);
                    } else {
                        console.error("Opponent image error: " + opponent.error);
                    }
                }
            }
        }
    };
}


function makeMove(move) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostAddress + '/send_move', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.send(JSON.stringify({ move: move, playerNick: playerNick }));

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Move error!');
                isAuthorized = false;
                return
            }
            updateBoard();
        }
    };
}

function updateBoard() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress + '/board', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.send();

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Getting board error!');
                isAuthorized = false;
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
            cells[i].innerHTML = `<img src='x_image.png'>`;
        } else if (board[i] === 'o') {
            cells[i].innerHTML = `<img src='o_image.png'>`;
        }
    }
}

function checkWin() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress + '/winner', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.send();

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Error getting winner');
                isAuthorized = false;
                return
            }
            var data = JSON.parse(xhr.responseText);
            var winner = data.winner;
            if (winner == playerNick) {
                document.getElementById('topInfo').innerHTML = 'You won!';
            }
            else if (winner == 'draw') {
                document.getElementById('topInfo').innerHTML = 'Draw!';
            }
            else if (winner != 'None') {
                document.getElementById('topInfo').innerHTML = 'You lost!';
            }
        }
    };

}

function endGame() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostAddress + '/end_current_game', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.send();

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Error ending game');
                isAuthorized = false;
                return
            }
            checkEndGame();
        }
    };
}

function checkEndGame() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress + '/game_running', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.send();

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Error checking game end');
                isAuthorized = false;
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

function updateGame() {
    checkWin()
    getOpponent()
    updateBoard()
    checkEndGame()
    if (!isAuthorized) {
        clearInterval(nIntervId);
        nIntervId = null;
        document.getElementById('main_div').innerHTML = '<h1 class="topText">You are not authorized!</h1>';

    }
}

nIntervId = setInterval(updateGame, 1000);
