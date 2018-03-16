'use strict';

const Koa = require('koa');
const hap = require('../');


const app = new Koa();

app.use(hap('./api', {
  basePath: '/api',
  extension: '.js',
  delayLoad: false,
}));

app.listen(3000);
