$(document).ready(function(){
  $(window).keydown(function(e){
    if(e.keyCode == 116){
      if(!confirm("刷新将会清除所有聊天记录，确定要刷新么？")){
        e.preventDefault();
      }
    }
  });
  var socket = io.connect();
  var from = $.cookie('user');//从 cookie 中读取用户名，存于变量 from
  var group = $.cookie('room');
  var to = 'all';//设置默认接收对象为"所有人"

  var gameboard_color_set = new Object();

  var card_in_hand = {'card0':0xff,'card1':0xff,'card2':0xff,'card3':0xff,'card4':0xff};
  var card_select;
  var my_color;

  var card_set = new Object;
  var card_set_num = new Object;
  var card_set_Mapping = new Object;
  var gameboard_color = new Object;

  var score = new Object;
  var card_changed = new Object;

  var card = ['1','2','3','4','5','6','7','8','9',
              'A','B','C','D','E','F','G','H','I',
              '!','@','#','$','%','^','&','*','+'];
  var player_color = ['#ff0000','#0ff000','#00ff00','#000ff0','#0000ff'];
  //发送用户上线信号
  socket.emit('online',{user:from,room:group});

  socket.on('online',function(data){
    //显示系统消息
    if(data.ready == 'OK')
    {
      $("#game_start").disabled = false;
      $("#game_start").value='START';
    }
    else
    {
      $("#game_start").disabled = true;
      $("#game_start").value='WAITING';
    }
    if(data.user != from){
      var sys = '<div style="color:#f00">系统(' + now() + '):' + '用户 ' + data.user + ' 上线了！</div>';
    } else {
      var sys = '<div style="color:#f00">系统(' + now() + '):你进入了聊天室！</div>';
    }
    $("#contents").append(sys + "<br/>");
    //刷新用户在线列表
    flushUsers(data.users);
    //显示正在对谁说话
    showSayTo();
  });

  socket.on('say',function(data){
    //对所有人说
    if(data.to == 'all'){
      $("#contents").append('<div>' + data.from + '(' + now() + ')对 所有人 说：<br/>' + data.msg + '</div><br />');
    }
    //对你密语
    if(data.to == from){
      $("#contents").append('<div style="color:#00f" >' + data.from + '(' + now() + ')对 你 说：<br/>' + data.msg + '</div><br />');
    }
  });

  socket.on('offline',function(data){
    //显示系统消息
    var sys = '<div style="color:#f00">系统(' + now() + '):' + '用户 ' + data.user + ' 下线了！</div>';
    $("#contents").append(sys + "<br/>");
    //刷新用户在线列表
    if(data.ready == 'OK')
    {
      $("#game_start").disabled = false;
      $("#game_start").value='START';
    }
    else
    {
      $("#game_start").disabled = true;
      $("#game_start").value='WAITING';
    }
    flushUsers(data.users);
    //如果正对某人聊天，该人却下线了
    if(data.user == to){
      to = "all";
    }
    //显示正在对谁说话
    showSayTo();
  });

  //服务器关闭
  socket.on('disconnect',function(){
    var sys = '<div style="color:#f00">系统:连接服务器失败！</div>';
    $("#contents").append(sys + "<br/>");
    $("#list").empty();
  });

  //重新启动服务器
  socket.on('reconnect',function(){
    var sys = '<div style="color:#f00">系统:重新连接服务器！</div>';
    $("#contents").append(sys + "<br/>");
    socket.emit('online',{user:from,room:group});
  });

  socket.on('get_card',function(data){
    for (var i in card_in_hand)
    {
      if (card_in_hand[i] == card_select) 
      {
        if(data.card == 0xff)
        {
          card_in_hand[i] = data.card;
          $('#'+i).css('display','none');
        }
        else
        {
          card_in_hand[i] = data.card;
          $('#'+i).html(card[card_in_hand[i]]);
        }
      }
    }
    clear_game_board();
    card_select=0xff;
    $('#card_pond').css('display','none');
  });

  socket.on('wrong_place',function(){
    alert("wrong place");
  });

  socket.on('waiting',function(){
    $('#card_pond').css('display','none');
  });

  socket.on('its_your_turn',function(){
    $('#card_pond').css('display','block');
  });

  socket.on('refresh_board',function(data){
    if((card_set[data.color] == null)||(card_set_num[data.color] == 0))
    {
      if(card_set[data.color] == null) card_set[data.color] = new Object;
      card_set[data.color][data.pos] = 0;
      card_set_Mapping[data.color] = [0];
      if(card_set_num[data.color] == null) card_set_num[data.color]=1;
      else
        card_set_num[data.color]++;

      if(gameboard_color[data.pos] != null)
      {
        if(card_changed[data.color] == null) card_changed[data.color]=[''+gameboard_color[data.pos]+$('#pad'+data.pos).text()];
        else card_changed[data.color].unshift(''+gameboard_color[data.pos]+$('#pad'+data.pos).text());
        if(!(((data.pos[0]>1)&&(gameboard_color[data.pos]==gameboard_color[''+(data.pos[0]-1)+data.pos[1]]))||
          ((data.pos[0]<9)&&(gameboard_color[data.pos]==gameboard_color[''+(parseInt(data.pos[0])+1)+data.pos[1]]))||
          ((data.pos[1]>1)&&(gameboard_color[data.pos]==gameboard_color[''+data.pos[0]+(data.pos[1]-1)]))||
          ((data.pos[1]<9)&&(gameboard_color[data.pos]==gameboard_color[''+data.pos[0]+(parseInt(data.pos[1])+1)]))))
        {
          card_set_Mapping[gameboard_color[data.pos]].splice(card_set_Mapping[gameboard_color[data.pos]].indexOf(card_set[gameboard_color[data.pos]][data.pos]),1);
        }
        $('#score'+data.color).append(' <font color="'+player_color[gameboard_color[data.pos]]+'">'+$('#pad'+data.pos).text()+'</font>');
        //html($('#score'+data.color).text()+',<font color="'+player_color[gameboard_color[data.pos]]+'">'+$('#pad'+data.pos).text()+'</font>');
        delete card_set[gameboard_color[data.pos]][data.pos];
      }
    }
    else
    {
      if(gameboard_color[data.pos] != null)
      {
        if(card_changed[data.color] == null) card_changed[data.color]=[''+gameboard_color[data.pos]+$('#pad'+data.pos).text()];
        else card_changed[data.color].unshift(''+gameboard_color[data.pos]+$('#pad'+data.pos).text());
        if(!(((data.pos[0]>1)&&(gameboard_color[data.pos]==gameboard_color[''+(data.pos[0]-1)+data.pos[1]]))||
          ((data.pos[0]<9)&&(gameboard_color[data.pos]==gameboard_color[''+(parseInt(data.pos[0])+1)+data.pos[1]]))||
          ((data.pos[1]>1)&&(gameboard_color[data.pos]==gameboard_color[''+data.pos[0]+(data.pos[1]-1)]))||
          ((data.pos[1]<9)&&(gameboard_color[data.pos]==gameboard_color[''+data.pos[0]+(parseInt(data.pos[1])+1)]))))
        {
          card_set_Mapping[gameboard_color[data.pos]].splice(card_set_Mapping[gameboard_color[data.pos]].indexOf(card_set[gameboard_color[data.pos]][data.pos]),1);
        }
        $('#score'+data.color).append(' <font color="'+player_color[gameboard_color[data.pos]]+'">'+$('#pad'+data.pos).text()+'</font>');
        //$('#score'+data.color).html($('#score'+data.color).text()+',<font color="'+player_color[gameboard_color[data.pos]]+'">'+$('#pad'+data.pos).text()+'</font>');
        delete card_set[gameboard_color[data.pos]][data.pos];
      }
      var set_to_merge = [0xff,0xff,0xff,0xff];
      for(var pos in card_set[data.color])
      {
        if ((pos[0]-data.pos[0]==1)&&(pos[1]==data.pos[1]))
        {
          set_to_merge[0]=card_set[data.color][pos];
        }
        if ((data.pos[0]-pos[0]==1)&&(pos[1]==data.pos[1]))
        {
          set_to_merge[1]=card_set[data.color][pos];
        }
        if ((pos[0]==data.pos[0])&&(pos[1]-data.pos[1]==1))
        {
          set_to_merge[2]=card_set[data.color][pos];
        }
        if ((pos[0]==data.pos[0])&&(data.pos[1]-pos[1]==1))
        {
          set_to_merge[3]=card_set[data.color][pos];
        }
      }
      set_to_merge.sort(sortNumber);
      if(set_to_merge[0]==0xff)
      {
        card_set[data.color][data.pos] = card_set_num[data.color];
        card_set_Mapping[data.color].unshift(card_set_num[data.color]); 
        card_set_num[data.color]++;
      }
      else
      {
        card_set[data.color][data.pos] = set_to_merge[0];
        if(set_to_merge[1]!=0xff)
        {
          for(var pos in card_set[data.color])
          {
            if((card_set[data.color][pos]==set_to_merge[1])||(card_set[data.color][pos]==set_to_merge[2])||(card_set[data.color][pos]==set_to_merge[3]))
            {
              card_set[data.color][pos]=set_to_merge[0]
            }
          }
          card_set_Mapping[data.color].splice(card_set_Mapping[data.color].indexOf(set_to_merge[1]),1);
          if(set_to_merge[2]!=0xff)
            card_set_Mapping[data.color].splice(card_set_Mapping[data.color].indexOf(set_to_merge[2]),1);
          if(set_to_merge[3]!=0xff)
            card_set_Mapping[data.color].splice(card_set_Mapping[data.color].indexOf(set_to_merge[3]),1);
        }
      }
    }
    for(var index in card_set_Mapping)
    {
      var temp_score = [0,0,0,0,0];
      if(card_changed[index]!=null)
      {
        for (var n in card_changed[index])
        {
          temp_score[card_changed[index][n].slice(0,1)]++;
        }
        temp_score.sort(sortNumber);
      }
      $('#score_num'+index).html(card_set_Mapping[index].length+temp_score[4]);
    }
    gameboard_color[data.pos]=data.color;
    $("#pad"+data.pos).css('background-color',player_color[data.color]);
    $("#pad"+data.pos).html(card[data.card]);
  });

  socket.on('gameboard_init',function(data){
    
    my_color=player_color[data.color];
    card_select=0xff;
    card_set_num[data.color]=0;
    card_set[data.color] = new Object;

    var j=0;
    for (var i in card_in_hand)
    {
      card_in_hand[i]=data.card[j];
      j++;
    }
    for (var i in data.member)
    {
      $('#score_pond').append('<div id="score'+i+'" class="score_name"><font color="'+player_color[i]+'">'+data.member[i]+':</font></div>');
      $('#score_pond').append('<div id="score_num'+i+'" class="score" style="top:'+(100*i+75)+'px;">0</div>');
    }
    $('#pad_color').css('background-color',my_color);
    $('#pad_color').css('border-color','white');
    $("#game_board").append('<div id="pad_empty" class="pad" style="position:absolute;border-color:black;top:0px;left:0px;"></div>');
    for(var i=1;i<10;i++)
      $("#game_board").append('<div id="pad_row'+i+'" class="pad" style="position:absolute;border-color:black;top:0px;left:'+i*100+'px;">'+card[i-1]+'</div>');
    for(var i=1;i<10;i++)
      $("#game_board").append('<div id="pad_col'+i+'" class="pad" style="position:absolute;border-color:black;top:'+i*100+'px;left:0px;">'+card[i+9-1]+'</div>');
    for(var j=1;j<10;j++)
      for(var i=1;i<10;i++)
      {
        $("#game_board").append('<div id="pad'+j+i+'" class="pad" style="position:absolute;border-color:black;cursor:pointer;top:'+j*100+'px;left:'+i*100+'px;">'+card[Math.floor((i-1)/3)+Math.floor((j-1)/3)*3+18]+'</div>');
        $("#pad"+j+i).click(function()
        {
          if (card_select==0xff)
          {
            alert("no card select");
            return;
          }
          var x = this.id[3];
          var y = this.id[4];

          var a = $(this).css('border-color') ;
          var b = $('#pad_color').css('border-color');
          if ($(this).css('border-color') == $('#pad_color').css('border-color'))
          {
            socket.emit("draw",{user:from,card:card_select,pos:""+x+y});
          }
          else
          {
            alert("wrong place");
          }
        });
      }
    for(var i=0;i<5;i++)
    {
      $('#card_pond').append('<div id="card'+i+'" class="pad" style="position:absolute;border-color:black;cursor:pointer;background-color:'+my_color+';top:0px;left:'+i*100+'px;">'+card[card_in_hand['card'+i]]+'</div>');
      $('#card'+i).click(function(){
        card_select = card_in_hand[this.id];
        clear_game_board();
        if(card_select<9)
        {
          for(var x=1;x<10;x++)
          {
            checkpadvalid(x,(parseInt(card_select)+1));
          }
        }
        if((card_select<18)&&(card_select>=9))
        {
          for(var x=1;x<10;x++) 
          {
            checkpadvalid((parseInt(card_select)-8),x);
          }
        }
        if(card_select>=18)
        {
          for(var x=0;x<3;x++)
            for(var y=0;y<3;y++)
            {
              checkpadvalid(Math.floor((card_select-18)/3)*3+x+1,Math.floor((card_select-18)%3)*3+y+1);
            }
        }
      });
    }
  });

  var tile_is_conn;
  var tile_is_check;

  function checkpadvalid(x,y)
  {
    if($('#pad'+x+y).css('background-color') != $('#pad_color').css('background-color'))
    {
      if(($('#pad'+x+y).css('background-color') != $('#pad_empty').css('background-color'))&&($('#pad'+x+y).css('background-color') != null))
      {
        var temp_color = ($('#pad'+x+y).css('background-color'));
        var same_color_num=0;
        var color = $('#pad'+(parseInt(x)+1)+y).css('background-color');
        if((x>1)&&($('#pad'+(x-1)+y).css('background-color')==temp_color)) same_color_num++;
        if((x<9)&&($('#pad'+(parseInt(x)+1)+y).css('background-color')==temp_color)) same_color_num+=2;
        if((y>1)&&($('#pad'+x+(y-1)).css('background-color')==temp_color)) same_color_num+=4;
        if((y<9)&&($('#pad'+x+(parseInt(y)+1)).css('background-color')==temp_color)) same_color_num+=8;
        if((same_color_num>1)&&(same_color_num!=2)&&(same_color_num!=4)&&(same_color_num!=8))
        {
          var temp_set = card_set[gameboard_color[''+x+y]][''+x+y];
          delete card_set[gameboard_color[''+x+y]][''+x+y];
          if((same_color_num>=2)&&(same_color_num!=2)&&(same_color_num!=4)&&(same_color_num!=8))
          {
            tile_is_conn=0;
            tile_is_check = new Object;
            if(same_color_num>8) 
              {
                tile_is_conn = check_tile_conn(gameboard_color[''+x+y],temp_set,''+x+(parseInt(y)+1));
                for (pos in card_set) if (card_set[gameboard_color[''+x+y]][pos]==temp_set) tile_is_conn--;
              }
            else if(same_color_num>4) 
              {
                tile_is_conn = check_tile_conn(gameboard_color[''+x+y],temp_set,''+x+(y-1));
                for (pos in card_set) if (card_set[gameboard_color[''+x+y]][pos]==temp_set) tile_is_conn--;
              }
            else if(same_color_num>2) 
              {
                tile_is_conn = check_tile_conn(gameboard_color[''+x+y],temp_set,''+(parseInt(x)+1)+y);
                for (pos in card_set) if (card_set[gameboard_color[''+x+y]][pos]==temp_set) tile_is_conn--;
              }
            delete tile_is_check;
            if(tile_is_conn==0)  $('#pad'+x+y).css('border-color','white');
          }
          card_set[gameboard_color[''+x+y]][''+x+y] = temp_set;
        }
        else
          $('#pad'+x+y).css('border-color','white');
      }
      else
        $('#pad'+x+y).css('border-color','white');
    }
  }

  function check_tile_conn(color,set,pos)
  {
    if((tile_is_check[pos]!=null)&&(tile_is_check[pos]==1)&&(card_set[color][pos]!=set))
    {
      return;
    }
    else
    {
      tile_is_check[pos] = 1;
      tile_is_conn++;
      if(pos.charAt(0)>1) check_tile_conn(color,set,''+(pos.charAt(0)-1)+pos.charAt(1));
      if(pos.charAt(0)<9) check_tile_conn(color,set,''+(parseInt(pos.charAt(0)+1)+pos.charAt(1)));
      if(pos.charAt(1)>1) check_tile_conn(color,set,''+pos.charAt(0)+(pos.charAt(1)-1));
      if(pos.charAt(1)<9) check_tile_conn(color,set,''+pos.charAt(0)+(parseInt(pos.charAt(1)+1)));
    }
  }

  function sortNumber(a,b)
  {
    return a - b
  }

  function clear_game_board(){
  for(var x=1;x<10;x++)
    for(var y=1;y<10;y++)
    {
      $("#pad"+x+y).css('border-color','black');
    }
  }
  
  function flushUsers(users){
    //清空之前用户列表，添加 "所有人" 选项并默认为灰色选中效果
    $("#list").empty().append('<li title="双击聊天" alt="all" class="sayingto" onselectstart="return false">所有人</li>');
    //遍历生成用户在线列表
    for(var i in users){
      $("#list").append('<li alt="' + users[i] + '" title="双击聊天" onselectstart="return false">' + users[i] + '</li>');
    }
    $("#room_num").html(group);
    //双击对某人聊天
    $("#list > li").dblclick(function(){
      //如果不是双击的自己的名字
      if($(this).attr('alt') != from){
        //设置被双击的用户为说话对象
        to = $(this).attr('alt');
        //清除之前的选中效果
        $("#list > li").removeClass('sayingto');
        //给被双击的用户添加选中效果
        $(this).addClass('sayingto');
        //刷新正在对谁说话
        showSayTo();
      }
    });
  }

  //显示正在对谁说话
  function showSayTo(){
    $("#from").html(from);
    $("#to").html(to == "all" ? "所有人" : to);
  }

  //获取当前时间
  function now(){
    var date = new Date();
    var time = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + (date.getMinutes() < 10 ? ('0' + date.getMinutes()) : date.getMinutes()) + ":" + (date.getSeconds() < 10 ? ('0' + date.getSeconds()) : date.getSeconds());
    return time;
  }

  //发话
  $("#say").click(function(){
    //获取要发送的信息
    var $msg = $("#input_content").html();
    if($msg == "") return;
    //把发送的信息先添加到自己的浏览器 DOM 中
    if(to == "all"){
      $("#contents").append('<div>你(' + now() + ')对 所有人 说：<br/>' + $msg + '</div><br />');
    } else {
      $("#contents").append('<div style="color:#00f" >你(' + now() + ')对 ' + to + ' 说：<br/>' + $msg + '</div><br />');
    }
    //发送发话信息
    socket.emit('say',{from:from,to:to,msg:$msg});
    //清空输入框并获得焦点
    $("#input_content").html("").focus();
  });

  $("#game_start").click(function(){
    socket.emit('game_start',{user:from,room:group});
  });
});