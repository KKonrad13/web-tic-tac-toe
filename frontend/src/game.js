var hostAddress = 'http://localhost:8080';
//python3 -m http.server --bind 0.0.0.0 8081
var API_URL = "API_GATEWAY_URL";

var playerNick = localStorage.getItem('nick');
var isAuthorized = true;
var playerImageAppended = false;
var opponentImageAppended = false;
var gameFinished = false;
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
            if (players.p1 == playerNick || players.p2 == playerNick) {
                if (players.p2 === null) {
                    document.getElementById('player_info').innerHTML = players.p1 + '\'s symbol: X';
                    document.getElementById('opponent_info').innerHTML = 'Waiting for an opponent...';
                    setPlayerImage(players.p1);
                }
                else if (players.p2 === playerNick) {
                    document.getElementById('opponent_info').innerHTML = players.p1 + '\'s symbol: X';
                    document.getElementById('player_info').innerHTML = players.p2 + '\'s symbol: O';
                    setPlayerImage(players.p2);
                    setOpponentImage(players.p1);
                }
                else {
                    document.getElementById('player_info').innerHTML = players.p1 + '\'s symbol: X';
                    document.getElementById('opponent_info').innerHTML = players.p2 + '\'s symbol: O';
                    setPlayerImage(players.p1);
                    setOpponentImage(players.p2);
                }
            }
        }
    };
}

function setOpponentImage(opponentNick) {
    if (!opponentImageAppended) {
        var opponentImage = new Image();
        opponentImage.src = hostAddress + '/image/' + opponentNick;
        opponentImage.style.maxWidth = '200px';
        opponentImage.style.maxHeight = '200px';
        opponentImage.onload = function () {
            document.getElementById('opponent_image').appendChild(opponentImage);
        };
        opponentImageAppended = true;
    }
}

function setPlayerImage(playerNick) {
    if (!playerImageAppended) {
        var playerImage = new Image();
        playerImage.src = hostAddress + '/image/' + playerNick;
        playerImage.style.maxWidth = '200px';
        playerImage.style.maxHeight = '200px';
        playerImage.onload = function () {
            document.getElementById('player_image').appendChild(playerImage);
        };
        playerImageAppended = true;
    }
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
    if (gameFinished){
        return;
    }
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
            if (winner != 'None'){
                sendResultToLambda(data.p1, data.p2, data.winner)
            }
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

function sendResultToLambda(player1nick, player2nick, result){
    gameFinished = true;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL + '/game_ended', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    var data = JSON.stringify({
        "player_1": player1nick,
        "player_2": player2nick,
        "result": result
    });

    xhr.send(data);

    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status !== 200) {
                console.error('Error sending result.');
                return;
            }
            console.log('Result sent successfully');
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
