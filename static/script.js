const UNAUTHPAGE = document.querySelector(".unauth");
const AUTHPAGE = document.querySelector(".auth");
const WORKSPACE = document.querySelector(".workspace");
const PROFILE = document.querySelector(".profile");

let CURRENT_CHANNEL = -1;
let LOGIN_STATE = false;
let MAX_MESSAGE_ID = 0;
let MAX_REPLY_ID = 0;
let CURRENT_MESSAGE = -1;

function router(path) {

  UNAUTHPAGE.classList.add("hide");
  AUTHPAGE.classList.add("hide");
  WORKSPACE.classList.add("hide");
  PROFILE.classList.add("hide");
  closeChannel();
  closeThread();

  document.querySelector(".channelsbox").classList.add("narrowhide");
  document.querySelector(".messagesbox").classList.add("narrowhide");
  document.querySelector(".threadbox").classList.add("narrowhide");

  if (localStorage.getItem("rishi_belay_auth_key") != null) {
    LOGIN_STATE = true;
  }

  if (LOGIN_STATE) {
    AUTHPAGE.classList.remove("hide");
    UNAUTHPAGE.classList.add("hide");
  } 
  else {
    AUTHPAGE.classList.add("hide");
    UNAUTHPAGE.classList.remove("hide");
    showSignupLogin();
  }

  if (path == null) {
    path = window.location.pathname;
  }
  window.history.pushState(null, null, path);

  CURRENT_CHANNEL = -1;
  MAX_MESSAGE_ID = 0;
  MAX_REPLY_ID = 0;
  CURRENT_MESSAGE = -1;
  if (LOGIN_STATE) {
    if (path == "/") {
      WORKSPACE.classList.remove("hide");
      document.querySelector(".channelsbox").classList.remove("narrowhide");
    } 
    else if (path == "/profile") {
      PROFILE.classList.remove("hide");
    }
    else if (path.startsWith("/channels/")) {
      WORKSPACE.classList.remove("hide");
      let parts = path.split("/");
      CURRENT_CHANNEL = parseInt(parts[2])
      document.querySelector(".messagesbox").classList.remove("narrowhide");
      document.querySelector(".messagesbox").classList.add("extra_wide");
      openChannel(CURRENT_CHANNEL);
      if (parts.length > 4 && parts[3] == "replies") {
        CURRENT_MESSAGE = parseInt(parts[4]);
        document.querySelector(".messagesbox").classList.add("narrowhide");
        document.querySelector(".threadbox").classList.remove("narrowhide");
        openThread(CURRENT_MESSAGE);
      }
    }
    else {
      window.location.replace("/404");
    }
  }
}

window.addEventListener("DOMContentLoaded", router());
window.addEventListener("popstate", () => router());

setInterval(() => {
  if (CURRENT_CHANNEL == -1) {
    return;
  }
  getMessages(CURRENT_CHANNEL);
}, 500);

setInterval(() => {
  if (CURRENT_MESSAGE == -1) {
    return;
  }
  getReplies(CURRENT_MESSAGE);
}, 500);

setInterval(() => {
  if (LOGIN_STATE == false) {
    return;
  }
  getChannels();
}, 500);


function gohome() {
  router("/");
}

function gotologin() {
  document.querySelector(".gotologin").classList.add("hide");
  document.querySelector(".gotosignup").classList.add("hide");
  document.querySelector(".loginForm").classList.remove("hide");
}

function gotosignup() {
  document.querySelector(".gotologin").classList.add("hide");
  document.querySelector(".gotosignup").classList.add("hide");
  document.querySelector(".signupForm").classList.remove("hide");
}

function showSignupLogin() {
  document.querySelector(".gotologin").classList.remove("hide");
  document.querySelector(".gotosignup").classList.remove("hide");
  document.querySelector(".signupForm").classList.add("hide");
  document.querySelector(".loginForm").classList.add("hide");
}

function openChannel(channel_id) {
  fetch("/api/channel/get_channel_name/" + channel_id, {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
  })
  .then(response => response.json())
  .then(responseBody => {
    let channelTitle = document.querySelector(".channelTitle");
    channelTitle.replaceChildren();
    channelTitle.appendChild(document.createTextNode(responseBody.name));
    document.querySelector(".inChannelView").classList.remove("hide");
    document.querySelector(".outChannelView").classList.add("hide");
    document.querySelector(".postMessage > button").setAttribute("onclick", "postMessage(" + channel_id + ")");
    document.querySelector(".postReply > button").setAttribute("onclick", "postReplies(" + channel_id + ")");
    document.querySelector(".messagesList").replaceChildren();
  });
}

