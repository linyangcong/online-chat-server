
"use strict";
var http = require('http');
var https = require('https');
var fs = require('fs');
var formidable = require('formidable')
var {login,update,queryMobile,createUser}=require('./DBPool')
var WebSocketServer = require('websocket').server;
var url = require('url')
const keyFilePath = ''//"./ssl/aa.online.key";
const certFilePath = ''//"./ssl/aa.online_bundle.crt";
var connectionArray = [];
const staticServer='/'
var appendToMakeUnique = 1;
function log(text) {
  var time = new Date();
  console.log("[" + time.toLocaleTimeString() + "] " + text);
}
var httpsOptions = {
  key: null,
  cert: null
};

try {
  httpsOptions.key = fs.readFileSync(keyFilePath);
  try {
    httpsOptions.cert = fs.readFileSync(certFilePath);
  } catch(err) {
    httpsOptions.key = null;
    httpsOptions.cert = null;
  }
} catch(err) {
  httpsOptions.key = null;
  httpsOptions.cert = null;
}

// If we were able to get the key and certificate files, try to
// start up an HTTPS server.

var webServer = null;

try {
  if (httpsOptions.key && httpsOptions.cert) {
    webServer = https.createServer(httpsOptions, handleWebRequest);
  }
} catch(err) {
  webServer = null;
}

if (!webServer) {
  try {
    webServer = http.createServer({}, handleWebRequest);
  } catch(err) {
    webServer = null;
    log(`Error attempting to create HTTP(s) server: ${err.toString()}`);
  }
}
function handleWebRequest(request, response) {
  log ("Received request for " + request.url);
  //response.writeHead(404);
  //response.end();
}
webServer.listen(6503, function() {
  log("Server is listening on port 6503");
});
var wsServer = new WebSocketServer({
  httpServer: webServer,
  autoAcceptConnections: false
});

if (!wsServer) {
  log("ERROR: Unable to create WbeSocket server!");
}
// ws/wss请求
webServer.on("request",async function(req,res){
	if(req.method=='GET'){
    let hostURL=req.url.split('?')[0]
	res.writeHead(200, { 'Content-Type': 'application/json' });
	// const urlParam=url.parse(req.url,true)
  if(hostURL=='/getImg'){
    const query=req.url.split('?')[1]
    if(query){
      res.writeHead(200, {"Content-Type": "image/png"});
      let object={}
      query.split('&').forEach(item=>{
        const obj=item.split('=')
        object[obj[0]]=obj[1]
      })
      let pathname=__dirname+'/userIcon/'+object.id
      fs.exists(pathname, function (exists) {
        if (exists) {
          fs.readFile(pathname, function (err, data) {
            res.end(data);
            });
        }
      })
      
    }else{
      res.end(JSON.stringify({code:404,msg:'文件不存在'}))
    }
  }else{
   
    res.end(JSON.stringify({
      data: 'Hello GET!'
}));
  }
	}else if(req.method=='POST'){
    let result=''
    let results=[]
    let hostURL=req.url.split('?')[0]
	  req.on('data',async (data)=>{
    let http='http'
    res.writeHead(200, { 'Content-Type': 'application/json' });
    let response
    let imageBuffer
    switch(hostURL){
      case '/login':
        response=JSON.parse(data.toString())
        if(response.mobile&&response.password)
        // 登录
         results=await login('base_user',response.mobile,response.password)
        if(results.length!=0){
          // 刷新登录时间
          result =await update('base_user','loginTime',new Date().toLocaleTimeString(),response.mobile)
          if(result=='success'){
            res.end(JSON.stringify({code:200,msg:'登录成功',result:results[0]}))
          }
          else{
            res.end(JSON.stringify({code:500,msg:'数据库抛出了异常！！'}))
          }
        }else{
          res.end(JSON.stringify({code:404,msg:'用户不存在或密码错误'}))
        }
        break;
      case '/register':
        response=JSON.parse(data.toString())
        results=await queryMobile('base_user',response.mobile)
        if(results.length){
          res.end(JSON.stringify({code:200,msg:'用户已存在'}))
        }else{
          let resData=[]
          if(response.mobile&&response.password){
            result= await createUser('base_user',response)
            if(result){
              resData={code:200,msg:'注册成功'}
            }else{
              resData={code:500,msg:'注册失败'}
            }
          }else{
            resData={code:500,msg:'注册数据不完善'}
          }
          res.end(JSON.stringify(resData))
        }
        break;
      case '/resetPassword':
        response=JSON.parse(data.toString())
        result =await update('base_user','password',response.newPassword,response.mobile)
        if(result=='success'){
          res.end(JSON.stringify({code:200,msg:'密码修改成功',result:results[0]}))
        }
        else{
          res.end(JSON.stringify({code:500,msg:'数据库抛出了异常！！'}))
        }
        break;
      case '/uploadFile':
          response=JSON.parse(data.toString())
         imageBuffer = decodeBase64Image(response.obj);
        if(httpsOptions.key)http='https'
        fs.writeFile(`./userIcon/${response.name}.jpg`, imageBuffer.data, function(err) {
          if(err) {
            res.end(JSON.stringify({code:500,msg:'文件上传失败'}))
            return false
          }
          else
          res.end(JSON.stringify({code:200,msg:'文件上传成功',obj:`${http}://${req.headers.host}/getImg?id=${response.name}.jpg`}))
      });
      break;
      
    }
	 })
  // }
	}else{
		res.writeHead(404)
		res.end()
	} 
})
function decodeBase64Image(dataString) {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
  response = {};
  if (matches.length !== 3) {
  return new Error('Invalid input string');
  }
  response.type = matches[1];
  response.data = Buffer.from(matches[2], 'base64');
  return response;
  }
