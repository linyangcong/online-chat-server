var mysql = require("mysql")
var pool = mysql.createPool({
    host     : 'localhost',
    password : '123456',

    // host     : '121.5.69.13',
    // password : '123456',
    port     : '3306',
    user     : 'root',
    
    // socketPath:"",
    database : 'webrtcchat',
    // database : 'webrtccchat'
})
function query(sql,callback){
    pool.getConnection(function(err,connection){
        if(err){
            throw err
        }
        connection.query(sql, function (err,rows) {
            callback(err,rows)
            connection.release()
        })
    })
}//对数据库进行查找操作

exports.login=(table,loginname,passworld)=>{
    return new Promise((resolve,reject)=>{
        query(`select * from ${table} where mobile='${loginname}' and password='${passworld}'`,(err,rows)=>{
            if(err) reject(err)
            resolve(rows)
        })
    })
}
exports.queryMobile=(table,mobile)=>{
    return new Promise((resolve,reject)=>{
        query(`select * from ${table} where mobile='${mobile}'`,(err,rows)=>{
            if(err) reject(err)
            resolve(rows)
        })
    })
}
exports.update=(table,updateParam,time,mobile)=>{
    return new Promise((resolve,reject)=>{
        const sql=`update ${table} set ${updateParam}='${time}' where mobile='${mobile}'`
        console.log(sql)
        query(sql,(err,status)=>{
            if(err) reject(err)
            resolve('success')
        })
    })
}
exports.createUser=(table,values)=>{
    return new Promise((resolve,reject)=>{
        const sql=`insert into ${table} values('${values.mobile}','${values.name}','${values.password}','${values.img}','')`
        query(sql,(err,status)=>{
            if(err) reject(err)
            resolve('success')
        })
        
    })
}