import os
from functools import wraps

import boto3
import jwt
from botocore.exceptions import ClientError
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from jwt import PyJWKClient

# python -m http.server --bind 0.0.0.0 8081
app = Flask(__name__)
app.config["SECRET_KEY"] = "SECRET_KEY"
CORS(app)


jwtManager = JWTManager(app)

# Cognito configuration
USER_POOL_ID = os.getenv("USER_POOL_ID")
APP_CLIENT_ID = os.getenv("APP_CLIENT_ID")
COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")

S3_PROFILE_PICTURES = os.getenv("S3_PROFILE_PICTURES")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

SNS_TOPIC_ARN = os.getenv("SNS_TOPIC_ARN")
SNS_REGION = os.getenv("SNS_REGION", "us-east-1")

DB_TABLE_NAME = os.getenv("DB_TABLE_NAME")

cognito_client = boto3.client("cognito-idp", region_name=COGNITO_REGION)
s3_client = boto3.client("s3", region_name=S3_REGION)
sns_client = boto3.client("sns", region_name=SNS_REGION)
dynamodb = boto3.resource("dynamodb")

ranking_table = dynamodb.Table(DB_TABLE_NAME)

board = ["", "", "", "", "", "", "", "", ""]
players = {"p1": None, "p2": None}
game_locked = True
is_game_running = False
turn = None
winner = None


COGNITO_ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}"

# Fetch the Cognito public keys
jwks_url = f"{COGNITO_ISSUER}/.well-known/jwks.json"
jwk_client = PyJWKClient(jwks_url)


def decode_token(token):
    unverified_claims = jwt.decode(token, options={"verify_signature": False})
    unverified_claims["aud"] = unverified_claims.get("client_id")
    signing_key = jwk_client.get_signing_key_from_jwt(token).key
    decoded_token = jwt.decode(
        token,
        key=signing_key,
        algorithms=["RS256"],
        audience=APP_CLIENT_ID,
        issuer=COGNITO_ISSUER,
        options={"verify_signature": False},
    )
    return decoded_token


def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]
        if not token:
            return jsonify({"message": "Token is missing!"}), 403
        try:
            decode_token(token)
        except Exception as e:
            return jsonify({"message": str(e)}), 403
        return f(*args, **kwargs)

    return decorated_function


@app.route("/test", methods=["GET"])
def test_backend():
    return jsonify({"message": "Backend is running."}), 200


@app.route("/register", methods=["POST"])
def register():
    username = request.form.get("nick")
    password = request.form.get("password")
    email = request.form.get("email")
    image = request.files.get("image")
    save_img_result = None
    try:
        cognito_client.sign_up(
            ClientId=APP_CLIENT_ID,
            Username=username,
            Password=password,
            UserAttributes=[{"Name": "email", "Value": email}],
        )
        save_img_result = save_image_to_s3(image, username)
        subscribe_to_topic_result = subscribe_to_topic(email)
        return (
            jsonify(
                {
                    "message": f"User registered successfully. Saving image status: {save_img_result}. Subscribing status: {subscribe_to_topic_result}"
                }
            ),
            200,
        )
    except ClientError as e:
        if save_img_result:
            error = f"{str(e)}, Saving image status: {save_img_result}"
        else:
            error = str(e)
        return jsonify({"error": error}), 400


def save_image_to_s3(image, username):
    if image:
        filename = f"{username}.png"
        try:
            s3_client.upload_fileobj(
                image,
                S3_PROFILE_PICTURES,
                filename,
                ExtraArgs={"ContentType": image.content_type},
            )
            return "Success"
        except ClientError as e:
            return str(e)


def subscribe_to_topic(email):
    try:
        sns_client.subscribe(TopicArn=SNS_TOPIC_ARN, Protocol="email", Endpoint=email)
        return "Subscribe successful."
    except Exception as e:
        return str(e)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data["nick"]
    password = data["password"]

    try:
        response = cognito_client.initiate_auth(
            ClientId=APP_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": username,
                "PASSWORD": password,
            },
        )
        access_token = response["AuthenticationResult"]["AccessToken"]
        refresh_token = response["AuthenticationResult"]["RefreshToken"]
        expiresIn = response["AuthenticationResult"]["ExpiresIn"]
        return (
            jsonify(
                access_token=access_token,
                refresh_token=refresh_token,
                expiresIn=expiresIn,
            ),
            200,
        )
    except ClientError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/verify", methods=["POST"])
def verify():
    data = request.get_json()
    username = data["nick"]
    code = data["code"]
    try:
        response = cognito_client.confirm_sign_up(
            ClientId=APP_CLIENT_ID, Username=username, ConfirmationCode=code
        )
        return jsonify({"message": "User verified successfully"}), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/refresh_token", methods=["POST"])
def refresh_token():
    data = request.get_json()
    refresh_token = data["refresh_token"]

    try:
        response = cognito_client.initiate_auth(
            ClientId=APP_CLIENT_ID,
            AuthFlow="REFRESH_TOKEN_AUTH",
            AuthParameters={
                "REFRESH_TOKEN": refresh_token,
            },
        )
        new_access_token = response["AuthenticationResult"]["AccessToken"]
        return jsonify(access_token=new_access_token), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/logout", methods=["POST"])