function isUsernameUnique(name) {
  var isUnique = true;
  var i;
  for (i=0; i<connectionArray.length; i++) {
    if (connectionArray[i].username === name) {
      isUnique = false;
      break;
    }
  }
  return isUnique;
}
function sendToOneUser(id, msgString) {
  var isUnique = true;
  var i;
  for (i=0; i<connectionArray.length; i++) {
    if (connectionArray[i].clientID === id) {
      connectionArray[i].sendUTF(msgString);
      break;
    }
  }
}
function getConnectionForID(id) {
  var connect = null;
  var i;
  for (i=0; i<connectionArray.length; i++) {
    if (connectionArray[i].clientID === id) {
      connect = connectionArray[i];
      break;
    }
  }
  return connect;
}
function makeUserListMessage() {
  var userListMsg = {
    type: "userlist",
    users: []
  };
  var i;
  for (i=0; i<connectionArray.length; i++) {
    userListMsg.users.push({username:decodeURI(connectionArray[i].username),id:connectionArray[i].clientID,img:connectionArray[i].img||''});
  }
  return userListMsg;
}
function getQuery(paramString){
  const tempArr=paramString.split('&')
  let obj={}
  tempArr.forEach(item=>{
    const key=item.split('=')[0]
    const value=item.split('=')[1]
    obj[key]=value
  })
  return obj
}
function sendUserListToAll() {
  var userListMsg = makeUserListMessage();
  var userListMsgStr = JSON.stringify(userListMsg);
  var i;
  for (i=0; i<connectionArray.length; i++) {
    connectionArray[i].sendUTF(userListMsgStr);
  }
}

// https/http请求
wsServer.on('request', function(request) {
  // if (request.origin) {//websocket权限
  //   request.reject();
  //   return;
  // }
  var connection = request.accept("json", request.href);
  connectionArray.push(connection);
  
  // /?id=19925956050
  // equest.resource--请求地址
  const queryString=request.resource.split('?')[1]
  const param=getQuery(queryString)
  if(request.resource.split('?').length>2){
    connection.img=param.img+'?'+request.resource.split('?')[2]
    console.log(connection.img)
  }
  
  let nextID=''
  if(param){
    // 永久会话
    nextID=param.id
    connection.username=param.username
    
  }else{
    // 临时会话
    nextID=new Date().getTime()
  }
  
  connection.clientID = nextID;
  sendUserListToAll();
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
    
     let msg = JSON.parse(message.utf8Data);
      // let connect = getConnectionForID(msg.id);
      
      let msgString = JSON.stringify(msg);
      // 发送给个人的消息
      if (msg.id) {
        if(msg.type=='connectMul'||msg.type=='mulChat'||msg.isMulty){
          (msg.userList||[]).forEach(id=>{
            sendToOneUser(id,msgString)
          })
        }
        else
        sendToOneUser(msg.id, msgString);
      }
      else {
        // 发送给所有人的消息
        for (let i=0; i<connectionArray.length; i++) {
          connectionArray[i].sendUTF(msgString);
        }
      }
 
    }
  });

  connection.on('close', function(reason, description) {
    connectionArray = connectionArray.filter(function(el, idx, ar) {
      return el.connected;
    });
    sendUserListToAll();
    var logMessage = "Connection closed: " + connection.remoteAddress + " (" + reason;
    if (description !== null && description.length !== 0) {
      logMessage += ": " + description;
    }
    logMessage += ")";
    log(logMessage);
  });
});
