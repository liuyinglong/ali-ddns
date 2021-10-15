#! /usr/bin/env node

let AliCloudClient = require("aliyun-apisign")
let Req = require("aliyun-apisign/request/index")
let request = new Req()
let yargs = require('yargs')


yargs.option("I", {
    alias: "accessKeyId",
    demand: true,
    describe: '阿里云accessKey ID',
    type: 'string'
})

yargs.option("S", {
    alias: "accessKeySecret",
    demand: true,
    describe: '阿里云AccessKeySecret',
    type: 'string'
})

yargs.option("d", {
    alias: "domain",
    demand: true,
    describe: '域名',
    type: 'string'
})

yargs.option("r", {
    alias: "subDomain",
    demand: true,
    describe: '二级域名记录',
    type: 'string'
})

yargs.option("c", {
    alias: "checkTime",
    describe: '每次检测间隔时间，最低60秒',
    type: 'number',
    default: 60
})

let options = yargs.argv

if(!options.accessKeyId){
    console.log("accessKeyId 不能为空")
    return
}
if(!options.accessKeySecret){
    console.log("accessKeySecret 不能为空")
    return
}
if(!options.domain){
    console.log("domain 不能为空")
    return
}
if(!options.subDomain){
    console.log("subDomain 不能为空")
    return
}


let aliClient = new AliCloudClient({
    AccessKeyId: options.accessKeyId,
    AccessKeySecret: options.accessKeySecret,
    serverUrl: "http://alidns.aliyuncs.com"
})

let domain = options.domain
let subDomain = options.subDomain
let checkTime = options.checkTime < 60 ? 60 : options.checkTime

function dateFormat(date, type) {
    return date.toString()
}


function getMyIp() {
    return request.get("http://ip.getlove.cn", {
        ip: "myip"
    }).then(function ({body}) {
        return body.trim()
    })
}

function getDomainRecords() {
    return aliClient.get("/", {
        Action: "DescribeSubDomainRecords",
        SubDomain: `${subDomain}.${domain}`,
        Type: "A"
    }).then(function (data) {
        let body = data.body
        let {TotalCount, DomainRecords} = body
        if (!TotalCount) {
            return {
                recordId: "",
                ip: ""
            }
        }
        return {
            recordId: DomainRecords.Record[0].RecordId,
            ip: DomainRecords.Record[0].Value
        }
    })
}

function updateRecords({recordId, ip}) {
    return aliClient.get("/", {
        Action: "UpdateDomainRecord",
        RecordId: recordId,
        RR: subDomain,
        Type: "A",
        Value: ip
    }).then(function (data) {
        return `${dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")} ${subDomain}.${domain} 动态解析到ip: ${ip}`
    })
}

function addRecord({ip}) {
    return aliClient.get("/", {
        Action: "AddDomainRecord",
        DomainName: domain,
        RR: subDomain,
        Type: "A",
        Value: ip
    }).then(function (data) {
        return `${dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")} ${subDomain}.${domain} 新增解析到ip: ${ip}`
    })
}


function DDNS() {
    console.log(`${dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")} 开始检测...`)
    Promise.all([getMyIp(), getDomainRecords()])
        .then(function ([localIp, record]) {
            //没有解析记录，新增一条解析记录
            if (!record.recordId) {
                console.log(`${dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")} 未查询到相关记录， 开始新增解析记录`)
                return addRecord({ip: localIp})

            }
            if (localIp !== record.ip) {
                console.log(`${dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")} ip发生变化 开始更新解析记录`)
                return updateRecords({recordId: record.recordId, ip: localIp})
            }

            return `${dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")} ip未发生变化`
        })
        .then((message) => {
            console.log(message)
            console.log(`${dateFormat(new Date(), "yyyy-mm-dd hh:MM:ss")} 检测完毕`)
        })
        .catch((err) => {
            console.error(err)
        })
}

DDNS()
setInterval(DDNS, checkTime * 1000)

