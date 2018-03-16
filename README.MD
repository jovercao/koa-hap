# koa-api

## koa-api介绍

## 关于koa-hap
koa-api是基于[`hap协议`](#hap协议)的实现，以文件目录及文件名为目录的约定默认url映射，提供一套koa的中间件，仅支持koa2。

> 注意，--不支持koa 1.0--

### 快速开始

#### 安装

```bash
npm install koa-hap
```

#### 使用

```js
// koa app.js

import Koa from 'koa'
import koaHap from 'koa-hap'

const app = new Koa()

//使用中间件
app.use(koaHap('apis', {
  basePath: '/api', // http url path, default is '/api'
  extension: '*.js|*.es6', // string或者RegExp类型
}))

app.listen(3000)
// ...

```

#### 配合koa-router使用

```js
// koa app.js

import Koa from 'koa'
import Router from 'koa-router'
import koaHap from 'koa-hap'

const app = new Koa()

const router = new Router()

//使用中间件
router.perfix('/api').use(koaHap('apis', {
  basePath: 'test', // api根url被转为: /api/test
  extension: '*.js|*.es6', // string或者RegExp类型
}))

app.use(router)

app.listen(3000)
// ...

```

### API

koa-hap只包含一个入口函数 `function koaHap(apiPath, options)`

参数名|类型|描述
|---|---|---|
apiPath|string|api程序文件路径
options|object|配置选项

返回
[koa - middleware](https://www.npmjs.com/package/koa#middleware) 函数，该函数有一个`handlers`, 该属性存放apiPath映射后的对象，其结构如下：

```js
{
  auth: {
    index: Function, // 验证程序，可以通过 url /api/auth 或者 /api/auth/index 调用
    login: Function, // 用户登录，可以通过 url /api/auth/login调用
    logout: Function // 注销登录，可以通过 url /api/auth/login调用
    // ...
  },
  // ...
}
```

当启用`delayLoad`时，该项将为空一个对象{}

options 说明
属性名|类型|默认值|描述
|---|---|---|---|
basePath|string|"/api"|http服务中绑定到的url，可以指定到"/"，这样该koa将会被完全占用
extension|string/RegExp|"*.js"|字符串格式:"*.js&#124;*.es6"，如果apiPath下有发现不符合hap协议的程序文件，中间件将报错处理。***注意：如果您使用了ES6，除非您配置了babel，否则并不会自动转码，将会抛出异常***
delayLoad|boolean|false|延迟加载，如果配置了该项，服务将动态查找对应的程序文件执行。这样可以提高服务启动速度。***需要注意的是这样并不安全，你还需要严密监测apiPath下的文件变化，并且不会返回映射结构，--除非特殊要求，否则不建议开启此项--***

### apiPath映射约定

例如下目录结构

```fs
/api
  ├╌ sys  --目录
  ╎  ├╌╌ auth.js   --js文件
  ╎  ╎      ├╌╌ #login   --函数
  ╎  ╎      └╌╌ #logout  --函数
  ╎  └╌╌ access.js
  ╎        ├╌╌ #index  --函数
  ╎        ├╌╌ #valid    --函数
  ╎        └╌╌ #update   --函数
  ├╌ erp  --目录
  ...
```

将会被映射为以下结构

```js
{
  sys: {
    auth: {
      login: ...,
      logout: ...,
    },
    access(): {      // 通过 url "/api/sys/access" 调用
      valid: ...,    // 通过 url "/api/sys/access/valid" 调用
      update: ...,   // 通过 url "/api/sys/access/update" 调用
    }
  }
}
```

如果一个目录下面同时有一个程序文件，并且又有另一个同名文件夹，并且其子目录中的存一个与上级目录程序文件相同的文件名，同时还定义了index函数，此时将会导致冲突，koa-hap不允许这种情况该生，程序将抛出异常。***需要注意的是另一种情况，当我们启动了延迟加载`delayLoad`的时候，再访问这个有冲突的函数，这时候不会抛出异常，而是使会优先用较上一层级的程序文件。***
例如：

```fs
api
  ├╌ sys  --目录
  ╎  ├╌╌ access.js             --文件
  ╎  ╎      ├╌╌ #rights        --函数  冲突
  ╎  ╎      └╌╌ #logout        --函数
  ╎  └╌╌ access                --目录
  ╎        └╌╌ rights.js       --文件
  ╎              ├╌╌ #index    --函数, 冲突
  ╎              └╌╌ #update   --函数
  ...
```


## hap协议

- 以http的POST方式为提交数据
- 以json为数据传输格式
- 以url为调用位置描述
- url节(即两个`/`之间)只允许标识符,验证规则：`/^([a-zA-Z]+[0-9]*)+$/`，多级使用/划分。
  - 合法url示例: /api/foo/bar, /api/foo#bar
  - 非法url示例: /api/foo-bar, /api/fooBar
- url末端可以使用`#`划分
  - 例如: /api/auth#login   /api/auth#logout
  - /api#auth#login 此url非法.
- hap不规定除以上规定以外的项，即header，cookie,均由用户自行决定。

**request**

```json
{
  "arg1": ...,
  "arg2": ...
}
```

**response**
```json
{
  //表示此次是否调用成功，如果不成功，则却要
  "success": false,
  // 错误消息，如果调用不成功，应该返回错误信息
  "errMsg": "发生了错误",
  // 错误数据，错误信息类型为任意类型，可以在此项存放错误信息，不用时可以省略
  "errData": {
    "code": "01"
  },
  // 接口返回值，如果没有返回值或者发生了错误，可以省略此项
  "data": null
}
```

- 无论任何情况，服务端应该尽量确保http请求正常返回200，如果遇到错误，则返回一个标准的json对象，并标示错误信息
例：

***范例：***

**request**

```http

POST /api/auth/login HTTP/1.1
...
Accept: application/json
Content-Type: application/json;charset=UTF-8
...
------------------body---------------------------
{
  username: "admin",
  password: "123"
}
```

**response**

```http
HTTP/1.1 200 OK
...
content-type: application/json; charset=utf-8
...
---------------------body----------------------
{
  "success":true,
  "data":
  {
    "username":"admin",
    "loginTime":"2018-03-15T07:34:29.308Z"
  }
}

```