function closeChannel() {
  document.querySelector(".inChannelView").classList.add("hide");
  document.querySelector(".outChannelView").classList.remove("hide");
  document.querySelector(".messagesList").replaceChildren();
  CURRENT_CHANNEL = -1;
  MAX_MESSAGE_ID = 0;
  MAX_REPLY_ID = 0;
}

function openThread(message_id) {
  document.querySelector(".threadbox").classList.remove("hide");
  MAX_REPLY_ID = 0;
  document.querySelector("input#replies_to").setAttribute("value", message_id);
  getReplies(message_id);
  CURRENT_MESSAGE = message_id;
  document.querySelector(".threadTitle > button.narrowhide").setAttribute("onclick",  "router('/channels/" + CURRENT_CHANNEL + "')");
  document.querySelector(".threadTitle > button.widehide").setAttribute("onclick",  "router('/channels/" + CURRENT_CHANNEL + "')");
  
}

function closeThread() {
  document.querySelector(".threadbox").classList.add("hide");
  MAX_REPLY_ID = 0;
  CURRENT_MESSAGE = -1;
}

function signup() {
  fetch("/api/user/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({username: document.querySelector("input#signupUsername").value, password: document.querySelector("input#signupPassword").value})
  })
  .then(response => response.json())
  .then(responseBody => {
    if (responseBody.auth_key == "") {
    }
    else {
      localStorage.setItem("rishi_belay_auth_key", responseBody.auth_key);
      document.cookie = "rishi_belay_auth_key=" + responseBody.auth_key;
      LOGIN_STATE = true;
      gohome();
    }
  });
}

function login() {
  fetch("/api/user/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({username: document.querySelector("input#loginUsername").value, password: document.querySelector("input#loginPassword").value})
  })
  .then(response => response.json())
  .then(responseBody => {
    if (responseBody.auth_key == "") {
      alert("bad credentials");
    }
    else {
      localStorage.setItem("rishi_belay_auth_key", responseBody.auth_key);
      document.cookie = "rishi_belay_auth_key=" + responseBody.auth_key;
      LOGIN_STATE = true;
      gohome();
    }
  });
}

function logout() {
  fetch("/api/user/logout", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
  })
  .then(response => response.json())
  .then(responseBody => {
    localStorage.removeItem("rishi_belay_auth_key");
    document.cookie = document.cookie + ";max-age=0";
    LOGIN_STATE = false;
    gohome();
  });
}

function authenticate() {
  fetch("/api/user/authentication", {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
  })
  .then(response => response.json())
  .then(responseBody => {
    if (responseBody.status == "success") {
      LOGIN_STATE = true;
    } else {
      LOGIN_STATE = false;
    }
  });
}

function changeUsername() {
  fetch("/api/user/change_username", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({username: document.querySelector("input#changeUsername").value})
  });
}

function changePassword() {
  fetch("/api/user/change_password", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({password: document.querySelector("input#changePassword").value})
  });
}

function openCreateChannel() {
  document.querySelector(".createChannelButton").classList.add("hide");
  document.querySelector(".channelCreateForm").classList.remove("hide");
}

function closeCreateChannel() {
  document.querySelector(".createChannelButton").classList.remove("hide");
  document.querySelector(".channelCreateForm").classList.add("hide");
}

function createChannel() {
  fetch("/api/channel/create_channel", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({name: document.querySelector("input#createChannelName").value})
  })
  .then(response => response.json())
  .then(responseBody => {
    joinChannel(responseBody.id);
  });
  closeCreateChannel();
}

