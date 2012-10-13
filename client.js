// DA VERSION
var VERSION = "1.1.0";

var CONFIG = { debug: false,
               nick: "#",            // set in onConnect
               id: null,             // same here
               color: "#ffffff",
               last_message_time: 1,
               focus: true,          // event listeners bound in onConnect
               unread: 0             // updated in the message-proccesing loop
};

var history = {
  position: 0,
  stack: [],
  
  getPrev: function(){
    if (this.position < this.stack.length)
      this.position++;

    return this.stack[this.stack.length - this.position];
  },

  getNext: function(){
    if (this.position >= 2)
      this.position--;
    else {
      this.position = 0;
      return "";
    }

    return this.stack[this.stack.length - this.position];
  }
};

var nicks = [];
var colors = [];

Date.prototype.toRelativeTime = function(now){
  var delta = new Date() - this;

  now = parseInt(now, 10);

  if (isNaN(now)){
    now = 0;
  }

  if (delta <= now){
    return 'just now';
  }

  var units = null;
  var conversions = {
    millisecond: 1, // ms    -> ms
    second: 1000,   // ms    -> sec
    minute: 60,     // sec   -> min
    hour: 60,       // min   -> hour
    day: 24,        // hour  -> day
    month: 30,      // day   -> month (roughly)
    year: 12        // month -> year
  };

  for (var key in conversions){
    if (delta < conversions[key]){
      break;
    } else {
      units = key; // keep track of the selected key over the iteration
      delta = delta / conversions[key];
    }
  }

  // plularize a unit
  delta = Math.floor(delta);
  if (delta !== 1){ units += "s"; }
  return [delta, units].join(" ");
};

Date.fromString = function(str){
  return new Date(Date.parse(str));
};

// updates the users link to reflect the number of active users
function updateUsersLink(){
  var t = nicks.length.toString() + " haxor";
  if (nicks.length != 1) t += "ów";
  $("#usersLink").text(t);
}

// handles another person joining the chat
function userJoin(nick, timestamp){
  // put it in the stream
  addMessage(nick, "#555555", "joined", timestamp);
  // if we already know him, we ignore him
  for (var i = 0; i < nicks.lenght; i++)
    if (nicks[i] == nick) return;
  // otherwise, add him to the list
  nicks.push(nick);
  // update the UI
  updateUsersLink();
}

// handles someone leaving
function userPart(nick, timestamp){
  // put it in the stream
  addMessage(nick, "#555555", "left", timestamp);
  // remove him from the list
  for (var i = 0; i < nicks.length; i++){
    if (nicks[i] == nick){
      nicks.splice(i, 1);
      break;
    }
  }

  updateUsersLink();
}

// utility functions
util = {
  urlRE: /https?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g,

  // html sanitizer
  toStaticHTML: function(inputHtml) {
    inputHtml = inputHtml.toString();
    return inputHtml.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
  },

  //pads n with zeros on the left,
  //digits is minimum length of output
  //zeroPad(3, 5); returns "005"
  //zeroPad(2, 500); returns "500"
  zeroPad: function (digits, n) {
    n = n.toString();
    while (n.length < digits)
      n = '0' + n;
    return n;
  },

  //it is almost 8 o'clock PM here
  //timeString(new Date); returns "19:49"
  timeString: function (date) {
    var seconds = date.getSeconds().toString();
    var minutes = date.getMinutes().toString();
    var hours = date.getHours().toString();
    return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes) + ":" + this.zeroPad(2, seconds);
  },

  //does the argument only contain whitespace?
  isBlank: function(text) {
    var blank = /^\s*$/;
    return (text.match(blank) !== null);
  }

};

function setColor(nick, color){
  for (var i in nicks){
    if (nicks[i] == nick) colors[i] = color;
  }
}

function getColor(nick){
  for (var i in nicks){
    if (nicks[i] == nick) return colors[i];
  }
}

// sets a cookie called `key` with a value of `value` which expires in `expire` expressed in milliseconds.
//
// setCookie('ahoy', 'sea', 10 * 1000); creates a cookie called 'ahoy' with value 'sea' for ten seconds.
function setCookie(key, value, expire){
  var expires = new Date();
  expires.setTime(expires.getTime() + expire);
  document.cookie = key + "=" + value + ";expires=" + expires.toUTCString() + ';path="/"';
}

// getCookie('ahoy'); returns 'sea'
function getCookie(key){
  var keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
  return keyValue ? keyValue[2] : null;
}

// used to keep the most recent messages visible
function scrollDown(){
  window.scrollBy(0, 1000000000);
  $("entry").focus();
}