@token_required
def logout():
    data = request.get_json()
    access_token = data.get("access_token")

    if not access_token:
        return jsonify({"message": "Access token is missing!"}), 400

    try:
        response = cognito_client.global_sign_out(AccessToken=access_token)
        return jsonify({"message": "Successfully logged out!"}), 200
    except cognito_client.exceptions.NotAuthorizedException:
        return jsonify({"message": "The access token is not valid!"}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route("/players", methods=["GET"])
@token_required
def get_players():
    return jsonify({"players": players})


@app.route("/image/<player>", methods=["GET"])
def get_player_image(player):
    image_data, error_message = get_image_data(f"{player}.png")
    if image_data:
        return Response(image_data, mimetype="image/png")
    else:
        return error_message, 400


def get_image_data(filename):
    try:
        response = s3_client.get_object(Bucket=S3_PROFILE_PICTURES, Key=filename)
        image_data = response["Body"].read()
        return (image_data, None)
    except Exception as e:
        return (None, str(e))


@app.route("/register_player", methods=["POST"])
@token_required
def register_player():
    global players, turn, is_game_running, game_locked
    # or players["p2"] == request.json.get("nick")
    token = request.headers["Authorization"].split(" ")[1]
    decoded_token = decode_token(token)
    # Extract the username from the decoded token
    username = decoded_token.get("username")
    if players["p1"] == username or players["p2"] == username:
        return jsonify({"status": "registered", "nick": username})
    if not players["p1"]:
        players["p1"] = username
        is_game_running = True
        return jsonify({"status": "registered", "nick": username})
    elif not players["p2"]:
        players["p2"] = username
        turn = players["p1"]
        game_locked = False
        return jsonify({"status": "registered", "nick": username})
    else:
        return jsonify({"status": "full"})


@app.route("/game_running", methods=["GET"])
@token_required
def is_game_running():
    return jsonify({"gameRunning": is_game_running})


@app.route("/send_move", methods=["POST"])
@token_required
def send_move():
    global board, turn, players, game_locked, is_game_running
    move = request.json.get("move")
    currentPlayer = request.json.get("playerNick")

    if currentPlayer == turn and board[move] == "" and not game_locked:
        if currentPlayer == players["p1"]:
            board[move] = "x"
            turn = players["p2"]
            checkWin()
            return jsonify({"status": "success"})
        elif currentPlayer == players["p2"]:
            board[move] = "o"
            turn = players["p1"]
            checkWin()
            return jsonify({"status": "success"})
    else:
        return jsonify({"status": "error", "message": "Invalid move"})


@app.route("/end_current_game", methods=["POST"])
@token_required
def end_game():
    end_running_game()
    return jsonify({"status": "registered"})


@app.route("/board", methods=["GET"])
@token_required
def get_board():
    return jsonify({"board": board})


@app.route("/winner", methods=["GET"])
@token_required
def get_winner():
    winnerNick = None
    if winner == None:
        winnerNick = "None"
    if winner == "x":
        winnerNick = players["p1"]
    elif winner == "o":
        winnerNick = players["p2"]
    elif winner == "draw":
        winnerNick = "draw"
    return jsonify({"p1": players["p1"], "p2": players["p2"], "winner": winnerNick})


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
            if win_vertically(3 * i):
                winner = board[3 * i]
                game_locked = True
                break
    if "" not in board:
        winner = "draw"
        game_locked = True


@app.route("/get_rankings", methods=["GET"])
def get_rankings():
    response = ranking_table.scan()
    players = response["Items"]
    sorted_players = sorted(players, key=lambda x: x["result"], reverse=True)

    rank = 1
    previous_wins = -1
    current_rank = 0

    for player in sorted_players:
        if player["wins"] != previous_wins:
            current_rank = rank
            previous_wins = player["wins"]
        player["rank"] = current_rank
        rank += 1

    return jsonify(sorted_players)


def win_horizontally(i):
    global board
    return board[i] == board[i + 3] and board[i + 3] == board[i + 6] and board[i] != ""


def win_vertically(i):
    global board
    return board[i] == board[i + 1] and board[i + 1] == board[i + 2] and board[i] != ""


def win_diagonaly_topLeftToBottomRight():
    global board
    return board[0] == board[4] and board[4] == board[8] and board[0] != ""


def win_diagonaly_bottomLeftToTopRight():
    global board
    return board[6] == board[4] and board[4] == board[2] and board[6] != ""


def end_running_game():
    global board, turn, players, game_locked, is_game_running, winner
    board = ["", "", "", "", "", "", "", "", ""]
    players = {"p1": None, "p2": None}
    turn = None
    winner = None
    game_locked = True
    is_game_running = False


if __name__ == "__main__":
    # app.run(debug=True)
    app.run(port=8080, host="0.0.0.0")
