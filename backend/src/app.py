from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'SECRET_KEY'
CORS(app)  

board = ['', '', '', '', '', '', '', '', '']
players = {'p1': None, 'p2': None}
game_locked = True
is_game_running = False
turn = None
winner = None


@app.route('/players', methods=['GET'])
def get_players():
    return jsonify({'players': players})


@app.route('/register', methods=['POST'])
def register_player():
    global players, turn, is_game_running, game_locked

    if players['p1'] == request.json.get('nick') or players['p2'] == request.json.get('nick'):
        return jsonify({'status': 'taken'})
    if not players['p1']:
        players['p1'] = request.json.get('nick')
        is_game_running = True
        return jsonify({'status': 'registered'})  
    elif not players['p2']:
        players['p2'] = request.json.get('nick')
        turn = players['p1']
        game_locked = False
        return jsonify({'status': 'registered'})  
    else:
        return jsonify({'status': 'full'})  


@app.route('/game_running', methods=['GET'])
def is_game_running():
    return jsonify({'gameRunning': is_game_running})


@app.route('/send_move', methods=['POST'])
def send_move():
    global board, turn, players, game_locked, is_game_running
    move = request.json.get('move')
    currentPlayer = request.json.get('playerNick')
    
    if currentPlayer == turn and board[move] == '' and not game_locked:
        if currentPlayer == players['p1']:
            board[move] = 'x'
            turn = players['p2']
            checkWin()
            return jsonify({'status': 'success'})  
        elif currentPlayer == players['p2']:
            board[move] = 'o'
            turn = players['p1']
            checkWin()
            return jsonify({'status': 'success'})  
    else:
        return jsonify({'status': 'error', 'message': 'Invalid move'}) 


@app.route('/end_current_game', methods=['POST'])
def end_game():
    end_running_game()
    return jsonify({'status': 'registered'})  


@app.route('/board', methods=['GET'])
def get_board():
    return jsonify({'board': board})


@app.route('/winner', methods=['GET'])
def get_winner():
    winnerNick = None
    if winner == None:
        winnerNick = 'None'
    if winner == 'x':
        winnerNick = players['p1']
    elif winner =='o':
        winnerNick = players['p2']
    elif winner =='draw':
        winnerNick = 'draw'
    return jsonify({'winner': winnerNick})


def checkWin():
    global winner, game_locked, board
    if win_diagonaly_topLeftToBottomRight() or win_diagonaly_bottomLeftToTopRight():
        game_locked = True
        winner = board[4]
    else:
        for i in range(3):
            if win_horizontally(i):
                winner = board[i]
                game_locked = True
                break
            if win_vertically(3*i):
                winner = board[3*i]
                game_locked = True
                break
    if '' not in board:
        winner = 'draw'
        game_locked = True


def win_horizontally(i):
    global board
    return board[i] == board[i+3] and board[i+3] == board[i+6] and board[i] != ""


def win_vertically(i):
    global board
    return board[i] == board[i+1] and board[i+1] == board[i+2] and board[i] != ""


def win_diagonaly_topLeftToBottomRight():
    global board
    return board[0] == board[4] and board[4] == board[8] and board[0] != ""


def win_diagonaly_bottomLeftToTopRight():
    global board
    return board[6] == board[4] and board[4] == board[2] and board[6] != ""


def end_running_game():
    global board, turn, players, game_locked, is_game_running, winner
    board = ['', '', '', '', '', '', '', '', '']
    players = {'p1': None, 'p2': None}
    turn = None
    winner = None
    game_locked = True
    is_game_running = False


if __name__ == '__main__':
    #app.run(debug=True)
    app.run(port=8080, host="0.0.0.0")
    