// inserts an event into the stream for display
// the event may be a msg, join or part type
// from is the user, text is the body and time is the timestamp, defaulting
// to now. _class is a css class to apply to the message, usefull for system
// events.
function addMessage(from, color, text, time, type = "normal"){
  if (text === null) return;

  if (time == null){
   time = new Date();
  } else if ((time instanceof Date) === false){
    time = new Date(time);
  }

  // every message you see is actually a table with 3 cols.
  //    the time
  //    the person who caused the event
  //    the content
  var messageElement = $(document.createElement("table"));

  // sanitize
  text = util.toStaticHTML(text);

  // replace URLs with links
  text = text.replace(util.urlRE, '<a target="_blank" href="$&">$&</a>');

  messageElement.addClass("message");

  // default look of msg-text td.
  var msg_text = '  <td class="msg-text">' + text + '</td>';
  // see of what type the message is
  switch (type){
    case "me":
      // if user /me something, it msg-text has to look a bit different
      msg_text = '  <td class="msg-text" style="font-style: italic; font-family: serif;">' + text + '</td>';
      // we also have to modify the name a bit
      nick_color += "font-style: italic;";
      break;

    case "help":
      // show him the help
      msg_text = '  <td class="msg-text" style="color: #777">dostępne komendy:<br/>&nbsp;&nbsp;/me TEKST' +
                                                                             '<br/>&nbsp;&nbsp;/help' +
                                                                             '</td>';
      // change the name to "help"
      //from = "help";
      // also change it's color
      color = "#999";
  }

  // whether it's a colored user (null - it is not)
  var nick_color = null;

  // set nicks color
  nick_color = ' style="color: ' + color + ';';

  // close the style attribute in name
  nick_color += "\"";

  // parenthesis color
  var paren_color = "#32363B";

  // new Regular Expression object
  var re = new RegExp(CONFIG.nick, "i");
  // check if the messages text matches this primitive regexp
  if (text.match(re)){
    paren_color = "#B5B5B5";
  }

  var content = '<tr>'
              + '  <td class="date">' + util.timeString(time) + '</td>';
  if (type == "me")
     content +=
                '  <td class="nick"' + nick_color + '>&nbsp;' + util.toStaticHTML(from) + '</td>';
  else
     content +=
                '  <td class="nick"' + nick_color + '><span style="color: ' + paren_color + '";>&#91;</span>' + util.toStaticHTML(from) + '<span style="color: ' + paren_color + '">&#93;</span></td>';
     content +=
                msg_text
              + '</tr>';

  messageElement.html(content);

  // the log is the stream that we view
  if (type == "help"){
    if (from == CONFIG.nick){
      $("#log").append(messageElement);
    }
  } else {
    $("#log").append(messageElement);
  }

  // always view the most recent message when it's added
  scrollDown();
}

function updateRSS(){
  var bytes = parseInt(rss);
  if (bytes){
    var megabytes = bytes / (1024 * 1024);
    megabytes = Math.round(megabytes * 10) / 10;
    $("#rss").text(megabytes.toString());
  }
}

function updateUptime(){
  if (starttime){
    $("#uptime").text(starttime.toRelativeTime());
  }
}

var first_poll = true;

function longPoll(data){
  if (data && data.rss) {
    rss = data.rss;
    updateRSS();
  }

  //process any updates we may have
  //data will be null on the first call of longPoll
  if (data && data.messages) {
    for (var i = 0; i < data.messages.length; i++) {
      var message = data.messages[i];

      //track oldest message so we only request newer messages from server
      if (message.timestamp > CONFIG.last_message_time)
        CONFIG.last_message_time = message.timestamp;

      //dispatch new messages to their appropriate handlers
      switch (message.type) {
        case "msg":
          if(!CONFIG.focus){
            CONFIG.unread++;
          }
          addMessage(message.nick, message.color, message.text, message.timestamp);
          break;

        case "me":
          addMessage(message.nick, message.color, message.text, message.timestamp, "me");
          break;

        case "help":
          addMessage(message.nick, message.color, message.text, message.timestamp, "help");
          break;

        case "join":
          userJoin(message.nick, message.timestamp);
          break;

        case "part":
          userPart(message.nick, message.timestamp);
          break;
      }
    }
    //update the document title to include unread message count if blurred
    updateTitle();

    //only after the first request for messages do we want to show who is here
    if (first_poll) {
      first_poll = false;
      who();
    }
  }


  //make another request
  $.ajax({ cache: false
         , type: "GET"
         , url: "/recv"
         , dataType: "json"
         , data: { since: CONFIG.last_message_time, id: CONFIG.id }
         , error: function () {
             if (CONFIG.debug) $("#userName").html("!" + CONFIG.nick);
             // Wait 1 sec before retrying. We're gonna output info after every ten secends however. Yay!
             setTimeout(longPoll, 1000);
           }
         , success: function (data) {
             //if everything went well, begin another request immediately
             //the server will take a long time to respond
             //how long? well, it will wait until there is another message
             //and then it will return it to us and close the connection.
             //since the connection is closed when we get data, we longPoll again
             longPoll(data);
           }
         });
  if (CONFIG.debug) $("#userName").html("&nbsp;" + CONFIG.nick);
}

// submit a new message to the server
function send(msg){
  if (CONFIG.debug === false){
    jQuery.get("/send", { id: CONFIG.id, text: msg }, function(data){}, "json");
  }
}

function showConnect(){
  $("#connect").show();
  $("#loading").hide();
  $("#toolbar").hide();
  $("#nickInput").focus();
}

