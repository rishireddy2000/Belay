from flask import Flask, g, request, jsonify
import string
import random
import sqlite3

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

def get_db():
    db = getattr(g, '_database', None)

    if db is None:
        db = g._database = sqlite3.connect('db/belay.sqlite3')
        db.row_factory = sqlite3.Row
        setattr(g, '_database', db)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    cursor.close()
    if rows:
        if one: 
            return rows[0]
        return rows
    return None

def authenticate(request):
    auth_key = request.headers.get("X-API-KEY")
    return query_db('SELECT * FROM users WHERE auth_key = (?)', [auth_key], one=True)


@app.route('/')
@app.route('/profile')
@app.route('/channels')
@app.route('/channels/<c_id>')
@app.route('/channels/<c_id>/replies/<m_id>')
def index(c_id=None, m_id=None):
    return app.send_static_file('index.html')

@app.errorhandler(404)
def page_not_found(e):
    return app.send_static_file('404.html')


# -------------------------------- API ROUTES ----------------------------------

# user APIs

@app.route('/api/user/login', methods=['POST'])
def login():
    #print("login")
    name = request.json['username']
    password = request.json['password']
    u = query_db('SELECT * FROM users where name = ? and password = ?', [name, password], one=True)
    if u:
        auth_key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))
        query_db('UPDATE users SET auth_key = (?) WHERE name=(?)', [auth_key, name], one=True)
        return jsonify({"auth_key": auth_key}), 200
    else:
        return jsonify({"auth_key": ""}), 500
    
@app.route('/api/user/logout', methods=['POST'])
def logout():
    u = authenticate(request)
    if not u:
        return {}, 500
    query_db('UPDATE users SET auth_key = "" WHERE id=(?)', (u[0],), one=True)
    return jsonify({"auth_key": ""}), 200

@app.route('/api/user/authentication', methods=['GET'])
def authentication():
    u = authenticate(request)
    if not u:
        return jsonify({"status": "failure"}), 500
    return jsonify({"status": "success"}), 200

@app.route('/api/user/signup', methods=['POST'])
def signup():
    #print("signup")
    name = request.json['username']
    password = request.json['password']
    auth_key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))
    u = query_db('INSERT INTO users (name, password, auth_key) ' + 
        'VALUES (?, ?, ?) returning id, name, password, auth_key',
        (name, password, auth_key),
        one=True)
    if u:
        for i in range(1, query_db('SELECT MAX(id) FROM channels', one=True)[0] + 1):
            query_db('INSERT INTO unreads (user_id, channel_id, message_id) values (?, ?, ?)', [u[0], i, 0], one=True)
        return jsonify({"auth_key": u[3]}), 200
    else:
        return jsonify({"auth_key": ""}), 500
    

@app.route('/api/user/change_username', methods=['POST'])
def change_username():
    auth_key = request.headers.get("X-API-KEY")
    user = query_db('UPDATE users SET name=(?) WHERE auth_key = (?)', [request.json["username"], auth_key], one=True)
    if user:
        return jsonify({"status": "success"}), 200
    else:
        return {}, 500

@app.route('/api/user/change_password', methods=['POST'])
def change_password():
    auth_key = request.headers.get("X-API-KEY")
    user = query_db('UPDATE users SET password=(?) WHERE auth_key = (?)', [request.json["password"], auth_key], one=True)
    if user:
        return jsonify({"status": "success"}), 200
    else:
        return {}, 500

@app.route("/api/update/room", methods=["POST"])
def update_room():
    if validate_user_api_key(request):
        query_db(
            "UPDATE rooms SET name = ? WHERE id = ?",
            [request.args.get("name"), request.args.get("room_id")],
        )
        return {}, 200
    return {"Status": "Unauthorized"}, 401

# channel APIs

@app.route('/api/channel/get_all_channels', methods=['GET'])
def get_all_channels():
    u = authenticate(request)
    if not u:
        return {}, 500
    all_channels = query_db('SELECT c.id, c.name, ur.channel_id FROM channels AS c LEFT JOIN (SELECT * FROM unreads WHERE user_id = (?)) AS ur ON ur.channel_id = c.id', (u[0],))
    data = jsonify([{"id": i[0], "name": i[1], "joined": i[2]} for i in all_channels])
    return data, 200

@app.route('/api/channel/create_channel', methods=['POST'])
def create_channel():
    if not authenticate(request):
        return {}, 500
    name = request.json['name']
    c = query_db('INSERT INTO channels (name) values (?) returning id', [name], one=True)
    for i in range(1, query_db('SELECT MAX(id) FROM users', one=True)[0] + 1):
        query_db('INSERT INTO unreads (user_id, channel_id, message_id) values (?, ?, ?)', [i, c[0], 0], one=True)
    
    return jsonify({"id": c[0]}), 200

@app.route('/api/channel/join_channel', methods=['POST'])
def join_channel():
    u = authenticate(request)
    if not u:
        return {}, 500
    channel_id = request.json['channel_id']
    m = query_db('SELECT MAX(id) FROM messages', one=True)
    query_db('INSERT INTO unreads (user_id, channel_id, message_id) values (?, ?, ?)', [u[0], channel_id, m[0]], one=True)
    return jsonify({"status": "success"}), 200

