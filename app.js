
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

var game_start_num = 1;

var roomMapping = new Object();
var userMapping = new Object();
var rooms = [];
var users = [];

var groups = [];
var groupMapping = new Object();
var cardMapping = new Object();
var cardinhandMapping = new Object();

var score = new Object(); // -->user
var gameboard_color = new Object(); // -->room
var gameboard_card = new Object(); // -->room

app.get('/', function(req,res){
  if(req.cookies.user == null){
    res.redirect('/signin');
  }
  else res.sendfile('views/index.html');
});

app.get('/signin',function(req,res){
  res.sendfile('views/signin.html');
});

app.post('/signin',function(req,res){
  //检测该用户名是否已经存在于 users 数组中
  if((users.indexOf(req.body.name) != -1)||(req.body.room == "")||(req.body.name == "")||(groups.indexOf(req.body.room) != -1)){
    //存在，则不允许登陆
    res.redirect('/signin');
  } else {
	  //不存在，把用户名存入 cookie 并跳转到主页
    res.cookie("user",req.body.name,{maxAge:1000*60*60*24*30});
    res.cookie("room",req.body.room,{maxAge:1000*60*60*24*30});
    res.redirect('/');
  }
});

var server = http.createServer(app);
var io = require('socket.io').listen(server);

io.sockets.on('connection',function(socket){
  //有人上线
  socket.on('online',function(data){
    //将上线的用户名存储为 socket 对象的属性，以区分每个 socket 对象，方便后面使用
    console.log(data);
    socket.name = data.user;
    //数组中不存在该用户名则插入该用户名
    if(users.indexOf(data.user) == -1){
      users.unshift(data.user);
      userMapping[data.user]=data.room;
    }
    if(rooms.indexOf(data.room) == -1){
      rooms.unshift(data.room)
      roomMapping[data.room]=[data.user];
    }
    else
    {
      if(roomMapping[data.room].indexOf(data.user) == -1)
      {
        roomMapping[data.room].unshift(data.user);
      }
    }
    //向所有用户广播该用户上线信息
    var clients = io.sockets.clients();
    //遍历找到该用户
    clients.forEach(function(client){
      if(userMapping[client.name] == userMapping[data.user]){
        //触发该用户客户端的 say 事件
        if((roomMapping[userMapping[data.user]].indexOf(client.name)==(roomMapping[userMapping[data.user]].length-1))
          &&(roomMapping[userMapping[data.user]].length >= game_start_num))
        {
          client.emit('online',{users:roomMapping[userMapping[data.user]],user:data.user,ready:'OK'});
        }
        else
        {
          client.emit('online',{users:roomMapping[userMapping[data.user]],user:data.user,ready:'waiting'});
        }
      }
    });
  });

  //有人下线
  socket.on('disconnect',function(){
    //若 users 数组中保存了该用户名

    if(rooms.indexOf(userMapping[socket.name]) != -1)
    {
        if(roomMapping[userMapping[socket.name]].length != 0)
        {
          roomMapping[userMapping[socket.name]].splice(roomMapping[userMapping[socket.name]].indexOf(socket.name),1);
        }
        else
        {
          delete roomMapping[userMapping[socket.name]];
          rooms.splice(rooms.indexOf(userMapping[socket.name]),1);
      }
    }
    if(users.indexOf(socket.name) != -1)
    {
      var clients = io.sockets.clients();
      //遍历找到该用户
      clients.forEach(function(client){
        if((userMapping[socket.name] == userMapping[client.name]) && (socket.name != client.name)){
          //触发该用户客户端的 say 事件
          if(roomMapping[userMapping[socket.name]].indexOf(socket.name) == (roomMapping[userMapping[socket.name]].length-1))
          {
            if((client.name != socket.name)
              &&(roomMapping[userMapping[client.name]].indexOf(client.name) == (roomMapping[userMapping[client.name]].length-2))
              &&(roomMapping[userMapping[client.name]].length >= game_start_num+1))
            {
              client.emit('offline',{users:roomMapping[userMapping[socket.name]],user:socket.name,ready:'OK'});
            }
            else
            {
              client.emit('offline',{users:roomMapping[userMapping[socket.name]],user:socket.name,ready:'waiting'});
            }
          }
          else
          {
            if((client.name != socket.name)
              &&(roomMapping[userMapping[client.name]].indexOf(client.name) == (roomMapping[userMapping[client.name]].length-1))
              &&(roomMapping[userMapping[client.name]].length >= game_start_num+1))
            {
              client.emit('offline',{users:roomMapping[userMapping[socket.name]],user:socket.name,ready:'OK'});
            }
            else
            {
              client.emit('offline',{users:roomMapping[userMapping[socket.name]],user:socket.name,ready:'waiting'});
            }
          }
        }
      });
      delete userMapping[socket.name];
      users.splice(users.indexOf(socket.name),1);
    }
  });

  //有人发话
  socket.on('say',function(data){
    if(data.to == 'all')
    {
      var clients = io.sockets.clients();
      //遍历找到该用户
      clients.forEach(function(client){
        if((userMapping[client.name] == userMapping[data.from])&&(client.name != data.from)){
          //触发该用户客户端的 say 事件
          client.emit('say',data);
        }
      });
    } else {
      //向特定用户发送该用户发话信息
      //clients 为存储所有连接对象的数组
      var clients = io.sockets.clients();
      //遍历找到该用户
      clients.forEach(function(client){
        if(client.name == data.to){
          //触发该用户客户端的 say 事件
          client.emit('say',data);
        }
      });
    }
  });

  socket.on('game_start',function(data){
    if (groups.indexOf(data.room) == -1)
    {
      groups.unshift(data.room);
      roomMapping[data.room].forEach(function(user)
      {
        groupMapping[data.room] = roomMapping[data.room];
      });
    }

    groupMapping[data.room].forEach(function(user)
    {
      var s = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27];
      cardMapping[user] = new Array;
      while (s.length) cardMapping[user].push(s.splice(Math.random() * s.length, 1));

      cardinhandMapping[user] = [];
      for(var i=0;i<5;i++) cardinhandMapping[user][i] = cardMapping[user].pop();
    });

    gameboard_card[data.room]=[0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,];

    gameboard_color[data.room]=[0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
                               0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,];

    var clients = io.sockets.clients();
    clients.forEach(function(client)
    {
      if(groupMapping[data.room].indexOf(client.name) != -1)
      {
        client.emit('gameboard_init',{card:[cardinhandMapping[client.name][0],cardinhandMapping[client.name][1],cardinhandMapping[client.name][2],
          cardinhandMapping[client.name][3],cardinhandMapping[client.name][4]],color:groupMapping[data.room].indexOf(client.name),member:groupMapping[data.room]});
        if(groupMapping[data.room].indexOf(client.name) != 0)
        {
          client.emit('waiting');
        }
      }
    });
  });

  socket.on('draw',function(data){
    gameboard_card[userMapping[data.user]][data.pos[0]*9+data.pos[1]] = data.card;
    gameboard_color[userMapping[data.user]][data.pos[0]*9+data.pos[1]] = groupMapping[userMapping[data.user]].indexOf(data.user);

    var clients = io.sockets.clients();
    clients.forEach(function(client){
      if(groupMapping[userMapping[data.user]].indexOf(client.name) != -1){
        client.emit('refresh_board',{color:groupMapping[userMapping[data.user]].indexOf(data.user),card:data.card,pos:data.pos});
      if((cardMapping[groupMapping[userMapping[data.user]][groupMapping[userMapping[data.user]].length-1]].length == 0)
        &&(groupMapping[userMapping[data.user]][groupMapping[userMapping[data.user]].length-1]==data.user))
        {
          var clients = io.sockets.clients();
          clients.forEach(function(client){
            if(groupMapping[userMapping[data.user]].indexOf(client.name) != -1){
              client.emit('game_end',{user:groupMapping[userMapping[data.user]]});
              client.emit('waiting');
            }
          });
          return;
        }
        if(client.name==data.user)
        {
          for (var i=0;((i<5)&&((cardinhandMapping[client.name][i]-data.card) != 0));i++);
          if(i<5)
          {
            if (cardMapping[client.name].length == 0)
            {
              cardinhandMapping[client.name][i]=0xff;
              client.emit('get_card',{card:0xff});
            }
            else
            {
              cardinhandMapping[client.name][i] = cardMapping[client.name].pop();
              client.emit('get_card',{card:cardinhandMapping[client.name][i]});
            }
          }
          else
            console.log('error: card not in hand');
        }
        var next_player
        if(groupMapping[userMapping[data.user]].length == 1) next_player=data.user;
        else if(groupMapping[userMapping[data.user]].indexOf(data.user) == groupMapping[userMapping[data.user]].length - 1) next_player=groupMapping[userMapping[data.user]][0];
        else next_player=groupMapping[userMapping[data.user]][groupMapping[userMapping[data.user]].indexOf(data.user)+1];
        if(client.name==next_player)
        {
          client.emit('its_your_turn');
        }
      }
    });
  });
});

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