function showLoad(){
  $("#connect").hide();
  $("#loading").show();
  $("#toolbar").hide();
}

function showChat(nick){
  $("#toolbar").show();
  $("#entry").focus();
  $("#connect").hide();
  $("#loading").hide();

  scrollDown();
}

function updateTitle(){
  if (CONFIG.unread){
    document.title = "(" + CONFIG.unread.toString() + ") chatf";
  } else {
    document.title = "chatf";
  }
}

var starttime;
var rss;

function onConnect(session){
  if (session.error){
    alert("error connecting: " + session.error);
    showConnect();
    return;
  }

  CONFIG.nick  = session.nick;
  CONFIG.id    = session.id;
  CONFIG.color = session.color;
  starttime    = new Date(session.starttime);
  rss          = session.rss;
  updateRSS();
  updateUptime();

  setColor(session.nick, session.color);

  setCookie("beenhere", "nick:" + session.nick + "|color:" + session.color, 7 * 24 * 60 * 60 * 1000); // expires in a week (I hope so..)

  // update the UI to show the chat
  showChat(CONFIG.nick);

  // listen for browser events so we know to update the document title
  $(window).bind("blur", function(){
    CONFIG.focus = false;
    updateTitle();
  });

  $(window).bind("focus", function(){
    CONFIG.focus = true;
    CONFIG.unread = 0;
    updateTitle();
  });

  $("#userName").html("&nbsp;" + CONFIG.nick);
  $("#version").html(VERSION + "v");
  $("#toolbar").css("background", CONFIG.color);
}

// add a list of present chat members to the stream
function outputUsers(){
  var nick_string = nicks.length > 0 ? nicks.join(", ") : "(noone)";
  addMessage("users", "#999", nick_string, new Date());
  return false;
}

function who(){
  jQuery.get("/who", {}, function(data, status){
    if (status != "success") return;
    nicks = data.nicks;
    outputUsers();
  }, "json");
}

$(document).ready(function(){
  $("#entry").keypress(function(e){
    switch (e.keyCode){
      case 38: // up arrow clicked
        $("#entry").attr("value", history.getPrev());
        break;
      case 40: // down arrow clicked
        $("#entry").attr("value", history.getNext());
        break;
    }
  });


  // submit new messages when user hits enter if the message isnt blank.
  $("#entry").keypress(function(e){
    if (e.keyCode != 13 /* Return/Enter key */) return;
    var msg = $("#entry").attr("value").replace("\n", "");
    if (!util.isBlank(msg)) send(msg);

    if (msg != history.stack[history.stack.length - 1])
      history.stack.push(msg); // add message to the history stack
                               // unless its exactly the same as the previous one
    history.position = 0; // after sending a message, reset position back
                          // to zero, to make it behave correctly

    $("#entry").attr("value", ""); // clear the entry field
  });

  $("#usersLink").click(outputUsers);

  // if cookie 'beenhere' is set, don't ask the user for nick and don't validate it, since it already was, but just log him in.
  if (getCookie('beenhere')){
    var nick = getCookie("beenhere").split("|")[0].split(":")[1];
    var color = getCookie("beenhere").split("|")[1].split(":")[1];

    $.ajax({ cache: false,
             type: "GET",
             dataType: "json",
             url: "/join",
             data: { nick: nick, color: color },
             error: function(){
               alert("error connecting to the server");
               showConnect();
             }, success: onConnect
    });
  } else { // there is no such cookie.
    // try joining the chat when the user clicks the connect button
    $("#connectButton").click(function(){
      // lock the UI while waiting for a response
      showLoad();
      var nick = $("#nickInput").attr("value");
      var color = $("#colorInput").attr("value");

      // dont bother the backend if we fail easy validations
      if (nick.length > 50){
        alert("Name is too long, matey. 50 chars max.");
        showConnect();
        return false;
      }

      // some more validations
      if (/[^\w\-_^!]/.exec(nick)){
        alert("Bad character in name." +
              "Can only be letters, numbers and '_', '-', '^'");
        showConnect();
        return false;
      }

      if (color == "") color = "#fff";

      else if (!color.match(/^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)){
        alert("Bad HEX format.");
        if (color.slice(0,1) != "#")
          color = "#" + color;
        showConnect();
        return false;
      }
      
      $.ajax({ cache: false,
               type: "GET",
               dataType: "json",
               url: "/join",
               data: { nick: nick, color: color },
               error: function(){
                 alert("error connecting to the server");
                 showConnect();
               }, success: onConnect
      });

      return false;
    });
  }

  // update the daemon uptime every 10 seconds
  setInterval(function(){
    updateUptime();
  }, 10 * 1000);

  if (CONFIG.debug){
    $("#loading").hide();
    $("#connect").hide();
    scrollDown();
    return;
  }

  $("#log table").remove();

  longPoll();

  showConnect();
});

// if we can, notify the server that we're going away
$(window).unload(function(){
  jQuery.get("/part", { id: CONFIG.id }, function (data){}, "json");
});

