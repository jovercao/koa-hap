'use strict';

const fs = require('fs');
const path = require('path');
const { json } = require('co-body');
const process = require('process');
const util = require('util');

function exists(path) {
  try {
    fs.statSync(path);
    return true;
  } catch (ex) {
    return false;
  }
}

function isFile(apath) {
  return fs.statSync(apath).isFile();
}

function isDir(apath) {
  return fs.statSync(apath).isDirectory();
}

function getExtReg(extension) {
  let reg = extension;
  if (!reg) {
    reg = '.js';
  }

  if (typeof reg === 'string') {
    let exp = '^(.*)(';
    let isFirst = true;
    for (const ext of reg.split('|')) {
      if (!isFirst) {
        exp += '|';
      } else {
        isFirst = false;
      }

      exp += `(${ext.replace(/\**/g, '').replace('.', '\\.')})`;
    }
    exp += ')$';
    reg = new RegExp(exp);
  }

  return reg.compile(reg);
}

module.exports = function(apiPath, { basePath, extension, delayLoad }) {
  const rootPath = basePath.startsWith('/') ? basePath : '/' + basePath;
  const handlers = { __path: rootPath };
  const cache = {};

  const pathNodeReg = /^([a-zA-Z]+[0-9]*)+$/;
  pathNodeReg.compile(pathNodeReg);

  // const validPath = function (path) {
  //   let pathNodes = pathNodeReg.split('/');
  //   for (let i = 1; i < pathNodes.lenght; i++) {
  //     if (!pathNodeReg.test(pathNodes[i])) {
  //       return false;
  //     }
  //   }

  //   return true;
  // }

  // 缓存文件模块
  const cacheFileModule = function(fileModule, urlPath, filePath, existsNode) {
    let xNode = existsNode;
    // 检测冲突
    if (util.isFunction(fileModule.index)) {
      if (xNode) {
        throw new Error(
          `url绑定冲突： url - ${urlPath} 已被绑定。${filePath}的绑定无效！`
        );
      }
      xNode = fileModule.index;
      xNode.__path = urlPath;
      cache[urlPath] = xNode;
      // node.index = fileHandler.index,
    }

    if (!xNode) {
      xNode = {};
    }

    xNode.__file = filePath;

    for (const key in fileModule) {
      const handler = fileModule[key];
      if (util.isFunction(handler)) {
        if (!pathNodeReg.test(key)) {
          throw new Error(`文件${filePath}名称${key}不符合HAP协议规定!`);
        }
        handler.__path = urlPath + '/' + key;
        cache[handler.__path] = handler;
        xNode[key] = handler;
      }
    }

    return xNode;
  };

  const loadHandlers = () => {
    const extReg = getExtReg(extension);
    const loadNode = (curPath, curNode) => {
      const files = fs.readdirSync(curPath);
      const dirs = [];
      // 优先处理文件
      for (const file of files) {
        const fullPath = path.join(curPath, file);
        // 如何保证文件在文件夹前面？
        if (isFile(fullPath) && extReg.test(file)) {
          // 去除扩展名
          const nodeName = path.basename(file).replace(extReg, '$1');
          if (!pathNodeReg.test(nodeName)) {
            throw new Error(
              `目录名或者文件名${fullPath}, ${nodeName}不符合hap协议规定！`
            );
          }
          if (curNode[nodeName]) {
            throw new Error(`${fullPath}路径冲突！`);
          }
          let fileHandler;
          try {
            fileHandler = require(fullPath);
          } catch (err) {
            throw new Error(`在加载文件${fullPath}时发生错误：${err}`);
          }
          // url路径
          const urlPath = curNode.__path + '/' + nodeName;

          curNode[nodeName] = cacheFileModule(
            fileHandler,
            urlPath,
            fullPath,
            curNode[nodeName]
          );

          continue;
        }

        dirs.push(file);
      }

      // 再处理文件夹，以免路径成为对象导致无法调用
      for (const dirname of dirs) {
        const fullPath = path.join(curPath, dirname);

        if (isDir(fullPath)) {
          const nodeName = path.basename(dirname);
          if (!curPath[nodeName]) {
            curNode[nodeName] = {
              __file: fullPath,
            };
          }
          // 记录path
          // curNode[nodeName].__path = curNode.path + '/' + nodeName;
          loadNode(fullPath, curNode[nodeName]);
        }
      }
    };

    const curPath = path.resolve(apiPath);
    loadNode(curPath, handlers);
  };

  const getHandler = reqPath => {
    if (!delayLoad) {
      return cache[reqPath];
    }

    if (cache[reqPath]) {
      return reqPath;
    }

    const extensions = extension.split('|');
    const getExistsFile = function(apath) {
      let existsFile;
      extensions.find(ext => {
        if (exists(apath + ext)) {
          existsFile = apath + ext;
          return true;
        }
      });
      return existsFile;
    };

    let methodName;
    let filePath = getExistsFile(path.resolve(apiPath, reqPath));

    if (!filePath) {
      filePath = getExistsFile(path.resolve(apiPath, path.dirname(reqPath)));
      methodName = path.basename(reqPath);
    }

    // 找不到文件
    if (!filePath) {
      return;
    }

    let fileModule;
    try {
      console.log(`正在加载程序文件"${filePath}"`);
      fileModule = require(filePath);
    } catch (err) {
      throw new Error(`在加载HAP程序文件${filePath}时遇到错误错误：${err}`);
    }

    const handler = fileModule[methodName || 'index'];
    if (util.isFunction(handler)) {
      cache[reqPath] = handler;
      return handler;
    }
  };

  if (delayLoad) {
    console.warn(
      '[WARN] - 启用延迟加载可以加载服务启动速度（适用于对启动速度要求较高的环境），但是可能导致未知代码被动态调用，请严格管理 basePath 目录下的文件变化，同时要做好攻击防范，因为调用不存在的服务会消耗服务器性能（查找文件）。url绑定冲突不会被提前检测到。'
    );
  } else {
    loadHandlers();
  }


  console.log(handlers);
  console.log(cache);

  const urlPathReg = new RegExp(`^${rootPath}/.*`);
  urlPathReg.compile(urlPathReg);

  const middleware = async function(ctx, next) {
    const { path, body, method } = ctx.request;
    if (!urlPathReg.test(path)) {
      return await next();
    }

    const handler = getHandler(path);
    if (!handler) {
      await next();
    }

    // 名称不符合规范，交回权限 对性能有所损耗，暂时停用
    // if (!validPath(path)) {
    //   return await next();
    // }

    if (method !== 'POST') {
      ctx.body = {
        success: false,
        errMsg:
          'HAP is only allow POST http request pls read hap doc at http://github.com/jovercao/koa-hap.',
      };
      return;
    }

    if (!ctx.is('json')) {
      ctx.body = {
        success: false,
        errMsg:
          'HAP is ony allow JSON body pls read hap doc at http://github.com/jovercao/koa-hap.',
      };
      return;
    }

    let arg = body;
    // 如果body尚未被接收
    if (!arg) {
      arg = await json(ctx.request);
      // throw new Error('koa-api need to use ctx.request.body e.g. `koa-body` - http://github.com/dlau/koa-body.');
    }


    // 调用程序
    try {
      let data = await handler(body, ctx);
      const ret = {
        data
      };
      ctx.status = 200;
    } catch (err) {
      const ret = {
        success: false,
        errMsg: err.message,
      };

      if (process.env.NODE_ENV === 'developement') {
        if (err.data) {
          ret.errData = err.data;
        }
      }
      ctx.body = ret;
    }

    console.log(ctx.response);

  };

  middleware.handlers = handlers;

  return middleware;
};

// TODO: 调用POST调用所有程序。
// TODO: 考虑将程序文件放在指定环境执行，提供模块级别的上下文对象，而不是函数级别的ctx。