@app.route('/api/channel/get_channel_unreads', methods=['GET'])
def get_channel_unreads():
    u = authenticate(request)
    if not u:
        return {}, 500
    unreads = query_db('''SELECT channels.id, channels.name, COUNT(messages.id) FROM channels
                       LEFT JOIN messages ON channels.id = messages.channel_id
                       LEFT JOIN unreads ON channels.id = unreads.channel_id AND unreads.user_id = (?) 
                       WHERE messages.id > unreads.message_id
                       OR (messages.id IS NULL AND unreads.message_id IS NOT NULL)
                       GROUP BY channels.id''', (u[0],))
    allread = query_db('''SELECT channels.id, channels.name FROM channels
                       LEFT JOIN messages ON channels.id = messages.channel_id
                       LEFT JOIN unreads ON channels.id = unreads.channel_id AND unreads.user_id = (?) 
                       WHERE messages.id = unreads.message_id
                       GROUP BY channels.id''', (u[0],))
    data = [{"id": i[0], "name": i[1], "count": i[2]} for i in unreads or []]
    if len(data) > 0:
        data = sorted(data, key=lambda x: x["id"])
    #print(data)
    return jsonify(data), 200

@app.route('/api/channel/get_channels', methods=['GET'])
def get_channels():
    u = authenticate(request)
    if not u:
        return {}, 500
    allchannels = query_db('''SELECT channels.id, channels.name FROM channels''')
    data = [{"id": i[0], "name": i[1]} for i in allchannels or []]
    if len(data) > 0:
        data = sorted(data, key=lambda x: x["id"])
    return jsonify(data), 200

@app.route('/api/channel/get_channel_name/<int:channel_id>', methods=['GET'])
def get_channel_name(channel_id):
    if not authenticate(request):
        return {}, 500
    res = query_db("SELECT name FROM channels WHERE id = (?)", (channel_id,), one=True)
    return jsonify({"name": res[0]}), 200

# message APIs

@app.route('/api/message/get_message/<int:message_id>', methods=['GET'])
def get_message(message_id):
    u = authenticate(request)
    if not u:
        return {}, 500
    msg = query_db("SELECT m.id, u.name, m.body FROM messages as m \
                   LEFT JOIN users as u ON u.id = m.user_id \
                   WHERE m.id = (?)", (message_id,), one=True)
    return jsonify({"id": msg[0], "author_name": msg[1], "body": msg[2]}), 200
    
@app.route('/api/message/get_messages', methods=['POST'])
def get_messages():
    u = authenticate(request)
    if not u:
        return {}, 500
    channel_id = request.json['channel_id']
    max_msg_id = query_db('SELECT MAX(id) FROM messages WHERE channel_id = (?)', (channel_id,), one=True)
    query_db('UPDATE unreads SET message_id = (?) WHERE user_id = (?) AND channel_id = (?)', (max_msg_id[0], u[0], channel_id), one=True)
    msgs = query_db('''SELECT m1.id, u.name, m1.body, COUNT(m2.id) \
                    FROM messages AS m1 \
                    LEFT JOIN messages AS m2 ON m1.id = m2.replies_to \
                    LEFT JOIN users as u ON u.id = m1.user_id \
                    WHERE m1.channel_id = (?) AND m1.replies_to IS NULL \
                    GROUP BY m1.id''', (channel_id,))
    if msgs:
        return jsonify([{"id": msg[0], "author_name": msg[1], "body": msg[2], "num_replies": msg[3],
                        "reactions": [e[0] for e in query_db("SELECT emoji FROM reactions WHERE message_id = (?) GROUP BY emoji", (msg[0],)) or []]}
                        for msg in msgs]), 200
    else:
        return jsonify([]), 200

@app.route('/api/message/post_message', methods=['POST'])
def post_message():
    u = authenticate(request)
    if not u:
        return {}, 500
    channel_id = request.json['channel_id']
    body = request.json['body']
    query_db('INSERT INTO messages (user_id, channel_id, body) VALUES (?, ?, ?)', (u[0], channel_id, body), one=True)
    return jsonify({"status": "success"}), 200

@app.route('/api/message/get_replies/<int:message_id>', methods=['GET'])
def get_replies(message_id):
    if not authenticate(request):
        return {}, 500
    replies = query_db("SELECT m.id, u.name, m.body FROM messages AS m \
                       LEFT JOIN users as u ON u.id = m.user_id \
                       WHERE m.replies_to = (?)", ((message_id,)))
    data = [{"id": reply[0], "author_name": reply[1], "body": reply[2],
                     "reactions": [e[0] for e in query_db("SELECT emoji FROM reactions WHERE message_id = (?) GROUP BY emoji", (reply[0],)) or []]}
                       for reply in replies or []]
    #print(data)
    return jsonify(data), 200

@app.route('/api/message/post_reply', methods=['POST'])
def post_reply():
    u = authenticate(request)
    if not u:
        return {}, 500
    channel_id = request.json['channel_id']
    body = request.json['body']
    replies_to = request.json['replies_to']
    #print("post reply")
    query_db('INSERT INTO messages (user_id, channel_id, body, replies_to) VALUES (?, ?, ?, ?)', (u[0], channel_id, body, replies_to), one=True)
    return jsonify({"status": "success"}), 200


# reaction APIs

@app.route('/api/reactions/get_reaction_users/<int:message_id>/<emoji>', methods=['GET'])
def get_reaction_users(message_id, emoji):
    if not authenticate(request):
        return {}, 500
    usernames = query_db("SELECT users.name FROM reactions LEFT JOIN users on reactions.user_id = users.id WHERE reactions.message_id = (?) AND reactions.emoji = (?)", (message_id, emoji))
    return jsonify([u[0] for u in usernames] if usernames is not None else []) , 200

@app.route('/api/reactions/add_reaction', methods=['POST'])
def add_reaction():
    u = authenticate(request)
    if not u:
        return {}, 500
    emoji = request.json['emoji']
    message_id = request.json['message_id']
    query_db('INSERT INTO reactions (emoji, message_id, user_id) VALUES (?, ?, ?)', (emoji, message_id, u[0]), one=True)
    print("here")
    return jsonify({"status": "success"}), 200
