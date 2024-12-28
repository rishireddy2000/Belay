create table reactions (
  id INTEGER PRIMARY KEY,
  emoji VARCHAR(100),
  message_id INTEGER,
  user_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(message_id) REFERENCES messages(id)
);

create table users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(40) UNIQUE,
  password VARCHAR(40),
  auth_key VARCHAR(40)
);

create table unreads (
  user_id INTEGER,
  channel_id INTEGER,
  message_id INTEGER,
  PRIMARY KEY(channel_id, user_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(channel_id) REFERENCES channels(id),
  FOREIGN KEY(message_id) REFERENCES messages(id)
);

create table messages (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  channel_id INTEGER,
  body TEXT,
  replies_to INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(channel_id) REFERENCES channels(id)
);

create table channels (
  id INTEGER PRIMARY KEY,
  name VARCHAR(40) UNIQUE
);