function getChannels() {
  fetch("/api/channel/get_all_channels", {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(channels => {
    let channelsList = document.querySelector(".channelsList > ol");
    channelsList.replaceChildren();
    channels.map(chan => {
      let li = document.createElement("li");
      let p = document.createElement("p");
      if (chan.id == CURRENT_CHANNEL) {
        p.setAttribute("class", "channelName curChan");
      }
      else {
        p.setAttribute("class", "channelName");
      }
      p.classList.add("channel__"+chan.id)
      p.setAttribute("onclick", "router('/channels/" + chan.id + "')");
      p.appendChild(document.createTextNode(chan.name));
      li.appendChild(p);
      channelsList.appendChild(li);
    })
  });

  fetch("/api/channel/get_channel_unreads", {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(channels => {
    channels.map(chan => {
      let  var_chan = document.querySelector(".channel__"+chan.id)
      console.log()
      if (chan.count != 0) {
        var_chan.innerHTML += ("  ("+chan.count + " unread)");
        console.log(var_chan.innerHTML)
      }
    })
  });


}

function getChannelUnreads() {
  fetch("/api/channel/get_channel_unreads", {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(channels => {
    let channelsList = document.querySelector(".channelsList > ol");
    channelsList.replaceChildren();
    channels.map(chan => {
      let li = document.createElement("li");
      let p = document.createElement("p");
      if (chan.id == CURRENT_CHANNEL) {
        p.setAttribute("class", "channelName curChan");
      }
      else {
        p.setAttribute("class", "channelName");
      }
      p.setAttribute("onclick", "router('/channels/" + chan.id + "')");
      p.appendChild(document.createTextNode(chan.name));
      li.appendChild(p);
      if (chan.count != 0) {
        li.appendChild(document.createTextNode(" (" + chan.count + " unread)"));
      }
      channelsList.appendChild(li);
    })
  });
}


function getMessages(channel_id) {
  fetch("/api/message/get_messages", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({channel_id: channel_id})
  })
  .then(response => response.json())
  .then(messages => {
    let messagesList = document.querySelector(".messagesList");
    if (messages.length == 0) {
      messagesList.replaceChildren();
      let p = document.createElement("p");
      p.appendChild(document.createTextNode("No message in the channel."))
      p.setAttribute("class", "nomessage center");
      p.setAttribute("style", "margin-top: 40vh; color: #36C5F0");
      messagesList.appendChild(p);
    }
    else {
      let nomsg = document.querySelector(".nomessage");
      if (nomsg != null) {
        nomsg.classList.add("hide");
      }
      messages.map(m => {
        if (m.id > MAX_MESSAGE_ID) {
          MAX_MESSAGE_ID = m.id;
          let messageEntry = document.createElement("div");
          messageEntry.setAttribute("id", m.id);
          messageEntry.setAttribute("class", "messageEntry"+m.id);
          let pname = document.createElement("p");
          pname.appendChild(document.createTextNode(m.author_name));
          let pbody = document.createElement("p");
          pbody.appendChild(document.createTextNode(m.body));
          let message_span = document.createElement("div")
          pbody.setAttribute("style", "display: inline-block; padding-left: 10px; margin:5px")
          pname.setAttribute("style", "display: inline-block; font-weight: bold;  color: #36C5F0; margin:5px")
          message_span.setAttribute("style", "display: inline-block;  ")
          message_span.appendChild(pname);
          message_span.appendChild(pbody);
          messageEntry.appendChild(message_span);
          let imageUrlRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif))/gi;
          let imageUrls = m.body.match(imageUrlRegex);
          if (imageUrls) {
              imageUrls.map(url => {
                  let img = document.createElement("img");
                  img.setAttribute("src", url);
                  messageEntry.append(img);
              });
          }
          if (m.num_replies != 0) {
            let pnum = document.createElement("p");
            pnum.setAttribute("style", "font-weight: lighter;");
            let a = document.createElement("a");
            a.setAttribute("href", "#");
            a.setAttribute("onclick", "router('/channels/"+ channel_id +"/replies/"+ m.id +"')");
            a.appendChild(document.createTextNode("View " + m.num_replies + " replies"));
            pnum.appendChild(a);
            messageEntry.appendChild(pnum);
          }
          let replybutton = document.createElement("button");
          replybutton.setAttribute("class", "replyButton right");
          replybutton.setAttribute("onclick", "router('/channels/"+ channel_id +"/replies/"+ m.id +"')");
          replybutton.appendChild(document.createTextNode("Reply"));
          messageEntry.appendChild(replybutton);
          messagesList.appendChild(messageEntry);
          let emojibuttons = document.createElement("div");
          emojibuttons.classList.add("addedReactions" + m.id)
          let emojis = ["👍","✅","🙌","😀","👀"];
          emojis.map(e => {
            let eobj = document.createElement("button");
            eobj.setAttribute("class", "emoji");
            eobj.setAttribute("class", "emojiButton"+ m.id + e);
            eobj.setAttribute("onclick", "addReactionEmoji(" + m.id + ", '" + e + "')");
            eobj.appendChild(document.createTextNode(" " + e + " "));
            eobj.setAttribute("onmouseover", "getReactionUsers(" + m.id + ", '" + e + "')");
            eobj.setAttribute("onmouseleave", "hideReactionUsers(" + m.id + ", '" + e + "')");
            emojibuttons.appendChild(eobj);
          })
          messageEntry.appendChild(emojibuttons);
          let brdiv = document.createElement("div");
          brdiv.setAttribute("class", "brdiv"+m.id);
          if (m.reactions.length == 0) {
            brdiv.appendChild(document.createElement("br"));
            brdiv.appendChild(document.createElement("br"));
            messageEntry.appendChild(brdiv);
          }
          messagesList.appendChild(document.createElement("hr"));
        }
        else {
          let addedReactions = document.querySelector(".addedReactions" + m.id);
          if (addedReactions) {
            addedReactions.replaceChildren();
            let emojibuttons = document.createElement("div");
            let emojis = ["👍","🙌","😀","👀", "✅"];
            emojis.map(e => {
              let eobj = document.createElement("button");
              eobj.setAttribute("class", "emoji");
              eobj.setAttribute("class", "emojiButton"+ m.id + e);
              eobj.setAttribute("onclick", "addReactionEmoji(" + m.id + ", '" + e + "')");
              eobj.appendChild(document.createTextNode(" " + e + " "));
              eobj.setAttribute("onmouseover", "getReactionUsers(" + m.id + ", '" + e + "')");
              eobj.setAttribute("onmouseleave", "hideReactionUsers(" + m.id + ", '" + e + "')");
              emojibuttons.appendChild(eobj);
            })
            addedReactions.appendChild(emojibuttons)
          }
          if (m.reactions.length != 0) {
            let brdiv = document.querySelector(".brdiv"+m.id);
            if (brdiv != null) {
              brdiv.replaceChildren();
            }
          }
        }
      })
    }
    
  });
}


function postMessage(channel_id) {
  fetch("/api/message/post_message", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({channel_id: channel_id, body: document.querySelector("textarea#postMessage").value})
  })
  .then(response => response.json())
  .then(responseBody => {
  });
}

function getReplies(message_id) {
  fetch("/api/message/get_message/" + message_id, {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(m => {
    let repliedMessageEntry = document.querySelector(".repliedMessageEntry");
    repliedMessageEntry.replaceChildren();
    let pname = document.createElement("p");
    pname.setAttribute("style", "font-weight: bold;");
    pname.appendChild(document.createTextNode(m.author_name));
    let pbody = document.createElement("p");
    pbody.appendChild(document.createTextNode(m.body));
    let message_span = document.createElement("div")
    pbody.setAttribute("style", "display: inline-block; padding-left: 10px; margin:5px")
    pname.setAttribute("style", "display: inline-block; font-weight: bold;  color: #36C5F0; margin:5px")
    message_span.setAttribute("style", "display: inline-block;  ")
    message_span.appendChild(pname);
    message_span.appendChild(pbody);
    repliedMessageEntry.appendChild(message_span);
  });

  fetch("/api/message/get_replies/" + message_id, {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(replies => {
    let repliesList = document.querySelector(".repliesList");
    if (replies.length == 0) {
      repliesList.replaceChildren();
      let p = document.createElement("p");
      p.appendChild(document.createTextNode("No reply to the message."))
      p.setAttribute("class", "noreply center");
      p.setAttribute("style", "margin-top: 20vh;");
      repliesList.appendChild(p);
    }
    else {
      let noreply = document.querySelector(".noreply");
      if (noreply != null) {
        noreply.classList.add("hide");
      }
      replies.map(m => {
        if (m.id > MAX_REPLY_ID) {

          MAX_REPLY_ID = m.id;
          let replyEntry = document.createElement("div");
          replyEntry.setAttribute("id", m.id);
          replyEntry.setAttribute("class", "replyEntry"+m.id);
          let pname = document.createElement("p");
          pname.appendChild(document.createTextNode(m.author_name));
          let pbody = document.createElement("p");
          pbody.appendChild(document.createTextNode(m.body));

          let message_span = document.createElement("div")
          pbody.setAttribute("style", "display: inline-block; padding-left: 10px; margin:5px")
          pname.setAttribute("style", "display: inline-block; font-weight: bold;  color: #36C5F0; margin:5px")
          message_span.setAttribute("style", "display: inline-block;  ")
          message_span.appendChild(pname);
          message_span.appendChild(pbody);
          replyEntry.appendChild(message_span);

          let emojibuttons = document.createElement("div");
          emojibuttons.classList.add("addedReactions" + m.id)
            let emojis = ["👍","🙌","😀","👀", "✅"];
            emojis.map(e => {
              let eobj = document.createElement("button");
              eobj.setAttribute("class", "emoji");
              eobj.setAttribute("class", "emojiButton"+ m.id + e);
              eobj.setAttribute("onclick", "addReactionEmoji(" + m.id + ", '" + e + "')");
              eobj.appendChild(document.createTextNode(" " + e + " "));
              eobj.setAttribute("onmouseover", "getReactionUsers(" + m.id + ", '" + e + "')");
              eobj.setAttribute("onmouseleave", "hideReactionUsers(" + m.id + ", '" + e + "')");
              emojibuttons.appendChild(eobj);
            })
            replyEntry.appendChild(emojibuttons);
            repliesList.appendChild(replyEntry)
          let brdiv = document.createElement("div");
          repliesList.appendChild(document.createElement("hr"));
        }
        else {
          document.querySelector(".addedReactions" + m.id).replaceChildren();
          let emojibuttons = document.createElement("div");
          let emojis = ["👍","🙌","😀","👀", "✅"];
            emojis.map(e => {
              let eobj = document.createElement("button");
              eobj.setAttribute("class", "emoji");
              eobj.setAttribute("class", "emojiButton"+ m.id + e);
              eobj.setAttribute("onclick", "addReactionEmoji(" + m.id + ", '" + e + "')");
              eobj.appendChild(document.createTextNode(" " + e + " "));
              eobj.setAttribute("onmouseover", "getReactionUsers(" + m.id + ", '" + e + "')");
              eobj.setAttribute("onmouseover", "getReactionUsers(" + m.id + ", '" + e + "')");
              eobj.setAttribute("onmouseleave", "hideReactionUsers(" + m.id + ", '" + e + "')");
              emojibuttons.appendChild(eobj);
            })
            document.querySelector(".addedReactions" + m.id).appendChild(emojibuttons);


          if (m.reactions.length != 0) {
            let brdiv = document.querySelector(".brdiv"+m.id);
            if (brdiv != null) {
              brdiv.replaceChildren();
            }
          }
        }
      })
    }
  });
}


function postReplies(channel_id) {
  fetch("/api/message/post_reply", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({channel_id: channel_id, 
                          body: document.querySelector("textarea#postReplies").value, 
                          replies_to: document.querySelector("input#replies_to").value})
  })
  .then(response => response.json())
  .then(responseBody => {
  });
}


function getReactionUsers(message_id, emoji) {
  fetch("/api/reactions/get_reaction_users/" + message_id + "/" + emoji, {
    method: "GET",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    }
  })
  .then(response => response.json())
  .then(usernames => {
    let button = document.querySelector(".emojiButton" + message_id + emoji);

    button.replaceChildren();
    let text = "From: ";
    usernames.map(name => {
      text = text + name + ", "
    })
    text = usernames.length;
    button.innerHTML += emoji + text;
    return usernames.length?usernames.length:0 ;
  });
  }

function hideReactionUsers(message_id, emoji) {
  let button = document.querySelector(".emojiButton" + message_id + emoji);
  button.replaceChildren();
  button.appendChild(document.createTextNode(emoji));
}

function showAddReactions(message_id) {
  let button = document.querySelector(".addReactionButton" + message_id);
    button.replaceChildren();
    let emojis = ["👍","🙌","😀","👀", "✅"];
  emojis.map(e => {
    let eobj = document.createElement("b");
    eobj.setAttribute("class", "emoji");
    eobj.setAttribute("onclick", "addReactionEmoji(" + message_id + ", '" + e + "')");
    if (e == "👀") {
      eobj.appendChild(document.createTextNode(" " + e + " "));
    }
    else {
      eobj.appendChild(document.createTextNode(" " + e + " |"));
    }

    button.appendChild(eobj);
  })
}

function addReaction(message_id, emoji) {
  fetch("/api/reactions/add_reaction", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({emoji: emoji, message_id: message_id})
  })
  .then(response => response.json())
  .then(responseBody => {
    let button = document.querySelector(".addReactionButton" + message_id);
    button.appendChild(document.createTextNode(" Added: " + emoji + "+1"));
  });
}


function addReactionEmoji(message_id, emoji) {
  fetch("/api/reactions/add_reaction", {
    method: "POST",
    headers: {
      "X-API-KEY": localStorage.getItem("rishi_belay_auth_key"),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({emoji: emoji, message_id: message_id})
  })
}
