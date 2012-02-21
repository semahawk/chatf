var CONFIG = { debug: false,
               nick: "#", // set in onConnect
               id: null,  // same here
               last_message_time: 1,
               focus: true, // event listeners bound in onConnect
               unread: 0   // updated in the message-proccesing loop
};

var nicks = [];

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
  var t = nicks.length.toString() + " matey";
  if (nicks.length != 1) t += "s";
  $("#usersLink").text(t);
}

// handles another person joining the chat
function userJoin(nick, timestamp){
  // put it in the stream
  addMessage(nick, "joined", timestamp, "join");
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
  addMessage(nick, "left", timestamp, "part");
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
    var minutes = date.getMinutes().toString();
    var hours = date.getHours().toString();
    return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes);
  },

  //does the argument only contain whitespace?
  isBlank: function(text) {
    var blank = /^\s*$/;
    return (text.match(blank) !== null);
  }

};

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
  window.scrollBy(0, 1000000000000000);
  $("entry").focus();
}

// inserts an event into the stream for display
// the event may be a msg, join or part type
// from is the user, text is the body and time is the timestamp, defaulting
// to now. _class is a css class to apply to the message, usefull for system
// events.
function addMessage(from, text, time, _class){
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

  messageElement.addClass("message");
  if (_class) messageElement.addClass(_class);

  // sanitize
  text = util.toStaticHTML(text);

  // if the current user said this, add a special css class
  var nick_re = new RegExp(CONFIG.nick);
  if (nick_re.exec(text))
    messageElement.addClass("personal");

  // replace URLs with links
  text = text.replace(util.urlRE, '<a target="_blank" href="$&">$&</a>');

  var content = '<tr>'
              + '  <td class="date">' + util.timeString(time) + '</td>'
              + '  <td class="nick">' + util.toStaticHTML(from) + '</td>'
              + '  <td class="msg-text">' + text + '</td>'
              + '</tr>'
              ;

  messageElement.html(content);

  // the log is the stream that we view
  $("#log").append(messageElement);

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

var transmission_errors = 0;
var first_poll = true;
var n = -1; // used for displaying info about long poll error.

function longPoll(data){
  if (transmission_errors > 20) {
    showConnect();
    return;
  }

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
          addMessage(message.nick, message.text, message.timestamp);
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
             if (n % 10 == 0) addMessage("", "long poll error, trying again...", new Date(), "error");
             $("#userName").html("!" + CONFIG.nick);
             transmission_errors += 1;
             // Wait 1 sec before retrying. We're gonna output info after every ten secends however. Yay!
             setTimeout(longPoll, 1000);
           }
         , success: function (data) {
             transmission_errors = 0;
             n = -1;
             //if everything went well, begin another request immediately
             //the server will take a long time to respond
             //how long? well, it will wait until there is another message
             //and then it will return it to us and close the connection.
             //since the connection is closed when we get data, we longPoll again
             longPoll(data);
           }
         });
  n++;
  $("#userName").html("&nbsp;" + CONFIG.nick);
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
    document.title = "(" + CONFIG.unread.toString() + ") the pirates chat";
  } else {
    document.title = "the pirates chat";
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

  CONFIG.nick = session.nick;
  CONFIG.id   = session.id;
  starttime   = new Date(session.starttime);
  rss         = session.rss;
  updateRSS();
  updateUptime();

  setCookie("beenhere", CONFIG.nick, 7 * 24 * 60 * 60 * 1000); // expires in a week (I hope so..)

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
}

// add a list of present chat members to the stream
function outputUsers(){
  var nick_string = nicks.length > 0 ? nicks.join(", ") : "(noone)";
  addMessage("users:", nick_string, new Date(), "notice");
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
  // submit new messages when user hits enter if the message isnt blank.
  $("#entry").keypress(function(e){
    if (e.keyCode != 13 /* Return/Enter key */) return;
    var msg = $("#entry").attr("value").replace("\n", "");
    if (!util.isBlank(msg)) send(msg);
    $("#entry").attr("value", ""); // clear the entry field
  });

  $("#usersLink").click(outputUsers);

  // if cookie 'beenhere' is set, don't ask the user for nick and don't validate it, since it already was, but just log him in.
  if (getCookie('beenhere')){
    var nick = getCookie("beenhere");

    $.ajax({ cache: false,
             type: "GET",
             dataType: "json",
             url: "/join",
             data: { nick: nick },
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

      $.ajax({ cache: false,
               type: "GET",
               dataType: "json",
               url: "/join",
               data: { nick: nick },
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

