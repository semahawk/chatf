HOST = null; // localhost
PORT = 3000;

// when the deamon started
var starttime = (new Date()).getTime();

var mem = process.memoryUsage();
// every 10 seconds poll for the memory
setInterval(function(){
  mem = process.memoryUsage();
}, 10 * 1000);

var fu  = require("./fu"),
    sys = require("util"),
    url = require("url"),
    qs  = require("querystring");

var MESSAGE_BACKLOG = 200,
    SESSION_TIMEOUT = 60 * 1000;

var channel = new function(){
  var messages  = [],
      callbacks = [];

  this.appendMessage = function(nick, color, type, text){
    var m = { nick: nick,
              color: color,
              type: type, // "msg", "join", "part"
              text: text,
              timestamp: (new Date()).getTime() };

    switch (type){
      case "msg":
        //sys.puts("<" + nick + "> " + text);
        break;
      case "join":
        //sys.puts(nick + " join");
        break;
      case "part":
        //sys.puts(nick + " part");
        break;
    }

    messages.push(m);

    while (callbacks.length > 0){
      callbacks.shift().callback([m]);
    }

    while (messages.length > MESSAGE_BACKLOG)
      messages.shift();
  };

  this.query = function(since, callback){
    var matching = [];
    for (var i = 0; i < messages.length; i++){
      var message = messages[i];
      if (message.timestamp > since)
        matching.push(message);
    }

    if (matching.length != 0){
      callback(matching);
    } else {
      callbacks.push({ timestamp: new Date(), callback: callback });
    }
  };

  // clear old callbacks
  // they can hang around for at most 30 sec.
  setInterval(function(){
    var now = new Date();
    while (callbacks.length > 0 && now - callbacks[0].timestamp > 30 * 1000){
      callbacks.shift().callback([]);
    }
  }, 3000);
};

var sessions = {};

function createSession (nick, color){
  if (nick.length > 50) return null;
  if (/[^\w_\-^!]/.exec(nick)) return null;
  if (!color.match(/^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)) return null;
  if (color.slice(0,1) != "#")
    color = "#" + color;

  for (var i in sessions){
    var session = sessions[i];
    if (session && session.nick === nick) return null;
  }

  var session = {
    nick: nick,
    color: color,
    id: Math.floor(Math.random() * 9999999999).toString(),
    timestamp: new Date(),

    poke: function(){
      session.timestamp = new Date();
    },

    destroy: function(){
      channel.appendMessage(session.nick, session.color, "part");
      delete sessions[session.id];
    },
  };

  sessions[session.id] = session;
  return session;
}

// interval to kill off elder sessions
setInterval(function(){
  var now = new Date();
  for (var id in sessions){
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];

    if (now - session.timestamp > SESSION_TIMEOUT){
      session.destroy();
    }
  }
}, 1000);

fu.listen(Number(process.env.PORT || PORT), HOST);

fu.get("/", fu.staticHandler("index.html"));
fu.get("/style.css", fu.staticHandler("style.css"));
fu.get("/client.js", fu.staticHandler("client.js"));
fu.get("/jquery.js", fu.staticHandler("jquery.js"));

fu.get("/who", function(req, res){
  var nicks = [];
  for (var id in sessions){
    if (!sessions.hasOwnProperty(id)) continue;
    var session = sessions[id];
    nicks.push(session.nick);
  }

  res.simpleJSON(200, { nicks: nicks
                      , rss: mem.rss });
});

fu.get("/help", function(req, res){
  var nicks = [];
  for (var id in sessions){
    if (!sessions.hasOwnProperty(id)) continue;
    var sessien = sessions[id];
    nicks.push(session.nick);
  }

  res.simpleJSON(200, { text: "help"
                      , rss: mem.rss });
});

fu.get("/join", function(req, res){
  var nick = qs.parse(url.parse(req.url).query).nick;
  var color = qs.parse(url.parse(req.url).query).color;
  if (nick == null || nick.length == 0){
    res.simpleJSON(400, { error: "Baad name, matey!"});
    return;
  }

  var session = createSession(nick, color);
  if (session == null){
    res.simpleJSON(400, { error: "Name in use." });
    return;
  }

  channel.appendMessage(session.nick, session.color, "join");
  res.simpleJSON(200, { id: session.id,
                        color: session.color,
                        nick: session.nick,
                        rss: mem.rss,
                        starttime: starttime });
});

fu.get("/part", function(req, res){
  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]){
    session = sessions[id];
    session.destroy();
  }

  res.simpleJSON(200, { rss: mem.rss });
});

fu.get("/recv", function(req, res){
  if (!qs.parse(url.parse(req.url).query).since){
    res.simpleJSON(400, { error: "Must suplly since paramether!" });
    return;
  }

  var id = qs.parse(url.parse(req.url).query).id;
  var session;
  if (id && sessions[id]){
    session = sessions[id];
    session.poke();
  }

  var since = parseInt(qs.parse(url.parse(req.url).query).since, 10);

  channel.query(since, function(messages){
    if (session) session.poke();
    res.simpleJSON(200, { messages: messages, rss: mem.rss });
  });
});

fu.get("/send", function(req, res){
  var id = qs.parse(url.parse(req.url).query).id;
  var text = qs.parse(url.parse(req.url).query).text;

  var session = sessions[id];
  if (!session || !text){
    res.simpleJSON(400, { error: "Thar be no such id, me heartie!" });
    return;
  }

  session.poke();

///////////////////////////////////////////////////////////////////////////////
// COMMANDS
///////////////////////////////////////////////////////////////////////////////

  // we check if user has written some command, like '/me walks into a bar.'
  var m;
  // check if it's some sort of a command
  if (m = text.match(/^\/([\w]+)(\s)?(.*)$/)){
    switch (m[1]){
      case "me":
        if (m[2] == null) break;
        if (m[3] == "") break;

        text = text.slice(4);
        channel.appendMessage(session.nick, session.color, "me", text);
        break;
      case "help":
        text = "";
        channel.appendMessage(session.nick, session.color, "help", text);
        break;
    }
  // it just a ordinary message
  } else {
    channel.appendMessage(session.nick, session.color, "msg", text);
  }

  res.simpleJSON(200, { rss: mem.rss });
});
